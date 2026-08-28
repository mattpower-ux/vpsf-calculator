from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import list_products
from app.schemas import ProductRecommendation

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/recommendations", response_model=list[ProductRecommendation])
async def recommendations(db: Session = Depends(get_db)) -> list[ProductRecommendation]:
    return list_products(db)
