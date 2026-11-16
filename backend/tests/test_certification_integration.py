from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base, get_db
from app.main import app
from app.models import ScoreRunRecord
from app.scoring.store import seed_published


def test_new_model_rejects_reintroduced_certificate_bonus(tmp_path):
    import pytest
    from app.scoring.store import load_or_create_draft, save_draft, publish_draft
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_published(db)
        model, revision = load_or_create_draft(db)
        next(f for f in model.factors if f.field == 'waterStandard').options['WaterSense Home v2'] = 60
        revision = save_draft(db, model, revision)
        with pytest.raises(ValueError, match='certificate'):
            publish_draft(db, revision, 'test')
    engine.dispose()


def test_certificate_removal_duplicate_and_correction_change_only_feature_points(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'lifecycle.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_published(db)
    def session():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = session
    try:
        with TestClient(app) as client:
            claim = {'programId':'watersense-homes','edition':'2.0','level':'Certified','propertyAddress':'10 Test St','issuedDate':'2025-01-01'}
            raw = {'address':'10 Test St','certifications':[claim]}
            first = client.post('/api/score', json=raw).json()
            assert first['scores']['water'] == 35
            assert len(first['certificationEvidence']['derivedFeatures']) == 3
            duplicate = client.post('/api/score', json={**raw,'certifications':[claim,claim]}).json()
            assert duplicate['scores'] == first['scores']
            correction = client.post('/api/score', json={**raw,'toilets':'Standard','provenance':{'toilets':{'origin':'user-confirmed'}}}).json()
            assert correction['scores']['water'] == 30
            removed = client.post('/api/score', json={'address':'10 Test St'}).json()
            assert removed['scores']['water'] == 20
            with Session(engine) as db:
                snapshot = db.get(ScoreRunRecord, first['scoreRunId']).input_snapshot
                assert snapshot['toilets'] == 'Unknown'
                assert snapshot['effectiveInput']['toilets'] == 'WaterSense'
                assert len(snapshot['certificationEvidence']['derivedFeatures']) == 3
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_certification_admin_requires_login_and_rejects_stale_drafts(tmp_path, monkeypatch):
    monkeypatch.setenv('ADMIN_PASSWORD', 'cert-test-password')
    engine = create_engine(f"sqlite:///{tmp_path / 'admin.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_published(db)
    def session():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = session
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            assert client.get('/api/admin/certifications').status_code == 401
            token = client.post('/api/admin/session', json={'password':'cert-test-password'}).json()['token']
            headers = {'Authorization': 'Bearer ' + token}
            assert client.post('/api/admin/scoring/rebase', json={'revision':1}).status_code == 401
            score_draft = client.get('/api/admin/scoring/draft', headers=headers).json()
            draft = client.get('/api/admin/certifications', headers=headers).json()
            original = draft['library']['version']
            draft['library']['programs'][0]['editions'][0]['rules'][0]['enabled'] = False
            saved = client.put('/api/admin/certifications', headers=headers, json=draft)
            assert saved.status_code == 200
            assert client.put('/api/admin/certifications', headers=headers, json=draft).status_code == 409
            published = client.post('/api/admin/certifications/publish', headers=headers, json={'revision':saved.json()['revision']})
            assert published.status_code == 200
            assert published.json()['library']['version'] != original
            assert client.post('/api/admin/certifications/publish', headers=headers, json={'revision':saved.json()['revision']}).status_code == 409
            assert len(client.get('/api/admin/certifications/history', headers=headers).json()) == 2
            assert client.post('/api/admin/scoring/publish', headers=headers, json={'revision':score_draft['revision']}).status_code == 409
            rebased = client.post('/api/admin/scoring/rebase', headers=headers, json={'revision':score_draft['revision']})
            assert rebased.status_code == 200
            assert rebased.json()['model']['certificationLibraryVersion'] == published.json()['library']['version']
            assert rebased.json()['revision'] == score_draft['revision'] + 1
            assert client.post('/api/admin/scoring/rebase', headers=headers, json={'revision':score_draft['revision']}).status_code == 409
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_certificate_preview_and_scoring_keep_raw_input_and_corrected_features(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'certs.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_published(db)
    def session():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = session
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            catalog = client.get('/api/certifications/catalog')
            assert catalog.status_code == 200
            assert len(catalog.json()['programs']) >= 8
            home = {'address': '10 Test St', 'toilets': 'Low-flow', 'bathroomFaucets': 'WaterSense', 'showerheads': 'WaterSense'}
            result = client.post('/api/score', json=home)
            assert result.status_code == 200
            assert result.json()['scores']['water'] == 34
            assert result.json()['effectiveInput']['toilets'] == 'Low-flow'
            with Session(engine) as db:
                record = db.get(ScoreRunRecord, result.json()['scoreRunId'])
                assert record.input_snapshot['toilets'] == 'Low-flow'
                assert record.input_snapshot['certificationEvidence']['libraryVersion']
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
