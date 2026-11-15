"""Metadata-first Google Street View proxy; never stores or modifies imagery.

Official contracts verified:
https://developers.google.com/maps/documentation/streetview/request-streetview
https://developers.google.com/maps/documentation/streetview/metadata

Clients must show the full uncropped image (including Google's attribution),
plus attribution/date below it. Street View is nearby imagery, not proof of
property identity or current condition. Limits are per process; configure a
Google project quota as the shared cost ceiling for multiple workers/replicas.
"""
import asyncio
import base64
from collections import deque
import json
import math
import re
from threading import Lock
import time

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import get_settings

router = APIRouter(tags=['property-photo'])
METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata'
IMAGE_URL = 'https://maps.googleapis.com/maps/api/streetview'
MAX_METADATA_BYTES = 64 * 1024
MAX_IMAGE_BYTES = 2 * 1024 * 1024
PER_MINUTE = 10
PER_HOUR = 50
MAX_CLIENTS = 4096
_requests: dict[str, deque[float]] = {}
_lock = Lock()


def reserve_request(client: str) -> int:
    """Reserve before any provider I/O; return retry seconds, or zero if allowed."""
    now = time.monotonic()
    with _lock:
        expired = [key for key, times in _requests.items() if times[-1] <= now - 3600]
        for key in expired:
            del _requests[key]
        if client not in _requests:
            if len(_requests) >= MAX_CLIENTS:
                return 60  # Fail closed instead of evicting active cost limits.
            _requests[client] = deque()
        times = _requests[client]
        while times and times[0] <= now - 3600:
            times.popleft()
        if len(times) >= PER_HOUR:
            return max(1, math.ceil(times[0] + 3600 - now))
        recent = [stamp for stamp in times if stamp > now - 60]
        if len(recent) >= PER_MINUTE:
            return max(1, math.ceil(recent[0] + 60 - now))
        times.append(now)
        return 0


def result(status, *, image=None, attribution='', date=None, code=200, retry=None):
    payload = {'status': status, 'attribution': attribution, 'date': date}
    if status == 'available':
        payload['image'] = image
    headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
    if retry:
        headers['Retry-After'] = str(retry)
    return JSONResponse(payload, status_code=code, headers=headers)


async def bounded_get(client, url, params, limit, *, jpeg=False):
    async with client.stream('GET', url, params=params) as response:
        response.raise_for_status()  # Redirects are never followed.
        if jpeg and response.headers.get('content-type', '').split(';')[0].strip().lower() != 'image/jpeg':
            raise ValueError('Not a JPEG')
        length = response.headers.get('content-length')
        if length is not None and (int(length) < 0 or int(length) > limit):
            raise ValueError('Response exceeds limit')
        data = bytearray()
        async for chunk in response.aiter_bytes():
            if len(data) + len(chunk) > limit:
                raise ValueError('Response exceeds limit')
            data.extend(chunk)
        return bytes(data)


@router.get('/api/property-photo')
async def property_photo(request: Request, address: str = ''):
    # Validate here so every endpoint response, including invalid input, is no-store.
    if len(address) > 300 or any(ord(char) < 32 or ord(char) == 127 for char in address):
        return result('unavailable', code=422)
    address = address.strip()
    if len(address) < 5:
        return result('unavailable', code=422)
    key = get_settings().google_street_view_api_key
    if not key:
        return result('not_configured')
    # Use ASGI's client identity; never trust caller-supplied forwarding headers here.
    retry = reserve_request(request.client.host if request.client else 'unknown')
    if retry:
        return result('unavailable', code=429, retry=retry)
    params = {'location': address, 'key': key, 'source': 'outdoor', 'radius': '50'}
    try:
        async with asyncio.timeout(15):
            async with httpx.AsyncClient(timeout=httpx.Timeout(8, connect=3), follow_redirects=False, trust_env=False) as client:
                metadata = json.loads(await bounded_get(client, METADATA_URL, params, MAX_METADATA_BYTES))
                if not isinstance(metadata, dict) or metadata.get('status') != 'OK':
                    return result('unavailable')
                # Keep location, omit heading so Google aims at the entered address.
                image = await bounded_get(client, IMAGE_URL,
                    {**params, 'size': '640x400', 'fov': '80', 'return_error_code': 'true'},
                    MAX_IMAGE_BYTES, jpeg=True)
                if not image.startswith(b'\xff\xd8\xff') or not image.endswith(b'\xff\xd9'):
                    return result('unavailable')
                attribution = metadata.get('copyright')
                if not isinstance(attribution, str) or not attribution.strip() or len(attribution) > 500:
                    attribution = '© Google Street View'
                date = metadata.get('date')
                if not isinstance(date, str) or not re.fullmatch(r'\d{4}(?:-(?:0[1-9]|1[0-2]))?', date):
                    date = None
                return result('available', image='data:image/jpeg;base64,' + base64.b64encode(image).decode('ascii'),
                              attribution=attribution, date=date)
    except (httpx.HTTPError, TimeoutError, ValueError):
        # Provider URLs/errors may contain the key; neither log nor return them.
        return result('unavailable')
