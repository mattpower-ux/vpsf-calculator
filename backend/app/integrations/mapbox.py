from typing import Any

import httpx


class MapboxClient:
    base_url = "https://api.mapbox.com/search/geocode/v6/forward"

    def __init__(self, access_token: str):
        self.access_token = access_token

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token)

    async def geocode(self, query: str, limit: int = 1) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("MAPBOX_ACCESS_TOKEN is not configured")

        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                self.base_url,
                params={
                    "q": query,
                    "country": "us",
                    "limit": limit,
                    "access_token": self.access_token,
                },
            )
            response.raise_for_status()
            return response.json()
