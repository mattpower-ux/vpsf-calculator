import os
from functools import lru_cache


def default_database_url() -> str:
    if os.getenv("RENDER"):
        return "sqlite:////var/data/vpsf.db"
    return "sqlite:///./vpsf.db"


class Settings:
    app_name = "VPSF Calculator API"
    model_version = "vpsf-0.1.0"
    raw_database_url = os.getenv("DATABASE_URL", default_database_url())
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    mapbox_access_token = os.getenv("MAPBOX_ACCESS_TOKEN", "")
    attom_api_key = os.getenv("ATTOM_API_KEY", "")
    attom_monthly_limit = int(os.getenv("ATTOM_MONTHLY_LIMIT", "100"))
    rentcast_api_key = os.getenv("RENTCAST_API_KEY", "")
    rentcast_monthly_limit = int(os.getenv("RENTCAST_MONTHLY_LIMIT", "100"))
    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    ocr_provider = os.getenv("OCR_PROVIDER", "mistral")
    mistral_api_key = os.getenv("MISTRAL_API_KEY", "")
    google_application_credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    google_document_ai_project_id = os.getenv("GOOGLE_DOCUMENT_AI_PROJECT_ID", "")
    google_document_ai_location = os.getenv("GOOGLE_DOCUMENT_AI_LOCATION", "")
    google_document_ai_processor_id = os.getenv("GOOGLE_DOCUMENT_AI_PROCESSOR_ID", "")

    @property
    def database_url(self) -> str:
        if self.raw_database_url.startswith("postgres://"):
            return self.raw_database_url.replace("postgres://", "postgresql+psycopg://", 1)
        if self.raw_database_url.startswith("postgresql://"):
            return self.raw_database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.raw_database_url

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]

    @property
    def configured_integrations(self) -> dict[str, bool]:
        return {
            "mapbox": bool(self.mapbox_access_token),
            "attom": bool(self.attom_api_key),
            "rentcast": bool(self.rentcast_api_key),
            "openai": bool(self.openai_api_key),
            "mistral": bool(self.mistral_api_key),
            "googleDocumentAi": bool(
                self.google_application_credentials
                and self.google_document_ai_project_id
                and self.google_document_ai_location
                and self.google_document_ai_processor_id
            ),
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
