from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import get_educational_content, list_products, upsert_educational_content
from app.schemas import EducationalContent, EducationalContentUpsert, ProductRecommendation

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/recommendations", response_model=list[ProductRecommendation])
async def recommendations(db: Session = Depends(get_db)) -> list[ProductRecommendation]:
    return list_products(db)


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
