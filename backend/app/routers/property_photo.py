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
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import math
import re
from threading import Lock
import time
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.address_normalization import contains_exact_street, normalize_street_address, normalize_text, normalize_state, normalize_zip
from app.ocr.document_urls import PinnedHTTPSConnection, public_destination

router = APIRouter(tags=['property-photo'])
METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata'
IMAGE_URL = 'https://maps.googleapis.com/maps/api/streetview'
MAX_METADATA_BYTES = 64 * 1024
MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_CRAWL4AI_BYTES = 512 * 1024
CRAWL4AI_SEARCH_URL = 'https://api.crawl4ai.com/tools/search'
CRAWL4AI_SCRAPE_URL = 'https://api.crawl4ai.com/tools/scrape'
TRUSTED_LISTING_DOMAINS = {
    'zillow.com': 'Zillow',
    'redfin.com': 'Redfin',
    'realtor.com': 'Realtor.com',
}
PER_MINUTE = 10
PER_HOUR = 50
MAX_CLIENTS = 4096
_requests: dict[str, deque[float]] = {}
_lock = Lock()
_image_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix='vpsf-property-photo')


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


def result(status, *, image=None, attribution='', date=None, source_url=None, code=200, retry=None):
    payload = {'status': status, 'attribution': attribution, 'date': date}
    if status == 'available':
        payload['image'] = image
        if source_url:
            payload['sourceUrl'] = source_url
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


def address_identity(address):
    parts = [part.strip() for part in address.split(',')]
    street = normalize_street_address(parts[0] if parts else '')
    city = normalize_text(parts[1] if len(parts) > 1 else '')
    region = parts[2] if len(parts) > 2 else ''
    state = normalize_state(re.sub(r'\b\d{5}(?:-\d{4})?\b', '', region).strip())
    zip_code = normalize_zip(region)
    return street, city, state, zip_code


def normalized_candidate_text(value):
    value = re.sub(r'[-_/]+', ' ', str(value or '').lower())
    return normalize_street_address(value)


def trusted_provider(url):
    try:
        host = (urlsplit(url).hostname or '').lower()
    except ValueError:
        return None
    for domain, label in TRUSTED_LISTING_DOMAINS.items():
        if host == domain or host.endswith('.' + domain):
            return label
    return None


def select_crawl4ai_listing_page(data, address):
    """Choose only an exact-address page from a known listing source."""
    street, city, state, zip_code = address_identity(address)
    if not street or not city or (not state and not zip_code):
        return None
    entered_has_unit = bool(re.search(r'\b(?:apt|apartment|unit|suite)\b|#\s*\w+', street))
    for candidate in data.get('rows', []) if isinstance(data, dict) else []:
        if not isinstance(candidate, dict):
            continue
        page_url = candidate.get('url')
        provider = trusted_provider(page_url)
        if not provider:
            continue
        text = normalized_candidate_text(
            f"{candidate.get('title', '')} {candidate.get('snippet', '')} {page_url}")
        if not contains_exact_street(text, street) or city not in text:
            continue
        if not (zip_code and zip_code in text) and not (state and re.search(rf'\b{re.escape(state.lower())}\b', text)):
            continue
        if not entered_has_unit and re.search(r'\b(?:apt|apartment|unit|suite)\s+\w+\b', text):
            continue
        return {**candidate, 'provider': provider}
    return None


def listing_image_url(data):
    """Read an Open Graph image from Crawl4AI's parsed metadata or returned HTML."""
    payload = data.get('data') if isinstance(data, dict) else None
    if not isinstance(payload, dict):
        return None
    metadata = payload.get('metadata')
    if isinstance(metadata, dict):
        for key in ('og:image', 'ogImage', 'og_image', 'twitter:image', 'twitterImage', 'image'):
            value = metadata.get(key)
            if isinstance(value, str) and value.startswith('https://'):
                return value
    html = payload.get('html')
    if not isinstance(html, str) or len(html) > MAX_CRAWL4AI_BYTES:
        return None
    soup = BeautifulSoup(html, 'html.parser')
    for attribute, value in (('property', 'og:image'), ('name', 'twitter:image')):
        tag = soup.find('meta', attrs={attribute: value})
        image_url = tag.get('content') if tag else None
        if isinstance(image_url, str) and image_url.startswith('https://'):
            return image_url
    return None


