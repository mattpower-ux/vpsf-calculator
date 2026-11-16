from copy import deepcopy

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models import CertificationDraftRecord, CertificationLibraryRecord, ScoringDraftRecord, ScoringModelRecord
from app.certification_store import library_draft, publish_library, save_library_draft
from app.scoring.catalog import Factor
from app.scoring.seed import seed_model_v1
from app.scoring.store import (
    ConflictError, load_or_create_draft, load_published, migrate_certifications,
    publish_draft, save_draft, seed_published,
)


@pytest.fixture
def engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'publication.db'}")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.mark.parametrize('ambiguous', [False, True])
def test_migration_preserves_pending_draft_payload_and_revision(engine, ambiguous):
    with Session(engine) as db:
        old = seed_model_v1()
        draft = old.model_copy(deep=True)
        draft.factors[0].options['Code-Minimum'] = 43
        if ambiguous:
            draft.factors.append(Factor(id='custom_cert', label='Needs review', pillar='health',
                                        field='healthCert', mode='contains', matches=['Indoor'], points=7))
        raw = draft.model_dump()
        db.add(ScoringModelRecord(version=old.version, payload=old.model_dump(), active=True))
        db.add(ScoringDraftRecord(id=1, revision=7, payload=deepcopy(raw)))
        db.commit()
        migrate_certifications(db)
        assert db.get(ScoringDraftRecord, 1).payload == raw
        assert db.get(ScoringDraftRecord, 1).revision == 7
        assert load_published(db).certificationLibraryVersion == 'certifications-v1'
        with pytest.raises(ConflictError, match='rebase.*preview'):
            publish_draft(db, 7, 'test')


def test_library_publication_requires_explicit_draft_rebase(engine):
    with Session(engine) as db:
        seed_published(db)
        draft, revision = load_or_create_draft(db)
        draft.factors[0].options['Code-Minimum'] = 43
        revision = save_draft(db, draft, revision)
        before = deepcopy(db.get(ScoringDraftRecord, 1).payload)
        _, library_revision = library_draft(db)
        library, _ = publish_library(db, library_revision)
        with pytest.raises(ConflictError, match='rebase.*preview'):
            publish_draft(db, revision, 'test')
        assert db.get(ScoringDraftRecord, 1).payload == before
        assert db.get(ScoringDraftRecord, 1).revision == revision
        assert load_published(db).certificationLibraryVersion == library.version


def test_explicit_rebase_preserves_weights_and_checks_revision(engine):
    from app.scoring.store import rebase_draft
    with Session(engine) as db:
        seed_published(db)
        draft, revision = load_or_create_draft(db)
        draft.factors[0].options['Code-Minimum'] = 43
        revision = save_draft(db, draft, revision)
        _, library_revision = library_draft(db)
        library, _ = publish_library(db, library_revision)
        rebased, new_revision = rebase_draft(db, revision, 'test')
        assert new_revision == revision + 1
        assert rebased.certificationLibraryVersion == library.version
        assert rebased.factors == draft.factors
        with pytest.raises(ConflictError):
            rebase_draft(db, revision, 'test')
        published = publish_draft(db, new_revision, 'test')
        assert published.factors[0].options['Code-Minimum'] == 43


def test_explicit_rebase_migrates_legacy_draft_without_overwriting_custom_weights(engine):
    from app.scoring.store import rebase_draft
    with Session(engine) as db:
        seed_published(db)
        legacy = seed_model_v1()
        legacy.factors[0].options['Code-Minimum'] = 43
        db.add(ScoringDraftRecord(id=1, revision=7, payload=legacy.model_dump()))
        db.commit()
        rebased, revision = rebase_draft(db, 7, 'test')
        assert revision == 8
        assert rebased.certificationLibraryVersion == load_published(db).certificationLibraryVersion
        assert rebased.factors[0].options['Code-Minimum'] == 43
        assert next(f for f in rebased.factors if f.field == 'waterStandard').options['WaterSense Home v2'] == 20


def test_report_only_roof_factor_cannot_publish(engine):
    with Session(engine) as db:
        seed_published(db)
        original = load_published(db)
        draft, revision = load_or_create_draft(db)
        draft.factors.append(Factor(id='roof_bonus', label='Roof rating', pillar='resilience',
                                   field='roofFireRating', mode='equals', matches=['Class A'], points=40))
        revision = save_draft(db, draft, revision)
        with pytest.raises(ValueError, match='report-only'):
            publish_draft(db, revision, 'test')
        assert load_published(db) == original
        assert db.get(ScoringDraftRecord, 1).revision == revision


