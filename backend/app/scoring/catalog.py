from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas import PropertyInput
from app.scoring.wildfire import wildfire_adjustment


PILLARS = ("energy", "water", "health", "resilience", "carbon", "financial", "community")
Mode = Literal["lookup", "contains", "contains_any", "equals", "not_equals", "wildfire", "number_range", "epa_range"]


class CustomField(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    label: str = Field(min_length=1, max_length=100)
    helper: str = ""
    pillar: str
    kind: Literal["checkbox", "select", "number"]
    choices: list[str] = Field(default_factory=list)
    minimum: float | None = None
    maximum: float | None = None
    active: bool = True


class Factor(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    label: str = Field(min_length=1, max_length=120)
    pillar: str
    field: str
    mode: Mode
    points: int = Field(default=0, ge=-200, le=200)
    options: dict[str, int] = Field(default_factory=dict)
    default: int = Field(default=0, ge=-200, le=200)
    matches: list[str] = Field(default_factory=list)
    lower: float | None = None
    upper: float | None = None
    active: bool = True
    source: str = "property_input"
    parentId: str | None = None

    @field_validator("options")
    @classmethod
    def bounded_options(cls, options):
        if any(not -200 <= points <= 200 for points in options.values()):
            raise ValueError("Lookup points must be within -200 to 200")
        return options


class ScoreModel(BaseModel):
    version: str
    pillars: dict[str, int]
    factors: list[Factor]
    customFields: list[CustomField] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_structure(self):
        if set(self.pillars) != set(PILLARS) or any(not 0 <= cap <= 1000 for cap in self.pillars.values()):
            raise ValueError("Exactly seven nonnegative pillar budgets are required")
        ids = [factor.id for factor in self.factors]
        if len(ids) != len(set(ids)):
            raise ValueError("Factor IDs must be unique")
        fields = set(PropertyInput.model_fields) | {field.id for field in self.customFields}
        custom = {field.id: field for field in self.customFields}
        if len({field.id for field in self.customFields}) != len(self.customFields) or any(field.id in PropertyInput.model_fields for field in self.customFields):
            raise ValueError("Custom field IDs must be unique and cannot replace built-in facts")
        for factor in self.factors:
            if factor.pillar not in self.pillars or factor.field not in fields:
                raise ValueError(f"Invalid factor target: {factor.id}")
            if factor.mode == "wildfire" and factor.field != "wildfire":
                raise ValueError("Wildfire matching requires the verified wildfire field")
            if factor.mode == "epa_range" and factor.field != "epaWalkability":
                raise ValueError("EPA matching requires the sourced walkability field")
            if factor.mode == "lookup" and not factor.options:
                raise ValueError("Lookup needs options")
            if factor.mode in {"contains", "contains_any", "equals", "not_equals"} and not factor.matches:
                raise ValueError(f"Matching condition is empty: {factor.id}")
            if factor.mode in {"number_range", "epa_range"} and factor.lower is None and factor.upper is None:
                raise ValueError(f"Numeric condition needs a bound: {factor.id}")
            if factor.lower is not None and factor.upper is not None and factor.lower > factor.upper:
                raise ValueError(f"Invalid numeric range: {factor.id}")
            if factor.field in custom and factor.active and not custom[factor.field].active:
                raise ValueError(f"Active factor uses a retired field: {factor.id}")
            if factor.field in custom and factor.mode == "number_range" and custom[factor.field].kind != "number":
                raise ValueError(f"Numeric rule needs a number input: {factor.id}")
        factors_by_id = {factor.id: factor for factor in self.factors}
        for factor in self.factors:
            if factor.parentId and (factor.parentId not in factors_by_id or factors_by_id[factor.parentId].active):
                raise ValueError("A split child requires a retired parent")
        for parent in self.factors:
            children = [factor for factor in self.factors if factor.active and factor.parentId == parent.id]
            if children:
                parent_max = max(parent.options.values(), default=parent.points)
                child_max = sum(max(child.options.values(), default=child.points) for child in children)
                if child_max > parent_max:
                    raise ValueError("Split children exceed their parent allocation")
        for field in self.customFields:
            if field.pillar not in self.pillars:
                raise ValueError("Invalid custom field pillar")
            if field.kind == "select" and not field.choices:
                raise ValueError("Select field needs choices")
            if field.kind == "number" and (field.minimum is None or field.maximum is None or field.minimum >= field.maximum):
                raise ValueError("Number field needs valid bounds")
        return self


def factor_points(home: PropertyInput, factor: Factor) -> int:
    if not factor.active:
        return 0
    if factor.mode == "wildfire":
        return wildfire_adjustment(home)
    if factor.mode == "epa_range":
        evidence = home.epaWalkability
        if not evidence or evidence.status != "available" or evidence.source != "EPA National Walkability Index" or evidence.value is None:
            return 0
        if home.latitude is None or home.longitude is None or evidence.latitude is None or evidence.longitude is None:
            return 0
        if abs(home.latitude - evidence.latitude) > 0.000001 or abs(home.longitude - evidence.longitude) > 0.000001:
            return 0
        return factor.points if (factor.lower is None or evidence.value >= factor.lower) and (factor.upper is None or evidence.value <= factor.upper) else 0
    value = getattr(home, factor.field, None)
    if value is None:
        value = (getattr(home, "extraInputs", {}) or {}).get(factor.field)
    if factor.mode == "lookup":
        return factor.options.get(str(value), factor.default)
    if value is None or value == "" or value == "Unknown":
        return 0
    if factor.mode == "contains":
        return factor.points if factor.matches and factor.matches[0].lower() in str(value).lower() else 0
    if factor.mode == "contains_any":
        return factor.points if any(match.lower() in str(value).lower() for match in factor.matches) else 0
    if factor.mode == "equals":
        return factor.points if str(value).lower() in {match.lower() for match in factor.matches} else 0
    if factor.mode == "not_equals":
        return factor.points if str(value).lower() not in {match.lower() for match in factor.matches} else 0
    if factor.mode == "number_range":
        try:
            number = float(value)
        except (ValueError, TypeError):
            return 0
        return factor.points if (factor.lower is None or number >= factor.lower) and (factor.upper is None or number <= factor.upper) else 0
    return 0


def evaluate_model(home: PropertyInput, model: ScoreModel) -> dict[str, int]:
    scores = {pillar: 0 for pillar in PILLARS}
    for factor in model.factors:
        scores[factor.pillar] += factor_points(home, factor)
    return {pillar: max(0, min(model.pillars[pillar], points)) for pillar, points in scores.items()}
