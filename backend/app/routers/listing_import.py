"""Public listing previews only; no JavaScript execution, login or challenge bypass.

JSON-LD fields follow https://schema.org/SingleFamilyResidence and
https://schema.org/floorSize. Missing values stay absent, never scoring defaults.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import http.client
import json
import re
import socket
from threading import BoundedSemaphore, Timer, Event
import time
from typing import Literal
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.ocr.document_urls import public_destination, PinnedHTTPSConnection

router = APIRouter(tags=['listing-import'])
MAX_BYTES = 2 * 1024 * 1024
DEADLINE = 20
DOMAINS = {'zillow': 'zillow.com', 'realtor': 'realtor.com', 'redfin': 'redfin.com'}
HOME_TYPES = {'SingleFamilyResidence', 'House', 'Apartment', 'Residence', 'Accommodation'}
FALLBACK = 'This public listing could not be read. Enter the address manually or upload listing documents. Login and CAPTCHA pages are not supported.'
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix='listing-import')
_slots = BoundedSemaphore(4)


class ListingRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    source: Literal['zillow', 'realtor', 'redfin', 'mls']
    url: str = Field(default='', max_length=4096)
    listingId: str = Field(default='', max_length=120)
    market: str = Field(default='', max_length=160)


def unavailable():
    return HTTPException(422, FALLBACK)


def validate_source_url(source, url):
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or '').encode('idna').decode('ascii').lower()
        if (len(url) > 4096 or parsed.scheme != 'https' or not host or parsed.username
                or parsed.password or parsed.port not in (None, 443)
                or any(ord(char) < 32 or ord(char) == 127 for char in url)):
            raise ValueError()
        domain = DOMAINS.get(source)
        if domain and host != domain and not host.endswith('.' + domain):
            raise ValueError()
        if source not in {*DOMAINS, 'mls'}:
            raise ValueError()
    except (ValueError, UnicodeError):
        raise unavailable()


def close_socket(sock):
    # shutdown interrupts buffered response reads even when HTTPConnection has
    # transferred ownership of a Connection: close socket to HTTPResponse.
    try:
        sock.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass


def download_listing(source, url):
    deadline = time.monotonic() + DEADLINE
    expired = Event()
    def expire(sock):
        expired.set()
        close_socket(sock)
    try:
        for _ in range(4):
            validate_source_url(source, url)
            host, ip, path = public_destination(url)  # DNS checked and pinned anew per redirect.
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise unavailable()
            connection = PinnedHTTPSConnection(host, ip, min(8, remaining))
            timer = None
            try:
                connection.connect()
                sock = connection.sock
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise unavailable()
                timer = Timer(remaining, expire, args=(sock,))
                timer.daemon = True
                timer.start()
                connection.request('GET', path, headers={'Accept': 'text/html', 'Accept-Encoding': 'identity', 'User-Agent': 'VPSF-Listing-Reader/1.0'})
                response = connection.getresponse()
                if expired.is_set():
                    raise unavailable()
                if response.status in (301, 302, 303, 307, 308):
                    location = response.getheader('Location')
                    if not location:
                        raise unavailable()
                    url = urljoin(url, location)
                    continue
                if response.status != 200:
                    raise unavailable()
                mime = response.getheader('Content-Type', '').split(';')[0].strip().lower()
                if mime not in {'text/html', 'application/xhtml+xml'}:
                    raise unavailable()
                if response.getheader('Content-Encoding', 'identity').lower() not in {'', 'identity'}:
                    raise unavailable()
                length = response.getheader('Content-Length')
                if length is not None and (int(length) < 0 or int(length) > MAX_BYTES):
                    raise unavailable()
                data = bytearray()
                while True:
                    remaining = deadline - time.monotonic()
                    if expired.is_set() or remaining <= 0:
                        raise unavailable()
                    sock.settimeout(min(8, remaining))
                    chunk = response.read1(min(65536, MAX_BYTES + 1 - len(data)))
                    if not chunk:
                        break
                    data.extend(chunk)
                    if len(data) > MAX_BYTES:
                        raise unavailable()
                if expired.is_set() or time.monotonic() >= deadline:
                    raise unavailable()
                html = data.decode('utf-8', errors='replace')
                visible = BeautifulSoup(html, 'html.parser').get_text(' ', strip=True).lower()
                if visible == 'captcha' or any(marker in visible for marker in ('verify you are human', 'verify that you are human', 'access to this page has been denied', 'sign in to view this listing', 'log in to view this listing')):
                    raise unavailable()
                return html
            finally:
                if timer:
                    timer.cancel()
                connection.close()
        raise unavailable()
    except (OSError, http.client.HTTPException, ValueError, UnicodeError, HTTPException):
        raise unavailable() from None


def text_value(value, maximum=300):
    if isinstance(value, str) and 0 < len(value.strip()) <= maximum and not any(ord(c) < 32 for c in value):
        return value.strip()
    return None


def number(value, minimum, maximum, integer=False):
    if isinstance(value, dict):
        value = value.get('value')
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    raw = str(value).strip()
    if not re.fullmatch(r'(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?', raw):
        return None
    numeric = float(raw.replace(',', ''))
    if not minimum <= numeric <= maximum or (integer and not numeric.is_integer()):
        return None
    return str(int(numeric)) if numeric.is_integer() else str(numeric)


def home_facts(node):
    address = node.get('address')
    facts = {}
    if isinstance(address, dict):
        for source, target in [('streetAddress', 'address'), ('addressLocality', 'city'), ('addressRegion', 'state'), ('postalCode', 'zip')]:
            value = text_value(address.get(source))
            if value:
                facts[target] = value
    elif text_value(address):
        facts['address'] = address.strip()
    if 'address' not in facts:
        return {}
    for source, target, minimum, maximum, integer in [
        ('yearBuilt', 'yearBuilt', 1600, datetime.now(timezone.utc).year + 5, True),
        ('numberOfBedrooms', 'bedrooms', 0, 100, True),
        ('numberOfBathroomsTotal', 'bathrooms', 0, 100, False),
    ]:
        value = number(node.get(source), minimum, maximum, integer)
        if value is not None:
            facts[target] = value
    area = node.get('floorSize')
    if isinstance(area, dict):
        unit = str(area.get('unitCode') or area.get('unitText') or '').lower().strip()
        if unit in {'ftk', 'sqft', 'sq ft', 'square feet', 'square foot', 'ft²'}:
            value = number(area.get('value'), 100, 1000000)
            if value:
                facts['squareFeet'] = value
    return facts


def parse_listing(html):
    if len(html.encode('utf-8')) > MAX_BYTES:
        raise unavailable()
    soup = BeautifulSoup(html, 'html.parser')
    candidates = []
    for script in soup.find_all('script', attrs={'type': 'application/ld+json'}, limit=64):
        try:
            root = json.loads(script.string or '')
        except (ValueError, RecursionError):
            continue
        stack, visited = [(root, 0)], 0
        while stack and visited < 5000:
            node, depth = stack.pop()
            visited += 1
            if depth > 30:
                continue
            if isinstance(node, dict):
                types = node.get('@type', [])
                types = [types] if isinstance(types, str) else types
                if isinstance(types, list) and any(isinstance(kind, str) and kind.rsplit('/', 1)[-1] in HOME_TYPES for kind in types):
                    facts = home_facts(node)
                    if facts:
                        candidates.append(facts)
                stack.extend((child, depth + 1) for child in node.values() if isinstance(child, (dict, list)))
            elif isinstance(node, list):
                stack.extend((child, depth + 1) for child in node)
    identities = {tuple(item.get(key, '').casefold() for key in ('address', 'city', 'state', 'zip')) for item in candidates}
    if len(identities) != 1:
        raise unavailable()  # Never choose an arbitrary result or nearby/recommended home.
    merged = {}
    for field in ('address', 'city', 'state', 'zip', 'squareFeet', 'yearBuilt', 'bedrooms', 'bathrooms'):
        values = {item[field] for item in candidates if field in item}
        if len(values) == 1:
            merged[field] = values.pop()
    return merged


@router.post('/api/listing-import')
async def listing_import(payload: ListingRequest):
    url = payload.url.strip()
    if not url:
        if payload.source == 'mls':
            raise HTTPException(422, 'MLS ID lookup is unavailable: no MLS provider is connected for this market. Paste a public listing HTTPS URL, enter the address manually, or upload documents.')
        raise HTTPException(422, 'Paste a public HTTPS listing URL, or enter the address manually.')
    validate_source_url(payload.source, url)
    if not _slots.acquire(blocking=False):
        raise HTTPException(422, 'Listing import is busy. Try again shortly, enter the address manually, or upload documents.')
    try:
        future = _pool.submit(download_listing, payload.source, url)
    except BaseException:
        _slots.release()
        raise
    # Keep the slot until the worker actually ends, even after timeout/disconnect.
    future.add_done_callback(lambda _: _slots.release())
    try:
        html = await asyncio.wait_for(asyncio.wrap_future(future), timeout=DEADLINE + 1)
    except TimeoutError:
        raise unavailable() from None
    facts = parse_listing(html)
    return JSONResponse({'facts': facts, 'sourceNote': 'Extracted from public listing JSON-LD. Review every field; bathroom totals follow the listing data. No score has changed.'}, headers={'Cache-Control': 'no-store'})
