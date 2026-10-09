import asyncio

from app.integrations.climate import estimate_climate_zone
from app.routers.properties import enrich_property_risk, geocode_response_from_mapbox
from app.schemas import RiskEnrichmentRequest


def test_iecc_zone_uses_county_not_state_guess():
    assert estimate_climate_zone("ME", county="Penobscot County") == "6A - Cold Humid"
    assert estimate_climate_zone("Maine", county="Aroostook County") == "7 - Very Cold"
    assert estimate_climate_zone("FL", county="Orange County") == "2A - Hot Humid"
    assert estimate_climate_zone("Florida", county="Miami-Dade County") == "1A - Very Hot Humid"


def test_unknown_county_does_not_claim_a_precise_zone():
    assert estimate_climate_zone("ME") == "Unknown"
    assert estimate_climate_zone("FL", county="Unrecognized County") == "Unknown"


def test_geocoder_preserves_county_context_for_climate_lookup():
    response = geocode_response_from_mapbox(
        "346 Lincoln Street, Bangor, ME 04401",
        {"features": [{"properties": {"context": {
            "place": {"name": "Bangor"},
            "district": {"name": "Penobscot County"},
            "region": {"name": "Maine", "region_code": "ME"},
            "postcode": {"name": "04401"},
        }}}]},
    )

    assert response.county == "Penobscot County"
    assert response.state == "ME"


def test_risk_endpoint_returns_bangor_zone_from_county():
    result = asyncio.run(
        enrich_property_risk(
            RiskEnrichmentRequest(state="ME", zip="04401", county="Penobscot County"),
            db=None,
        )
    )

    assert result.climateZone == "6A - Cold Humid"
