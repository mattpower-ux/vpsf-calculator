from app.adapters.base import ListingAdapter
from app.schemas import ListingImportRequest, PropertyInput


class NotConfiguredListingAdapter(ListingAdapter):
    def __init__(self, source: str):
        self.source = source

    async def fetch(self, request: ListingImportRequest) -> PropertyInput:
        identifier = request.address or request.listingId or request.url or ""
        return PropertyInput(
            address=identifier,
            sourceNote=f"{self.source} API credentials are not configured yet.",
        )
