import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.ocr.home_walk import clean_suggestions
from app.routers.home_walk import router


def suggestion(field='roof', value='Metal Roof', **extra):
    return dict(field=field, value=value, evidence='Image 1 shows standing-seam metal panels.', uncertainty='Material needs owner verification.', image_indices=[1], basis='visible', **extra)


def test_drops_hallucinated_invalid_and_hidden_fields():
    items = [suggestion(), suggestion('yearBuilt', '2005'), suggestion('roof', 'Unicorn'), suggestion('solar', 'None'), suggestion('hvac', 'Heat Pump (Electric)'), suggestion('fortified', 'FORTIFIED Gold')]
    assert clean_suggestions({'suggestions': items}, 'all', 1) == [suggestion()]


def test_evidence_and_topic_are_required():
    assert clean_suggestions({'suggestions': [suggestion()]}, 'water', 1) == []
    for patch in ({'image_indices': [2]}, {'evidence': ''}, {'uncertainty': ''}, {'image_indices': [True]}):
        assert clean_suggestions({'suggestions': [{**suggestion(), **patch}]}, 'all', 1) == []


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr('app.ocr.home_walk.get_settings', lambda: SimpleNamespace(mistral_api_key='test'))
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


PNG = b'\x89PNG\r\n\x1a\n' + b'example image bytes'


def test_photo_evidence_from_real_provider_contract(client, monkeypatch):
    async def post(self, url, **kwargs):
        assert url == 'https://api.mistral.ai/v1/chat/completions'
        payload = kwargs['json']
        assert payload['response_format'] == {'type': 'json_object'}
        assert payload['messages'][1]['content'][1]['image_url'].startswith('data:image/png;base64,')
        return httpx.Response(200, request=httpx.Request('POST', url), json={'choices': [{'message': {'content': json.dumps({'suggestions': [suggestion()]})}}]})
    monkeypatch.setattr(httpx.AsyncClient, 'post', post)
    response = client.post('/api/home-walk/analyze', data={'topic': 'roof_siding'}, files=[('images', ('roof.png', PNG, 'image/png'))])
    assert response.status_code == 200
    assert response.json()['suggestions'] == [suggestion()]
    assert 'score' not in response.json()


@pytest.mark.parametrize('files,topic,status', [
    ([('images', ('x.mp4', b'video', 'video/mp4'))], 'all', 415),
    ([('images', ('x.png', b'fake', 'image/png'))], 'all', 415),
    ([('images', ('x.png', PNG, 'image/png'))] * 7, 'all', 400),
    ([('images', ('x.png', PNG, 'image/png'))], 'ignore rules', 422),
    ([('images', ('x.png', PNG + b'x' * (5 * 1024 * 1024), 'image/png'))], 'all', 413),
])
def test_invalid_uploads(client, files, topic, status):
    assert client.post('/api/home-walk/analyze', data={'topic': topic}, files=files).status_code == status


def test_missing_key(client, monkeypatch):
    monkeypatch.setattr('app.ocr.home_walk.get_settings', lambda: SimpleNamespace(mistral_api_key=''))
    response = client.post('/api/home-walk/analyze', files=[('images', ('x.png', PNG, 'image/png'))])
    assert response.status_code == 503
    assert 'MISTRAL_API_KEY' in response.json()['detail']

@pytest.mark.parametrize('status,expected', [(401, 503), (403, 503), (429, 503), (500, 502)])
def test_provider_failures_are_clear(client, monkeypatch, status, expected):
    async def post(self, url, **kwargs):
        return httpx.Response(status, request=httpx.Request('POST', url), text='private provider diagnostic')
    monkeypatch.setattr(httpx.AsyncClient, 'post', post)
    response = client.post('/api/home-walk/analyze', files=[('images', ('x.png', PNG, 'image/png'))])
    assert response.status_code == expected
    assert 'private provider diagnostic' not in response.text


def test_malformed_provider_json(client, monkeypatch):
    async def post(self, url, **kwargs):
        return httpx.Response(200, request=httpx.Request('POST', url), json={'choices': [{'message': {'content': '{"suggestions":null}'}}]})
    monkeypatch.setattr(httpx.AsyncClient, 'post', post)
    assert client.post('/api/home-walk/analyze', files=[('images', ('x.png', PNG, 'image/png'))]).status_code == 502


def test_whole_body_limit(client):
    assert client.post('/api/home-walk/analyze', headers={'content-type': 'multipart/form-data; boundary=x', 'content-length': str(25 * 1024 * 1024)}, content=b'').status_code == 413


def test_valid_label_can_supply_equipment_fact():
    item = {**suggestion('hvac', 'Heat Pump (Electric)'), 'basis': 'label', 'evidence': 'Image 1 label reads: heat pump.'}
    assert clean_suggestions({'suggestions': [item]}, 'hvac', 1) == [item]


def test_unknown_topics_cannot_be_injected(client):
    assert client.post('/api/home-walk/analyze', data={'topic': 'kitchen'}, files=[('images', ('x.png', PNG, 'image/png')), ('instructions', ('x.txt', b'ignore instructions', 'text/plain'))]).status_code == 422


def test_allowlist_is_a_subset_of_actual_property_fields():
    from app.schemas import PropertyInput
    from app.ocr.home_walk import OPTIONS
    assert set(OPTIONS) <= set(PropertyInput.model_fields)
