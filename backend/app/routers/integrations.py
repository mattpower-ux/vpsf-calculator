from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.integrations.ocr import OcrConfiguration
from app.repositories import get_api_usage

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/status")
async def integration_status(settings: Settings = Depends(get_settings), db: Session = Depends(get_db)) -> dict:
    ocr = OcrConfiguration(
        provider=settings.ocr_provider,
        mistral_api_key=settings.mistral_api_key,
        google_application_credentials=settings.google_application_credentials,
        google_project_id=settings.google_document_ai_project_id,
        google_location=settings.google_document_ai_location,
        google_processor_id=settings.google_document_ai_processor_id,
    )

    rentcast_usage = get_api_usage(db, "rentcast")

    return {
        "mapbox": {
            "configured": settings.configured_integrations["mapbox"],
            "missing": [] if settings.configured_integrations["mapbox"] else ["MAPBOX_ACCESS_TOKEN"],
        },
        "attom": {
            "configured": settings.configured_integrations["attom"],
            "missing": [] if settings.configured_integrations["attom"] else ["ATTOM_API_KEY"],
        },
        "rentcast": {
            "configured": settings.configured_integrations["rentcast"],
            "missing": [] if settings.configured_integrations["rentcast"] else ["RENTCAST_API_KEY"],
            "usedThisMonth": rentcast_usage.count,
            "monthlyLimit": settings.rentcast_monthly_limit,
            "period": rentcast_usage.period,
        },
        "climateZone": {
            "configured": True,
            "missing": [],
        },
        "femaFlood": {
            "configured": True,
            "missing": [],
        },
        "openai": {
            "configured": settings.configured_integrations["openai"],
            "missing": [] if settings.configured_integrations["openai"] else ["OPENAI_API_KEY"],
        },
        "ocr": {
            "provider": settings.ocr_provider,
            "configured": ocr.is_configured,
            "missing": ocr.missing_fields,
        },
    }
