from datetime import date
from urllib.parse import urlsplit
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas import PropertyInput
from app.advice.products import NEED_TAGS, REQUIREMENTS

PILLARS = {"energy", "water", "health", "resilience", "carbon", "financial", "community"}


def https_url(value):
    if not value: return value
    u = urlsplit(value)
    if u.scheme != "https" or not u.hostname or u.username or u.password:
        raise ValueError("Use a public HTTPS URL")
    return value


class ProductMetadata(BaseModel):
    needTags: list[str] = Field(default_factory=list, max_length=8)
    pillars: list[str] = Field(default_factory=list, max_length=7)
    requirements: list[str] = Field(default_factory=list, max_length=8)
    verificationNotes: str = Field(default="", max_length=600)
    sourceUrl: str = Field(default="", max_length=1000)
    reviewedAt: str = ""
    isSponsored: bool = False
    sponsorName: str = Field(default="", max_length=160)

    @model_validator(mode="after")
    def validate_metadata(self):
        if set(self.needTags) - NEED_TAGS or set(self.requirements) - REQUIREMENTS or set(self.pillars) - PILLARS:
            raise ValueError("Unsupported matching tag, requirement or pillar")
        https_url(self.sourceUrl)
        if self.reviewedAt: date.fromisoformat(self.reviewedAt)
        if self.isSponsored and not self.sponsorName.strip(): raise ValueError("Sponsor name is required")
        if self.reviewedAt and not self.sourceUrl: raise ValueError("Reviewed specifications need a source URL")
        return self


class MetadataUpdate(BaseModel):
    revision: int = Field(ge=0)
    data: ProductMetadata


class AdviceRequest(BaseModel):
    home: PropertyInput
    modelVersion: str | None = None


class TipData(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,119}$")
    pillar: str
    text: str = Field(default="", max_length=650)
    image: str = Field(default="", max_length=1000)
    alt: str = Field(default="", max_length=200)
    source: str = Field(default="", max_length=1000)
    sourceLabel: str = Field(default="", max_length=150)
    reviewedAt: str = ""
    imageCredit: str = Field(default="", max_length=300)
    climateTags: list[str] = Field(default_factory=list, max_length=20)
    order: int = Field(default=0, ge=0, le=10000)

    @model_validator(mode="after")
    def valid(self):
        if self.pillar not in PILLARS: raise ValueError("Unsupported pillar")
        https_url(self.source)
        if self.image and self.image not in PILLARS | {"sprinkler", "water-heater", "cool-roof"}: https_url(self.image)
        if self.reviewedAt: date.fromisoformat(self.reviewedAt)
        if any(x not in {f"{z}{m}" for z in range(1,9) for m in ("A","B","C","")} for x in self.climateTags): raise ValueError("Use climate zone tags such as 2A or 6A")
        if any("<" in str(v) or ">" in str(v) for v in [self.text,self.alt,self.sourceLabel,self.imageCredit]): raise ValueError("Use plain text, not HTML")
        return self

    def publishable(self):
        if not 25 <= len(self.text.split()) <= 55: raise ValueError("Published tips need 25–55 words")
        if not all([self.image, self.alt.strip(), self.source, self.sourceLabel.strip(), self.reviewedAt, self.imageCredit.strip()]): raise ValueError("Image, alt text, source, review date and image credit are required")
        return self


class TipUpdate(BaseModel):
    revision: int = Field(ge=0)
    data: TipData


class RevisionRequest(BaseModel):
    revision: int = Field(ge=1)
    version: int | None = None
