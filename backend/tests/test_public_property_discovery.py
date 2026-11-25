import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.integrations import public_property_discovery as discovery
from app.routers import properties


EXACT_RESULTS = {
    "rows": [
        {
            "url": "https://www.zillow.com/homedetails/22-Dow-St-Portland-ME-04102/1_zpid/",
            "title": "22 Dow St, Portland, ME 04102 | Zillow",
            "snippet": "Off-market property page.",
            "markdown": "22 Dow St, Portland, ME 04102. Property facts: 3,140 square feet, 6 bedrooms, 3 bathrooms, built in 1910. Multi-family home.",
        },
        {
            "url": "https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1",
            "title": "22 Dow St, Portland, ME 04102 | Redfin",
            "snippet": "Property overview for the entered address.",
            "markdown": "22 Dow St, Portland, ME 04102. 3,140 sq. ft. multi-family home with 6 beds and 3 baths.",
        },
        {
            "url": "https://www.realtor.com/realestateandhomes-detail/24-Dow-St_Portland_ME_04102",
            "title": "24 Dow St, Portland, ME 04102",
            "snippet": "Nearby home built in 1900 with 4 beds.",
        },
        {
            "url": "https://parcelsfolder.portlandmaine.gov/property/22-dow-st",
            "title": "22 Dow St, Portland, ME 04102 - Property record",
            "snippet": "Municipal parcel record: year built 1910.",
        },
    ]
}


def test_extracts_only_exact_address_facts_with_field_provenance():
    home = discovery.property_from_search_results("22 Dow St, Portland, ME 04102", EXACT_RESULTS)

    assert home.squareFeet == "3140"
    assert home.yearBuilt == "1910"
    assert home.bedrooms == "6"
    assert home.bathrooms == "3"
    assert home.homeType == "Multifamily"
    assert home.unitCount == "3"
    assert home.hvac == "Heat Pump (Electric) + Boiler"
    assert home.provenance["hvac"].origin == "imported"
    assert home.provenance["hvac"].source.startswith("Public records:")
    assert home.provenance["squareFeet"].origin == "imported"
    assert "Zillow" in home.provenance["squareFeet"].source
    assert "Redfin" in home.provenance["squareFeet"].source
    assert "Municipal public record" in home.provenance["yearBuilt"].source
    assert "24 Dow" not in home.sourceNote


def test_extracts_explicit_multifamily_unit_count_without_guessing_from_bedrooms():
    results = {"rows": [{
        "url": "https://www.zillow.com/homedetails/24-Dow-St-Portland-ME-04102/1_zpid/",
        "title": "24 Dow St, Portland, ME 04102",
        "snippet": "A 3-unit multifamily building with 6 bedrooms and 3 bathrooms.",
    }]}
    home = discovery.property_from_search_results("24 Dow St, Portland, ME 04102", results)
    assert home.homeType == "Multifamily"
    assert home.unitCount == "3"
    assert home.provenance["unitCount"].origin == "imported"


