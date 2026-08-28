from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import create_lead
from app.schemas import LeadRequest, LeadResponse

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.post("", response_model=LeadResponse)
async def submit_lead(lead: LeadRequest, db: Session = Depends(get_db)) -> LeadResponse:
    record = create_lead(db, lead)
    return LeadResponse(id=record.id)
