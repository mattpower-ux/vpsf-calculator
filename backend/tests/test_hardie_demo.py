from app.schemas import PropertyInput
from app.scoring.seed import seed_model_v1
from app.scoring.catalog import evaluate_model
from app.advice.context import build_home_context, needs
from app.advice.takeaways import build_takeaways
from app.advice.products import match_products
from app.demo_hardie import hardie_demo_home


def test_demo_resilience_is_computed_not_overridden():
    home = hardie_demo_home()
    assert home.siding == "Wood clapboard"
    assert home.roof == "Asphalt shingles"
    assert home.roofAge == "20 years"
    assert home.provenance["roofAge"].origin == "demo-assumption"
    assert "surrounding idyllwild-pine cove community" in home.sourceNote.lower()
    assert home.address == "53017 Double View Lane"
    assert all(p.origin == "demo-assumption" for p in home.provenance.values())
    assert evaluate_model(home, seed_model_v1())["resilience"] == 20


def test_siding_need_uses_exposure_and_material_not_demo_id():
    h = hardie_demo_home()
    c = build_home_context(h, {}, {}, {})
    assert "fire-resistant-siding" in needs(c)
    assert build_takeaways(c)[3]["action"]["destination"] == "products"
    p = dict(id="hardie",needTags=["fire-resistant-siding"],requirements=["siding-assembly"],reviewedAt="2026-11-13")
    assert match_products(c,[p])
    for updates in [{"siding":"Fiber cement"},{"siding":"Unknown"},{"wildfire":None},{"latitude":0}]:
        changed=PropertyInput.model_validate({**h.model_dump(),**updates})
        assert "fire-resistant-siding" not in needs(build_home_context(changed,{}, {}, {}))


def test_full_api_flow_recommends_hardie_without_saving_fictional_home():
    from fastapi.testclient import TestClient
    from sqlalchemy import select, func
    from app.main import app
    from app.db import init_db, SessionLocal
    from app.models import PropertyRecord, ScoreRunRecord, PropertyQueryRecord, LeadRecord

    init_db()
    client = TestClient(app)
    def counts():
        with SessionLocal() as db:
            return [db.scalar(select(func.count()).select_from(m)) for m in
                    (PropertyRecord, ScoreRunRecord, PropertyQueryRecord, LeadRecord)]
    before = counts()
    profile = client.get("/api/demos/hardie-wildfire")
    assert profile.status_code == 200
    home = profile.json()["home"]
    score = client.post("/api/demos/hardie-wildfire/score", json=home)
    assert score.status_code == 200, score.text
    body = score.json()
    assert body["scores"]["resilience"] == 20
    assert body["propertyId"] is None and body["scoreRunId"] is None
    advice = client.post("/api/products/advice", json={"home":home,"modelVersion":body["modelVersion"]})
    assert advice.status_code == 200, advice.text
    advice = advice.json()
    assert advice["matches"][0]["productId"] == "james-hardie-plank"
    assert advice["advisoryRecommendations"][0]["id"] == "resilience-siding"
    assert advice["advisoryRecommendations"][0]["gainPoints"] is None
    catalog = client.get("/api/products/recommendations").json()
    hardie = next(p for p in catalog if p["id"] == "james-hardie-plank")
    assert hardie["isSponsored"] and hardie["sponsorName"] == "James Hardie"
    assert hardie["sourceUrl"].startswith("https://www.jameshardie.com/")
    alternate = client.post("/api/products/advice",json={"home":{**home,"siding":"Fiber cement"}}).json()
    assert not any(m["productId"] == "james-hardie-plank" for m in alternate["matches"])
    assert counts() == before


def test_preview_uses_published_epa_rules_and_returns_evidence(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.routers import demos, scoring
    from app.schemas import WalkabilityEvidence

    model = seed_model_v1()
    for factor in model.factors:
        if factor.mode == "epa_range":
            factor.active = True
    evidence = WalkabilityEvidence(status="available", value=12, blockGroup="test-block", latitude=33.729507, longitude=-116.736539)
    calls = []
    async def lookup(db, latitude, longitude):
        calls.append((latitude, longitude))
        return evidence
    monkeypatch.setattr(demos, "load_published", lambda db: model)
    monkeypatch.setattr(scoring, "cached_walkability", lookup)
    client = TestClient(app)
    home = hardie_demo_home().model_dump(mode="json")
    response = client.post("/api/demos/hardie-wildfire/score", json=home)
    assert response.status_code == 200, response.text
    assert response.json()["walkability"]["value"] == 12
    assert len(calls) == 1
    for factor in model.factors:
        if factor.mode == "epa_range":
            factor.active = False
    home["epaWalkability"] = evidence.model_dump(mode="json")
    response = client.post("/api/demos/hardie-wildfire/score", json=home)
    assert response.status_code == 200
    assert response.json()["walkability"] is None
    assert len(calls) == 1
