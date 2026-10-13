import hashlib
import hmac
import os
import secrets
from datetime import timedelta, timezone

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminLoginAttemptRecord, AdminSessionRecord, utc_now


def _hash(token: str, password: str) -> str:
    return hmac.new(password.encode(), token.encode(), hashlib.sha256).hexdigest()


def create_session(password: str, request: Request, db: Session) -> str:
    now = utc_now()
    key = request.client.host if request.client else "unknown"
    window = now - timedelta(minutes=15)
    db.execute(delete(AdminLoginAttemptRecord).where(AdminLoginAttemptRecord.attempted_at < window))
    failures = db.scalar(select(func.count()).select_from(AdminLoginAttemptRecord).where(AdminLoginAttemptRecord.client_key == key)) or 0
    if failures >= 5:
        db.commit()
        raise HTTPException(status_code=429, detail="Too many login attempts; try again later")
    expected = os.getenv("ADMIN_PASSWORD", "")
    if not expected or not hmac.compare_digest(password, expected):
        db.add(AdminLoginAttemptRecord(client_key=key))
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    db.execute(delete(AdminLoginAttemptRecord).where(AdminLoginAttemptRecord.client_key == key))
    token = secrets.token_urlsafe(32)
    db.add(AdminSessionRecord(token_hash=_hash(token, expected), expires_at=now + timedelta(hours=8)))
    db.commit()
    return token


def require_admin_session(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> AdminSessionRecord:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Admin session required")
    password = os.getenv("ADMIN_PASSWORD", "")
    if not password:
        raise HTTPException(status_code=401, detail="Admin login is not configured")
    record = db.scalar(select(AdminSessionRecord).where(AdminSessionRecord.token_hash == _hash(token, password)))
    if not record or record.revoked_at:
        raise HTTPException(status_code=401, detail="Invalid admin session")
    expiry = record.expires_at.replace(tzinfo=timezone.utc) if record.expires_at.tzinfo is None else record.expires_at
    if expiry <= utc_now():
        raise HTTPException(status_code=401, detail="Admin session expired")
    return record
