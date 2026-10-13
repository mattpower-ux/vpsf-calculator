from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.admin_auth import create_session, require_admin_session
from app.models import AdminSessionRecord, LeadRecord, ProductRecord, PropertyRecord, ScoreRunRecord, utc_now
from app.repositories import list_educational_content, list_product_clicks, list_products, list_property_detail_archive, list_property_queries, seed_products, upsert_educational_content
from app.schemas import AdminSummary, EducationalContent, EducationalContentUpsert, ProductRecommendation
from app.schemas import PropertyInput
from app.scoring.catalog import ScoreModel, evaluate_model
from app.scoring.candidates import CANDIDATES
from app.scoring.store import ConflictError, ModelUnavailableError, load_or_create_draft, load_published, model_history, publish_draft, save_draft

router = APIRouter(prefix="/api/admin", tags=["admin"])


class DraftUpdate(BaseModel):
    revision: int
    model: ScoreModel


class PublishRequest(BaseModel):
    revision: int


class PreviewRequest(BaseModel):
    propertyId: int


@router.get("/scoring/model", dependencies=[Depends(require_admin_session)])
def published_scoring_model(db: Session = Depends(get_db)) -> ScoreModel:
    return load_published(db)


@router.get("/scoring/draft", dependencies=[Depends(require_admin_session)])
def scoring_draft(db: Session = Depends(get_db)) -> dict:
    model, revision = load_or_create_draft(db)
    return {"model": model, "revision": revision}


@router.put("/scoring/draft", dependencies=[Depends(require_admin_session)])
def update_scoring_draft(payload: DraftUpdate, db: Session = Depends(get_db)) -> dict:
    try:
        revision = save_draft(db, payload.model, payload.revision)
    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"revision": revision, "model": payload.model}


@router.post("/scoring/validate", dependencies=[Depends(require_admin_session)])
def validate_scoring_draft(model: ScoreModel) -> dict:
    issues = []
    total = sum(model.pillars.values())
    if total != 1000:
        issues.append(f"Pillar budgets total {total}; they must total 1,000")
    return {"valid": not issues, "issues": issues, "total": total}


@router.post("/scoring/preview", dependencies=[Depends(require_admin_session)])
def preview_scoring_draft(payload: PreviewRequest, db: Session = Depends(get_db)) -> dict:
    record = db.get(PropertyRecord, payload.propertyId)
    if not record:
        raise HTTPException(status_code=404, detail="Property not found")
    home = PropertyInput.model_validate(record.input_snapshot)
    draft, revision = load_or_create_draft(db)
    return {"propertyId": record.id, "revision": revision, "published": evaluate_model(home, load_published(db)), "draft": evaluate_model(home, draft)}


@router.post("/scoring/publish", dependencies=[Depends(require_admin_session)])
def publish_scoring_draft(payload: PublishRequest, db: Session = Depends(get_db)) -> ScoreModel:
    try:
        return publish_draft(db, payload.revision, "admin")
    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/scoring/history", dependencies=[Depends(require_admin_session)])
def scoring_history(db: Session = Depends(get_db)) -> list[dict]:
    return model_history(db)


@router.get("/scoring/available-fields", dependencies=[Depends(require_admin_session)])
def scoring_available_fields() -> list[str]:
    excluded = {"address", "city", "state", "zip", "latitude", "longitude", "wildfire", "sourceNote", "extraInputs", "epaWalkability"}
    return [key for key in PropertyInput.model_fields if key not in excluded]


@router.get("/scoring/candidates", dependencies=[Depends(require_admin_session)])
def scoring_candidates() -> list[dict]:
    return CANDIDATES


class LoginRequest(BaseModel):
    password: str


@router.post("/session")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    return {"token": create_session(payload.password, request, db)}


@router.delete("/session", status_code=204)
def logout(session: AdminSessionRecord = Depends(require_admin_session), db: Session = Depends(get_db)) -> Response:
    session.revoked_at = utc_now()
    db.commit()
    return Response(status_code=204)


@router.get("/summary", response_model=AdminSummary)
async def summary(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> AdminSummary:
    seed_products(db)
    return AdminSummary(
        properties=db.scalar(select(func.count()).select_from(PropertyRecord)) or 0,
        scoreRuns=db.scalar(select(func.count()).select_from(ScoreRunRecord)) or 0,
        products=db.scalar(select(func.count()).select_from(ProductRecord)) or 0,
        leads=db.scalar(select(func.count()).select_from(LeadRecord)) or 0,
    )


@router.get("/products", response_model=list[ProductRecommendation])
async def products(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> list[ProductRecommendation]:
    return list_products(db)


@router.get("/education", response_model=list[EducationalContent])
async def educational_pages(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> list[EducationalContent]:
    return list_educational_content(db)


@router.put("/education/{content_key}", response_model=EducationalContent)
async def upsert_educational_page(
    content_key: str,
    payload: EducationalContentUpsert,
    _: None = Depends(require_admin_session),
    db: Session = Depends(get_db),
) -> EducationalContent:
    return upsert_educational_content(db, content_key, payload)


@router.patch("/products/{product_id}/weighting", response_model=ProductRecommendation)
async def update_product_weighting(product_id: str, weight: str, _: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> ProductRecommendation:
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
async def properties(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> list[dict]:
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
async def leads(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> list[dict]:
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
async def lead_report(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> dict:
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


@router.get("/property-queries")
async def property_queries(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> list[dict]:
    return list_property_queries(db)


@router.get("/product-clicks")
async def product_clicks(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> list[dict]:
    return list_product_clicks(db)


@router.get("/property-detail-archive")
async def property_detail_archive(_: None = Depends(require_admin_session), db: Session = Depends(get_db)) -> list[dict]:
    return list_property_detail_archive(db)

