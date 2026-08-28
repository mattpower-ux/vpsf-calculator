from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import LeadRecord, ProductRecord, PropertyRecord, ScoreRunRecord
from app.repositories import list_products, seed_products
from app.schemas import AdminSummary, ProductRecommendation

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/summary", response_model=AdminSummary)
async def summary(db: Session = Depends(get_db)) -> AdminSummary:
    seed_products(db)
    return AdminSummary(
        properties=db.scalar(select(func.count()).select_from(PropertyRecord)) or 0,
        scoreRuns=db.scalar(select(func.count()).select_from(ScoreRunRecord)) or 0,
        products=db.scalar(select(func.count()).select_from(ProductRecord)) or 0,
        leads=db.scalar(select(func.count()).select_from(LeadRecord)) or 0,
    )


@router.get("/products", response_model=list[ProductRecommendation])
async def products(db: Session = Depends(get_db)) -> list[ProductRecommendation]:
    return list_products(db)


@router.patch("/products/{product_id}/weighting", response_model=ProductRecommendation)
async def update_product_weighting(product_id: str, weight: str, db: Session = Depends(get_db)) -> ProductRecommendation:
    if weight not in {"Priority", "Standard", "Downgrade", "Hidden"}:
        raise HTTPException(status_code=400, detail="Unsupported product weight")
    record = db.get(ProductRecord, product_id)
    if not record:
        raise HTTPException(status_code=404, detail="Product not found")
    record.weight = weight
    db.commit()
    db.refresh(record)
    return ProductRecommendation(
        id=record.id,
        brand=record.brand,
        product=record.product,
        pillar=record.pillar,
        category=record.category,
        weight=record.weight,
        summary=record.summary,
        imageUrl=record.image_url,
    )


@router.get("/properties")
async def properties(db: Session = Depends(get_db)) -> list[dict]:
    records = db.scalars(select(PropertyRecord).order_by(PropertyRecord.created_at.desc()).limit(100)).all()
    return [
        {
            "id": record.id,
            "address": record.address,
            "city": record.city,
            "state": record.state,
            "zip": record.zip,
            "source": record.source,
            "createdAt": record.created_at,
        }
        for record in records
    ]


@router.get("/leads")
async def leads(db: Session = Depends(get_db)) -> list[dict]:
    records = db.scalars(select(LeadRecord).order_by(LeadRecord.created_at.desc()).limit(250)).all()
    return [
        {
            "id": record.id,
            "name": record.name,
            "email": record.email,
            "role": record.role,
            "productId": record.product_id,
            "propertyAddress": record.property_address,
            "zip": record.zip,
            "action": record.action,
            "createdAt": record.created_at,
        }
        for record in records
    ]


@router.get("/reports/leads")
async def lead_report(db: Session = Depends(get_db)) -> dict:
    records = db.scalars(select(LeadRecord).order_by(LeadRecord.created_at.desc()).limit(500)).all()
    by_product: dict[str, int] = {}
    by_zip: dict[str, int] = {}
    for record in records:
        if record.product_id:
            by_product[record.product_id] = by_product.get(record.product_id, 0) + 1
        if record.zip:
            by_zip[record.zip] = by_zip.get(record.zip, 0) + 1
    return {
        "total": len(records),
        "byProduct": by_product,
        "byZip": by_zip,
        "rows": [
            {
                "id": record.id,
                "email": record.email,
                "productId": record.product_id,
                "propertyAddress": record.property_address,
                "zip": record.zip,
                "action": record.action,
                "createdAt": record.created_at,
            }
            for record in records
        ],
    }
