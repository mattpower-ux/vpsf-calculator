"""Bound the entire multipart body before parsing (including chunked uploads)."""
from fastapi import APIRouter, HTTPException, Request
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException

from app.ocr.home_walk import TOPICS, analyze_images

router = APIRouter(prefix='/api/home-walk', tags=['home-walk'])
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_BODY_BYTES = 24 * 1024 * 1024


@router.post('/analyze')
async def analyze(request: Request):
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
        async with bounded.form(max_files=6, max_fields=1, max_part_size=256) as form:
            if any(key not in {'images', 'topic'} for key in form):
                raise HTTPException(422, 'Only images and topic are accepted.')
            topic = form.get('topic', 'all')
            if not isinstance(topic, str) or topic not in TOPICS:
                raise HTTPException(422, 'Choose a supported Home Walk topic.')
            uploads = form.getlist('images')
            if not 1 <= len(uploads) <= 6:
                raise HTTPException(422, 'Select between 1 and 6 images per batch.')
            images = []
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
            return await analyze_images(images, topic)
    except MultiPartException as exc:
        raise HTTPException(400, 'Invalid multipart upload; at most 6 images are accepted.') from exc
