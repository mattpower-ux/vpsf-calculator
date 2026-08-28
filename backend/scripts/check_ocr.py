import os

import httpx

from integration_env import load_backend_env, require_env


def check_mistral() -> None:
    api_key = require_env("MISTRAL_API_KEY")
    response = httpx.get(
        "https://api.mistral.ai/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    response.raise_for_status()
    print("Mistral OK")
    print("API key authenticated successfully.")


def check_google_document_ai() -> None:
    required = [
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_DOCUMENT_AI_PROJECT_ID",
        "GOOGLE_DOCUMENT_AI_LOCATION",
        "GOOGLE_DOCUMENT_AI_PROCESSOR_ID",
    ]
    missing = [name for name in required if not os.getenv(name, "").strip()]
    if missing:
        raise SystemExit(f"Missing Google Document AI settings: {', '.join(missing)}")

    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not os.path.exists(credentials_path):
        raise SystemExit(f"GOOGLE_APPLICATION_CREDENTIALS does not exist: {credentials_path}")

    print("Google Document AI config OK")
    print("Credential file and processor settings are present.")


def main() -> None:
    load_backend_env()
    provider = os.getenv("OCR_PROVIDER", "mistral").strip()
    if provider == "mistral":
        check_mistral()
        return
    if provider == "google_document_ai":
        check_google_document_ai()
        return

    raise SystemExit("OCR_PROVIDER must be mistral or google_document_ai")


if __name__ == "__main__":
    main()