def test_all_startup_upgrades_preserve_pending_draft(engine):
    with Session(engine) as db:
        legacy = seed_model_v1()
        raw = legacy.model_dump()
        raw['version'] = 'pending-custom-work'
        db.add(ScoringModelRecord(version=legacy.version, payload=legacy.model_dump(), active=True))
        db.add(ScoringDraftRecord(id=1, revision=9, payload=deepcopy(raw)))
        db.commit()
        seed_published(db)
        seed_published(db)
        assert db.get(ScoringDraftRecord, 1).payload == raw
        assert db.get(ScoringDraftRecord, 1).revision == 9


def test_ambiguous_legacy_rebase_leaves_draft_and_publication_unchanged(engine):
    from app.scoring.store import rebase_draft
    with Session(engine) as db:
        seed_published(db)
        original = load_published(db)
        legacy = seed_model_v1()
        legacy.factors.append(Factor(id='custom_cert', label='Needs review', pillar='health',
                                    field='healthCert', mode='contains', matches=['Indoor'], points=7))
        raw = legacy.model_dump()
        db.add(ScoringDraftRecord(id=1, revision=7, payload=deepcopy(raw)))
        db.commit()
        with pytest.raises(ValueError, match='custom_cert'):
            rebase_draft(db, 7, 'test')
        assert db.get(ScoringDraftRecord, 1).payload == raw
        assert db.get(ScoringDraftRecord, 1).revision == 7
        assert load_published(db) == original


@pytest.mark.parametrize('kind', ['scoring', 'library'])
def test_draft_revision_conflict_rolls_back_active_deactivation(engine, monkeypatch, kind):
    with Session(engine) as setup:
        seed_published(setup)
        original = load_published(setup)
        scoring, scoring_revision = load_or_create_draft(setup)
        library, library_revision = library_draft(setup)
    with Session(engine) as loser:
        scalar = loser.scalar
        interrupted = False

        def read_then_save_draft(statement, *args, **kwargs):
            nonlocal interrupted
            result = scalar(statement, *args, **kwargs)
            if not interrupted and isinstance(result, ScoringModelRecord) and result.active:
                interrupted = True
                with Session(engine) as editor:
                    if kind == 'scoring':
                        scoring.factors[0].options['Code-Minimum'] = 44
                        save_draft(editor, scoring, scoring_revision)
                    else:
                        save_library_draft(editor, library, library_revision)
            return result

        monkeypatch.setattr(loser, 'scalar', read_then_save_draft)
        with pytest.raises(ConflictError, match='[Dd]raft changed'):
            if kind == 'scoring':
                publish_draft(loser, scoring_revision, 'test')
            else:
                publish_library(loser, library_revision)
    with Session(engine) as check:
        assert load_published(check) == original
        assert len(check.scalars(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True))).all()) == 1


@pytest.mark.parametrize('loser_kind', ['scoring', 'library'])
def test_competing_publication_rolls_back_loser_and_leaves_one_active_model(engine, monkeypatch, loser_kind):
    with Session(engine) as setup:
        seed_published(setup)
        _, scoring_revision = load_or_create_draft(setup)
        _, library_revision = library_draft(setup)
        original_scoring = deepcopy(setup.get(ScoringDraftRecord, 1).payload)
        original_library = deepcopy(setup.get(CertificationDraftRecord, 1).payload)
    winner_model = None
    with Session(engine) as loser:
        scalar = loser.scalar
        interrupted = False

        def read_then_competitor_publishes(statement, *args, **kwargs):
            nonlocal interrupted, winner_model
            result = scalar(statement, *args, **kwargs)
            if not interrupted and isinstance(result, ScoringModelRecord) and result.active:
                interrupted = True
                # Real second session commits after loser reads the old active
                # record, before loser writes. No production behavior is mocked.
                with Session(engine) as winner:
                    if loser_kind == 'scoring':
                        publish_library(winner, library_revision)
                    else:
                        publish_draft(winner, scoring_revision, 'winner')
                    winner_model = load_published(winner)
            return result

        monkeypatch.setattr(loser, 'scalar', read_then_competitor_publishes)
        with pytest.raises(ConflictError, match='Published.*changed'):
            if loser_kind == 'scoring':
                publish_draft(loser, scoring_revision, 'loser')
            else:
                publish_library(loser, library_revision)
        assert interrupted
    with Session(engine) as check:
        active = check.scalars(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True))).all()
        assert len(active) == 1
        assert active[0].version == winner_model.version
        if loser_kind == 'scoring':
            assert check.get(ScoringDraftRecord, 1).payload == original_scoring
            assert check.get(ScoringDraftRecord, 1).revision == scoring_revision
        else:
            assert check.get(CertificationDraftRecord, 1).payload == original_library
            assert check.get(CertificationDraftRecord, 1).revision == library_revision
            assert len(check.scalars(select(CertificationLibraryRecord)).all()) == 1
