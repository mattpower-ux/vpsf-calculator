from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import ScoringAuditRecord, ScoringDraftRecord, ScoringModelRecord, utc_now
from app.scoring.catalog import ScoreModel
from app.scoring.seed import seed_model_v1
from app.scoring.heating_resilience import UPGRADE_SUFFIX, with_heating_resilience


class ConflictError(Exception):
    pass


class ModelUnavailableError(Exception):
    pass


def seed_published(db: Session) -> None:
    if db.scalar(select(ScoringModelRecord.id).limit(1)) is None:
        model = seed_model_v1()
        db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(), active=True))
        db.commit()
    previous = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True)).with_for_update())
    # Keep the migration in history so retiring a factor later stays respected.
    if db.scalar(select(ScoringModelRecord.id).where(ScoringModelRecord.version.endswith(UPGRADE_SUFFIX)).limit(1)) is not None:
        db.rollback()
        return
    if previous is None:
        raise ModelUnavailableError("No published scoring model")
    model = with_heating_resilience(ScoreModel.model_validate(previous.payload))
    previous.active = False
    db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(), active=True))
    draft = db.get(ScoringDraftRecord, 1)
    if draft is not None:
        draft.payload = with_heating_resilience(ScoreModel.model_validate(draft.payload)).model_dump()
        draft.revision += 1
    db.add(ScoringAuditRecord(action="upgrade", actor="deployment", version=model.version, revision=draft.revision if draft else 0))
    db.commit()


def load_published(db: Session) -> ScoreModel:
    record = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True)))
    if record is None:
        raise ModelUnavailableError("No published scoring model")
    return ScoreModel.model_validate(record.payload)


def load_or_create_draft(db: Session) -> tuple[ScoreModel, int]:
    record = db.get(ScoringDraftRecord, 1)
    if record is None:
        model = load_published(db)
        record = ScoringDraftRecord(id=1, revision=1, payload=model.model_dump())
        db.add(record)
        db.commit()
    return ScoreModel.model_validate(record.payload), record.revision


def save_draft(db: Session, model: ScoreModel, expected_revision: int) -> int:
    result = db.execute(
        update(ScoringDraftRecord)
        .where(ScoringDraftRecord.id == 1, ScoringDraftRecord.revision == expected_revision)
        .values(payload=model.model_dump(), revision=expected_revision + 1, updated_at=utc_now())
    )
    if result.rowcount != 1:
        db.rollback()
        raise ConflictError("Draft changed in another session")
    db.add(ScoringAuditRecord(action="save", actor="admin", revision=expected_revision + 1, version=model.version))
    db.commit()
    return expected_revision + 1


def publish_draft(db: Session, expected_revision: int, actor: str) -> ScoreModel:
    draft = db.get(ScoringDraftRecord, 1)
    if draft is None or draft.revision != expected_revision:
        raise ConflictError("Draft changed in another session")
    model = ScoreModel.model_validate(draft.payload)
    if sum(model.pillars.values()) != 1000:
        raise ValueError("Pillar budgets must total exactly 1,000")
    previous = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True)))
    if previous is None:
        raise ModelUnavailableError("No published scoring model")
    next_number = (db.scalar(select(ScoringModelRecord.id).order_by(ScoringModelRecord.id.desc()).limit(1)) or 0) + 1
    model.version = f"vpsf-model-{next_number}"
    result = db.execute(update(ScoringDraftRecord).where(ScoringDraftRecord.id == 1, ScoringDraftRecord.revision == expected_revision).values(revision=expected_revision + 1, payload=model.model_dump()))
    if result.rowcount != 1:
        db.rollback()
        raise ConflictError("Draft changed in another session")
    previous.active = False
    db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(), active=True))
    db.add(ScoringAuditRecord(action="publish", actor=actor, revision=expected_revision, version=model.version))
    db.commit()
    return model


def model_history(db: Session) -> list[dict]:
    records = db.scalars(select(ScoringModelRecord).order_by(ScoringModelRecord.id.desc())).all()
    return [{"version": row.version, "active": row.active, "createdAt": row.created_at.isoformat()} for row in records]
