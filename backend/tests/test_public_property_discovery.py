from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.integrations import public_property_discovery as discovery
from app.routers import properties


EXACT_RESULTS = {
    "web": [
        {
            "url": "https://www.zillow.com/homedetails/22-Dow-St-Portland-ME-04102/1_zpid/",
            "title": "22 Dow St, Portland, ME 04102 | Zillow",
            "description": "This 3,140 square foot multi family home has 6 bedrooms and 3 bathrooms. Built in 1910.",
        },
        {
            "url": "https://www.redfin.com/ME/Portland/22-Dow-St-04102/home/1",
            "title": "22 Dow St, Portland, ME 04102 | Redfin",
            "description": "22 Dow St is a 3,140 sq. ft. multi-family home with 6 beds and 3 baths.",
        },
        {
            "url": "https://www.realtor.com/realestateandhomes-detail/24-Dow-St_Portland_ME_04102",
            "title": "24 Dow St, Portland, ME 04102",
            "description": "Nearby home built in 1900 with 4 beds.",
        },
        {
            "url": "https://parcelsfolder.portlandmaine.gov/property/22-dow-st",
            "title": "22 Dow St, Portland, ME 04102 - Property record",
            "description": "Municipal parcel record: year built 1910.",
        },
    ]
}


def test_extracts_only_exact_address_facts_with_field_provenance():
    home = discovery.property_from_search_results("22 Dow St, Portland, ME 04102", EXACT_RESULTS)

    assert home.squareFeet == "3140"
    assert home.yearBuilt == "1910"
    assert home.bedrooms == "6"
    assert home.bathrooms == "3"
    assert home.homeType == "Multi-Family"
    assert home.provenance["squareFeet"].origin == "imported"
    assert "Zillow" in home.provenance["squareFeet"].source
    assert "Redfin" in home.provenance["squareFeet"].source
    assert "Municipal public record" in home.provenance["yearBuilt"].source
    assert "24 Dow" not in home.sourceNote


def test_rejects_unit_and_non_exact_results_for_whole_building_address():
    results = {"web": [
        {
            "url": "https://www.zillow.com/homedetails/22-Dow-St-APT-3-Portland-ME-04102/2_zpid/",
            "title": "22 Dow St Apt 3, Portland, ME 04102",
            "description": "An 1,100 square foot apartment with 2 beds and 1 bath.",
        },
        {
            "url": "https://www.redfin.com/ME/Portland/20-Dow-St-04102/home/3",
            "title": "20 Dow St, Portland, ME 04102",
            "description": "A 2,000 sq ft home with 4 beds.",
        },
    ]}

    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_rejects_house_number_prefix_collision_and_untrusted_dot_us():
    results = {"web": [
        {"url": "https://www.redfin.com/ME/Portland/122-Dow-St-04102/home/2",
         "title": "122 Dow St, Portland, ME 04102", "description": "Built in 1910 with 6 beds."},
        {"url": "https://not-a-government-record.us/22-dow-st",
         "title": "22 Dow St, Portland, ME 04102", "description": "Built in 1800 with 20 beds."},
    ]}
    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_wayback_accepts_only_snapshots_of_trusted_publishers():
    results = {"web": [{
        "url": "https://web.archive.org/web/20200101/https://attacker.example/22-dow-st",
        "title": "22 Dow St, Portland, ME 04102",
        "description": "Built in 1800 with 20 beds and 9,999 square feet.",
    }]}
    assert discovery.property_from_search_results("22 Dow St, Portland, ME 04102", results) is None


def test_only_extracted_fields_receive_imported_provenance():
    home = discovery.property_from_search_results("22 Dow St, Portland, ME 04102", EXACT_RESULTS)
    assert home.provenance["yearBuilt"].origin == "imported"
    assert home.provenance["pietim"].origin == "unknown"


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.dependency_overrides[properties.get_settings] = lambda: SimpleNamespace(firecrawl_api_key="fc-test")
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
    assert calls == [("22 Dow St, Portland, ME 04102", "fc-test", False)]
    assert response.json()["yearBuilt"] == "1910"


def test_discovery_endpoint_is_optional_when_firecrawl_is_not_configured(client, monkeypatch):
    client.app.dependency_overrides[properties.get_settings] = lambda: SimpleNamespace(firecrawl_api_key="")
    response = client.post("/api/properties/discover", json={"address": "22 Dow St, Portland, ME 04102"})
    assert response.status_code == 503


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
    archived_results = {"web": [{
        "url": "https://web.archive.org/web/20200101/https://www.realtor.com/realestateandhomes-detail/22-Dow-St_Portland_ME_04102",
        "title": "22 Dow St, Portland, ME 04102",
        "description": "Archived property page: 3,140 square feet, 6 beds, 3 baths, built in 1910.",
    }]}

    async def fake_search(address, key, *, archived=False):
        calls.append(archived)
        return archived_results if archived else {"web": []}

    monkeypatch.setattr(properties, "search_public_property", fake_search)
    response = client.post("/api/properties/discover", json={"address": "22 Dow St, Portland, ME 04102"})
    assert response.status_code == 200
    assert calls == [False, True]
    assert response.json()["provenance"]["yearBuilt"]["source"] == "Public listing metadata: Internet Archive snapshot · Realtor.com"
