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
        google_street_view_api_key='test-secret', firecrawl_api_key=''))
    async def no_fallback(*args, **kwargs):
        return None
    monkeypatch.setattr(photo, 'firecrawl_listing_photo', no_fallback)
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
        google_street_view_api_key='', firecrawl_api_key=''))
    provider(monkeypatch, lambda request: pytest.fail('No provider request without key'))
    response = client.get('/api/property-photo', params={'address': '123 Example Street'})
    assert response.json()['status'] == 'not_configured'
    assert 'image' not in response.json()
    assert response.headers['cache-control'] == 'no-store'


def test_missing_street_view_key_uses_exact_firecrawl_listing_photo(client, monkeypatch):
    monkeypatch.setattr(photo, 'get_settings', lambda: SimpleNamespace(
        google_street_view_api_key='', firecrawl_api_key='fc-test'))
    provider(monkeypatch, lambda request: pytest.fail('Google must not be called without a key'))
    async def fallback(address, key):
        assert address == '22 Dow St, Portland, ME 04102'
        assert key == 'fc-test'
        return {
            'image': 'data:image/jpeg;base64,ZmFrZQ==',
            'attribution': 'Exterior photo · Redfin',
            'date': None,
            'sourceUrl': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1',
        }
    monkeypatch.setattr(photo, 'firecrawl_listing_photo', fallback)
    response = client.get('/api/property-photo', params={'address': '22 Dow St, Portland, ME 04102'})
    assert response.status_code == 200
    assert response.json() == {
        'status': 'available',
        'image': 'data:image/jpeg;base64,ZmFrZQ==',
        'attribution': 'Exterior photo · Redfin',
        'date': None,
        'sourceUrl': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1',
    }


def test_google_zero_results_falls_back_to_firecrawl(client, monkeypatch):
    provider(monkeypatch, lambda request: httpx.Response(200, json={'status': 'ZERO_RESULTS'}))
    async def fallback(address, key):
        return {'image': 'data:image/jpeg;base64,ZmFrZQ==', 'attribution': 'Exterior photo · Realtor.com', 'date': None}
    monkeypatch.setattr(photo, 'firecrawl_listing_photo', fallback)
    data = client.get('/api/property-photo', params={'address': '22 Dow St, Portland, ME 04102'}).json()
    assert data['status'] == 'available'
    assert data['attribution'] == 'Exterior photo · Realtor.com'


def test_firecrawl_candidate_requires_exact_address_and_excludes_units():
    results = {
        'images': [
            {'title': '20 Dow St, Portland, ME 04102', 'url': 'https://www.redfin.com/ME/Portland/20-Dow-St/home/1', 'imageUrl': 'https://img.example/nearby.jpg', 'imageWidth': 900, 'imageHeight': 600},
            {'title': '22 Dow St Apt 3, Portland, ME 04102', 'url': 'https://www.zillow.com/homedetails/22-Dow-St-APT-3/1_zpid/', 'imageUrl': 'https://img.example/unit.jpg', 'imageWidth': 900, 'imageHeight': 600},
            {'title': '22 Dow St, Portland, ME 04102', 'url': 'https://www.realtor.com/realestateandhomes-detail/22-Dow-St_Portland_ME_04102', 'imageUrl': 'https://img.example/exterior.jpg', 'imageWidth': 900, 'imageHeight': 600},
        ]
    }
    candidate = photo.select_firecrawl_candidate(results, '22 Dow St, Portland, ME 04102')
    assert candidate['imageUrl'] == 'https://img.example/exterior.jpg'
    assert candidate['provider'] == 'Realtor.com'


def test_firecrawl_candidate_rejects_untrusted_or_portrait_images():
    results = {
        'images': [
            {'title': '22 Dow St, Portland, ME 04102', 'url': 'https://example.com/property', 'imageUrl': 'https://img.example/unknown.jpg', 'imageWidth': 900, 'imageHeight': 600},
            {'title': '22 Dow St, Portland, ME 04102', 'url': 'https://www.redfin.com/ME/Portland/22-Dow-St/home/1', 'imageUrl': 'https://img.example/portrait.jpg', 'imageWidth': 300, 'imageHeight': 900},
        ]
    }
    assert photo.select_firecrawl_candidate(results, '22 Dow St, Portland, ME 04102') is None


def test_firecrawl_candidate_rejects_house_number_prefix_and_missing_dimensions():
    results = {'images': [
        {'title': '122 Dow St, Portland, ME 04102', 'url': 'https://www.redfin.com/ME/Portland/122-Dow-St/home/1',
         'imageUrl': 'https://img.example/wrong.jpg', 'imageWidth': 900, 'imageHeight': 600},
        {'title': '22 Dow St, Portland, ME 04102', 'url': 'https://www.zillow.com/homedetails/22-Dow-St/1_zpid/',
         'imageUrl': 'https://img.example/no-size.jpg'},
    ]}
    assert photo.select_firecrawl_candidate(results, '22 Dow St, Portland, ME 04102') is None


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


def test_firecrawl_search_uses_exact_address_and_returns_bounded_image(monkeypatch):
    original = httpx.AsyncClient
    def handle(request):
        assert request.url == photo.FIRECRAWL_URL
        assert request.headers['authorization'] == 'Bearer fc-test'
        body = json.loads(request.content)
        assert body == {
            'query': '"22 Dow St, Portland, ME 04102" exterior home',
            'sources': ['images'],
            'limit': 10,
        }
        return httpx.Response(200, json={'success': True, 'data': {'images': [{
            'title': '22 Dow St, Portland, ME 04102',
            'url': 'https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1',
            'imageUrl': 'https://ssl.cdn-redfin.com/photo/home.jpg',
            'imageWidth': 900,
            'imageHeight': 600,
        }]}})
    monkeypatch.setattr(photo.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    monkeypatch.setattr(photo, '_download_public_image', lambda url: ('image/jpeg', JPEG))
    data = asyncio.run(photo.firecrawl_listing_photo('22 Dow St, Portland, ME 04102', 'fc-test'))
    assert data['attribution'] == 'Exterior photo · Redfin'
    assert data['sourceUrl'].startswith('https://www.redfin.com/')
    assert data['image'] == 'data:image/jpeg;base64,' + base64.b64encode(JPEG).decode()


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
