from fastapi import APIRouter, Depends, Response
from app.lead_limits import LeadLimitedRoute
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import create_lead
from app.schemas import LeadRequest, LeadResponse

router = APIRouter(prefix="/api/leads", tags=["leads"], route_class=LeadLimitedRoute)


@router.post("", response_model=LeadResponse)
def submit_lead(lead: LeadRequest, response: Response, db: Session = Depends(get_db)) -> LeadResponse:
    response.headers["Cache-Control"] = "no-store"
    record = create_lead(db, lead)
    return LeadResponse(id=record.id)
