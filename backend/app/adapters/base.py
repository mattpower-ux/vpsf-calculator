from abc import ABC, abstractmethod

from app.schemas import ListingImportRequest, PropertyInput


class ListingAdapter(ABC):
    source: str

    @abstractmethod
    async def fetch(self, request: ListingImportRequest) -> PropertyInput:
        """Fetch and normalize a listing from a licensed provider API."""
