from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base, get_db
from app.models import ScoreRunRecord
from app.routers import admin, scoring
from app.scoring.store import seed_published


def test_admin_publish_changes_only_new_scores_and_form(tmp_path, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "scoring-lifecycle-test")
    engine = create_engine(f"sqlite:///{tmp_path / 'models.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_published(db)
    application = FastAPI()
    application.include_router(admin.router)
    application.include_router(scoring.router)

    def session():
        with Session(engine) as db:
            yield db

    application.dependency_overrides[get_db] = session
    with TestClient(application) as client:
        before = client.post("/api/score", json={"address": "10 Test St"}).json()
        token = client.post("/api/admin/session", json={"password": "scoring-lifecycle-test"}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        draft = client.get("/api/admin/scoring/draft", headers=headers).json()
        draft["model"]["customFields"].append({"id": "attic_r", "label": "Attic R-value", "pillar": "energy", "kind": "number", "minimum": 0, "maximum": 100})
        draft["model"]["factors"].append({"id": "attic_bonus", "label": "Attic insulation", "pillar": "energy", "field": "attic_r", "mode": "number_range", "lower": 40, "points": 5})
        saved = client.put("/api/admin/scoring/draft", json=draft, headers=headers)
        assert saved.status_code == 200
        assert client.get("/api/scoring/form-fields").json() == []
        published = client.post("/api/admin/scoring/publish", json={"revision": saved.json()["revision"]}, headers=headers)
        assert published.status_code == 200
        assert client.get("/api/scoring/form-fields").json()[0]["id"] == "attic_r"
        after = client.post("/api/score", json={"address": "10 Test St", "extraInputs": {"attic_r": 45}})
        assert after.status_code == 200
        assert after.json()["scores"]["energy"] == before["scores"]["energy"] + 5
        assert after.json()["modelVersion"] != before["modelVersion"]
        assert client.post("/api/score", json={"extraInputs": {"attic_r": 101}}).status_code == 422
        assert client.post("/api/score", json={"extraInputs": {"unknown": 1}}).status_code == 422
        with Session(engine) as db:
            old = db.get(ScoreRunRecord, before["scoreRunId"])
            assert old.model_version == before["modelVersion"]
            assert old.scores["energy"] == before["scores"]["energy"]
    engine.dispose()
