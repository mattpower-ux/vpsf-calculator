from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.address_normalization import normalize_state, normalize_street_address, normalize_text, normalize_zip, property_query_key
from app.models import ApiUsageRecord, EducationalContentRecord, LeadRecord, ProductClickRecord, ProductRecord, PropertyDetailArchiveRecord, PropertyQueryRecord, PropertyRecord, ScoreRunRecord, SourceDocumentRecord
from app.products.catalog import SEED_PRODUCTS
from app.schemas import EducationalContent, EducationalContentUpsert, LeadRequest, ProductClickCreate, ProductRecommendation, PropertyInput, PropertyQueryCreate, PropertyQueryProgress


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
        input_snapshot=property_input.model_dump(mode='json'),
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
    certification_evidence: dict | None = None,
    effective_input: dict | None = None,
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
        input_snapshot={**property_input.model_dump(mode='json'), **({'certificationEvidence': certification_evidence, 'effectiveInput': effective_input} if certification_evidence is not None else {})},
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
    from app.products.award_catalog import load_manifest, seed_awards, insert_if_missing
    # Validate before any mutation, including the legacy catalog seed.
    manifest = load_manifest()
    try:
        existing_ids = set(db.scalars(select(ProductRecord.id)).all())
        for product in SEED_PRODUCTS:
            if product.id in existing_ids:
                continue
            insert_if_missing(db, ProductRecord, dict(
                id=product.id, brand=product.brand, product=product.product,
                manufacturer=product.brand, pillar=product.pillar, category=product.category,
                weight=product.weight, summary=product.summary, image_url=product.imageUrl,
            ), 'id')
        seed_awards(db, manifest)
        db.commit()
    except Exception:
        db.rollback()
        raise


def list_products(db: Session) -> list[ProductRecommendation]:
    seed_products(db)
    from app.models import ProductAdviceRecord
    from app.advice.catalog_metadata import initial_metadata
    from app.products.award_catalog import catalog_metadata, public_image_url
    records = db.scalars(select(ProductRecord).where(ProductRecord.status == "active").order_by(ProductRecord.brand, ProductRecord.id)).all()
    metadata = {m.id: m for m in db.scalars(select(ProductAdviceRecord)).all()}
    _, awards = catalog_metadata(db)
    products = []
    for record in records:
        defaults = initial_metadata(record).model_dump()
        evidence = awards.get(record.id)
        if evidence:
            defaults.update({key: evidence[key] for key in ('needTags', 'pillars', 'requirements', 'verificationNotes')})
            defaults['sourceUrl'] = max(evidence['awards'], key=lambda a: a['year'])['sourceUrl']
            # An editorial award is not a review of current technical specs.
            defaults['reviewedAt'] = ''
        if record.id in metadata:
            defaults.update(metadata[record.id].payload)
        products.append(ProductRecommendation(
            id=record.id, brand=record.brand, product=record.product,
            pillar=record.pillar, category=record.category, weight=record.weight,
            summary=record.summary, imageUrl=public_image_url(record.image_url),
            companyUrl=record.product_url,
            awards=evidence['awards'] if evidence else [],
            imageCredit=evidence['imageCredit'] if evidence else None,
            imageSourceUrl=evidence['imageSourceUrl'] if evidence else None,
            catalogVersion=evidence['catalogVersion'] if evidence else None,
            **defaults,
            metadataRevision=metadata[record.id].revision if record.id in metadata else 0,
        ))
    return products


def export_product_catalog(db: Session):
    from app.products.award_catalog import catalog_metadata
    from app.schemas import ProductCatalogExport
    products = [p for p in list_products(db) if p.weight != 'Hidden']
    version, _ = catalog_metadata(db)
    return ProductCatalogExport(catalogVersion=version, products=products)


def serialize_educational_content(record: EducationalContentRecord) -> EducationalContent:
    return EducationalContent(
        key=record.key,
        title=record.title,
        intro=record.intro,
        background=record.background or "",
        howItWorks=record.how_it_works or [],
        sustainableAspects=record.sustainable_aspects or [],
        why=record.why or [],
        verify=record.verify or [],
        vpsf=record.vpsf,
        source=record.source,
        sourceUrl=record.source_url,
    )


def get_educational_content(db: Session, key: str) -> EducationalContent | None:
    record = db.get(EducationalContentRecord, key)
    return serialize_educational_content(record) if record else None


def list_educational_content(db: Session) -> list[EducationalContent]:
    records = db.scalars(select(EducationalContentRecord).order_by(EducationalContentRecord.updated_at.desc())).all()
    return [serialize_educational_content(record) for record in records]


