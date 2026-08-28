from typing import Any

import httpx


class RentCastClient:
    base_url = "https://api.rentcast.io/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def property_by_address(self, address: str) -> list[dict[str, Any]]:
        if not self.is_configured:
            raise RuntimeError("RENTCAST_API_KEY is not configured")

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/properties",
                headers={"Accept": "application/json", "X-Api-Key": self.api_key},
                params={"address": address, "limit": 1},
            )
            response.raise_for_status()
            return response.json()
