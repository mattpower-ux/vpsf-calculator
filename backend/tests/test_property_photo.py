"""Mock Google only: no addresses, imagery, or secrets leave this test suite."""
import base64
import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import property_photo as photo


JPEG = b'\xff\xd8\xff\xe0unaltered-google-attribution\xff\xd9'


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(photo, 'get_settings', lambda: SimpleNamespace(
        google_street_view_api_key='test-secret', crawl4ai_api_key=''))
    async def no_fallback(*args, **kwargs):
        return None
    monkeypatch.setattr(photo, 'crawl4ai_listing_photo', no_fallback)
    photo._requests.clear()
    app = FastAPI()
    app.include_router(photo.router)
    return TestClient(app)


def provider(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(photo.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


def test_metadata_precedes_image_and_parameters_target_address(client, monkeypatch):
    calls = []
    def handle(request):
        calls.append(request)
        assert request.url.host == 'maps.googleapis.com'
        assert request.url.params['key'] == 'test-secret'
        assert request.url.params['location'] == '123 Example Street, Denver, CO'
        assert request.url.params['source'] == 'outdoor'
        assert request.url.params['radius'] == '50'
        assert 'heading' not in request.url.params
        if request.url.path.endswith('/metadata'):
            return httpx.Response(200, json={'status': 'OK', 'copyright': '© Google', 'date': '2025-06'})
        assert len(calls) == 2
        assert request.url.params['size'] == '640x400'
        assert request.url.params['fov'] == '80'
        assert request.url.params['return_error_code'] == 'true'
        return httpx.Response(200, content=JPEG, headers={'content-type': 'image/jpeg'})
    provider(monkeypatch, handle)
    response = client.get('/api/property-photo', params={'address': '  123 Example Street, Denver, CO  '})
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    assert response.json() == {'status': 'available', 'image': 'data:image/jpeg;base64,' + base64.b64encode(JPEG).decode(), 'attribution': '© Google', 'date': '2025-06'}
    assert 'test-secret' not in response.text


def test_missing_key_never_calls_google(client, monkeypatch):
    monkeypatch.setattr(photo, 'get_settings', lambda: SimpleNamespace(
        google_street_view_api_key='', crawl4ai_api_key=''))
    provider(monkeypatch, lambda request: pytest.fail('No provider request without key'))
    response = client.get('/api/property-photo', params={'address': '123 Example Street'})
    assert response.json()['status'] == 'not_configured'
    assert 'image' not in response.json()
    assert response.headers['cache-control'] == 'no-store'


def test_missing_street_view_key_uses_exact_crawl4ai_listing_photo(client, monkeypatch):
    monkeypatch.setattr(photo, 'get_settings', lambda: SimpleNamespace(
        google_street_view_api_key='', crawl4ai_api_key='c4-test'))
    provider(monkeypatch, lambda request: pytest.fail('Google must not be called without a key'))
    async def fallback(address, key):
        assert address == '22 Dow St, Portland, ME 04102'
        assert key == 'c4-test'
        return {
            'image': 'data:image/jpeg;base64,ZmFrZQ==',
            'attribution': 'Exterior photo · Redfin',
            'date': None,
            'sourceUrl': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1',
        }
    monkeypatch.setattr(photo, 'crawl4ai_listing_photo', fallback)
    response = client.get('/api/property-photo', params={'address': '22 Dow St, Portland, ME 04102'})
    assert response.status_code == 200
    assert response.json() == {
        'status': 'available',
        'image': 'data:image/jpeg;base64,ZmFrZQ==',
        'attribution': 'Exterior photo · Redfin',
        'date': None,
        'sourceUrl': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1',
    }


def test_configured_crawl4ai_failure_is_unavailable_not_not_configured(client, monkeypatch):
    monkeypatch.setattr(photo, 'get_settings', lambda: SimpleNamespace(
        google_street_view_api_key='', crawl4ai_api_key='c4-test'))
    async def no_photo(*args, **kwargs):
        return None
    monkeypatch.setattr(photo, 'crawl4ai_listing_photo', no_photo)
    response = client.get('/api/property-photo', params={'address': '22 Dow St, Portland, ME 04102'})
    assert response.json()['status'] == 'unavailable'


def test_google_zero_results_falls_back_to_crawl4ai(client, monkeypatch):
    provider(monkeypatch, lambda request: httpx.Response(200, json={'status': 'ZERO_RESULTS'}))
    async def fallback(address, key):
        return {'image': 'data:image/jpeg;base64,ZmFrZQ==', 'attribution': 'Exterior photo · Realtor.com', 'date': None}
    monkeypatch.setattr(photo, 'crawl4ai_listing_photo', fallback)
    data = client.get('/api/property-photo', params={'address': '22 Dow St, Portland, ME 04102'}).json()
    assert data['status'] == 'available'
    assert data['attribution'] == 'Exterior photo · Realtor.com'


def test_crawl4ai_listing_page_requires_exact_address_and_excludes_units():
    results = {'rows': [
        {'title': '20 Dow St, Portland, ME 04102', 'url': 'https://www.redfin.com/ME/Portland/20-Dow-St/home/1'},
        {'title': '22 Dow St Apt 3, Portland, ME 04102', 'url': 'https://www.zillow.com/homedetails/22-Dow-St-APT-3/1_zpid/'},
        {'title': '22 Dow St, Portland, ME 04102', 'url': 'https://www.realtor.com/realestateandhomes-detail/22-Dow-St_Portland_ME_04102'},
    ]}
    candidate = photo.select_crawl4ai_listing_page(results, '22 Dow St, Portland, ME 04102')
    assert candidate['url'].startswith('https://www.realtor.com/')
    assert candidate['provider'] == 'Realtor.com'


def test_crawl4ai_listing_page_rejects_untrusted_result():
    results = {'rows': [
        {'title': '22 Dow St, Portland, ME 04102', 'url': 'https://example.com/property'},
    ]}
    assert photo.select_crawl4ai_listing_page(results, '22 Dow St, Portland, ME 04102') is None


def test_crawl4ai_listing_page_rejects_house_number_prefix():
    results = {'rows': [
        {'title': '122 Dow St, Portland, ME 04102', 'url': 'https://www.redfin.com/ME/Portland/122-Dow-St/home/1'},
    ]}
    assert photo.select_crawl4ai_listing_page(results, '22 Dow St, Portland, ME 04102') is None


def test_listing_image_dimensions_are_read_without_decoding_pixels():
    jpeg = b'\xff\xd8\xff\xc0\x00\x08\x08\x02\x58\x03\x84\x01\xff\xd9'
    png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 8 + (900).to_bytes(4, 'big') + (600).to_bytes(4, 'big')
    assert photo.image_dimensions('image/jpeg', jpeg) == (900, 600)
    assert photo.image_dimensions('image/png', png) == (900, 600)
    assert photo.image_dimensions('image/webp', b'not-a-webp') is None


def test_public_image_download_enforces_total_deadline_while_reading(monkeypatch):
    times = iter([0, 0, 1, 13])
    monkeypatch.setattr(photo.time, 'monotonic', lambda: next(times))
    monkeypatch.setattr(photo, 'public_destination', lambda url: ('images.example', '203.0.113.8', '/home.jpg'))
    reads = []

    class Socket:
        def settimeout(self, value):
            assert value > 0

    class Response:
        status = 200
        def getheader(self, name, default=None):
            return 'image/jpeg' if name == 'Content-Type' else default
        def read1(self, size):
            reads.append(size)
            return b'\xff\xd8\xffsmall-drip'

    class Connection:
        sock = Socket()
        def __init__(self, *args): pass
        def connect(self): pass
        def request(self, *args, **kwargs): pass
        def getresponse(self): return Response()
        def close(self): pass

    monkeypatch.setattr(photo, 'PinnedHTTPSConnection', Connection)
    with pytest.raises(TimeoutError):
        photo._download_public_image('https://images.example/home.jpg')
    assert len(reads) == 1


def test_crawl4ai_search_then_scrape_uses_exact_listing_and_returns_bounded_image(monkeypatch):
    search_payload = {'rows': [{
        'title': '22 Dow St, Portland, ME 04102',
        'url': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1',
        'snippet': '22 Dow St is a home in Portland, ME 04102.',
    }]}
    scrape_payload = {'data': {'html': (
        '<html><head><meta property="og:image" '
        'content="https://ssl.cdn-redfin.com/photo/home.jpg"></head></html>'
    )}}
    calls = []

    class Response:
        def raise_for_status(self):
            return None

        async def aiter_bytes(self):
            yield json.dumps(calls[-1][1]).encode()

    class Stream:
        async def __aenter__(self):
            return Response()

        async def __aexit__(self, *args):
            return None

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def stream(self, method, url, *, headers, json):
            assert method == 'POST'
            assert headers['Authorization'] == 'Bearer c4-test'
            if url == photo.CRAWL4AI_SEARCH_URL:
                assert json == {'q': '"22 Dow St, Portland, ME 04102" exterior home', 'rich': False, 'deep': False}
                calls.append((url, search_payload))
            else:
                assert url == photo.CRAWL4AI_SCRAPE_URL
                assert json == {
                    'url': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1',
                    'format': 'html',
                    'parse': ['metadata'],
                    'timeout': 8,
                }
                calls.append((url, scrape_payload))
            return Stream()

    monkeypatch.setattr(photo.httpx, 'AsyncClient', lambda **kwargs: Client())
    monkeypatch.setattr(photo, '_download_public_image', lambda url: ('image/jpeg', JPEG))
    monkeypatch.setattr(photo, 'image_dimensions', lambda mime, data: (900, 600))
    data = asyncio.run(photo.crawl4ai_listing_photo('22 Dow St, Portland, ME 04102', 'c4-test'))
    assert data['attribution'] == 'Exterior photo · Redfin'
    assert data['sourceUrl'].startswith('https://www.redfin.com/')
    assert data['image'] == 'data:image/jpeg;base64,' + base64.b64encode(JPEG).decode()


def test_crawl4ai_photo_tries_next_exact_listing_when_first_has_no_image(monkeypatch):
    scraped = []

    async def fake_json(_client, url, _headers, body):
        if url == photo.CRAWL4AI_SEARCH_URL:
            return {'rows': [
                {'title': '22 Dow St, Portland, ME 04102',
                 'url': 'https://www.realtor.com/realestateandhomes-detail/22-Dow-St_Portland_ME_04102'},
                {'title': '22 Dow St, Portland, ME 04102',
                 'url': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1'},
            ]}
        scraped.append(body['url'])
        if 'realtor.com' in body['url']:
            return {'data': {'metadata': {}}}
        return {'data': {'metadata': {'og:image': 'https://img.example/home.jpg'}}}

    monkeypatch.setattr(photo, '_crawl4ai_json', fake_json)
    monkeypatch.setattr(photo, '_download_public_image', lambda url: ('image/jpeg', JPEG))
    monkeypatch.setattr(photo, 'image_dimensions', lambda mime, data: (900, 600))
    data = asyncio.run(photo.crawl4ai_listing_photo('22 Dow St, Portland, ME 04102', 'c4-test'))
    assert data['sourceUrl'].startswith('https://www.redfin.com/')
    assert len(scraped) == 2


def test_crawl4ai_photo_rejects_small_or_portrait_download(monkeypatch):
    async def fake_json(*args, **kwargs):
        if args[1] == photo.CRAWL4AI_SEARCH_URL:
            return {'rows': [{'title': '22 Dow St, Portland, ME 04102',
                              'url': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1'}]}
        return {'data': {'metadata': {'og:image': 'https://img.example/portrait.jpg'}}}

    monkeypatch.setattr(photo, '_crawl4ai_json', fake_json)
    monkeypatch.setattr(photo, '_download_public_image', lambda url: ('image/jpeg', JPEG))
    monkeypatch.setattr(photo, 'image_dimensions', lambda mime, data: (300, 900))
    assert asyncio.run(photo.crawl4ai_listing_photo('22 Dow St, Portland, ME 04102', 'c4-test')) is None


def test_crawl4ai_photo_degrades_safely_for_non_public_image(monkeypatch):
    async def fake_json(*args, **kwargs):
        if args[1] == photo.CRAWL4AI_SEARCH_URL:
            return {'rows': [{'title': '22 Dow St, Portland, ME 04102',
                              'url': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1'}]}
        return {'data': {'metadata': {'og:image': 'https://127.0.0.1/private.jpg'}}}

    monkeypatch.setattr(photo, '_crawl4ai_json', fake_json)
    def blocked(_url):
        raise photo.HTTPException(status_code=400, detail='Private destination')
    monkeypatch.setattr(photo, '_download_public_image', blocked)
    assert asyncio.run(photo.crawl4ai_listing_photo('22 Dow St, Portland, ME 04102', 'c4-test')) is None


def test_listing_image_url_requires_https():
    assert photo.listing_image_url({'data': {'metadata': {'og:image': 'http://images.example/home.jpg'}}}) is None


@pytest.mark.parametrize('status', ['ZERO_RESULTS', 'NOT_FOUND', 'REQUEST_DENIED', 'OVER_QUERY_LIMIT', 'UNKNOWN_ERROR'])
def test_no_image_request_for_unavailable_metadata(client, monkeypatch, status):
    def handle(request):
        assert request.url.path.endswith('/metadata')
        return httpx.Response(200, json={'status': status, 'error_message': 'test-secret'})
    provider(monkeypatch, handle)
    response = client.get('/api/property-photo', params={'address': '123 Example Street'})
    assert response.json()['status'] == 'unavailable'
    assert 'image' not in response.json()
    assert 'test-secret' not in response.text


@pytest.mark.parametrize('kind', ['timeout', 'http', 'redirect', 'invalid_json', 'oversized_metadata', 'non_object'])
def test_provider_errors_are_safe(client, monkeypatch, kind):
    def handle(request):
        if kind == 'timeout':
            raise httpx.ReadTimeout('URL includes test-secret', request=request)
        if kind == 'http':
            return httpx.Response(403, text='test-secret')
        if kind == 'redirect':
            return httpx.Response(302, headers={'location': 'https://other.example/steal'})
        if kind == 'oversized_metadata':
            return httpx.Response(200, content=b'x' * (photo.MAX_METADATA_BYTES + 1))
        if kind == 'non_object':
            return httpx.Response(200, json=[])
        return httpx.Response(200, text='not JSON')
    provider(monkeypatch, handle)
    response = client.get('/api/property-photo', params={'address': '123 Example Street'})
    assert response.json()['status'] == 'unavailable'
    assert response.headers['cache-control'] == 'no-store'
    assert 'test-secret' not in response.text


@pytest.mark.parametrize('kind', ['oversized', 'not_jpeg', 'wrong_type', 'not_found'])
def test_bad_image_is_not_returned(client, monkeypatch, kind):
    def handle(request):
        if request.url.path.endswith('/metadata'):
            return httpx.Response(200, json={'status': 'OK'})
        if kind == 'not_found':
            return httpx.Response(404)
        data = b'x' * (photo.MAX_IMAGE_BYTES + 1) if kind == 'oversized' else b'not jpeg' if kind == 'not_jpeg' else JPEG
        return httpx.Response(200, content=data, headers={'content-type': 'image/png' if kind == 'wrong_type' else 'image/jpeg'})
    provider(monkeypatch, handle)
    assert client.get('/api/property-photo', params={'address': '123 Example Street'}).json()['status'] == 'unavailable'


@pytest.mark.parametrize('address', ['', '   ', 'x' * 301, '123\nHidden header'])
def test_invalid_address_rejected_before_provider(client, monkeypatch, address):
    provider(monkeypatch, lambda request: pytest.fail('Invalid address must not reach Google'))
    response = client.get('/api/property-photo', params={'address': address})
    assert response.status_code == 422
    assert response.headers['cache-control'] == 'no-store'


def test_per_client_limit_ignores_spoofed_forwarded_header(client, monkeypatch):
    calls = []
    def handle(request):
        calls.append(request)
        return httpx.Response(200, json={'status': 'ZERO_RESULTS'})
    provider(monkeypatch, handle)
    for index in range(photo.PER_MINUTE):
        assert client.get('/api/property-photo', params={'address': '123 Example Street'}, headers={'x-forwarded-for': f'192.0.2.{index}'}).status_code == 200
    response = client.get('/api/property-photo', params={'address': '123 Example Street'})
    assert response.status_code == 429
    assert response.json()['status'] == 'unavailable'
    assert int(response.headers['retry-after']) > 0
    assert len(calls) == photo.PER_MINUTE


def test_rate_window_expires_and_clients_are_independent(monkeypatch):
    photo._requests.clear()
    monkeypatch.setattr(photo.time, 'monotonic', lambda: 1000)
    for _ in range(photo.PER_MINUTE):
        assert photo.reserve_request('one') == 0
    assert photo.reserve_request('one') > 0
    assert photo.reserve_request('two') == 0
    monkeypatch.setattr(photo.time, 'monotonic', lambda: 1061)
    assert photo.reserve_request('one') == 0


def test_chunked_image_size_is_bounded_without_content_length(client, monkeypatch):
    class LargeStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'\xff\xd8\xff' + b'x' * photo.MAX_IMAGE_BYTES
    def handle(request):
        if request.url.path.endswith('/metadata'):
            return httpx.Response(200, json={'status': 'OK'})
        return httpx.Response(200, stream=LargeStream(), headers={'content-type': 'image/jpeg'})
    provider(monkeypatch, handle)
    assert client.get('/api/property-photo', params={'address': '123 Example Street'}).json()['status'] == 'unavailable'


def test_optional_date_and_attribution_have_safe_defaults(client, monkeypatch):
    def handle(request):
        if request.url.path.endswith('/metadata'):
            return httpx.Response(200, json={'status': 'OK', 'date': 'not-a-date'})
        return httpx.Response(200, content=JPEG, headers={'content-type': 'image/jpeg'})
    provider(monkeypatch, handle)
    data = client.get('/api/property-photo', params={'address': '123 Example Street'}).json()
    assert data['status'] == 'available'
    assert data['attribution'] == '© Google Street View'
    assert data['date'] is None


def test_hourly_limit_and_bounded_client_storage(monkeypatch):
    photo._requests.clear()
    now = [1000]
    monkeypatch.setattr(photo.time, 'monotonic', lambda: now[0])
    for _ in range(photo.PER_HOUR):
        assert photo.reserve_request('one') == 0
        now[0] += 61
    assert photo.reserve_request('one') > 0
    monkeypatch.setattr(photo, 'MAX_CLIENTS', 1)
    assert photo.reserve_request('two') > 0
    now[0] += 3601
    assert photo.reserve_request('two') == 0
    assert list(photo._requests) == ['two']
