from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PropertyRecord(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    state: Mapped[str] = mapped_column(String(40), default="")
    zip: Mapped[str] = mapped_column(String(20), default="")
    source: Mapped[str] = mapped_column(String(40), default="manual")
    source_identifier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    score_runs: Mapped[list["ScoreRunRecord"]] = relationship(back_populates="property", cascade="all, delete-orphan")
    documents: Mapped[list["SourceDocumentRecord"]] = relationship(back_populates="property", cascade="all, delete-orphan")


class ScoreRunRecord(Base):
    __tablename__ = "score_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id"), nullable=True)
    model_version: Mapped[str] = mapped_column(String(80))
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
    total: Mapped[int] = mapped_column(Integer)
    grade: Mapped[str] = mapped_column(String(10))
    label: Mapped[str] = mapped_column(String(80))
    meaning: Mapped[str] = mapped_column(String(255))
    explanations: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[int] = mapped_column(Integer, default=60)
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    property: Mapped[PropertyRecord | None] = relationship(back_populates="score_runs")


class SourceDocumentRecord(Base):
    __tablename__ = "source_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id"), nullable=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="")
    source_type: Mapped[str] = mapped_column(String(80), default="upload")
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ocr_text: Mapped[str] = mapped_column(Text, default="")
    extracted_facts: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    review_status: Mapped[str] = mapped_column(String(40), default="needs_review")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    property: Mapped[PropertyRecord | None] = relationship(back_populates="documents")


class ProductRecord(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    brand: Mapped[str] = mapped_column(String(160))
    product: Mapped[str] = mapped_column(String(255))
    manufacturer: Mapped[str] = mapped_column(String(160), default="")
    pillar: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(120))
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    weight: Mapped[str] = mapped_column(String(40), default="Standard")
    summary: Mapped[str] = mapped_column(Text, default="")
    technical_writeup: Mapped[str] = mapped_column(Text, default="")
    product_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_issue: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class LeadRecord(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    product_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    property_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    property_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    action: Mapped[str] = mapped_column(String(120), default="Requested info")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ApiUsageRecord(Base):
    __tablename__ = "api_usage"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(80), index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
