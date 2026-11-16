from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import ScoringAuditRecord, ScoringDraftRecord, ScoringModelRecord, utc_now
from app.scoring.catalog import ScoreModel
from app.scoring.seed import seed_model_v1
from app.scoring.heating_resilience import UPGRADE_SUFFIX, with_heating_resilience


from app.scoring.siding import SIDING_SUFFIX, with_noncombustible_siding


class ConflictError(Exception):
    pass


class ModelUnavailableError(Exception):
    pass


def deactivate_published(db: Session, record_id: int) -> None:
    """Claim the active record in the publication transaction shared by both stores."""
    result = db.execute(
        update(ScoringModelRecord)
        .where(ScoringModelRecord.id == record_id, ScoringModelRecord.active.is_(True))
        .values(active=False)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise ConflictError("Published scoring model changed; reload and re-preview before publishing")


def seed_published(db: Session) -> None:
    if db.scalar(select(ScoringModelRecord.id).limit(1)) is None:
        model = seed_model_v1()
        db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(), active=True))
        db.commit()

    for suffix, upgrade in [(UPGRADE_SUFFIX, with_heating_resilience), (SIDING_SUFFIX, with_noncombustible_siding)]:
        # History prevents deployment from restoring a factor an admin retired.
        if db.scalar(select(ScoringModelRecord.id).where(ScoringModelRecord.version.endswith(suffix)).limit(1)) is not None:
            continue
        previous = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True)).with_for_update())
        if previous is None:
            raise ModelUnavailableError("No published scoring model")
        model = upgrade(ScoreModel.model_validate(previous.payload))
        deactivate_published(db, previous.id)
        db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(), active=True))
        draft = db.get(ScoringDraftRecord, 1)
        # Pending drafts are administrator work, never deployment-owned data.
        db.add(ScoringAuditRecord(action="upgrade", actor="deployment", version=model.version, revision=draft.revision if draft else 0))
        db.commit()

    migrate_certifications(db)


def migrate_certifications(db: Session) -> None:
    from app.certification_store import seed_library
    from app.scoring.certifications import with_certification_features, CERTIFICATION_MODEL_SUFFIX
    seed_library(db)
    # Never restore retired factors on later startups; preserve history.
    if db.scalar(select(ScoringModelRecord.id).where(ScoringModelRecord.version.endswith(CERTIFICATION_MODEL_SUFFIX)).limit(1)) is not None:
        db.commit()
        return
    previous = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True)).with_for_update())
    if previous is None:
        raise ModelUnavailableError('No published scoring model')
    model = with_certification_features(ScoreModel.model_validate(previous.payload))
    draft = db.get(ScoringDraftRecord, 1)
    # Leave pending drafts byte-for-byte unchanged. Publication requires an
    # explicit rebase; ambiguous custom draft rules cannot block this upgrade.
    deactivate_published(db, previous.id)
    db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(), active=True))
    db.add(ScoringAuditRecord(action='certification-upgrade', actor='deployment', version=model.version, revision=draft.revision if draft else 0))
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
    library_version = previous.payload.get('certificationLibraryVersion')
    if model.certificationLibraryVersion != library_version:
        raise ConflictError("Certification library changed; explicitly rebase the scoring draft and re-preview before publishing")
    if library_version:
        validate_feature_only_model(model)
    deactivate_published(db, previous.id)
    next_number = (db.scalar(select(ScoringModelRecord.id).order_by(ScoringModelRecord.id.desc()).limit(1)) or 0) + 1
    model.version = f"vpsf-model-{next_number}"
    result = db.execute(update(ScoringDraftRecord).where(ScoringDraftRecord.id == 1, ScoringDraftRecord.revision == expected_revision).values(revision=expected_revision + 1, payload=model.model_dump()))
    if result.rowcount != 1:
        db.rollback()
        raise ConflictError("Draft changed in another session")
    db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(), active=True))
    db.add(ScoringAuditRecord(action="publish", actor=actor, revision=expected_revision, version=model.version))
    db.commit()
    return model


def rebase_draft(db: Session, expected_revision: int, actor: str = "admin") -> tuple[ScoreModel, int]:
    """Explicitly adopt the current library, retaining custom weights for preview."""
    draft = db.get(ScoringDraftRecord, 1)
    if draft is None or draft.revision != expected_revision:
        raise ConflictError("Draft changed in another session")
    current = load_published(db)
    if not current.certificationLibraryVersion:
        raise ValueError("Migrate the scoring model before rebasing certification rules")
    model = ScoreModel.model_validate(draft.payload)
    if not model.certificationLibraryVersion:
        from app.scoring.certifications import with_certification_features
        model = with_certification_features(model)
    model.certificationLibraryVersion = current.certificationLibraryVersion
    validate_feature_only_model(model)
    revision = expected_revision + 1
    result = db.execute(update(ScoringDraftRecord).where(
        ScoringDraftRecord.id == 1, ScoringDraftRecord.revision == expected_revision
    ).values(payload=model.model_dump(), revision=revision, updated_at=utc_now()))
    if result.rowcount != 1:
        db.rollback()
        raise ConflictError("Draft changed in another session")
    db.add(ScoringAuditRecord(action="certification-rebase", actor=actor, revision=revision, version=current.version))
    db.commit()
    return model, revision


def model_history(db: Session) -> list[dict]:
    records = db.scalars(select(ScoringModelRecord).order_by(ScoringModelRecord.id.desc())).all()
    return [{"version": row.version, "active": row.active, "createdAt": row.created_at.isoformat()} for row in records]


def validate_feature_only_model(model: ScoreModel):
    from app.schemas import PropertyInput
    from app.scoring.catalog import factor_points
    for factor in model.factors:
        if not factor.active:
            continue
        if factor.field == 'roofFireRating':
            raise ValueError('Roof fire rating is report-only and cannot receive scoring points')
        if factor.field in {'fortified', 'healthCert', 'waterStandard', 'certifications'}:
            if factor.mode != 'lookup' or any(v != factor.default for v in factor.options.values()):
                raise ValueError('Use physical features, not direct certificate bonuses')
        if factor.field == 'carbonStrategy':
            certified = factor_points(PropertyInput(carbonStrategy='Zero Carbon Certified'), factor)
            baseline = factor_points(PropertyInput(carbonStrategy='No Accounting'), factor)
            if certified != baseline:
                raise ValueError('Use physical features, not direct certificate bonuses')