def image_dimensions(mime, data):
    """Return dimensions for common listing image formats without decoding pixels."""
    if mime == 'image/png' and len(data) >= 24 and data.startswith(b'\x89PNG\r\n\x1a\n'):
        return int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')
    if mime == 'image/jpeg' and data.startswith(b'\xff\xd8'):
        index = 2
        start_of_frame = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
        while index + 4 <= len(data):
            if data[index] != 0xFF:
                index += 1
                continue
            while index < len(data) and data[index] == 0xFF:
                index += 1
            if index >= len(data):
                break
            marker = data[index]
            index += 1
            if marker in {0x01, 0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
                continue
            if index + 2 > len(data):
                break
            length = int.from_bytes(data[index:index + 2], 'big')
            if length < 2 or index + length > len(data):
                break
            if marker in start_of_frame and length >= 7:
                return (int.from_bytes(data[index + 5:index + 7], 'big'),
                        int.from_bytes(data[index + 3:index + 5], 'big'))
            index += length
    return None


def _download_public_image(url):
    """Fetch one public image with DNS pinning, bounded redirects and no cookies."""
    deadline = time.monotonic() + 12
    for _ in range(4):
        host, ip, path = public_destination(url)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError()
        connection = PinnedHTTPSConnection(host, ip, min(6, remaining))
        try:
            connection.connect()
            connection.request('GET', path, headers={
                'Accept': 'image/jpeg,image/png,image/webp',
                'Accept-Encoding': 'identity',
                'User-Agent': 'VPSF-Property-Photo/1.0',
            })
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader('Location')
                if not location:
                    return None
                url = urljoin(url, location)
                continue
            if response.status != 200:
                return None
            mime = response.getheader('Content-Type', '').split(';')[0].strip().lower()
            if mime not in {'image/jpeg', 'image/png', 'image/webp'}:
                return None
            length = response.getheader('Content-Length')
            if length and (not length.isdigit() or int(length) > MAX_IMAGE_BYTES):
                return None
            data = bytearray()
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError()
                if connection.sock is not None:
                    connection.sock.settimeout(max(0.05, remaining))
                chunk = response.read1(min(65536, MAX_IMAGE_BYTES + 1 - len(data)))
                if not chunk:
                    break
                data.extend(chunk)
                if len(data) > MAX_IMAGE_BYTES:
                    return None
            signatures = {
                'image/jpeg': bytes(data).startswith(b'\xff\xd8\xff') and bytes(data).endswith(b'\xff\xd9'),
                'image/png': bytes(data).startswith(b'\x89PNG\r\n\x1a\n'),
                'image/webp': bytes(data).startswith(b'RIFF') and bytes(data)[8:12] == b'WEBP',
            }
            if not data or not signatures[mime]:
                return None
            return mime, bytes(data)
        finally:
            connection.close()
    return None


async def _crawl4ai_json(client, url, headers, body):
    async with client.stream('POST', url, headers=headers, json=body) as response:
        response.raise_for_status()
        raw = bytearray()
        async for chunk in response.aiter_bytes():
            if len(raw) + len(chunk) > MAX_CRAWL4AI_BYTES:
                return None
            raw.extend(chunk)
    payload = json.loads(raw)
    return payload if isinstance(payload, dict) else None


async def crawl4ai_listing_photo(address, key=''):
    if not key:
        return None
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json',
               'Authorization': 'Bearer ' + key}
    async with httpx.AsyncClient(timeout=httpx.Timeout(12, connect=4), follow_redirects=False, trust_env=False) as client:
        search = await _crawl4ai_json(client, CRAWL4AI_SEARCH_URL, headers, {
            'q': f'"{address}" exterior home', 'rich': False, 'deep': False,
        })
        candidate = select_crawl4ai_listing_page(search, address)
        if not candidate:
            return None
        page = await _crawl4ai_json(client, CRAWL4AI_SCRAPE_URL, headers, {
            'url': candidate['url'], 'format': 'html', 'parse': ['metadata'], 'timeout': 8,
        })
    image_url = listing_image_url(page)
    if not image_url:
        return None
    try:
        downloaded = await asyncio.get_running_loop().run_in_executor(
            _image_executor, _download_public_image, image_url)
    except (HTTPException, OSError, http.client.HTTPException, TimeoutError, ValueError):
        return None
    if not downloaded:
        return None
    mime, image = downloaded
    dimensions = image_dimensions(mime, image)
    if not dimensions:
        return None
    width, height = dimensions
    if width < 400 or height < 250 or width < height * 1.1:
        return None
    return {
        'image': f'data:{mime};base64,' + base64.b64encode(image).decode('ascii'),
        'attribution': f"Exterior photo · {candidate['provider']}",
        'date': None,
        'sourceUrl': candidate['url'],
    }


