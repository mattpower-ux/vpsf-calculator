from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import io
import os
from pathlib import Path
import secrets
from uuid import uuid4

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import PropertyPhotoAssetRecord

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_DIMENSION = 12_000
RETENTION_DAYS = 365


@dataclass(frozen=True)
class PhotoAssetCapability:
    asset_id: str
    token: str
    mime: str
    width: int
    height: int


def _root() -> Path:
    return Path(get_settings().photo_storage_path).resolve()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _sanitize(data: bytes, mime: str) -> tuple[str, bytes, int, int]:
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, 'Each photo must be smaller than 8 MB.')
    if mime not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise HTTPException(415, 'Use a JPEG, PNG, or WebP photo.')
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
            if width < 160 or height < 120 or max(width, height) > MAX_DIMENSION:
                raise HTTPException(422, 'Photo dimensions are not usable.')
            output = io.BytesIO()
            if mime == 'image/png':
                image.convert('RGBA' if image.mode == 'RGBA' else 'RGB').save(output, 'PNG', optimize=True)
                extension = 'png'
            elif mime == 'image/webp':
                image.convert('RGB').save(output, 'WEBP', quality=88, method=4)
                extension = 'webp'
            else:
                image.convert('RGB').save(output, 'JPEG', quality=88, optimize=True)
                extension = 'jpg'
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(422, 'This file is not a valid photo.')
    return extension, output.getvalue(), width, height


def _asset_path(relative_path: str) -> Path:
    root = _root()
    target = (root / relative_path).resolve()
    if root != target and root not in target.parents:
        raise HTTPException(400, 'Invalid photo path.')
    return target


def store_photo_asset(data: bytes, mime: str, property_identity: str, category: str,
                      db: Session) -> PhotoAssetCapability:
    extension, sanitized, width, height = _sanitize(data, mime)
    asset_id, token = uuid4().hex, secrets.token_urlsafe(32)
    relative = f'{asset_id[:2]}/{asset_id}.{extension}'
    target = _asset_path(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + '.tmp')
    try:
        with open(temporary, 'xb') as handle:
            handle.write(sanitized)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
        db.add(PropertyPhotoAssetRecord(
            id=asset_id, token_hash=_token_hash(token), property_identity=property_identity,
            category=category[:80], relative_path=relative, mime=mime,
            byte_size=len(sanitized), width=width, height=height))
        db.commit()
    except Exception:
        temporary.unlink(missing_ok=True)
        target.unlink(missing_ok=True)
        db.rollback()
        raise
    return PhotoAssetCapability(asset_id, token, mime, width, height)


def _authorized(asset_id: str, token: str, db: Session) -> PropertyPhotoAssetRecord:
    record = db.get(PropertyPhotoAssetRecord, asset_id)
    if not record or not secrets.compare_digest(record.token_hash, _token_hash(token)):
        raise HTTPException(404, 'Photo not found.')
    return record


def read_photo_asset(asset_id: str, token: str, db: Session) -> tuple[str, bytes]:
    record = _authorized(asset_id, token, db)
    path = _asset_path(record.relative_path)
    if not path.is_file():
        raise HTTPException(404, 'Photo file is missing.')
    data = path.read_bytes()
    record.last_accessed_at = datetime.now(timezone.utc)
    db.commit()
    return record.mime, data


def delete_photo_asset(asset_id: str, token: str, db: Session) -> None:
    record = _authorized(asset_id, token, db)
    _asset_path(record.relative_path).unlink(missing_ok=True)
    db.delete(record)
    db.commit()


def expire_photo_assets(db: Session, now: datetime | None = None) -> int:
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=RETENTION_DAYS)
    records = list(db.scalars(select(PropertyPhotoAssetRecord).where(
        PropertyPhotoAssetRecord.last_accessed_at < cutoff)))
    for record in records:
        _asset_path(record.relative_path).unlink(missing_ok=True)
        db.delete(record)
    db.commit()
    return len(records)
