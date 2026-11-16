"""Bounded, JSON-native permit evidence; never a scoring feature."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

SOURCE_URL = 'https://api.permit-stack.com/public-openapi.json'


class PermitEvidence(BaseModel):
    id: str = Field(max_length=36)
    permitNumber: str | None = Field(default=None, max_length=300)
    status: Literal['FILED','ISSUED','IN_PROGRESS','FINAL','EXPIRED','CANCELLED','REVOKED','UNKNOWN','INTERCONNECTED']
    category: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    jurisdiction: str | None = Field(default=None, max_length=300)
    address: str = Field(max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state: str = Field(pattern=r'^[A-Z]{2}$')
    zip: str = Field(pattern=r'^\d{5}$')
    dateFiled: str | None = Field(default=None, max_length=10)
    dateIssued: str | None = Field(default=None, max_length=10)
    dateCompleted: str | None = Field(default=None, max_length=10)


class PermitCoverage(BaseModel):
    confidence: str | None = Field(default=None, max_length=80)
    covered: bool | None = None
    dataThrough: str | None = Field(default=None, max_length=40)
    tierWindowClamped: bool = False
    tierWindowFrom: str | None = Field(default=None, max_length=40)


class PermitStackResponse(BaseModel):
    status: Literal['matched','no_exact_match']
    source: Literal['PermitStack'] = 'PermitStack'
    sourceUrl: Literal['https://api.permit-stack.com/public-openapi.json'] = SOURCE_URL
    address: str = Field(max_length=200)
    state: str = Field(pattern=r'^[A-Z]{2}$')
    zip: str = Field(pattern=r'^\d{5}$')
    # Keep JSON-native strings: existing archive repositories use model_dump().
    fetchedAt: str = Field(max_length=40)
    cacheHit: bool = False
    searchTruncated: bool
    searchedRecords: int = Field(ge=0, le=25)
    permits: list[PermitEvidence] = Field(max_length=25)
    coverage: PermitCoverage
    sourceNote: str = Field(max_length=1000)

    @field_validator('fetchedAt')
    @classmethod
    def timestamp(cls, value):
        if datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is None:
            raise ValueError('Evidence timestamp must include a timezone.')
        return value