@router.get('/api/property-photo')
async def property_photo(request: Request, address: str = ''):
    # Validate here so every endpoint response, including invalid input, is no-store.
    if len(address) > 300 or any(ord(char) < 32 or ord(char) == 127 for char in address):
        return result('unavailable', code=422)
    address = address.strip()
    if len(address) < 5:
        return result('unavailable', code=422)
    settings = get_settings()
    key = getattr(settings, 'google_street_view_api_key', '')
    # Use ASGI's client identity; never trust caller-supplied forwarding headers here.
    retry = reserve_request(request.client.host if request.client else 'unknown')
    if retry:
        return result('unavailable', code=429, retry=retry)
    params = {'location': address, 'key': key, 'source': 'outdoor', 'radius': '50'}
    try:
        async with asyncio.timeout(15):
            if key:
                async with httpx.AsyncClient(timeout=httpx.Timeout(8, connect=3), follow_redirects=False, trust_env=False) as client:
                    metadata = json.loads(await bounded_get(client, METADATA_URL, params, MAX_METADATA_BYTES))
                    if isinstance(metadata, dict) and metadata.get('status') == 'OK':
                        # Keep location, omit heading so Google aims at the entered address.
                        image = await bounded_get(client, IMAGE_URL,
                            {**params, 'size': '640x400', 'fov': '80', 'return_error_code': 'true'},
                            MAX_IMAGE_BYTES, jpeg=True)
                        if image.startswith(b'\xff\xd8\xff') and image.endswith(b'\xff\xd9'):
                            attribution = metadata.get('copyright')
                            if not isinstance(attribution, str) or not attribution.strip() or len(attribution) > 500:
                                attribution = '© Google Street View'
                            date = metadata.get('date')
                            if not isinstance(date, str) or not re.fullmatch(r'\d{4}(?:-(?:0[1-9]|1[0-2]))?', date):
                                date = None
                            return result('available', image='data:image/jpeg;base64,' + base64.b64encode(image).decode('ascii'),
                                          attribution=attribution, date=date)
            fallback = await crawl4ai_listing_photo(address, getattr(settings, 'crawl4ai_api_key', ''))
            if fallback:
                return result('available', image=fallback['image'], attribution=fallback['attribution'],
                              date=fallback.get('date'), source_url=fallback.get('sourceUrl'))
            return result('not_configured' if not key else 'unavailable')
    except (httpx.HTTPError, http.client.HTTPException, TimeoutError, ValueError, json.JSONDecodeError):
        # Provider URLs/errors may contain the key; neither log nor return them.
        return result('not_configured' if not key else 'unavailable')
