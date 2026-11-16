"""Shared, fail-fast admission for public inference routes.

OCR limits are shared across inference routes on one application worker, not across
separate worker processes/replicas. Counters contain client addresses only, expire
after an hour, and have a fixed cardinality bound. No provider work is queued.
PermitStack uses independent, tighter limits so it cannot consume OCR capacity.
"""
from collections import deque
from contextlib import contextmanager
from math import ceil
from threading import Lock
import time

from fastapi import HTTPException, Request
from fastapi.routing import APIRoute

PROTECTED_PATHS = frozenset({'/api/home-walk/analyze', '/api/properties/ocr', '/api/properties/ocr-url', '/api/properties/permitstack'})
PER_MINUTE = 30
PER_HOUR = 120
MAX_CONCURRENT = 4
MAX_CLIENTS = 4096
PERMITSTACK_PER_MINUTE = 3
PERMITSTACK_PER_HOUR = 10
_initialization_lock = Lock()


class InferenceLimiter:
    def __init__(self, *, clock=time.monotonic, max_clients=MAX_CLIENTS,
                 per_minute=PER_MINUTE, per_hour=PER_HOUR, max_concurrent=MAX_CONCURRENT):
        self.clock = clock
        self.max_clients = max_clients
        self.per_minute = per_minute
        self.per_hour = per_hour
        self.max_concurrent = max_concurrent
        self.clients: dict[str, deque[float]] = {}
        self.active = 0
        self.lock = Lock()

    @contextmanager
    def admit(self, client):
        with self.lock:
            now = self.clock()
            for key in [key for key, times in self.clients.items() if times[-1] <= now - 3600]:
                del self.clients[key]
            times = self.clients.get(client)
            if times is not None:
                while times and times[0] <= now - 3600:
                    times.popleft()
                recent = [stamp for stamp in times if stamp > now - 60]
                retry = 0
                if len(times) >= self.per_hour:
                    retry = max(retry, ceil(times[0] + 3600 - now))
                if len(recent) >= self.per_minute:
                    retry = max(retry, ceil(recent[0] + 60 - now))
                if retry:
                    raise HTTPException(429, 'Request limit reached. Please wait before trying again.',
                                        headers={'Retry-After': str(max(1, retry)), 'Cache-Control': 'no-store'})
            if self.active >= self.max_concurrent or (times is None and len(self.clients) >= self.max_clients):
                raise HTTPException(503, 'Processing is busy. Please try again shortly.',
                                    headers={'Retry-After': '5', 'Cache-Control': 'no-store'})
            if times is None:
                times = self.clients[client] = deque()
            times.append(now)
            self.active += 1
        try:
            yield
        finally:
            with self.lock:
                self.active -= 1


def limiter_for(request: Request):
    # App-local state keeps all routes coordinated, including across request
    # event loops, without coupling independently mounted test applications.
    with _initialization_lock:
        if request.url.path == '/api/properties/permitstack':
            if not hasattr(request.app.state, 'permitstack_limiter'):
                request.app.state.permitstack_limiter = InferenceLimiter(
                    per_minute=PERMITSTACK_PER_MINUTE, per_hour=PERMITSTACK_PER_HOUR)
            return request.app.state.permitstack_limiter
        if not hasattr(request.app.state, 'inference_limiter'):
            request.app.state.inference_limiter = InferenceLimiter()
        return request.app.state.inference_limiter


class InferenceLimitedRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        if self.path not in PROTECTED_PATHS:
            return handler

        async def limited(request: Request):
            # Gate BEFORE multipart parsing, downloads, PDF parsing, or provider
            # requests. Ignore client-supplied forwarding headers; the ASGI server
            # must configure its trusted proxy identity separately.
            client = request.client.host if request.client else 'unknown'
            with limiter_for(request).admit(client):
                return await handler(request)
        return limited
