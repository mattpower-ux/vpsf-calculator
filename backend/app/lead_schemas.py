"""Public lead validation and admin lifecycle payloads; no delivery semantics."""
import json
import math
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr, StringConstraints, field_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, strict=True)]
LeadStatus = Literal['new', 'reviewed', 'qualified', 'approved', 'contacted', 'quoted', 'won', 'lost', 'archived']
CONTEXT_FIELDS = {'sidingType', 'roofType', 'roofAge', 'wildfireRisk', 'resilienceScore', 'totalScore', 'modelVersion', 'reason'}


class LeadRequest(BaseModel):
    # Legacy clients may still send brand/action. Brand is never trusted or stored.
    model_config = ConfigDict(extra='ignore')
    name: Text = Field(min_length=1, max_length=160)
    email: Text = Field(min_length=3, max_length=254)
    productId: Text = Field(min_length=1, max_length=120)
    role: Literal['homeowner', 'buyer', 'builder', 'designer', 'agent', 'other'] | None = None
    intent: Literal['information', 'planning', 'estimate'] = 'information'
    timeline: Literal['researching', 'within_3_months', 'within_12_months', 'later'] = 'researching'
    scope: Text | None = Field(default=None, max_length=500)
    phone: Text | None = Field(default=None, max_length=40)
    propertyAddress: Text | None = Field(default=None, max_length=255)
    zip: Text = Field(pattern=r'^[0-9]{5}(?:-[0-9]{4})?$', max_length=10)
    contactConsent: StrictBool
    shareConsent: StrictBool = False
    isDemo: StrictBool = False
    assessmentContext: dict[str, StrictStr | StrictInt | StrictFloat] = Field(default_factory=dict, max_length=8)
    action: Text = Field(default='Requested info', max_length=120)

    @field_validator('name', 'email', 'productId', 'role', 'phone', 'propertyAddress', 'zip', 'action', mode='before')
    @classmethod
    def single_line(cls, value):
        if isinstance(value, str) and re.search(r'[\x00-\x1f\x7f]', value):
            raise ValueError('Control characters are not allowed')
        return value

    @field_validator('scope')
    @classmethod
    def valid_scope(cls, value):
        if value is not None and '\x00' in value:
            raise ValueError('NUL characters are not allowed')
        return value

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        if value.count('@') != 1:
            raise ValueError('Enter a valid email address')
        local, domain = value.rsplit('@', 1)
        if (len(local) > 64 or not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+", local)
                or local.startswith('.') or local.endswith('.') or '..' in local):
            raise ValueError('Enter a valid email address')
        try:
            domain = domain.encode('idna').decode('ascii').lower()
        except UnicodeError:
            raise ValueError('Enter a valid email address')
        labels = domain.split('.')
        if len(labels) < 2 or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in labels):
            raise ValueError('Enter a valid email address')
        normalized = local + '@' + domain
        if len(normalized) > 254:
            raise ValueError('Email address is too long')
        return normalized

    @field_validator('contactConsent')
    @classmethod
    def require_contact_consent(cls, value):
        if value is not True:
            raise ValueError('Explicit contact consent is required')
        return value

    @field_validator('assessmentContext', mode='before')
    @classmethod
    def bounded_context(cls, value):
        if not isinstance(value, dict) or set(value) - CONTEXT_FIELDS:
            raise ValueError('Unsupported assessment context field')
        for key, item in value.items():
            if type(item) not in (str, int, float):
                raise ValueError('Assessment context must contain only strings or numbers')
            if isinstance(item, str):
                if len(item) > 500 or '\x00' in item:
                    raise ValueError('Assessment context text is too long or invalid')
            elif abs(item) > 1_000_000 or not math.isfinite(item):
                raise ValueError('Assessment context number is out of range')
            if key in {'resilienceScore', 'totalScore'} and type(item) in (int, float):
                if not 0 <= item <= (200 if key == 'resilienceScore' else 1000):
                    raise ValueError('Assessment score is out of range')
        if len(json.dumps(value, ensure_ascii=False).encode('utf-8')) > 4096:
            raise ValueError('Assessment context is too large')
        return value


class LeadResponse(BaseModel):
    id: int
    status: str = 'accepted'


class LeadUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: LeadStatus
    adminNotes: str = Field(max_length=2000)
    revision: StrictInt = Field(ge=1)


    @field_validator('adminNotes')
    @classmethod
    def valid_notes(cls, value):
        if '\x00' in value:
            raise ValueError('NUL characters are not allowed')
        return value
