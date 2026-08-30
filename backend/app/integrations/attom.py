from typing import Any

import httpx


class AttomClient:
    base_url = "https://api.gateway.attomdata.com/propertyapi/v1.0.0"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def headers(self) -> dict[str, str]:
        return {"APIKey": self.api_key, "Accept": "application/json"}

    async def property_basic_profile(self, address1: str, address2: str) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("ATTOM_API_KEY is not configured")

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/property/basicprofile",
                headers=self.headers,
                params={"address1": address1, "address2": address2},
            )
            response.raise_for_status()
            return response.json()

    async def property_detail(self, address1: str, address2: str) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("ATTOM_API_KEY is not configured")

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/property/detail",
                headers=self.headers,
                params={"address1": address1, "address2": address2},
            )
            response.raise_for_status()
            return response.json()
