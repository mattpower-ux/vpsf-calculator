from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.repositories import create_property, create_score_run
from app.schemas import PropertyInput, ScoreResponse
from app.scoring import classify_score, confidence_for_input, explain_score, score_home

router = APIRouter(prefix="/api", tags=["scoring"])


@router.post("/score", response_model=ScoreResponse)
async def score_property(property_input: PropertyInput, db: Session = Depends(get_db)) -> ScoreResponse:
    settings = get_settings()
    property_record = create_property(db, property_input, source="score_request")
    scores = score_home(property_input)
    total = sum(scores.values())
    classification = classify_score(total)
    explanations = explain_score(property_input, scores)
    confidence = confidence_for_input(property_input)
    score_run = create_score_run(
        db,
        property_input,
        model_version=settings.model_version,
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
        modelVersion=settings.model_version,
        explanations=explanations,
        confidence=confidence,
        propertyId=property_record.id,
        scoreRunId=score_run.id,
        **classification,
    )
