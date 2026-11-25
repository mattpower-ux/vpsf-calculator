"""Bounded permit evidence, never equipment facts or scoring inputs.

Contract: https://api.permit-stack.com/public-openapi.json (reviewed 2026-11-15).
Only GET search is used. No contact fields, enrichment guesses, or raw responses
are persisted. A request cap bounds calls, not the provider's billing in dollars.
"""
import asyncio
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID
from concurrent.futures import Future
from threading import Lock

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import DateTime, Integer, String, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.types import JSON

from app.address_normalization import STATE_TO_CODE, STREET_SUFFIXES, normalize_state, normalize_street_address
from app.config import Settings
from app.db import Base
from app.models import utc_now
from app.permitstack_schemas import SOURCE_URL, PermitEvidence, PermitCoverage, PermitStackResponse

SEARCH_URL = 'https://api.permit-stack.com/v1/permits/search'
PAGE_SIZE = 25
MAX_RESPONSE_BYTES = 1_048_576
CACHE_HOURS = 24
EMPTY_CACHE_HOURS = 1
STATUSES = {'FILED','ISSUED','IN_PROGRESS','FINAL','EXPIRED','CANCELLED','REVOKED','UNKNOWN','INTERCONNECTED'}
MAX_INFLIGHT_LOOKUPS = 64
_inflight_lock = Lock()
_inflight: dict[tuple, Future] = {}


def search_address_prefix(address: str) -> str:
    """Broaden candidate retrieval only; exact full-address matching stays below.

    Strip recognized terminal suffix/direction, retaining house number and street
    name. Never expand leading directions or remove/guess apartment identifiers.
    This deliberately favors false negatives over attaching a different home.
    """
    words = address.split()
    directions = {'n','s','e','w','ne','nw','se','sw',
                  'north','south','east','west','northeast','northwest','southeast','southwest'}
    suffixes = set(STREET_SUFFIXES) | set(STREET_SUFFIXES.values())
    if len(words) > 2 and words[-1].lower().rstrip('.') in directions:
        words.pop()
    if len(words) > 2 and words[-1].lower().rstrip('.') in suffixes:
        words.pop()
    return ' '.join(words)


class PermitStackRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    address: str = Field(min_length=3, max_length=200)
    state: str = Field(min_length=2, max_length=30)
    zip: str = Field(pattern=r'^\d{5}(?:-\d{4})?$')
    city: str = Field(default='', max_length=100)
    parcel: str = Field(default='', max_length=100, pattern=r'^[A-Za-z0-9 ./-]*$')

    @field_validator('address')
    @classmethod
    def street_only(cls, value):
        if ',' in value or not re.match(r'^\d+\S*\s+\S', value) or any(ord(c) < 32 for c in value):
            raise ValueError('Supply the street address including unit, with state and ZIP in separate fields.')
        return value

    @field_validator('state')
    @classmethod
    def valid_state(cls, value):
        state = normalize_state(value)
        if state not in STATE_TO_CODE.values():
            raise ValueError('Supply a valid US state.')
        return state

    @field_validator('zip')
    @classmethod
    def zip5(cls, value):
        return value[:5]


class SearchPage(BaseModel):
    results: list[dict] = Field(max_length=PAGE_SIZE)
    total: int | None = Field(ge=0, strict=True)
    page: Literal[1]
    per_page: int = Field(ge=1, le=PAGE_SIZE, strict=True)
    total_capped: bool = False
    total_unknown: bool = False
    tier_window_clamped: bool = False
    tier_window_from: str | None = None
    coverage_confidence: dict | None = None


