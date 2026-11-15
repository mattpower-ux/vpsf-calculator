"""Bounded public lead submission counters; no contact data in limiter keys."""
from collections import deque
from math import ceil
from threading import Lock
import time

from fastapi import HTTPException
from fastapi.routing import APIRoute

_lock = Lock()


class LeadLimitedRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        async def limited(request):
            now = time.monotonic()
            key = request.client.host if request.client else 'unknown'
            with _lock:
                if not hasattr(request.app.state, 'lead_limits'):
                    request.app.state.lead_limits = {}
                limits = request.app.state.lead_limits
                for old in [old for old, times in limits.items() if times[-1] <= now - 3600]:
                    del limits[old]
                times = limits.get(key)
                if times is None:
                    if len(limits) >= 4096:
                        raise HTTPException(503, 'Please try again shortly.', headers={'Retry-After':'60'})
                    times = limits[key] = deque()
                while times and times[0] <= now - 3600:
                    times.popleft()
                recent = [stamp for stamp in times if stamp > now - 60]
                wait = max(ceil(times[0] + 3600 - now) if len(times) >= 60 else 0,
                           ceil(recent[0] + 60 - now) if len(recent) >= 10 else 0)
                if wait:
                    raise HTTPException(429, 'Too many submissions. Please try again later.', headers={'Retry-After':str(max(1,wait)), 'Cache-Control':'no-store'})
                times.append(now)
            return await handler(request)
        return limited
