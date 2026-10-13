from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal, init_db
from app.main import app
from app.models import AdminLoginAttemptRecord, AdminSessionRecord, utc_now


client = TestClient(app)


def test_admin_login_and_protected_routes(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "test-admin-password")
    init_db()
    assert client.get("/api/admin/summary").status_code == 401
    assert client.post("/api/admin/session", json={"password": "wrong"}).status_code == 401
    response = client.post("/api/admin/session", json={"password": "test-admin-password"})
    assert response.status_code == 200
    token = response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/admin/summary", headers=headers).status_code == 200
    assert client.delete("/api/admin/session", headers=headers).status_code == 204
    assert client.get("/api/admin/summary", headers=headers).status_code == 401


def test_expired_session_is_rejected(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "test-admin-password")
    init_db()
    token = client.post("/api/admin/session", json={"password": "test-admin-password"}).json()["token"]
    with SessionLocal() as db:
        record = db.scalar(select(AdminSessionRecord).order_by(AdminSessionRecord.id.desc()))
        record.expires_at = utc_now() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/admin/summary", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_rotating_password_revokes_existing_session(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "first-password")
    init_db()
    token = client.post("/api/admin/session", json={"password": "first-password"}).json()["token"]
    monkeypatch.setenv("ADMIN_PASSWORD", "replacement-password")
    assert client.get("/api/admin/summary", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_repeated_bad_passwords_are_throttled(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "test-admin-password")
    init_db()
    for _ in range(5):
        assert client.post("/api/admin/session", json={"password": "wrong"}).status_code == 401
    assert client.post("/api/admin/session", json={"password": "test-admin-password"}).status_code == 429
    with SessionLocal() as db:
        db.execute(delete(AdminLoginAttemptRecord).where(AdminLoginAttemptRecord.client_key == "testclient"))
        db.commit()
