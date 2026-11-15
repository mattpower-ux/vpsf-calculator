"""Mock Google only: no addresses, imagery, or secrets leave this test suite."""
import base64
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import property_photo as photo

JPEG = b'\xff\xd8\xff\xe0unaltered-google-attribution\xff\xd9'


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(photo, 'get_settings', lambda: SimpleNamespace(google_street_view_api_key='test-secret'))
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
    monkeypatch.setattr(photo, 'get_settings', lambda: SimpleNamespace(google_street_view_api_key=''))
    provider(monkeypatch, lambda request: pytest.fail('No provider request without key'))
    response = client.get('/api/property-photo', params={'address': '123 Example Street'})
    assert response.json()['status'] == 'not_configured'
    assert 'image' not in response.json()
    assert response.headers['cache-control'] == 'no-store'


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
