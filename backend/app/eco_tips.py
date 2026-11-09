import hashlib
import json
from pathlib import Path
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.models import EcoTipRecord, utc_now
from app.advice.schemas import TipData


def seed_data():
    return json.loads((Path(__file__).parent / "data" / "eco_tips.json").read_text(encoding="utf-8"))


def seed_tips(db):
    for data in seed_data():
        if db.get(EcoTipRecord, data["id"]) is None:
            TipData(**data).publishable()
            db.add(EcoTipRecord(id=data["id"], draft=data, published=data, revision=1, history=[{"version": 1, "data": data, "at": utc_now().isoformat()}]))
    db.commit()


def tip_record(record):
    return {"id": record.id, "draft": record.draft, "published": record.published, "revision": record.revision, "history": record.history, "updatedAt": record.updated_at.isoformat()}


def public_tips(db):
    records = db.scalars(select(EcoTipRecord).where(EcoTipRecord.published.is_not(None))).all()
    tips = [r.published for r in records if r.published]
    tips.sort(key=lambda t: (t.get("order",0),t["id"]))
    revision = hashlib.sha256(json.dumps(tips,sort_keys=True).encode()).hexdigest()[:16]
    return {"tips": tips, "revision": revision}


def save_tip(db, id, payload):
    if payload.data.id != id: raise HTTPException(422, "Tip ID cannot change")
    data=payload.data.model_dump()
    if payload.revision == 0:
        db.add(EcoTipRecord(id=id,draft=data,published=None,history=[],revision=1))
        try: db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409,"Tip changed; reload before saving")
    else:
        change_tip(db,id,payload.revision,{"draft":data})
    return tip_record(db.get(EcoTipRecord,id))


def change_tip(db,id,revision,values):
    result=db.execute(update(EcoTipRecord).where(EcoTipRecord.id==id,EcoTipRecord.revision==revision).values(**values,revision=revision+1,updated_at=utc_now()))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409,"Tip changed; reload before saving")
    db.commit()
    db.expire_all()


def publish_tip(db,id,payload,action):
    r=db.get(EcoTipRecord,id)
    if r is None: raise HTTPException(404,"Tip not found")
    if r.revision != payload.revision: raise HTTPException(409,"Tip changed; reload before saving")
    if action == "retire":
        values={"published":None}
    else:
        data=r.draft
        if action == "restore":
            version=next((v for v in r.history if v["version"]==payload.version),None)
            if version is None: raise HTTPException(404,"Published version not found")
            data=version["data"]
        try: TipData(**data).publishable()
        except ValueError as e: raise HTTPException(422,str(e)) from e
        history=[*r.history,{"version":len(r.history)+1,"data":data,"at":utc_now().isoformat()}]
        values={"published":data,"history":history}
        if action == "restore": values["draft"]=data
    change_tip(db,id,payload.revision,values)
    return tip_record(db.get(EcoTipRecord,id))