def upsert_educational_content(
    db: Session,
    key: str,
    payload: EducationalContentUpsert,
    *,
    overwrite: bool = True,
) -> EducationalContent:
    record = db.get(EducationalContentRecord, key)
    if record and not overwrite:
        has_rich_content = bool(record.background or record.how_it_works or record.sustainable_aspects)
        incoming_is_richer = bool(payload.background or payload.howItWorks or payload.sustainableAspects)
        if has_rich_content or not incoming_is_richer:
            return serialize_educational_content(record)
    if not record:
        record = EducationalContentRecord(key=key)
        db.add(record)

    record.title = payload.title
    record.intro = payload.intro
    record.background = payload.background
    record.how_it_works = payload.howItWorks
    record.sustainable_aspects = payload.sustainableAspects
    record.why = payload.why
    record.verify = payload.verify
    record.vpsf = payload.vpsf
    record.source = payload.source
    record.source_url = payload.sourceUrl
    db.commit()
    db.refresh(record)
    return serialize_educational_content(record)


def create_lead(db: Session, lead: LeadRequest) -> LeadRecord:
    from app.lead_workflow import create_lead as save_lead
    return save_lead(db, lead)


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
        "addressKey": record.address_key,
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
    address_key = property_query_key(payload.address, payload.city, payload.state, payload.zip)
    existing = find_existing_property_query(db, payload.address, payload.city, payload.state, payload.zip, address_key)
    if existing:
        existing.session_id = payload.sessionId
        existing.source = payload.source or existing.source
        if payload.snapshot:
            existing.latest_snapshot = merge_property_snapshots(existing.latest_snapshot or {}, payload.snapshot)
        if not existing.address_key:
            existing.address_key = address_key
        db.commit()
        db.refresh(existing)
        return existing

    record = PropertyQueryRecord(
        session_id=payload.sessionId,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        zip=payload.zip,
        address_key=address_key,
        source=payload.source,
        latest_snapshot=payload.snapshot,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def find_existing_property_query(
    db: Session,
    address: str,
    city: str,
    state: str,
    zip_code: str,
    address_key: str | None = None,
) -> PropertyQueryRecord | None:
    address_key = address_key or property_query_key(address, city, state, zip_code)
    if not address_key or address_key == "|||":
        return None

    record = db.scalar(
        select(PropertyQueryRecord)
        .where(PropertyQueryRecord.address_key == address_key)
        .order_by(PropertyQueryRecord.updated_at.desc())
    )
    if record:
        return record

    return find_saved_property_query(db, address, city, state, zip_code)


def find_saved_property_query(
    db: Session,
    address: str,
    city: str = "",
    state: str = "",
    zip_code: str = "",
) -> PropertyQueryRecord | None:
    normalized_address = normalize_street_address(address)
    normalized_city = normalize_text(city)
    normalized_state = normalize_state(state)
    normalized_zip = normalize_zip(zip_code)
    if not normalized_address:
        return None

    records = db.scalars(select(PropertyQueryRecord).order_by(PropertyQueryRecord.updated_at.desc()).limit(500)).all()
    for candidate in records:
        candidate_address = normalize_street_address(candidate.address)
        if candidate_address != normalized_address:
            continue
        if normalized_city and normalize_text(candidate.city) != normalized_city:
            continue
        if normalized_state and normalize_state(candidate.state) != normalized_state:
            continue
        if normalized_zip and normalize_zip(candidate.zip) != normalized_zip:
            continue
        if not candidate.address_key:
            candidate.address_key = property_query_key(candidate.address, candidate.city, candidate.state, candidate.zip)
            db.commit()
            db.refresh(candidate)
        return candidate
    return None


def merge_property_snapshots(existing: dict, incoming: dict) -> dict:
    merged = dict(existing)
    for key, value in incoming.items():
        if is_blank_property_value(value) and not is_blank_property_value(merged.get(key)):
            continue
        merged[key] = value
    return merged


def is_blank_property_value(value: object) -> bool:
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    return value.strip().lower() in {"", "unknown", "none / unknown"}


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
    for change in payload.detailChanges:
        db.add(
            PropertyDetailArchiveRecord(
                query_id=record.id,
                session_id=payload.sessionId,
                screen=payload.screen,
                screen_label=payload.screenLabel,
                field=str(change.get("field", "")),
                previous_value=str(change.get("previousValue", "")),
                new_value=str(change.get("newValue", "")),
                snapshot=payload.snapshot,
            )
        )
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


def list_property_detail_archive(db: Session, limit: int = 500) -> list[dict]:
    records = db.scalars(select(PropertyDetailArchiveRecord).order_by(PropertyDetailArchiveRecord.created_at.desc()).limit(limit)).all()
    return [
        {
            "id": record.id,
            "queryId": record.query_id,
            "sessionId": record.session_id,
            "screen": record.screen,
            "screenLabel": record.screen_label,
            "field": record.field,
            "previousValue": record.previous_value,
            "newValue": record.new_value,
            "snapshot": record.snapshot or {},
            "createdAt": record.created_at.isoformat(),
        }
        for record in records
    ]
