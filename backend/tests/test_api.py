from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app

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
