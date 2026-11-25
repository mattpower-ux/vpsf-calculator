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
    jurisdiction: str | None = Field(default=None, max_length=300)
    dataStatus: str | None = Field(default=None, max_length=80)
    freshness: str | None = Field(default=None, max_length=80)
    captureRatio: float | None = Field(default=None, ge=0, le=1)
    captureCheckedAt: str | None = Field(default=None, max_length=40)
    captureNote: str | None = Field(default=None, max_length=500)


class PermitStackResponse(BaseModel):
    status: Literal['matched','no_exact_match']
    source: Literal['PermitStack'] = 'PermitStack'
    sourceUrl: Literal['https://api.permit-stack.com/public-openapi.json'] = SOURCE_URL
    address: str = Field(max_length=200)
    state: str = Field(pattern=r'^[A-Z]{2}$')
    zip: str = Field(pattern=r'^\d{5}$')
    lookupMode: Literal['search','address-history','parcel-history'] = 'search'
    matchedBy: Literal['address','parcel'] = 'address'
    parcelId: str = Field(default='', max_length=100, pattern=r'^[A-Za-z0-9 ./-]*$')
    completeness: Literal['complete','partial','unknown','unavailable','ambiguous'] = 'unknown'
    pagesChecked: int = Field(default=1, ge=0, le=10)
    recordsChecked: int = Field(default=0, ge=0, le=500)
    stopReason: Literal['exhausted','page-budget','record-budget','provider-window','ambiguous','fallback','unknown'] = 'unknown'
    # Keep JSON-native strings: existing archive repositories use model_dump().
    fetchedAt: str = Field(max_length=40)
    cacheHit: bool = False
    searchTruncated: bool
    searchedRecords: int = Field(ge=0, le=500)
    permits: list[PermitEvidence] = Field(max_length=500)
    coverage: PermitCoverage
    sourceNote: str = Field(max_length=1000)

    @field_validator('fetchedAt')
    @classmethod
    def timestamp(cls, value):
        if datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is None:
            raise ValueError('Evidence timestamp must include a timezone.')
        return value
