"""Lead persistence and reporting. This module never emails or forwards records."""
import hashlib
import json
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import case, func, literal, select, update
from sqlalchemy.exc import IntegrityError

from app.models import LeadRecord, ProductRecord, utc_now


def canonical_product_name(product):
    name, brand = product.product.strip(), product.brand.strip()
    return name if not brand or name.casefold().startswith(brand.casefold()) else f'{brand} {name}'


def create_lead(db, payload):
    from app.repositories import seed_products
    product = db.get(ProductRecord, payload.productId)
    if product is None:
        seed_products(db)
        product = db.get(ProductRecord, payload.productId)
    if product is None or product.status != 'active':
        raise HTTPException(422, 'Choose a product from the current catalog.')
    # Normalized full-content digest, not email-only matching. Same public receipt
    # for both acceptance and retries; never disclose email existence or dedup state.
    digest = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    cutoff = utc_now() - timedelta(hours=24)
    existing = db.scalar(select(LeadRecord).where(LeadRecord.dedup_key == digest, LeadRecord.created_at >= cutoff))
    if existing is not None:
        return existing
    db.execute(update(LeadRecord).where(LeadRecord.dedup_key == digest, LeadRecord.created_at < cutoff).values(dedup_key=None))
    record = LeadRecord(
        name=payload.name, email=payload.email, phone=payload.phone, role=payload.role,
        product_id=product.id, product_name=canonical_product_name(product),
        manufacturer=(product.manufacturer or '').strip() or product.brand,
        intent=payload.intent, timeline=payload.timeline, scope=payload.scope,
        property_address=payload.propertyAddress, zip=payload.zip, action=payload.action,
        contact_consent=payload.contactConsent, share_consent=payload.shareConsent,
        is_demo=payload.isDemo, assessment_context=payload.assessmentContext,
        status='new', admin_notes='', revision=1, updated_at=utc_now(), dedup_key=digest,
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Unique digest coordinates concurrent retries across workers and databases.
        existing = db.scalar(select(LeadRecord).where(LeadRecord.dedup_key == digest, LeadRecord.created_at >= cutoff))
        if existing is None:
            raise
        return existing
    db.refresh(record)
    return record


def utc_iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def serialize_lead(record, product_name=None, manufacturer=None):
    return {
        'id': record.id, 'name': record.name, 'email': record.email, 'phone': record.phone,
        'role': record.role, 'intent': record.intent, 'timeline': record.timeline, 'scope': record.scope,
        'productId': record.product_id, 'productName': product_name or record.product_name or '',
        'manufacturer': manufacturer or record.manufacturer or '',
        'propertyAddress': record.property_address, 'zip': record.zip,
        'contactConsent': record.contact_consent, 'shareConsent': record.share_consent,
        'isDemo': record.is_demo, 'assessmentContext': record.assessment_context or {},
        'status': record.status, 'adminNotes': record.admin_notes or '', 'revision': record.revision,
        'createdAt': utc_iso(record.created_at), 'updatedAt': utc_iso(record.updated_at),
        'action': record.action,
    }


def report_query(filters):
    # Stored snapshots keep historical manufacturer assignments. Legacy rows fall
    # back to the canonical catalog; deleted/unknown products remain in reports.
    full_name = case((func.lower(func.substr(ProductRecord.product, 1, func.length(ProductRecord.brand))) == func.lower(ProductRecord.brand), ProductRecord.product), else_=ProductRecord.brand + literal(' ') + ProductRecord.product)
    product_name = func.coalesce(func.nullif(LeadRecord.product_name, ''), full_name, ProductRecord.product, '').label('resolved_product')
    manufacturer = func.coalesce(func.nullif(LeadRecord.manufacturer, ''), func.nullif(ProductRecord.manufacturer, ''), ProductRecord.brand, '').label('resolved_manufacturer')
    query = select(LeadRecord, product_name, manufacturer).outerjoin(ProductRecord, ProductRecord.id == LeadRecord.product_id)
    if not filters.includeDemo:
        query = query.where(LeadRecord.is_demo.is_(False))
    if filters.manufacturer:
        query = query.where(func.lower(manufacturer) == filters.manufacturer.strip().lower())
    if filters.productId:
        query = query.where(LeadRecord.product_id == filters.productId)
    if filters.status:
        query = query.where(LeadRecord.status == filters.status)
    if filters.dateFrom:
        query = query.where(LeadRecord.created_at >= datetime.combine(filters.dateFrom, datetime.min.time(), tzinfo=timezone.utc))
    if filters.dateTo:
        # The next midnight is excluded, making dateTo inclusive in UTC.
        query = query.where(LeadRecord.created_at < datetime.combine(filters.dateTo + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
    return query


def lead_report(db, filters):
    base = report_query(filters)
    matching = base.subquery()
    total = db.scalar(select(func.count()).select_from(matching)) or 0
    def counts(column):
        totals = {}
        for key, count in db.execute(select(column, func.count()).group_by(column)):
            label = key or 'Unknown'
            totals[label] = totals.get(label, 0) + count
        return totals
    by_status = counts(matching.c.status)
    by_product = counts(matching.c.product_id)
    by_manufacturer = counts(matching.c.resolved_manufacturer)
    rows = db.execute(base.order_by(LeadRecord.created_at.desc(), LeadRecord.id.desc()).offset((filters.page - 1) * filters.pageSize).limit(filters.pageSize))
    return {'total': total, 'rows': [serialize_lead(*row) for row in rows],
            'byStatus': by_status, 'byProduct': by_product, 'byManufacturer': by_manufacturer,
            'page': filters.page, 'pageSize': filters.pageSize}


def update_lead(db, lead_id, payload):
    record = db.get(LeadRecord, lead_id)
    if record is None:
        raise HTTPException(404, 'Lead not found.')
    if record.revision != payload.revision:
        raise HTTPException(409, 'Lead changed. Refresh and review the latest revision.')
    # Later sharing/contact states cannot bypass the approval consent guard.
    if payload.status == 'contacted' and record.contact_consent is not True:
        raise HTTPException(422, 'Internal contact requires explicit contact consent.')
    if payload.status in {'approved', 'quoted', 'won'}:
        if record.is_demo or record.share_consent is not True or record.contact_consent is not True:
            raise HTTPException(422, 'Sharing approval and manufacturer outcomes require a real lead with explicit contact and sharing consent.')
    changed = db.execute(update(LeadRecord).where(LeadRecord.id == lead_id, LeadRecord.revision == payload.revision)
                         .values(status=payload.status, admin_notes=payload.adminNotes, updated_at=utc_now(), revision=LeadRecord.revision + 1))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, 'Lead changed. Refresh and review the latest revision.')
    db.commit()
    db.refresh(record)
    product = db.get(ProductRecord, record.product_id) if record.product_id else None
    return serialize_lead(record, record.product_name or (canonical_product_name(product) if product else None),
                          record.manufacturer or ((product.manufacturer or product.brand) if product else None))
