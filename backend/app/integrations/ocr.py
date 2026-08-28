from dataclasses import dataclass


@dataclass(frozen=True)
class OcrConfiguration:
    provider: str
    mistral_api_key: str = ""
    google_application_credentials: str = ""
    google_project_id: str = ""
    google_location: str = ""
    google_processor_id: str = ""

    @property
    def is_configured(self) -> bool:
        if self.provider == "mistral":
            return bool(self.mistral_api_key)
        if self.provider == "google_document_ai":
            return bool(
                self.google_application_credentials
                and self.google_project_id
                and self.google_location
                and self.google_processor_id
            )
        return False

    @property
    def missing_fields(self) -> list[str]:
        if self.provider == "mistral":
            return [] if self.mistral_api_key else ["MISTRAL_API_KEY"]
        if self.provider == "google_document_ai":
            fields = {
                "GOOGLE_APPLICATION_CREDENTIALS": self.google_application_credentials,
                "GOOGLE_DOCUMENT_AI_PROJECT_ID": self.google_project_id,
                "GOOGLE_DOCUMENT_AI_LOCATION": self.google_location,
                "GOOGLE_DOCUMENT_AI_PROCESSOR_ID": self.google_processor_id,
            }
            return [name for name, value in fields.items() if not value]
        return ["OCR_PROVIDER"]
