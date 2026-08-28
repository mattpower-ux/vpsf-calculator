from app.adapters.base import ListingAdapter
from app.adapters.placeholders import NotConfiguredListingAdapter


def get_listing_adapter(source: str) -> ListingAdapter:
    return NotConfiguredListingAdapter(source)