# Registered with Base when properties/integration-status routers are imported;
# normal init_db/create_all provisions these additive tables.
class PermitStackCacheRecord(Base):
    __tablename__ = 'permitstack_cache'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    result: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PermitStackUsageRecord(Base):
    __tablename__ = 'permitstack_usage'
    period: Mapped[str] = mapped_column(String(7), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


def usage_status(db: Session) -> dict:
    period = utc_now().strftime('%Y-%m')
    record = db.get(PermitStackUsageRecord, period)
    return {'period':period, 'usedThisMonth':record.count if record else 0}


def reserve_call(db: Session, limit: int) -> None:
    """Atomic across workers, including first-use races; failures count attempts."""
    period = utc_now().strftime('%Y-%m')
    if not db.get(PermitStackUsageRecord, period):
        db.add(PermitStackUsageRecord(period=period, count=0))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    reserved = db.execute(update(PermitStackUsageRecord).where(
        PermitStackUsageRecord.period == period, PermitStackUsageRecord.count < limit
    ).values(count=PermitStackUsageRecord.count + 1))
    db.commit()
    if reserved.rowcount != 1:
        raise HTTPException(429, 'PermitStack monthly request limit reached.')


class PermitStackClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def search(self, request: PermitStackRequest) -> dict:
        # Single page, no retries/detail fan-out/redirects, fixed origin, no keys in URLs.
        async with httpx.AsyncClient(timeout=10, follow_redirects=False, trust_env=False) as client:
            async with client.stream('GET', SEARCH_URL, headers={'X-API-Key':self.api_key}, params={
                'address':search_address_prefix(request.address), 'state':request.state, 'zip_code':request.zip,
                'fields':'summary', 'record_kind':'permit', 'page':1, 'per_page':PAGE_SIZE
            }) as response:
                response.raise_for_status()
                body = bytearray()
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    body.extend(chunk)
                    if len(body) > MAX_RESPONSE_BYTES:
                        raise ValueError('Response exceeds limit')
                return json.loads(body)


def _text(value, limit=300):
    return value.strip()[:limit] if isinstance(value, str) and value.strip() else None


def _date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date().isoformat()
    except ValueError:
        return None


def _zip(value):
    return value.strip()[:5] if isinstance(value, str) and re.fullmatch(r'\d{5}(?:-\d{4})?', value.strip()) else None


def evidence_response(request: PermitStackRequest, payload: dict) -> PermitStackResponse:
    page = SearchPage.model_validate(payload)
    permits, seen = [], set()
    for row in page.results:
        street, state = row.get('address_street'), row.get('address_state')
        # Never trust search filters: address is a substring upstream; state may
        # come from jurisdiction rather than the permit. Unit tokens are retained.
        if not isinstance(street, str) or not isinstance(state, str):
            continue
        if (normalize_street_address(street) != normalize_street_address(request.address)
                or normalize_state(state) != request.state or _zip(row.get('address_zip')) != request.zip):
            continue
        identifier = str(UUID(row['id']))
        if identifier in seen:
            continue
        seen.add(identifier)
        status = row.get('status')
        permits.append(PermitEvidence(
            id=identifier, permitNumber=_text(row.get('permit_number')),
            status=status if isinstance(status,str) and status in STATUSES else 'UNKNOWN',
            category=_text(row.get('category')), description=_text(row.get('description_raw'), 2000),
            jurisdiction=_text(row.get('jurisdiction_name')), address=street[:200],
            city=_text(row.get('address_city'),100), state=request.state, zip=request.zip,
            dateFiled=_date(row.get('date_filed')), dateIssued=_date(row.get('date_issued')),
            dateCompleted=_date(row.get('date_completed'))))
    raw_coverage = page.coverage_confidence or {}
    coverage = PermitCoverage(
        confidence=_text(raw_coverage.get('confidence'),80),
        covered=raw_coverage.get('covered') if isinstance(raw_coverage.get('covered'),bool) else None,
        dataThrough=_text(raw_coverage.get('data_through'),40),
        tierWindowClamped=page.tier_window_clamped, tierWindowFrom=_text(page.tier_window_from,40))
    truncated = (page.total is None or page.total > len(page.results)
                 or page.total_capped or page.total_unknown or page.tier_window_clamped)
    return PermitStackResponse(status='matched' if permits else 'no_exact_match',
        address=request.address, state=request.state, zip=request.zip, fetchedAt=utc_now().isoformat(),
        parcelId=request.parcel,
        searchTruncated=truncated, searchedRecords=len(page.results), permits=permits, coverage=coverage,
        sourceNote='PermitStack permit evidence matched by normalized street address, state and ZIP. '
        'One bounded search page; coverage and subscription history may be incomplete. '
        'No matching records is not proof that no work occurred. Permit status and dates '
        'do not establish installed equipment, replacement age, performance or scoring credit.')


async def lookup_permits(request: PermitStackRequest, db: Session, settings: Settings) -> PermitStackResponse:
    if not settings.permit_stack_api_key.strip():
        raise HTTPException(503, 'PermitStack is not configured.')
    cache_key = hashlib.sha256(json.dumps(['v2-prefix',normalize_street_address(request.address),request.state,request.zip]).encode()).hexdigest()
    # Process-local single-flight; the atomic monthly cap remains cross-worker.
    # concurrent Future supports callers on different event loops/threads. No
    # Session or async task is shared. Finished entries are always removed.
    flight_key = (db.get_bind(), cache_key)
    with _inflight_lock:
        future = _inflight.get(flight_key)
        leader = future is None
        if leader:
            if len(_inflight) >= MAX_INFLIGHT_LOOKUPS:
                raise HTTPException(503, 'PermitStack lookup is busy. Try again shortly.', headers={'Retry-After':'5'})
            future = Future()
            _inflight[flight_key] = future
    if not leader:
        shared = asyncio.wrap_future(future)
        # A disconnected/timed-out follower must not cancel the provider or
        # leave an unobserved exception when the shared operation later fails.
        shared.add_done_callback(lambda done: None if done.cancelled() else done.exception())
        try:
            result = await asyncio.wait_for(asyncio.shield(shared), timeout=13)
        except TimeoutError:
            raise HTTPException(503, 'PermitStack lookup is still busy. Try again shortly.', headers={'Retry-After':'5'}) from None
        return result.model_copy(deep=True, update={'address':request.address})
    try:
        # Recheck persistent cache after admission, before reserving any quota.
        result = await _lookup_permits_once(request, db, settings, cache_key)
        future.set_result(result)
        return result
    except BaseException as error:
        future.set_exception(error if isinstance(error, HTTPException) else HTTPException(
            503, 'PermitStack lookup interrupted. Try again later.'))
        raise
    finally:
        with _inflight_lock:
            _inflight.pop(flight_key, None)


async def _lookup_permits_once(request: PermitStackRequest, db: Session, settings: Settings, cache_key: str) -> PermitStackResponse:
    record = db.get(PermitStackCacheRecord, cache_key)
    now = utc_now()
    if record and record.expires_at.replace(tzinfo=timezone.utc) > now:
        try:
            cached = PermitStackResponse.model_validate(record.result)
            return cached.model_copy(update={'cacheHit':True, 'address':request.address})
        except ValueError:
            pass
    reserve_call(db, settings.permit_stack_monthly_limit)
    try:
        payload = await asyncio.wait_for(PermitStackClient(settings.permit_stack_api_key).search(request), timeout=12)
        result = evidence_response(request, payload)
    except (TimeoutError, httpx.TimeoutException):
        raise HTTPException(504, 'PermitStack lookup timed out. Try again later.') from None
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        # No upstream bodies, URLs, exception strings or credentials in the response.
        raise HTTPException(502, 'PermitStack lookup is unavailable. Try again later.') from None
    expires = now + timedelta(hours=CACHE_HOURS if result.permits else EMPTY_CACHE_HOURS)
    if record:
        record.result = result.model_dump(mode='json')
        record.expires_at = expires
    else:
        db.add(PermitStackCacheRecord(key=cache_key,result=result.model_dump(mode='json'),expires_at=expires))
    try:
        db.commit()
    except IntegrityError:
        # Another worker filled this cache first; both attempts were reserved.
        db.rollback()
    return result
