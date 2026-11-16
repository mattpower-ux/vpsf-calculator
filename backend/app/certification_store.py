"""Immutable certification publications linked to versioned score models."""
from functools import lru_cache
import json
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.certifications import Library, get_reference_library
from app.models import CertificationLibraryRecord, CertificationDraftRecord, ScoringModelRecord, ScoringAuditRecord
from app.scoring.catalog import ScoreModel
from app.scoring.store import ConflictError, ModelUnavailableError, deactivate_published, validate_feature_only_model


def seed_library(db: Session):
    library = get_reference_library()
    if db.get(CertificationLibraryRecord, library.version) is None:
        db.add(CertificationLibraryRecord(version=library.version, payload=library.model_dump(mode='json')))
        db.flush()


@lru_cache(maxsize=32)
def _validated(payload: str):
    return Library.model_validate_json(payload)


def load_library(db: Session, version: str) -> Library:
    record = db.get(CertificationLibraryRecord, version)
    if record is None:
        raise ValueError('Certification reference version unavailable')
    return _validated(json.dumps(record.payload, sort_keys=True)).model_copy(deep=True)


def current_library(db: Session):
    record = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True)))
    if record is None:
        raise ValueError('Scoring model unavailable')
    version = record.payload.get('certificationLibraryVersion')
    return load_library(db, version) if version else get_reference_library()


def library_draft(db: Session):
    draft = db.get(CertificationDraftRecord, 1)
    if draft is None:
        draft = CertificationDraftRecord(id=1, revision=1, payload=current_library(db).model_dump(mode='json'))
        db.add(draft)
        db.commit()
    return Library.model_validate(draft.payload), draft.revision


def save_library_draft(db: Session, library: Library, revision: int):
    result = db.execute(update(CertificationDraftRecord).where(
        CertificationDraftRecord.id == 1, CertificationDraftRecord.revision == revision
    ).values(payload=library.model_dump(mode='json'), revision=revision + 1))
    if result.rowcount != 1:
        db.rollback()
        raise ConflictError('Certification draft changed; reload before saving')
    db.add(ScoringAuditRecord(action='certification-save', actor='admin', revision=revision + 1, version=library.version))
    db.commit()
    return revision + 1


def publish_library(db: Session, revision: int):
    draft = db.get(CertificationDraftRecord, 1)
    if draft is None or draft.revision != revision:
        raise ConflictError('Certification draft changed; reload before publishing')
    library = Library.model_validate(draft.payload)
    published = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.active.is_(True)))
    if published is None:
        raise ModelUnavailableError('No published scoring model')
    model = ScoreModel.model_validate(published.payload)
    if not model.certificationLibraryVersion:
        raise ValueError('Migrate the scoring model before publishing certification rules')
    validate_feature_only_model(model)
    deactivate_published(db, published.id)
    library.version = 'certifications-' + uuid4().hex[:16]
    model.certificationLibraryVersion = library.version
    model.version = 'vpsf-cert-' + uuid4().hex[:16]
    result = db.execute(update(CertificationDraftRecord).where(
        CertificationDraftRecord.id == 1, CertificationDraftRecord.revision == revision
    ).values(payload=library.model_dump(mode='json'), revision=revision + 1))
    if result.rowcount != 1:
        db.rollback()
        raise ConflictError('Certification draft changed; reload before publishing')
    db.add(CertificationLibraryRecord(version=library.version, payload=library.model_dump(mode='json')))
    db.add(ScoringModelRecord(version=model.version, payload=model.model_dump(mode='json'), active=True))
    db.add(ScoringAuditRecord(action='certification-publish', actor='admin', revision=revision + 1, version=library.version))
    # Scoring drafts retain their weights. Publication checks the library pointer
    # to prevent a stale draft silently restoring a previous library.
    db.commit()
    return library, revision + 1
