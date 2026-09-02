from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApiUsageRecord, LeadRecord, ProductClickRecord, ProductRecord, PropertyQueryRecord, PropertyRecord, ScoreRunRecord, SourceDocumentRecord
from app.products.catalog import SEED_PRODUCTS
from app.schemas import LeadRequest, ProductClickCreate, ProductRecommendation, PropertyInput, PropertyQueryCreate, PropertyQueryProgress


def create_property(
    db: Session,
    property_input: PropertyInput,
    *,
    source: str = "manual",
    source_identifier: str | None = None,
) -> PropertyRecord:
    record = PropertyRecord(
        address=property_input.address,
        city=property_input.city,
        state=property_input.state,
        zip=property_input.zip,
        source=source,
        source_identifier=source_identifier,
        input_snapshot=property_input.model_dump(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def create_score_run(
    db: Session,
    property_input: PropertyInput,
    *,
    model_version: str,
    scores: dict[str, int],
    total: int,
    grade: str,
    label: str,
    meaning: str,
    explanations: dict[str, str],
    confidence: int,
    property_id: int | None = None,
) -> ScoreRunRecord:
    record = ScoreRunRecord(
        property_id=property_id,
        model_version=model_version,
        scores=scores,
        total=total,
        grade=grade,
        label=label,
        meaning=meaning,
        explanations=explanations,
        confidence=confidence,
        input_snapshot=property_input.model_dump(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def create_source_document(
    db: Session,
    *,
    filename: str,
    content_type: str,
    property_id: int | None = None,
    ocr_text: str = "",
    extracted_facts: dict | None = None,
    confidence: int = 0,
) -> SourceDocumentRecord:
    record = SourceDocumentRecord(
        property_id=property_id,
        filename=filename,
        content_type=content_type,
        ocr_text=ocr_text,
        extracted_facts=extracted_facts or {},
        confidence=confidence,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def seed_products(db: Session) -> None:
    for product in SEED_PRODUCTS:
        existing = db.get(ProductRecord, product.id)
        if existing:
            continue
        db.add(
            ProductRecord(
                id=product.id,
                brand=product.brand,
                product=product.product,
                manufacturer=product.brand,
                pillar=product.pillar,
                category=product.category,
                weight=product.weight,
                summary=product.summary,
                image_url=product.imageUrl,
            )
        )
    db.commit()


def list_products(db: Session) -> list[ProductRecommendation]:
    seed_products(db)
    records = db.scalars(select(ProductRecord).where(ProductRecord.status == "active").order_by(ProductRecord.brand)).all()
    return [
        ProductRecommendation(
            id=record.id,
            brand=record.brand,
            product=record.product,
            pillar=record.pillar,
            category=record.category,
            weight=record.weight,
            summary=record.summary,
            imageUrl=record.image_url,
        )
        for record in records
    ]


def create_lead(db: Session, lead: LeadRequest) -> LeadRecord:
    record = LeadRecord(
        email=lead.email,
        name=lead.name,
        role=lead.role,
        product_id=lead.productId,
        property_address=lead.propertyAddress,
        zip=lead.zip,
        action=lead.action,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def current_usage_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_api_usage(db: Session, provider: str, period: str | None = None) -> ApiUsageRecord:
    usage_period = period or current_usage_period()
    record = db.scalar(
        select(ApiUsageRecord).where(
            ApiUsageRecord.provider == provider,
            ApiUsageRecord.period == usage_period,
        )
    )
    if record:
        return record

    record = ApiUsageRecord(provider=provider, period=usage_period, count=0)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def reserve_api_call(db: Session, provider: str, monthly_limit: int) -> ApiUsageRecord:
    record = get_api_usage(db, provider)
    if record.count >= monthly_limit:
        return record

    record.count += 1
    db.commit()
    db.refresh(record)
    return record


def mark_api_usage_limit_notified(db: Session, record: ApiUsageRecord) -> ApiUsageRecord:
    record.limit_notified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


def serialize_property_query(record: PropertyQueryRecord) -> dict:
    return {
        "id": record.id,
        "sessionId": record.session_id,
        "address": record.address,
        "city": record.city,
        "state": record.state,
        "zip": record.zip,
        "source": record.source,
        "maxScreen": record.max_screen,
        "maxScreenLabel": record.max_screen_label,
        "productClicks": record.product_clicks,
        "vpsfScore": record.vpsf_score,
        "scoreLabel": record.score_label,
        "scoreRunId": record.score_run_id,
        "leadName": record.lead_name,
        "leadEmail": record.lead_email,
        "leadProductId": record.lead_product_id,
        "leadAction": record.lead_action,
        "latestSnapshot": record.latest_snapshot or {},
        "createdAt": record.created_at.isoformat(),
        "updatedAt": record.updated_at.isoformat(),
    }


def create_property_query(db: Session, payload: PropertyQueryCreate) -> PropertyQueryRecord:
    record = PropertyQueryRecord(
        session_id=payload.sessionId,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        zip=payload.zip,
        source=payload.source,
        latest_snapshot=payload.snapshot,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def record_query_progress(db: Session, payload: PropertyQueryProgress) -> PropertyQueryRecord | None:
    record = db.get(PropertyQueryRecord, payload.queryId) if payload.queryId else None
    if not record:
        return None

    if payload.screen >= record.max_screen:
        record.max_screen = payload.screen
        record.max_screen_label = payload.screenLabel
    if payload.snapshot:
        record.latest_snapshot = payload.snapshot
    if payload.vpsfScore is not None:
        record.vpsf_score = payload.vpsfScore
    if payload.scoreLabel:
        record.score_label = payload.scoreLabel
    if payload.scoreRunId is not None:
        record.score_run_id = payload.scoreRunId
    if payload.leadName or payload.leadEmail:
        record.lead_name = payload.leadName
        record.lead_email = payload.leadEmail
        record.lead_product_id = payload.leadProductId
        record.lead_action = payload.leadAction
    db.commit()
    db.refresh(record)
    return record


def record_product_click(db: Session, payload: ProductClickCreate) -> ProductClickRecord:
    record = ProductClickRecord(
        query_id=payload.queryId,
        session_id=payload.sessionId,
        product_id=payload.productId,
        product_name=payload.productName,
        pillar=payload.pillar,
        click_context=payload.context,
    )
    db.add(record)
    if payload.queryId:
        query = db.get(PropertyQueryRecord, payload.queryId)
        if query:
            query.product_clicks += 1
    db.commit()
    db.refresh(record)
    return record


def list_property_queries(db: Session, limit: int = 250) -> list[dict]:
    records = db.scalars(select(PropertyQueryRecord).order_by(PropertyQueryRecord.updated_at.desc()).limit(limit)).all()
    return [serialize_property_query(record) for record in records]


def list_product_clicks(db: Session, limit: int = 250) -> list[dict]:
    records = db.scalars(select(ProductClickRecord).order_by(ProductClickRecord.created_at.desc()).limit(limit)).all()
    return [
        {
            "id": record.id,
            "queryId": record.query_id,
            "sessionId": record.session_id,
            "productId": record.product_id,
            "productName": record.product_name,
            "pillar": record.pillar,
            "context": record.click_context,
            "createdAt": record.created_at.isoformat(),
        }
        for record in records
    ]
