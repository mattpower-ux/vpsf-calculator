import os
from uuid import uuid4
from fastapi.testclient import TestClient
from app.db import init_db
from app.main import app

init_db()
client = TestClient(app)

def auth():
    os.environ["ADMIN_PASSWORD"] = "advice-test-password"
    token = client.post("/api/admin/session", json={"password": "advice-test-password"}).json()["token"]
    return {"Authorization": "Bearer " + token}

def test_advice_recomputes_and_keeps_catalog_compatible():
    r = client.post("/api/products/advice", json={"home": {"hvac": "Heat Pump (Electric)"}})
    assert r.status_code == 200, r.text
    b = r.json()
    assert len(b["takeaways"]) == 4
    assert b["modelVersion"]
    assert all("isSponsored" in p for p in client.get("/api/products/recommendations").json())

def test_metadata_is_authenticated_and_validated():
    products = client.get("/api/products/recommendations").json()
    url = "/api/admin/products/" + products[0]["id"] + "/metadata"
    assert client.put(url, json={}).status_code == 401
    h = auth()
    assert client.put(url, headers=h, json={"revision": 0, "data": {"needTags": ["execute_script"]}}).status_code == 422

def test_tip_lifecycle_revision_and_publication():
    h = auth()
    data = dict(id="test-"+uuid4().hex, pillar="water", text="Check accessible plumbing connections regularly. Early attention to visible leaks can prevent wasted water and help limit moisture damage; arrange repairs when a connection is wet or shows signs of deterioration.", image="water", alt="Water illustration", source="https://www.epa.gov/watersense/fix-leak-week", sourceLabel="EPA WaterSense", reviewedAt="2026-11-09", imageCredit="VPSF original illustration", climateTags=[], order=0)
    url = "/api/admin/eco-tips/" + data["id"]
    assert client.put(url, json={"revision": 0, "data": data}).status_code == 401
    r = client.put(url, headers=h, json={"revision": 0, "data": data})
    assert r.status_code == 200, r.text
    assert data["id"] not in [t["id"] for t in client.get("/api/eco-tips").json()["tips"]]
    assert client.put(url, headers=h, json={"revision": 0, "data": data}).status_code == 409
    r = client.post(url+"/publish", headers=h, json={"revision": 1})
    assert r.status_code == 200, r.text
    assert data["id"] in [t["id"] for t in client.get("/api/eco-tips").json()["tips"]]
    data["text"] = "Draft must not leak"
    assert client.put(url, headers=h, json={"revision": 2, "data": data}).status_code == 200
    assert "Draft must not leak" not in str(client.get("/api/eco-tips").json())
    assert client.post(url+"/publish", headers=h, json={"revision": 3}).status_code == 422
    assert client.post(url+"/retire", headers=h, json={"revision": 3}).status_code == 200
    assert data["id"] not in [t["id"] for t in client.get("/api/eco-tips").json()["tips"]]
    assert client.post(url+"/restore", headers=h, json={"revision": 4, "version": 1}).status_code == 200
    assert data["id"] in [t["id"] for t in client.get("/api/eco-tips").json()["tips"]]

def test_tip_seed_count_and_safety():
    from app.eco_tips import seed_data
    assert len(seed_data()) == 28
    from collections import Counter
    assert set(Counter(t["pillar"] for t in seed_data()).values()) == {4}
    from app.advice.schemas import TipData
    import pytest
    with pytest.raises(ValueError):
        TipData(**{**seed_data()[0], "source": "javascript:alert(1)"})
