from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import LeadRecord, ProductRecord, PropertyRecord, ScoreRunRecord, SourceDocumentRecord
from app.products.catalog import SEED_PRODUCTS
from app.schemas import LeadRequest, ProductRecommendation, PropertyInput


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
