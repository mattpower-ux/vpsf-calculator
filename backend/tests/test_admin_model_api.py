import os

from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app


client = TestClient(app)


def headers():
    os.environ["ADMIN_PASSWORD"] = "test-admin-password"
    token = client.post("/api/admin/session", json={"password": "test-admin-password"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_model_routes_are_admin_only_and_persist_edits():
    init_db()
    assert client.get("/api/admin/scoring/model").status_code == 401
    assert client.get("/api/admin/scoring/draft").status_code == 401
    auth = headers()
    published = client.get("/api/admin/scoring/model", headers=auth).json()
    assert len(published["factors"]) >= 30
    draft = client.get("/api/admin/scoring/draft", headers=auth).json()
    draft["model"]["factors"][0]["options"]["Code-Minimum"] = 43
    saved = client.put("/api/admin/scoring/draft", json=draft, headers=auth)
    assert saved.status_code == 200
    assert client.put("/api/admin/scoring/draft", json=draft, headers=auth).status_code == 409
    assert client.get("/api/admin/scoring/model", headers=auth).json()["factors"][0]["options"]["Code-Minimum"] == published["factors"][0]["options"]["Code-Minimum"]


def test_unbalanced_model_cannot_publish():
    init_db()
    auth = headers()
    draft = client.get("/api/admin/scoring/draft", headers=auth).json()
    draft["model"]["pillars"]["energy"] += 1
    saved = client.put("/api/admin/scoring/draft", json=draft, headers=auth)
    assert saved.status_code == 200
    assert client.post("/api/admin/scoring/publish", json={"revision": saved.json()["revision"]}, headers=auth).status_code == 422
