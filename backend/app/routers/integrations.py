from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.integrations.ocr import OcrConfiguration

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/status")
async def integration_status(settings: Settings = Depends(get_settings)) -> dict:
    ocr = OcrConfiguration(
        provider=settings.ocr_provider,
        mistral_api_key=settings.mistral_api_key,
        google_application_credentials=settings.google_application_credentials,
        google_project_id=settings.google_document_ai_project_id,
        google_location=settings.google_document_ai_location,
        google_processor_id=settings.google_document_ai_processor_id,
    )

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
