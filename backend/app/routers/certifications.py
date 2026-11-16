from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.admin_auth import require_admin_session
from app.certifications import Library, catalog_for_library
from app.certification_store import current_library, library_draft, save_library_draft, publish_library
from app.certification_resolution import resolve_home
from app.db import get_db
from app.models import CertificationLibraryRecord
from app.schemas import PropertyInput
from app.scoring.store import load_published, ConflictError

router = APIRouter(prefix='/api', tags=['certifications'])


@router.get('/certifications/catalog')
def catalog(db: Session = Depends(get_db)):
    return catalog_for_library(current_library(db))


@router.post('/certifications/preview')
def preview(home: PropertyInput, db: Session = Depends(get_db)):
    effective, evidence = resolve_home(home, load_published(db), db)
    return {**evidence, 'effectiveInput': effective.model_dump(mode='json')}


class DraftRequest(BaseModel):
    library: Library
    revision: int = Field(ge=1)


class PublishRequest(BaseModel):
    revision: int = Field(ge=1)


@router.get('/admin/certifications', dependencies=[Depends(require_admin_session)])
def get_draft(db: Session = Depends(get_db)):
    library, revision = library_draft(db)
    return {'library': library, 'revision': revision}


@router.put('/admin/certifications', dependencies=[Depends(require_admin_session)])
def save_draft(payload: DraftRequest, db: Session = Depends(get_db)):
    try:
        revision = save_library_draft(db, payload.library, payload.revision)
        return {'library': payload.library, 'revision': revision}
    except ConflictError as error:
        raise HTTPException(409, str(error)) from error


@router.post('/admin/certifications/publish', dependencies=[Depends(require_admin_session)])
def publish(payload: PublishRequest, db: Session = Depends(get_db)):
    try:
        library, revision = publish_library(db, payload.revision)
        return {'library': library, 'revision': revision}
    except ConflictError as error:
        raise HTTPException(409, str(error)) from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.get('/admin/certifications/history', dependencies=[Depends(require_admin_session)])
def history(db: Session = Depends(get_db)):
    rows = db.scalars(select(CertificationLibraryRecord).order_by(CertificationLibraryRecord.created_at.desc())).all()
    return [{'version': row.version, 'createdAt': row.created_at.isoformat()} for row in rows]
