from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import create_property_query, find_saved_property_query, record_product_click, record_query_progress, serialize_property_query
from app.schemas import ProductClickCreate, PropertyQueryCreate, PropertyQueryProgress

router = APIRouter(prefix="/api/tracking", tags=["tracking"])


@router.post("/property-query")
async def track_property_query(payload: PropertyQueryCreate, db: Session = Depends(get_db)) -> dict:
    record = create_property_query(db, payload)
    return serialize_property_query(record)


@router.get("/saved-property")
async def saved_property(
    address: str = Query(default=""),
    city: str = Query(default=""),
    state: str = Query(default=""),
    zip: str = Query(default=""),
    db: Session = Depends(get_db),
) -> dict:
    record = find_saved_property_query(db, address, city, state, zip)
    if not record:
        return {"found": False}
    return {"found": True, "property": serialize_property_query(record)}


@router.post("/progress")
async def track_progress(payload: PropertyQueryProgress, db: Session = Depends(get_db)) -> dict:
    record = record_query_progress(db, payload)
    return serialize_property_query(record) if record else {"status": "ignored"}


@router.post("/product-click")
async def track_product_click(payload: ProductClickCreate, db: Session = Depends(get_db)) -> dict:
    record = record_product_click(db, payload)
    return {"id": record.id, "status": "recorded"}
