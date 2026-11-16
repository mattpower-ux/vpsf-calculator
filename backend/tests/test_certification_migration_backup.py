from contextlib import closing
import hashlib
import json
import os
import sqlite3
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session, sessionmaker

import app.db as database
from app.db import Base
from app.models import ScoringModelRecord, ScoreRunRecord
from app.schemas import PropertyInput
from app.scoring.catalog import evaluate_model
from app.scoring.seed import seed_model_v1


BACKUP_NAME = 'vpsf-before-certifications-2026-11-15.sqlite.bak'


@pytest.fixture
def legacy_database(tmp_path, monkeypatch):
    path = tmp_path / 'vpsf.db'
    bind = create_engine(f'sqlite:///{path}')
    with bind.connect() as connection:
        connection.exec_driver_sql('PRAGMA journal_mode=WAL')
    Base.metadata.create_all(bind, tables=[table for table in Base.metadata.sorted_tables
                                          if not table.name.startswith('certification_')])
    old = seed_model_v1()
    raw = PropertyInput(waterStandard='WaterSense Home v2').model_dump(mode='json')
    scores = evaluate_model(PropertyInput.model_validate(raw), old)
    with Session(bind) as session:
        session.add(ScoringModelRecord(version=old.version, payload=old.model_dump(), active=True))
        session.add(ScoreRunRecord(model_version=old.version, scores=scores, total=sum(scores.values()),
                                   grade='C', label='Historical', meaning='Saved before migration',
                                   explanations={}, confidence=60, input_snapshot=raw))
        session.commit()
    monkeypatch.setenv('RENDER', 'true')
    monkeypatch.setattr(database, 'engine', bind)
    monkeypatch.setattr(database, 'SessionLocal', sessionmaker(bind=bind, autoflush=False))
    monkeypatch.setattr(database, 'settings', SimpleNamespace(database_url=str(bind.url)))
    yield path, bind, old, scores, raw
    bind.dispose()


def test_startup_snapshots_old_scores_and_model_before_new_tables_and_never_overwrites(legacy_database):
    path, bind, old, scores, raw = legacy_database
    backup = path.with_name(BACKUP_NAME)
    database.init_db()
    assert backup.is_file()
    with closing(sqlite3.connect(backup)) as snapshot:
        assert snapshot.execute('PRAGMA integrity_check').fetchone() == ('ok',)
        tables = {row[0] for row in snapshot.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert 'certification_libraries' not in tables
        model = snapshot.execute('SELECT version, payload, active FROM scoring_models').fetchone()
        assert model[0] == old.version
        assert json.loads(model[1]) == old.model_dump()
        assert model[2] == 1
        saved = snapshot.execute('SELECT model_version, scores, total, input_snapshot FROM score_runs').fetchone()
        assert saved[0] == old.version
        assert json.loads(saved[1]) == scores
        assert saved[2] == sum(scores.values())
        assert json.loads(saved[3]) == raw
    digest = hashlib.sha256(backup.read_bytes()).hexdigest()
    with Session(bind) as session:
        assert session.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True))).payload['certificationLibraryVersion'] == 'certifications-v1'
        session.get(ScoreRunRecord, 1).total = 999
        session.commit()
    database.init_db()
    assert hashlib.sha256(backup.read_bytes()).hexdigest() == digest
    assert not list(path.parent.glob('.vpsf-certifications-backup-*.tmp'))


@pytest.mark.parametrize('failure_point', ['fsync', 'link'])
def test_backup_failure_aborts_startup_without_migration_or_partial_snapshot(legacy_database, monkeypatch, failure_point):
    path, bind, old, _, _ = legacy_database
    def fail(*args, **kwargs):
        raise OSError('simulated backup storage failure')
    monkeypatch.setattr(os, failure_point, fail)
    with pytest.raises(OSError, match='backup storage failure'):
        database.init_db()
    assert not path.with_name(BACKUP_NAME).exists()
    assert not list(path.parent.glob('.vpsf-certifications-backup-*.tmp'))
    assert 'certification_libraries' not in inspect(bind).get_table_names()
    with Session(bind) as session:
        records = session.scalars(select(ScoringModelRecord)).all()
        assert len(records) == 1
        assert records[0].payload == old.model_dump()
        assert records[0].active


def test_competing_worker_backup_does_not_overwrite_published_snapshot(legacy_database, monkeypatch):
    path, _, _, _, _ = legacy_database
    original_link = os.link
    def competitor_wins(source, destination):
        original_link(source, destination)
        raise FileExistsError('another worker already published')
    monkeypatch.setattr(os, 'link', competitor_wins)
    database.init_db()
    with closing(sqlite3.connect(path.with_name(BACKUP_NAME))) as snapshot:
        assert snapshot.execute('PRAGMA integrity_check').fetchone() == ('ok',)
        assert snapshot.execute('SELECT count(*) FROM scoring_models').fetchone() == (1,)
    assert not list(path.parent.glob('.vpsf-certifications-backup-*.tmp'))


def test_local_startup_does_not_create_render_backup(legacy_database, monkeypatch):
    path, _, _, _, _ = legacy_database
    monkeypatch.delenv('RENDER')
    database.init_db()
    assert not path.with_name(BACKUP_NAME).exists()
