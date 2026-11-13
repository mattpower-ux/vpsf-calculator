from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import get_educational_content, list_products, upsert_educational_content
from app.schemas import EducationalContent, EducationalContentUpsert, ProductRecommendation

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/recommendations", response_model=list[ProductRecommendation])
async def recommendations(db: Session = Depends(get_db)) -> list[ProductRecommendation]:
    return [p for p in list_products(db) if p.weight != "Hidden"]


@router.get("/education/{content_key}", response_model=EducationalContent)
async def education_content(content_key: str, db: Session = Depends(get_db)) -> EducationalContent:
    content = get_educational_content(db, content_key)
    if not content:
        raise HTTPException(status_code=404, detail="Educational content has not been cached for this category")
    return content


@router.post("/education/{content_key}/cache", response_model=EducationalContent)
async def cache_education_content(
    content_key: str,
    payload: EducationalContentUpsert,
    db: Session = Depends(get_db),
) -> EducationalContent:
    return upsert_educational_content(db, content_key, payload, overwrite=False)


from sqlalchemy import select
from app.models import ScoringModelRecord
from app.scoring.catalog import ScoreModel, evaluate_model
from app.scoring.store import load_published
from app.advice.schemas import AdviceRequest
from app.advice.context import build_home_context, needs
from app.advice.takeaways import build_takeaways
from app.advice.products import match_products


@router.post("/advice")
async def home_advice(payload: AdviceRequest, db: Session = Depends(get_db)):
    if payload.modelVersion:
        record = db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.version == payload.modelVersion))
        if record is None:
            raise HTTPException(409, "This scoring model is unavailable. Recalculate to refresh advice.")
        model = ScoreModel.model_validate(record.payload)
    else:
        model = load_published(db)
    scores = evaluate_model(payload.home, model)
    context = build_home_context(payload.home, {}, scores, model.pillars)
    return {"ruleVersion": "advice-1", "modelVersion": model.version,
            "advisoryRecommendations": [],
            "takeaways": build_takeaways(context), "matches": match_products(context, list_products(db))}
