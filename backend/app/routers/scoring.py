from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from math import isfinite

from app.config import get_settings
from app.db import get_db
from app.repositories import create_property, create_score_run
from app.schemas import PropertyInput, ScoreResponse
from app.scoring import classify_score, confidence_for_input, explain_score
from app.scoring.catalog import ScoreModel, evaluate_model
from app.scoring.store import ModelUnavailableError, load_published
from app.integrations.epa_walkability import cached_walkability

router = APIRouter(prefix="/api", tags=["scoring"])


def validate_extra_inputs(values: dict[str, object], model: ScoreModel) -> dict[str, object]:
    fields = {field.id: field for field in model.customFields if field.active}
    for key, value in values.items():
        field = fields.get(key)
        if field is None:
            raise ValueError(f"Unknown scoring input: {key}")
        if value in (None, "Unknown"):
            continue
        if field.kind == "checkbox" and not isinstance(value, bool):
            raise ValueError(f"{field.label} requires a checkbox value")
        if field.kind == "select" and value not in field.choices:
            raise ValueError(f"{field.label} requires a listed choice")
        if field.kind == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not field.minimum <= value <= field.maximum:
                raise ValueError(f"{field.label} is outside its allowed range")
    return values


@router.get("/scoring/form-fields")
def form_fields(db: Session = Depends(get_db)) -> list[dict]:
    try:
        model = load_published(db)
    except (ModelUnavailableError, SQLAlchemyError) as error:
        raise HTTPException(status_code=503, detail="Scoring model unavailable") from error
    return [field.model_dump() for field in model.customFields if field.active]


@router.post("/score", response_model=ScoreResponse)
async def score_property(property_input: PropertyInput, db: Session = Depends(get_db)) -> ScoreResponse:
    try:
        model = load_published(db)
    except (ModelUnavailableError, SQLAlchemyError) as error:
        raise HTTPException(status_code=503, detail="Scoring model unavailable") from error
    try:
        validate_extra_inputs(property_input.extraInputs, model)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if any(factor.active and factor.mode == "epa_range" for factor in model.factors):
        property_input.epaWalkability = await cached_walkability(db, property_input.latitude, property_input.longitude)
    else:
        property_input.epaWalkability = None
    property_record = create_property(db, property_input, source="score_request")
    scores = evaluate_model(property_input, model)
    total = sum(scores.values())
    classification = classify_score(total)
    explanations = explain_score(property_input, scores)
    confidence = confidence_for_input(property_input)
    score_run = create_score_run(
        db,
        property_input,
        model_version=model.version,
        scores=scores,
        total=total,
        explanations=explanations,
        confidence=confidence,
        property_id=property_record.id,
        **classification,
    )
    return ScoreResponse(
        scores=scores,
        total=total,
        modelVersion=model.version,
        explanations=explanations,
        confidence=confidence,
        propertyId=property_record.id,
        scoreRunId=score_run.id,
        walkability=property_input.epaWalkability,
        **classification,
    )
