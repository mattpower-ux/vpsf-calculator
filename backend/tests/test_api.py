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
