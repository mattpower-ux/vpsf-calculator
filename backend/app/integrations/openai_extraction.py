from typing import Any

import httpx


class OpenAiExtractionClient:
    base_url = "https://api.openai.com/v1/responses"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def extract_property_facts(self, listing_text: str) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-5-mini",
                    "input": [
                        {
                            "role": "system",
                            "content": (
                                "Extract structured residential property facts for VPSF scoring. "
                                "Return concise JSON only."
                            ),
                        },
                        {"role": "user", "content": listing_text},
                    ],
                    "text": {"format": {"type": "json_object"}},
                },
            )
            response.raise_for_status()
            return response.json()
