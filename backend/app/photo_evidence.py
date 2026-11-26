from dataclasses import dataclass, replace
from datetime import datetime, timezone
from uuid import uuid4

from app.routers.property_photo import (
    PHOTO_PROVIDER_PRIORITY,
    address_identity,
    crawl4ai_listing_pages,
    search_result_image_urls,
)


@dataclass(frozen=True)
class PhotoCandidate:
    candidate_id: str
    property_identity: str
    provider: str
    source_page_url: str
    remote_image_url: str
    photo_kind_hint: str
    width: int | None
    height: int | None
    match_confidence: int
    match_evidence: dict
    created_at: datetime
    expires_at: datetime


def _property_identity(address: str) -> str:
    street, city, state, zip_code = address_identity(address)
    return '|'.join((street, city, state.lower(), zip_code))


def _kind_hint(raw: dict) -> str:
    text = ' '.join(str(raw.get(key) or '') for key in ('title', 'snippet', 'alt', 'description')).lower()
    for kind in ('exterior', 'roof', 'siding', 'landscaping', 'hvac', 'kitchen', 'bath', 'window', 'flooring'):
        if kind in text:
            return kind
    return ''


def match_photo_candidate(raw: dict, address: str) -> PhotoCandidate | None:
    """Normalize one rich-search image only when its page matches the exact property."""
    if not isinstance(raw, dict):
        return None
    matches = crawl4ai_listing_pages({'rows': [raw]}, address)
    if not matches:
        return None
    matched = matches[0]
    images = search_result_image_urls(matched)
    if not images:
        return None
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    return PhotoCandidate(
        candidate_id='',
        property_identity=_property_identity(address),
        provider=matched['provider'],
        source_page_url=matched['url'],
        remote_image_url=images[0],
        photo_kind_hint=_kind_hint(raw),
        width=raw.get('imageWidth') if isinstance(raw.get('imageWidth'), int) else None,
        height=raw.get('imageHeight') if isinstance(raw.get('imageHeight'), int) else None,
        match_confidence=100,
        match_evidence={'exact_address': True},
        created_at=now,
        expires_at=now + timedelta(minutes=30),
    )


def rank_photo_candidates(candidates: list[PhotoCandidate], limit: int = 12) -> list[PhotoCandidate]:
    """Deduplicate images, prefer stronger matches, then diversify providers."""
    bounded = max(0, min(limit, 12))
    unique = {}
    for candidate in candidates:
        existing = unique.get(candidate.remote_image_url)
        if existing is None or candidate.match_confidence > existing.match_confidence:
            unique[candidate.remote_image_url] = candidate
    ordered = sorted(unique.values(), key=lambda item: (
        -item.match_confidence, PHOTO_PROVIDER_PRIORITY.get(item.provider, 99), item.candidate_id))
    diverse, remaining, providers = [], [], set()
    for candidate in ordered:
        if candidate.provider in providers:
            remaining.append(candidate)
        else:
            providers.add(candidate.provider)
            diverse.append(candidate)
    return (diverse + remaining)[:bounded]


def candidates_from_search(data: dict, address: str) -> list[PhotoCandidate]:
    """Normalize row-level and separately emitted rich-search images."""
    if not isinstance(data, dict):
        return []
    candidates = []
    for key in ('rows', 'images'):
        values = data.get(key)
        if not isinstance(values, list):
            continue
        for raw in values:
            candidate = match_photo_candidate(raw, address)
            if candidate:
                candidates.append(replace(candidate, candidate_id=uuid4().hex))
    return rank_photo_candidates(candidates)
