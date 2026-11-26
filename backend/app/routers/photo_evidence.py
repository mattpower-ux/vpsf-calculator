from datetime import datetime, timezone
import json

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import PropertyPhotoCandidateRecord
from app.photo_evidence import PhotoCandidate, candidates_from_search
from app.routers.property_photo import (
    CRAWL4AI_SEARCH_URL,
    _crawl4ai_json,
    listing_search_address,
)

router = APIRouter(prefix='/api/photo-evidence', tags=['photo-evidence'])


class DiscoverRequest(BaseModel):
    address: str = Field(min_length=5, max_length=300)


def discover_photo_candidates(address: str, settings) -> list[PhotoCandidate]:
    key = str(getattr(settings, 'crawl4ai_api_key', '') or '').strip()
    if not key:
        return []
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json',
               'Authorization': 'Bearer ' + key}
    body = {'q': f'"{listing_search_address(address)}" real estate listing exterior photo',
            'rich': True, 'deep': False}
    try:
        with httpx.Client(timeout=httpx.Timeout(12, connect=4),
                          follow_redirects=False, trust_env=False) as client:
            response = client.post(CRAWL4AI_SEARCH_URL, headers=headers, json=body)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError, json.JSONDecodeError):
        return []
    return candidates_from_search(payload or {}, address)


def _record(candidate: PhotoCandidate) -> PropertyPhotoCandidateRecord:
    return PropertyPhotoCandidateRecord(
        id=candidate.candidate_id,
        property_identity=candidate.property_identity,
        provider=candidate.provider,
        source_page_url=candidate.source_page_url,
        remote_image_url=candidate.remote_image_url,
        photo_kind_hint=candidate.photo_kind_hint,
        width=candidate.width,
        height=candidate.height,
        match_confidence=candidate.match_confidence,
        match_evidence=candidate.match_evidence,
        created_at=candidate.created_at,
        expires_at=candidate.expires_at,
    )


@router.post('/discover')
def discover(request: DiscoverRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    db.execute(delete(PropertyPhotoCandidateRecord).where(
        PropertyPhotoCandidateRecord.expires_at <= now))
    candidates = discover_photo_candidates(request.address.strip(), get_settings())
    for candidate in candidates:
        db.add(_record(candidate))
    db.commit()
    expires = min((item.expires_at for item in candidates), default=None)
    payload = {
        'candidates': [{
            'id': item.candidate_id,
            'provider': item.provider,
            'sourcePageUrl': item.source_page_url,
            'kind': item.photo_kind_hint,
            'width': item.width,
            'height': item.height,
            'previewUrl': f'/api/photo-evidence/candidates/{item.candidate_id}/preview',
        } for item in candidates],
        'expiresAt': expires.isoformat() if expires else None,
    }
    return JSONResponse(payload, headers={'Cache-Control': 'private, no-store'})
