import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.scoring.store import ConflictError, load_or_create_draft, load_published, publish_draft, save_draft, seed_published


@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_seed_and_draft_survive_reload(session):
    seed_published(session)
    seed_published(session)
    assert load_published(session).version == "vpsf-0.2.0-usfs"
    model, revision = load_or_create_draft(session)
    model.factors[0].options["Code-Minimum"] = 41
    assert save_draft(session, model, revision) == revision + 1
    with pytest.raises(ConflictError):
        save_draft(session, model, revision)
    reloaded, new_revision = load_or_create_draft(session)
    assert new_revision == revision + 1
    assert reloaded.factors[0].options["Code-Minimum"] == 41
    assert load_published(session).factors[0].options["Code-Minimum"] == 40


def test_publish_keeps_old_version_immutable(session):
    seed_published(session)
    model, revision = load_or_create_draft(session)
    model.factors[0].options["Code-Minimum"] = 42
    revision = save_draft(session, model, revision)
    published = publish_draft(session, revision, "admin")
    assert published.version != "vpsf-0.2.0-usfs"
    assert load_published(session).factors[0].options["Code-Minimum"] == 42
