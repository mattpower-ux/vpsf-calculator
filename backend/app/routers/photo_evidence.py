from datetime import datetime, timezone
import json

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import PropertyPhotoCandidateRecord
from app.photo_assets import delete_photo_asset, read_photo_asset, store_photo_asset, MAX_UPLOAD_BYTES
from app.photo_evidence import PhotoCandidate, candidates_from_search
from app.routers.property_photo import (
    CRAWL4AI_SEARCH_URL,
    _download_public_image,
    image_dimensions,
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


def fetch_candidate_image(candidate_id: str, db: Session):
    record = db.get(PropertyPhotoCandidateRecord, candidate_id)
    if not record:
        raise HTTPException(404, 'Photo candidate not found.')
    expires = record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        raise HTTPException(410, 'Photo candidate expired. Search again.')
    downloaded = _download_public_image(record.remote_image_url, record.source_page_url)
    if not downloaded:
        raise HTTPException(422, 'This photo is no longer available.')
    mime, data = downloaded
    dimensions = image_dimensions(mime, data)
    if not dimensions:
        raise HTTPException(422, 'This photo could not be validated.')
    width, height = dimensions
    if width < 320 or height < 180 or height > width * 1.25:
        raise HTTPException(422, 'This image is not a usable exterior photo.')
    return mime, data, record


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


@router.get('/candidates/{candidate_id}/preview')
def preview_candidate(candidate_id: str, db: Session = Depends(get_db)):
    mime, data, _ = fetch_candidate_image(candidate_id, db)
    return Response(data, media_type=mime, headers={
        'Cache-Control': 'private, no-store',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
    })


@router.post('/assets')
async def upload_asset(
    property_identity: str = Form(min_length=3, max_length=500),
    category: str = Form(default='', max_length=80),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    data = await photo.read(MAX_UPLOAD_BYTES + 1)
    capability = store_photo_asset(data, photo.content_type or '', property_identity, category, db)
    return JSONResponse({
        'id': capability.asset_id,
        'capability': capability.token,
        'mime': capability.mime,
        'width': capability.width,
        'height': capability.height,
        'previewUrl': f'/api/photo-evidence/assets/{capability.asset_id}',
    }, headers={'Cache-Control': 'private, no-store'})


@router.get('/assets/{asset_id}')
def read_asset(asset_id: str, capability: str, db: Session = Depends(get_db)):
    mime, data = read_photo_asset(asset_id, capability, db)
    return Response(data, media_type=mime, headers={
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})


@router.delete('/assets/{asset_id}', status_code=204)
def delete_asset(asset_id: str, capability: str, db: Session = Depends(get_db)):
    delete_photo_asset(asset_id, capability, db)
    return Response(status_code=204, headers={'Cache-Control': 'private, no-store'})
