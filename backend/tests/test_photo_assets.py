from datetime import datetime, timedelta, timezone
import io

import pytest
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import models
from app.config import get_settings
from app.db import Base
from app.photo_assets import (
    delete_photo_asset, expire_photo_assets, read_photo_asset, store_photo_asset)


def image_bytes(fmt='JPEG', size=(640, 420), metadata=False):
    output = io.BytesIO()
    kwargs = {'exif': b'Exif\x00\x00secret-location'} if metadata and fmt == 'JPEG' else {}
    Image.new('RGB', size, '#789').save(output, fmt, **kwargs)
    return output.getvalue()


@pytest.fixture
def storage(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), 'photo_storage_path', str(tmp_path))
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return tmp_path, engine


def test_store_read_delete_uses_sharded_disk_and_hashed_token(storage):
    root, engine = storage
    with Session(engine) as db:
        capability = store_photo_asset(image_bytes(metadata=True), 'image/jpeg', '22-dow', 'roof', db)
        record = db.get(models.PropertyPhotoAssetRecord, capability.asset_id)
        assert record.token_hash != capability.token and len(record.token_hash) == 64
        assert record.relative_path.startswith(capability.asset_id[:2] + '/')
        path = root / record.relative_path
        assert path.is_file() and b'secret-location' not in path.read_bytes()
        mime, data = read_photo_asset(capability.asset_id, capability.token, db)
        assert mime == 'image/jpeg' and data.startswith(b'\xff\xd8')
        with pytest.raises(HTTPException):
            read_photo_asset(capability.asset_id, 'wrong', db)
        delete_photo_asset(capability.asset_id, capability.token, db)
        assert not path.exists() and db.get(models.PropertyPhotoAssetRecord, capability.asset_id) is None


def test_store_rejects_invalid_mime_signature_size_and_dimensions(storage):
    _, engine = storage
    with Session(engine) as db:
        for data, mime in [(b'not-image', 'image/jpeg'), (image_bytes(), 'text/plain')]:
            with pytest.raises(HTTPException): store_photo_asset(data, mime, 'home', '', db)
        with pytest.raises(HTTPException):
            store_photo_asset(image_bytes(size=(50, 50)), 'image/jpeg', 'home', '', db)


def test_expire_assets_removes_old_file_and_record(storage):
    root, engine = storage
    with Session(engine) as db:
        cap = store_photo_asset(image_bytes(), 'image/jpeg', 'home', '', db)
        record = db.get(models.PropertyPhotoAssetRecord, cap.asset_id)
        path = root / record.relative_path
        record.last_accessed_at = datetime.now(timezone.utc) - timedelta(days=366)
        db.commit()
        assert expire_photo_assets(db) == 1
        assert not path.exists() and db.get(models.PropertyPhotoAssetRecord, cap.asset_id) is None
