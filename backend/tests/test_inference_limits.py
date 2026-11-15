import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.inference_limits import InferenceLimiter
from app.routers import home_walk, properties
from app.schemas import PropertyInput

PNG = b'\x89PNG\r\n\x1a\nmock-image'


def make_app(monkeypatch, provider=None):
    app = FastAPI()
    app.include_router(home_walk.router)
    app.include_router(properties.router)
    async def walk(*args):
        if provider: await provider()
        return {'suggestions': []}
    async def ocr(*args):
        if provider: await provider()
        return PropertyInput()
    monkeypatch.setattr(home_walk, 'analyze_images', walk)
    monkeypatch.setattr(properties, 'extract_property_from_upload', ocr)
    monkeypatch.setattr(properties, 'extract_property_from_url', ocr)
    return app


def send(client, path, **kwargs):
    if path.endswith('ocr-url'):
        return client.post(path, json={'url': 'https://example.com/file.pdf'}, **kwargs)
    field = 'images' if 'home-walk' in path else 'file'
    return client.post(path, files=[(field, ('photo.png', PNG, 'image/png'))], **kwargs)


PATHS = ['/api/home-walk/analyze', '/api/properties/ocr', '/api/properties/ocr-url']


def test_limits_shared_across_all_routes_and_forwarded_headers_ignored(monkeypatch):
    app = make_app(monkeypatch)
    with TestClient(app) as client:
        for index in range(30):
            assert send(client, PATHS[index % 3], headers={'x-forwarded-for': f'192.0.2.{index}'}).status_code == 200
        for path in PATHS:
            response = send(client, path)
            assert response.status_code == 429
            assert int(response.headers['retry-after']) > 0


def test_complete_walk_and_ten_document_batch_fit(monkeypatch):
    app = make_app(monkeypatch)
    with TestClient(app) as client:
        for index in range(8):
            files = [('images', ('photo.png', PNG, 'image/png'))] * (2 if index < 4 else 1)
            assert client.post(PATHS[0], files=files).status_code == 200
        for index in range(10):
            assert send(client, PATHS[1 + index % 2]).status_code == 200


def test_global_concurrency_fails_fast_and_recovers(monkeypatch):
    async def run():
        entered = 0
        ready, release = asyncio.Event(), asyncio.Event()
        async def provider():
            nonlocal entered
            entered += 1
            if entered == 4: ready.set()
            await release.wait()
        app = make_app(monkeypatch, provider)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            tasks = [asyncio.create_task(send(client, PATHS[index % 3])) for index in range(4)]
            await asyncio.wait_for(ready.wait(), 2)
            rejected = await asyncio.wait_for(send(client, PATHS[2]), 1)
            assert rejected.status_code == 503
            assert entered == 4
            release.set()
            assert all(response.status_code == 200 for response in await asyncio.gather(*tasks))
            assert (await send(client, PATHS[0])).status_code == 200
    asyncio.run(run())


def test_capacity_released_after_validation_and_provider_errors(monkeypatch):
    app = make_app(monkeypatch)
    with TestClient(app) as client:
        for _ in range(5):
            assert client.post(PATHS[0], content=b'invalid').status_code == 415
        async def broken(*args): raise HTTPException(502, 'provider failed')
        monkeypatch.setattr(home_walk, 'analyze_images', broken)
        for _ in range(5): assert send(client, PATHS[0]).status_code == 502
        assert send(client, PATHS[2]).status_code == 200


def test_sliding_windows_and_memory_bound():
    now = [1000.0]
    limiter = InferenceLimiter(clock=lambda: now[0], max_clients=2)
    for batch in range(4):
        for _ in range(30):
            with limiter.admit('one'): pass
        now[0] += 61
    with pytest.raises(HTTPException) as error:
        with limiter.admit('one'): pass
    assert error.value.status_code == 429
    with limiter.admit('two'): pass
    with pytest.raises(HTTPException) as error:
        with limiter.admit('three'): pass
    assert error.value.status_code == 503
    now[0] += 3601
    with limiter.admit('three'): pass
    assert len(limiter.clients) == 1


def test_cancelled_request_releases_capacity(monkeypatch):
    async def run():
        started = asyncio.Event()
        async def provider():
            started.set()
            await asyncio.Event().wait()
        app = make_app(monkeypatch, provider)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            pending = asyncio.create_task(send(client, PATHS[0]))
            await asyncio.wait_for(started.wait(), 2)
            pending.cancel()
            with pytest.raises(asyncio.CancelledError): await pending
            assert app.state.inference_limiter.active == 0
    asyncio.run(run())
