"""Validated, immutable awards imports; editorial product settings always win."""
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import unquote, urlsplit

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import ProductCatalogSourceRecord, ProductRecord
from app.products.catalog import SEED_PRODUCTS

MANIFEST_PATH = Path(__file__).resolve().parents[1] / 'data' / 'award_products.json'
PUBLIC_ORIGIN = 'https://vpsf-calculator.onrender.com'
PILLARS = {'Energy', 'Water', 'Health', 'Resilience', 'Carbon', 'Financial', 'Community'}
Identifier = Annotated[str, StringConstraints(pattern=r'^[a-z0-9][a-z0-9-]{1,119}$')]


def https_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in value) or '\\' in value:
        raise ValueError('Expected an HTTPS URL without credentials')
    return value


def public_image_url(value: str | None) -> str | None:
    return PUBLIC_ORIGIN + value if value and value.startswith('/catalog-images/') else value


class Award(BaseModel):
    model_config = ConfigDict(extra='forbid')
    year: int = Field(strict=True, ge=2024, le=2026)
    sourceUrl: str = Field(max_length=1000)
    sourceTitle: str = Field(min_length=1, max_length=300)
    _url = field_validator('sourceUrl')(https_url)


class AwardProduct(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    id: Identifier
    existingId: Identifier | None = None
    brand: str = Field(min_length=1, max_length=160)
    product: str = Field(min_length=1, max_length=255)
    pillar: str
    category: str = Field(min_length=1, max_length=120)
    summary: str
    imageUrl: str = Field(max_length=500)
    companyUrl: str = Field(max_length=500)
    awards: list[Award] = Field(min_length=1)
    imageCredit: str = Field(min_length=1, max_length=500)
    imageSourceUrl: str = Field(max_length=1000)
    needTags: list[str] = Field(max_length=16)
    pillars: list[str] = Field(min_length=1, max_length=7)
    requirements: list[str] = Field(max_length=16)
    verificationNotes: str = Field(default='', max_length=600)
    _urls = field_validator('companyUrl', 'imageSourceUrl')(https_url)

    @field_validator('imageUrl')
    @classmethod
    def image_url(cls, value):
        if value.startswith('/catalog-images/'):
            if '?' in value or '#' in value or '\\' in value or '..' in unquote(value) or any(c.isspace() for c in value):
                raise ValueError('Invalid catalog image path')
            return value
        return https_url(value)

    @model_validator(mode='after')
    def valid(self):
        if self.pillar not in PILLARS or not set(self.pillars) <= {p.lower() for p in PILLARS}:
            raise ValueError('Unsupported pillar')
        if not 25 <= len(self.summary.split()) <= 40:
            raise ValueError('Awards summaries must contain 25–40 words')
        from app.advice.products import NEED_TAGS, REQUIREMENTS
        if set(self.needTags) - NEED_TAGS or set(self.requirements) - REQUIREMENTS:
            raise ValueError('Unsupported matching tag or requirement')
        return self

    @property
    def product_id(self):
        return self.existingId or self.id


class AwardManifest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schemaVersion: Literal[1]
    catalogVersion: str = Field(min_length=1, max_length=120, pattern=r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$')
    sources: list[dict]
    products: list[AwardProduct]

    @model_validator(mode='after')
    def unique_products(self):
        ids = [p.id for p in self.products]
        targets = [p.product_id for p in self.products]
        if len(set(ids)) != len(ids) or len(set(targets)) != len(targets):
            raise ValueError('Duplicate product id or existingId')
        return self


def load_manifest() -> AwardManifest | None:
    if not MANIFEST_PATH.is_file():
        return None
    return AwardManifest.model_validate_json(MANIFEST_PATH.read_text(encoding='utf-8'))


def insert_if_missing(db: Session, model, values: dict, key: str):
    """Unique-key conflicts are normal when multiple workers seed together."""
    dialect = db.get_bind().dialect.name
    if dialect == 'sqlite':
        from sqlalchemy.dialects.sqlite import insert
    elif dialect == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        raise RuntimeError('Catalog imports require SQLite or PostgreSQL')
    return db.execute(insert(model).values(**values).on_conflict_do_nothing(index_elements=[key]))


def seed_awards(db: Session, manifest: AwardManifest | None) -> None:
    """Participate in the caller's transaction; a version is immutable."""
    if manifest is None:
        return
    payload = manifest.model_dump(mode='json')
    existing = db.scalar(select(ProductCatalogSourceRecord).where(ProductCatalogSourceRecord.version == manifest.catalogVersion))
    if existing:
        if existing.payload != payload:
            raise ValueError('Catalog content changed without a new catalogVersion')
        return
    result = insert_if_missing(db, ProductCatalogSourceRecord, dict(version=manifest.catalogVersion, payload=payload), 'version')
    if result.rowcount == 0:
        existing = db.scalar(select(ProductCatalogSourceRecord).where(ProductCatalogSourceRecord.version == manifest.catalogVersion))
        if existing.payload != payload:
            raise ValueError('Catalog content changed without a new catalogVersion')
        return
    # The source row was inserted above; it must not be its own baseline.
    _, prior_products = catalog_metadata(db, exclude_version=manifest.catalogVersion)
    legacy = {p.id: p for p in SEED_PRODUCTS}
    for product in manifest.products:
        newest_award = max(product.awards, key=lambda a: a.year)
        values = dict(id=product.product_id, brand=product.brand, product=product.product, manufacturer=product.brand,
                      pillar=product.pillar, category=product.category, summary=product.summary,
                      image_url=product.imageUrl, product_url=product.companyUrl, source_year=newest_award.year,
                      source_issue=newest_award.sourceTitle[:120], tags=product.needTags, weight='Standard', status='active')
        inserted = insert_if_missing(db, ProductRecord, values, 'id')
        if inserted.rowcount:
            continue
        # SQL predicates protect content edited concurrently after our read.
        seed = legacy.get(product.product_id)
        previous = prior_products.get(product.product_id)
        previous_values = None
        if previous:
            previous_award = max(previous['awards'], key=lambda a: a['year'])
            previous_values = dict(
                product=previous['product'], summary=previous['summary'],
                image_url=previous['imageUrl'], product_url=previous['companyUrl'],
                source_year=previous_award['year'], source_issue=previous_award['sourceTitle'][:120],
                tags=previous['needTags'],
            )
        for field in ('product', 'summary', 'image_url', 'product_url', 'source_year', 'source_issue', 'tags'):
            column = getattr(ProductRecord, field)
            current = db.scalar(select(column).where(ProductRecord.id == product.product_id))
            seed_value = getattr(seed, {'image_url': 'imageUrl'}.get(field, field), None) if seed else None
            if previous_values is not None:
                # A cleared field is also an admin edit after the first import.
                if current != previous_values[field]:
                    continue
            elif current and (seed_value is None or current != seed_value):
                continue
            if current == values[field]:
                continue
            db.execute(update(ProductRecord).where(ProductRecord.id == product.product_id, column == current).values(**{field: values[field]}))


def catalog_metadata(db: Session, *, exclude_version: str | None = None):
    """Resolve the last imported evidence per product, retaining older history."""
    query = select(ProductCatalogSourceRecord).order_by(ProductCatalogSourceRecord.id)
    if exclude_version is not None:
        query = query.where(ProductCatalogSourceRecord.version != exclude_version)
    records = db.scalars(query).all()
    metadata = {}
    for record in records:
        for product in record.payload['products']:
            metadata[product.get('existingId') or product['id']] = {**product, 'catalogVersion': record.version}
    return (records[-1].version if records else None), metadata
