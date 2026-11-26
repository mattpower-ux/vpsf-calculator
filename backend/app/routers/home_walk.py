"""Bound the entire multipart body before parsing (including chunked uploads)."""
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.inference_limits import InferenceLimitedRoute
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException

from app.ocr.home_walk import TOPICS, analyze_images
from app.db import get_db
from app.photo_assets import read_photo_asset
from app.routers.photo_evidence import fetch_candidate_image

router = APIRouter(prefix='/api/home-walk', tags=['home-walk'], route_class=InferenceLimitedRoute)
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_BODY_BYTES = 24 * 1024 * 1024


@router.post('/analyze')
async def analyze(request: Request, db: Session = Depends(get_db)):
    if not request.headers.get('content-type', '').lower().startswith('multipart/form-data;'):
        raise HTTPException(415, 'Send JPEG or PNG images as multipart form data.')
    length = request.headers.get('content-length')
    if length:
        try:
            if int(length) > MAX_BODY_BYTES:
                raise HTTPException(413, 'Upload limit is 24 MB per batch.')
        except ValueError:
            raise HTTPException(400, 'Invalid content length.')
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            raise HTTPException(413, 'Upload limit is 24 MB per batch.')
        body.extend(chunk)

    async def receive():
        return {'type': 'http.request', 'body': bytes(body), 'more_body': False}

    bounded = Request(request.scope, receive)
    try:
        async with bounded.form(max_files=6, max_fields=30, max_part_size=4096) as form:
            if any(key not in {'images', 'topic', 'candidate_ids', 'asset_capabilities'} for key in form):
                raise HTTPException(422, 'Only images and topic are accepted.')
            topic = form.get('topic', 'all')
            if not isinstance(topic, str) or topic not in TOPICS:
                raise HTTPException(422, 'Choose a supported Home Walk topic.')
            uploads = form.getlist('images')
            candidate_ids = [value for value in form.getlist('candidate_ids') if isinstance(value, str)]
            try:
                asset_capabilities = json.loads(form.get('asset_capabilities', '[]'))
            except (TypeError, json.JSONDecodeError):
                raise HTTPException(422, 'Invalid homeowner photo references.')
            if not isinstance(asset_capabilities, list) or any(not isinstance(value, dict) for value in asset_capabilities):
                raise HTTPException(422, 'Invalid homeowner photo references.')
            requested = len(uploads) + len(candidate_ids) + len(asset_capabilities)
            if not 1 <= requested <= 12:
                raise HTTPException(422, 'Select between 1 and 12 images.')
            images, manifest, failures = [], [], []
            for upload in uploads:
                if not isinstance(upload, UploadFile) or upload.content_type not in {'image/jpeg', 'image/png'}:
                    raise HTTPException(415, 'Only JPEG and PNG images are supported.')
                data = await upload.read(MAX_IMAGE_BYTES + 1)
                if len(data) > MAX_IMAGE_BYTES:
                    raise HTTPException(413, 'Each image must be 5 MB or smaller.')
                valid = (upload.content_type == 'image/png' and data.startswith(b'\x89PNG\r\n\x1a\n')) or (upload.content_type == 'image/jpeg' and data.startswith(b'\xff\xd8\xff'))
                if not valid:
                    raise HTTPException(415, 'The file does not contain a supported JPEG or PNG image.')
                images.append((upload.content_type, data))
                manifest.append({'evidence_type': 'homeowner', 'evidence_reference': 'upload', 'source_provider': 'Homeowner'})
            for reference in asset_capabilities:
                try:
                    mime, data = read_photo_asset(str(reference.get('id', '')), str(reference.get('capability', '')), db)
                    images.append((mime, data))
                    manifest.append({'evidence_type': 'homeowner', 'evidence_reference': str(reference.get('id', '')), 'source_provider': 'Homeowner'})
                except HTTPException as exc:
                    failures.append({'type': 'homeowner', 'id': str(reference.get('id', '')), 'status': exc.status_code})
            for candidate_id in candidate_ids:
                try:
                    mime, data, record = fetch_candidate_image(candidate_id, db)
                    images.append((mime, data))
                    manifest.append({'evidence_type': 'public', 'evidence_reference': candidate_id, 'source_provider': record.provider})
                except HTTPException as exc:
                    failures.append({'type': 'public', 'id': candidate_id, 'status': exc.status_code})
            if not images:
                raise HTTPException(422, 'None of the selected photos could be analyzed.')
            # The vision provider is deliberately bounded; homeowner evidence wins the six-image window.
            combined = sorted(zip(images, manifest), key=lambda item: item[1]['evidence_type'] != 'homeowner')[:6]
            result = await analyze_images([item[0] for item in combined], topic)
            selected_manifest = [item[1] for item in combined]
            for suggestion in result.get('suggestions', []):
                sources = [selected_manifest[index - 1] for index in suggestion.get('image_indices', [])
                           if 0 < index <= len(selected_manifest)]
                if sources:
                    source = next((value for value in sources if value['evidence_type'] == 'homeowner'), sources[0])
                    suggestion.update(source)
            result['failures'] = failures
            return result
    except MultiPartException as exc:
        raise HTTPException(400, 'Invalid multipart upload; at most 6 images are accepted.') from exc