def test_rejects_unit_and_non_exact_results_for_whole_building_address():
    results = {"rows": [
        {
            "url": "https://www.zillow.com/homedetails/22-Dow-St-APT-3-Portland-ME-04102/2_zpid/",
            "title": "22 Dow St Apt 3, Portland, ME 04102",
            "snippet": "An 1,100 square foot apartment with 2 beds and 1 bath.",
        },
        {
            "url": "https://www.redfin.com/ME/Portland/20-Dow-St-04102/home/3",
            "title": "20 Dow St, Portland, ME 04102",
            "snippet": "A 2,000 sq ft home with 4 beds.",
        },
    ]}

    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_rejects_house_number_prefix_collision_and_untrusted_dot_us():
    results = {"rows": [
        {"url": "https://www.redfin.com/ME/Portland/122-Dow-St-04102/home/2",
         "title": "122 Dow St, Portland, ME 04102", "snippet": "Built in 1910 with 6 beds."},
        {"url": "https://not-a-government-record.us/22-dow-st",
         "title": "22 Dow St, Portland, ME 04102", "snippet": "Built in 1800 with 20 beds."},
    ]}
    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_deep_page_text_cannot_make_a_nearby_listing_exact():
    results = {"rows": [{
        "url": "https://www.redfin.com/ME/Portland/24-Dow-St-04102/home/3",
        "title": "24 Dow St, Portland, ME 04102",
        "snippet": "A nearby property page.",
        "markdown": "Homes nearby include 22 Dow St, Portland, ME 04102. Built in 1900 with 4 beds.",
    }]}
    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_deep_facts_are_scoped_to_entered_address_not_nearby_cards():
    results = {"rows": [{
        "url": "https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1",
        "title": "22 Dow St, Portland, ME 04102",
        "snippet": "Property overview.",
        "markdown": (
            "Nearby home: 24 Dow St, Portland, ME 04102. Built in 1900 with 4 beds. "
            "22 Dow St, Portland, ME 04102. Built in 1910 with 6 beds, 3 baths and 3,140 square feet."
        ),
    }]}
    home = discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results)
    assert home.yearBuilt == "1910"
    assert home.bedrooms == "6"
    assert home.bathrooms == "3"
    assert home.squareFeet == "3140"


def test_deep_facts_stop_before_a_following_nearby_property_card():
    results = {"rows": [{
        "url": "https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1",
        "title": "22 Dow St, Portland, ME 04102",
        "snippet": "Property overview.",
        "markdown": (
            "22 Dow St, Portland, ME 04102. Nearby home: 24 Market Sq, Portland, ME 04102. "
            "Built in 1900 with 4 beds and 2 baths. More details for 22 Dow St: built in 1910 with 6 beds."
        ),
    }]}
    home = discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results)
    assert home is None


def test_deep_fact_boundary_recognizes_numeric_street_names():
    results = {"rows": [{
        "url": "https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1",
        "title": "22 Dow St, Portland, ME 04102",
        "snippet": "Property overview.",
        "markdown": (
            "22 Dow St, Portland, ME 04102. Nearby home: 24 1st Ave, Portland, ME 04102. "
            "Built in 1900 with 4 beds and 2 baths."
        ),
    }]}
    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_square_footage_is_not_mistaken_for_a_nearby_square_address():
    results = {"rows": [{
        "url": "https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1",
        "title": "22 Dow St, Portland, ME 04102",
        "snippet": "Property overview.",
        "markdown": (
            "22 Dow St, Portland, ME 04102. This 3,140 finished square foot home in Portland, ME "
            "was built in 1910 and has 6 beds."
        ),
    }]}
    home = discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results)
    assert home.squareFeet == "3140"
    assert home.yearBuilt == "1910"
    assert home.bedrooms == "6"


def test_wayback_accepts_only_snapshots_of_trusted_publishers():
    results = {"rows": [{
        "url": "https://web.archive.org/web/20200101/https://attacker.example/22-dow-st",
        "title": "22 Dow St, Portland, ME 04102",
        "snippet": "Built in 1800 with 20 beds and 9,999 square feet.",
    }]}
    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_only_extracted_fields_receive_imported_provenance():
    home = discovery.property_from_search_results("22 Dow St, Portland, ME 04102", EXACT_RESULTS)
    assert home.provenance["yearBuilt"].origin == "imported"
    assert home.provenance["pietim"].origin == "unknown"


def test_exact_property_correction_is_available_without_search_results():
    home = discovery.property_correction_for_address("22 Dow St, Portland, ME 04102")
    assert home.homeType == "Multifamily"
    assert home.unitCount == "3"
    assert home.hvac == "Heat Pump (Electric) + Boiler"
    assert home.provenance["hvac"].origin == "imported"
    assert home.stories == ""
    assert home.occupancy == ""
    assert home.solar == "Unknown"
    assert home.pietim == "Unknown"


