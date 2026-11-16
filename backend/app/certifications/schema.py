"""Bounded, data-only publication contract. URLs are citations, never fetched."""
from datetime import date
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator, field_validator

Id = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80, strict=True)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000, strict=True)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160, strict=True)]
TARGET_VALUES = {
    "toilets": ("Unknown", "Standard", "Low-flow", "WaterSense"),
    "bathroomFaucets": ("Unknown", "Standard", "Low-flow", "WaterSense"),
    "showerheads": ("Unknown", "Standard", "Low-flow", "WaterSense"),
    "ventilation": ("Balanced",),
    "roofFireRating": ("Class A",),
    "siding": ("Noncombustible",),
}
OFFICIAL_HOSTS = frozenset({"epa.gov", "www.epa.gov", "energystar.gov", "www.energystar.gov",
    "usgbc.org", "www.usgbc.org", "usgbc.my.site.com", "ngbs.com", "www.ngbs.com",
    "phius.org", "www.phius.org", "passivehouse.com", "www.passivehouse.com",
    "univention.passiv.de", "fortifiedhome.org", "www.fortifiedhome.org",
    "wildfireprepared.org", "www.wildfireprepared.org"})


class BoundedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class CertificateClaim(BoundedModel):
    programId: Id
    edition: Short = ""
    level: Short = ""
    propertyAddress: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, strict=True)] = ""
    propertyCity: Short = ""
    propertyState: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80, strict=True)] = ""
    propertyZip: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20, strict=True)] = ""
    certificateId: Short = ""
    issuedDate: date | None = None
    evidenceReference: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000, strict=True)] = ""
    status: Literal["reported", "document-supported"] = "reported"
    replacedFields: list[Id] = Field(default_factory=list, max_length=64)

    @field_validator("issuedDate")
    @classmethod
    def not_future(cls, value):
        if value is not None and value > date.today():
            raise ValueError("Certificate issue date cannot be in the future")
        return value


class Claims(BoundedModel):
    certifications: list[CertificateClaim] = Field(default_factory=list, max_length=32)


class SourceFact(BoundedModel):
    description: Text
    sourceUrl: Annotated[str, StringConstraints(max_length=2000, strict=True)]
    clause: Text

    @field_validator("sourceUrl")
    @classmethod
    def official_url(cls, value):
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or parsed.hostname not in OFFICIAL_HOSTS
                or parsed.username or parsed.password or parsed.port not in (None, 443)
                or any(c.isspace() or ord(c) < 32 for c in value)):
            raise ValueError("Source must be an official HTTPS citation URL")
        return value


class Rule(SourceFact):
    id: Id
    enabled: bool = True
    levels: list[Id] = Field(min_length=1, max_length=16)
    target: Id
    value: Id
    requirement: Literal["mandatory", "conditional"] = "mandatory"
    status: Literal["published"] = "published"
    precondition: Literal["none", "documented-exceptions-reviewed"] = "none"
    exceptions: Text
    reviewedAt: date

    @model_validator(mode="after")
    def safe_mapping(self):
        if self.value not in TARGET_VALUES.get(self.target, ()):
            raise ValueError("Unsupported inference target/value")
        if self.requirement == "conditional" and self.precondition == "none":
            raise ValueError("Conditional rules need a fixed precondition")
        if self.target == "siding" and self.precondition != "documented-exceptions-reviewed":
            raise ValueError("Siding requires documented exception review")
        return self


def unique(values, name):
    if len(values) != len(set(values)):
        raise ValueError(f"Duplicate {name}")


class Edition(BoundedModel):
    id: Id
    label: Text
    levels: list[Id] = Field(min_length=1, max_length=16)
    scope: Text
    reportFacts: list[SourceFact] = Field(min_length=1, max_length=64)
    rules: list[Rule] = Field(default_factory=list, max_length=64)

    @model_validator(mode="after")
    def valid_rules(self):
        unique(self.levels, "level")
        unique([r.id for r in self.rules], "rule ID")
        for rule in self.rules:
            if not set(rule.levels) <= set(self.levels):
                raise ValueError("Rule level not present in edition")
        return self


class Program(BoundedModel):
    id: Id
    name: Text
    issuer: Text
    editions: list[Edition] = Field(min_length=1, max_length=64)

    @model_validator(mode="after")
    def valid_editions(self):
        unique([e.id for e in self.editions], "edition ID")
        return self


class Library(BoundedModel):
    version: Id
    reviewedAt: date
    status: Literal["published"] = "published"
    programs: list[Program] = Field(min_length=1, max_length=32)

    @model_validator(mode="after")
    def valid_programs(self):
        unique([p.id for p in self.programs], "program ID")
        unique([r.id for p in self.programs for e in p.editions for r in e.rules], "library rule ID")
        for p in self.programs:
            for e in p.editions:
                for r in e.rules:
                    if r.target == "siding" and (p.id != "wildfire-prepared-home" or e.id != "2025-12" or r.levels != ["Plus"]):
                        raise ValueError("Siding mapping limited to reviewed Wildfire Plus edition")
        return self


PublishedLibrary = Library
