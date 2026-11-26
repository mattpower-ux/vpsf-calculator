import os
from functools import lru_cache


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def bounded_env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def default_database_url() -> str:
    if os.getenv("RENDER"):
        return "sqlite:////var/data/vpsf.db"
    return "sqlite:///./vpsf.db"


class Settings:
    app_name = "VPSF Calculator API"
    model_version = "vpsf-0.2.0-usfs"
    raw_database_url = os.getenv("DATABASE_URL", default_database_url())
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    mapbox_access_token = os.getenv("MAPBOX_ACCESS_TOKEN", "")
    google_street_view_api_key = os.getenv("GOOGLE_STREET_VIEW_API_KEY", "")
    crawl4ai_api_key = os.getenv("CRAWL4AI_API_KEY", "")
    photo_storage_path = os.getenv("PHOTO_STORAGE_PATH", "/var/data/vpsf-photos" if os.getenv("RENDER") else "./data/vpsf-photos")
    attom_api_key = os.getenv("ATTOM_API_KEY", "")
    attom_monthly_limit = int(os.getenv("ATTOM_MONTHLY_LIMIT", "100"))
    permit_stack_api_key = os.getenv("PERMIT_STACK_API_KEY", "")
    permit_stack_monthly_limit = max(0, min(10000, int(os.getenv("PERMIT_STACK_MONTHLY_LIMIT", "100"))))
    permit_stack_history_enabled = env_bool("PERMIT_STACK_HISTORY_ENABLED", False)
    permit_stack_max_pages = bounded_env_int("PERMIT_STACK_MAX_PAGES", 3, 1, 10)
    permit_stack_page_size = bounded_env_int("PERMIT_STACK_PAGE_SIZE", 50, 1, 50)
    permit_stack_max_records = bounded_env_int("PERMIT_STACK_MAX_RECORDS", 150, 1, 500)
    rentcast_api_key = os.getenv("RENTCAST_API_KEY", "")
    rentcast_monthly_limit = int(os.getenv("RENTCAST_MONTHLY_LIMIT", "100"))
    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    ocr_provider = os.getenv("OCR_PROVIDER", "mistral")
    mistral_api_key = os.getenv("MISTRAL_API_KEY", "")
    google_application_credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    google_document_ai_project_id = os.getenv("GOOGLE_DOCUMENT_AI_PROJECT_ID", "")
    google_document_ai_location = os.getenv("GOOGLE_DOCUMENT_AI_LOCATION", "")
    google_document_ai_processor_id = os.getenv("GOOGLE_DOCUMENT_AI_PROCESSOR_ID", "")
    alert_email_to = os.getenv("ALERT_EMAIL_TO", "matt.power@greenbuildermedia.com")
    alert_email_from = os.getenv("ALERT_EMAIL_FROM", "")
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() not in {"0", "false", "no"}

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
            "attom": False,
            "permitstack": bool(self.permit_stack_api_key.strip()),
            "crawl4ai": bool(self.crawl4ai_api_key.strip()),
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