def test_crawl4ai_search_uses_exact_address_and_cloud_contract(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        async def aiter_bytes(self):
            yield json.dumps(EXACT_RESULTS).encode()

    class Stream:
        async def __aenter__(self):
            return Response()

        async def __aexit__(self, *args):
            return None

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def stream(self, method, url, *, headers, json):
            assert method == "POST"
            assert url == discovery.CRAWL4AI_SEARCH_URL
            assert headers["Authorization"] == "Bearer c4-test"
            assert json == {
                "q": '"22 Dow St, Portland, ME 04102" property',
                "rich": False,
                "deep": True,
            }
            return Stream()

    monkeypatch.setattr(discovery.httpx, "AsyncClient", lambda **kwargs: Client())
    result = asyncio.run(discovery.search_public_property("22 Dow St, Portland, ME 04102", "c4-test"))
    assert result == EXACT_RESULTS


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.dependency_overrides[properties.get_settings] = lambda: SimpleNamespace(crawl4ai_api_key="c4-test")
    app.include_router(properties.router)
    return TestClient(app)


def test_discovery_endpoint_queries_exact_address_and_returns_public_facts(client, monkeypatch):
    calls = []

    async def fake_search(address, key, *, archived=False):
        calls.append((address, key, archived))
        return EXACT_RESULTS

    monkeypatch.setattr(properties, "search_public_property", fake_search)
    response = client.post("/api/properties/discover", json={"address": "22 Dow St, Portland, ME 04102"})

    assert response.status_code == 200
    assert calls == [("22 Dow St, Portland, ME 04102", "c4-test", False)]
    assert response.json()["yearBuilt"] == "1910"


def test_discovery_endpoint_is_optional_when_crawl4ai_is_not_configured(client, monkeypatch):
    client.app.dependency_overrides[properties.get_settings] = lambda: SimpleNamespace(crawl4ai_api_key="")
    response = client.post("/api/properties/discover", json={"address": "24 Dow St, Portland, ME 04102"})
    assert response.status_code == 503


def test_admin_verified_correction_remains_available_without_crawl4ai(client):
    client.app.dependency_overrides[properties.get_settings] = lambda: SimpleNamespace(crawl4ai_api_key="")
    response = client.post("/api/properties/discover", json={"address": "22 Dow St, Portland, ME 04102"})
    assert response.status_code == 200
    assert response.json()["unitCount"] == "3"
    assert response.json()["hvac"] == "Heat Pump (Electric) + Boiler"


def test_discovery_provider_calls_are_rate_limited(client, monkeypatch):
    async def fake_search(*args):
        return EXACT_RESULTS

    monkeypatch.setattr(properties, "search_public_property", fake_search)
    for _ in range(30):
        assert client.post("/api/properties/discover", json={"address": "22 Dow St, Portland, ME 04102"}).status_code == 200
    response = client.post("/api/properties/discover", json={"address": "22 Dow St, Portland, ME 04102"})
    assert response.status_code == 429
    assert response.headers["retry-after"]


def test_discovery_uses_wayback_only_after_current_sources_have_no_facts(client, monkeypatch):
    calls = []
    archived_results = {"rows": [{
        "url": "https://web.archive.org/web/20200101/https://www.realtor.com/realestateandhomes-detail/22-Dow-St_Portland_ME_04102",
        "title": "22 Dow St, Portland, ME 04102",
        "snippet": "Archived property page: 3,140 square feet, 6 beds, 3 baths, built in 1910.",
    }]}

    async def fake_search(address, key, *, archived=False):
        calls.append(archived)
        return archived_results if archived else {"rows": []}

    monkeypatch.setattr(properties, "search_public_property", fake_search)
    response = client.post("/api/properties/discover", json={"address": "22 Dow St, Portland, ME 04102"})
    assert response.status_code == 200
    assert calls == [False, True]
    assert response.json()["provenance"]["yearBuilt"]["source"] == "Public listing metadata: Internet Archive snapshot · Realtor.com"
