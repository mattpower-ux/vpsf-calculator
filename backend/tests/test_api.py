from fastapi.testclient import TestClient
from uuid import uuid4

from app.db import init_db
from app.main import app
from app.routers.properties import apply_attom_permit_facts, permit_records_from_attom, property_input_from_attom
from app.schemas import PropertyInput

init_db()
client = TestClient(app)


def test_health_includes_model_version():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["modelVersion"] == "vpsf-0.1.0"


def test_score_endpoint_returns_persisted_score_run():
    response = client.post(
        "/api/score",
        json={
            "address": "1313 Cognition Drive",
            "zip": "32101",
            "hers": "21-30",
            "solar": "5.2 kW Solar PV + Battery",
            "hvac": "Heat Pump (Electric)",
            "evReady": "EV Charger Installed",
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert body["total"] > 0
    assert body["modelVersion"] == "vpsf-0.1.0"
    assert body["propertyId"]
    assert body["scoreRunId"]
    assert "energy" in body["explanations"]


def test_products_and_leads_endpoints():
    products_response = client.get("/api/products/recommendations")
    assert products_response.status_code == 200
    assert len(products_response.json()) >= 4

    lead_response = client.post(
        "/api/leads",
        json={
            "name": "Demo User",
            "email": "demo@example.com",
            "productId": products_response.json()[0]["id"],
            "propertyAddress": "1313 Cognition Drive",
            "zip": "32101",
        },
    )
    assert lead_response.status_code == 200
    assert lead_response.json()["status"] == "accepted"


def test_geocode_requires_mapbox_key():
    response = client.post("/api/properties/geocode", json={"address": "1313 Cognition Drive, Orlando, FL"})

    assert response.status_code == 503
    assert "MAPBOX_ACCESS_TOKEN" in response.json()["detail"]


def test_rentcast_requires_api_key():
    response = client.post("/api/properties/rentcast", json={"address": "5500 Grand Lake Dr, San Antonio, TX 78244"})

    assert response.status_code == 503
    assert "RENTCAST_API_KEY" in response.json()["detail"]


def test_attom_requires_api_key():
    response = client.post("/api/properties/attom", json={"address": "5500 Grand Lake Dr, San Antonio, TX 78244"})

    assert response.status_code == 503
    assert "ATTOM_API_KEY" in response.json()["detail"]


def test_risk_endpoint_estimates_climate_without_coordinates():
    response = client.post("/api/properties/risk", json={"state": "FL", "zip": "32101"})

    assert response.status_code == 200
    body = response.json()
    assert body["climateZone"] == "2A - Hot Humid"
    assert body["flood"] == "Unknown"


def test_tracking_records_score_and_lead_for_admin_table():
    query_response = client.post(
        "/api/tracking/property-query",
        json={
            "sessionId": "test-session-admin-row",
            "address": "310 Gray Rd",
            "city": "Falmouth",
            "state": "ME",
            "zip": "04105",
            "source": "rentcast",
            "snapshot": {"address": "310 Gray Rd"},
        },
    )

    assert query_response.status_code == 200
    query_id = query_response.json()["id"]

    progress_response = client.post(
        "/api/tracking/progress",
        json={
            "sessionId": "test-session-admin-row",
            "queryId": query_id,
            "screen": 4,
            "screenLabel": "Score Dashboard",
            "snapshot": {"address": "310 Gray Rd"},
            "vpsfScore": 512,
            "scoreLabel": "Needs Upgrade",
            "scoreRunId": 22,
            "leadName": "Demo Buyer",
            "leadEmail": "demo@example.com",
            "leadProductId": "moen-eco-showerhead",
            "leadAction": "Requested specs and pricing",
        },
    )

    assert progress_response.status_code == 200

    unauthorized_admin = client.get("/api/admin/property-queries")
    assert unauthorized_admin.status_code == 401

    admin_response = client.get("/api/admin/property-queries", headers={"X-Admin-Passcode": "2027"})
    assert admin_response.status_code == 200
    row = next(item for item in admin_response.json() if item["id"] == query_id)
    assert row["vpsfScore"] == 512
    assert row["scoreLabel"] == "Needs Upgrade"
    assert row["leadName"] == "Demo Buyer"
    assert row["leadEmail"] == "demo@example.com"


def test_tracking_archives_added_property_details():
    query_response = client.post(
        "/api/tracking/property-query",
        json={
            "sessionId": "test-session-detail-archive",
            "address": "22 Dow St",
            "city": "Portland",
            "state": "ME",
            "zip": "04102",
            "source": "manual_entry",
            "snapshot": {"address": "22 Dow St", "hvac": "Unknown"},
        },
    )
    assert query_response.status_code == 200
    query_id = query_response.json()["id"]

    progress_response = client.post(
        "/api/tracking/progress",
        json={
            "sessionId": "test-session-detail-archive",
            "queryId": query_id,
            "screen": 2,
            "screenLabel": "Home Specs",
            "snapshot": {"address": "22 Dow St", "hvac": "FORCED AIR WITH AIR CONDITIONING"},
            "detailChanges": [
                {
                    "field": "hvac",
                    "previousValue": "Unknown",
                    "newValue": "FORCED AIR WITH AIR CONDITIONING",
                }
            ],
        },
    )
    assert progress_response.status_code == 200

    archive_response = client.get("/api/admin/property-detail-archive", headers={"X-Admin-Passcode": "2027"})
    assert archive_response.status_code == 200
    archive_row = next(item for item in archive_response.json() if item["queryId"] == query_id)
    assert archive_row["field"] == "hvac"
    assert archive_row["previousValue"] == "Unknown"
    assert archive_row["newValue"] == "FORCED AIR WITH AIR CONDITIONING"


def test_tracking_reuses_saved_scan_with_flexible_address_syntax():
    first_response = client.post(
        "/api/tracking/property-query",
        json={
            "sessionId": "test-session-address-normalization-a",
            "address": "44 Harbor View Street",
            "city": "Portland",
            "state": "Maine",
            "zip": "04102",
            "source": "manual_entry",
            "snapshot": {"address": "44 Harbor View Street", "hvac": "Heat Pump"},
        },
    )
    assert first_response.status_code == 200
    first_id = first_response.json()["id"]

    second_response = client.post(
        "/api/tracking/property-query",
        json={
            "sessionId": "test-session-address-normalization-b",
            "address": "44 Harbor View St.",
            "city": "Portland",
            "state": "ME",
            "zip": "04102-1234",
            "source": "address_scan",
            "snapshot": {"address": "44 Harbor View St.", "roof": "Metal"},
        },
    )
    assert second_response.status_code == 200
    second_body = second_response.json()
    assert second_body["id"] == first_id
    assert second_body["latestSnapshot"]["hvac"] == "Heat Pump"
    assert second_body["latestSnapshot"]["roof"] == "Metal"

    saved_response = client.get("/api/tracking/saved-property", params={"address": "44 Harbor View St"})
    assert saved_response.status_code == 200
    saved_body = saved_response.json()
    assert saved_body["found"] is True
    assert saved_body["property"]["id"] == first_id
    assert saved_body["property"]["state"] == "Maine"


def test_education_content_is_cached_and_admin_updatable():
    key = f"test-education-cache-{uuid4().hex}"
    payload = {
        "title": "Heat Pump Water Heating",
        "intro": "DeepThink draft about water heating.",
        "background": "Water heating is a major energy load, so the system type and controls shape both operating cost and electrification value.",
        "howItWorks": ["Heat pump water heaters move heat from nearby air into stored water.", "Controls can shift operation away from peak hours."],
        "sustainableAspects": ["Lower electric demand than resistance heating.", "Pairs well with solar and clean-grid electricity."],
        "why": ["Cuts water-heating energy.", "Supports electrification."],
        "verify": ["UEF rating", "Install year"],
        "vpsf": "Improves operating-cost confidence.",
        "source": "deepthink",
        "sourceUrl": "https://www.greenbuildermedia.com",
    }

    missing_response = client.get(f"/api/products/education/{key}")
    assert missing_response.status_code == 404

    cache_response = client.post(f"/api/products/education/{key}/cache", json=payload)
    assert cache_response.status_code == 200
    assert cache_response.json()["title"] == "Heat Pump Water Heating"

    get_response = client.get(f"/api/products/education/{key}")
    assert get_response.status_code == 200
    assert get_response.json()["why"] == payload["why"]
    assert get_response.json()["background"] == payload["background"]
    assert get_response.json()["howItWorks"] == payload["howItWorks"]
    assert get_response.json()["sustainableAspects"] == payload["sustainableAspects"]

    ignored_overwrite = client.post(
        f"/api/products/education/{key}/cache",
        json={**payload, "title": "Should Not Replace"},
    )
    assert ignored_overwrite.status_code == 200
    assert ignored_overwrite.json()["title"] == "Heat Pump Water Heating"

    admin_update = client.put(
        f"/api/admin/education/{key}",
        headers={"X-Admin-Passcode": "2027"},
        json={**payload, "title": "DeepThink Final Page"},
    )
    assert admin_update.status_code == 200
    assert admin_update.json()["title"] == "DeepThink Final Page"

    admin_list = client.get("/api/admin/education", headers={"X-Admin-Passcode": "2027"})
    assert admin_list.status_code == 200
    assert any(item["key"] == key for item in admin_list.json())


def test_attom_parser_reads_public_record_shapes_and_permits():
    property_input = property_input_from_attom(
        {
            "address": {"line1": "1313 MARGO LN", "locality": "LAKE CITY", "countrySubd": "CO", "postal1": "81235"},
            "summary": {"propType": "SFR", "yearBuilt": "1990"},
            "building": {
                "size": {"universalSize": "3000"},
                "rooms": {"beds": "3", "bathsTotal": "2.5"},
                "summary": {"levels": "2"},
                "parking": {"prkgSpaces": "2"},
            },
            "lot": {"lotSize1": "53.11"},
        }
    )

    assert property_input.squareFeet == "3000"
    assert property_input.yearBuilt == "1990"
    assert property_input.homeType == "SFR"
    assert property_input.stories == "2"
    assert property_input.bedrooms == "3"
    assert property_input.bathrooms == "2.5"
    assert property_input.garage == "2 Car Garage"

    permits = permit_records_from_attom(
        {
            "property": [
                {
                    "buildingPermits": {
                        "permits": [
                            {"description": "Replace roof shingles", "issueDate": "2020-03-15"},
                            {"workDescription": "Install heat pump HVAC", "permitDate": "2022-06-01"},
                            {"permitDescription": "Solar battery storage", "completedDate": "2023-01-12"},
                        ]
                    }
                }
            ]
        }
    )
    enriched = apply_attom_permit_facts(PropertyInput(), permits)

    assert enriched.roof == "Permit found - roof work"
    assert enriched.roofAge == "Permit year 2020"
    assert enriched.hvac == "Permit found - HVAC/mechanical work"
    assert enriched.hvacAge == "Permit year 2022"
    assert enriched.solar == "Permit found - solar/battery work"
    assert enriched.backup == "Permit found - battery/storage work"
