from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.admin_auth import require_admin_session
from app.models import EcoTipRecord
from app.eco_tips import public_tips, tip_record, save_tip, publish_tip
from app.advice.schemas import TipUpdate, RevisionRequest

router=APIRouter(tags=["eco-tips"])

@router.get("/api/eco-tips")
async def tips(db: Session=Depends(get_db)):
    return public_tips(db)

@router.get("/api/admin/eco-tips")
async def admin_tips(_: None=Depends(require_admin_session),db: Session=Depends(get_db)):
    return [tip_record(r) for r in db.scalars(select(EcoTipRecord).order_by(EcoTipRecord.id)).all()]

@router.put("/api/admin/eco-tips/{id}")
async def save(id: str,payload: TipUpdate,_: None=Depends(require_admin_session),db: Session=Depends(get_db)):
    return save_tip(db,id,payload)

@router.post("/api/admin/eco-tips/{id}/{action}")
async def publish(id: str,action: str,payload: RevisionRequest,_: None=Depends(require_admin_session),db: Session=Depends(get_db)):
    if action not in {"publish","retire","restore"}: raise HTTPException(404,"Unknown action")
    return publish_tip(db,id,payload,action)
