import asyncio

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base, get_db
from app.integrations import wildfire
from app.models import PropertyQueryRecord, ScoreRunRecord, WildfireRiskCacheRecord
from app.routers import properties, scoring, tracking
from app.schemas import PropertyInput, WildfireRisk
from app.scoring import explain_score, score_home
from app.scoring.wildfire import wildfire_adjustment, wildfire_explanation


def risk_fixture(percentile=95, **overrides):
    return WildfireRisk(
        **{
            "status": "available", "level": wildfire.risk_level(percentile),
            "nationalPercentile": percentile, "areaType": "community", "areaId": "0655520",
            "areaName": "Test community, CA", "boundaryVintage": "2023",
            "latitude": 39.7596, "longitude": -121.6219,
            "retrievedAt": "2026-09-25T12:00:00+00:00", **overrides,
        }
    )


def home_fixture(risk=None):
    return PropertyInput(
        address="10 Test St", city="Test", state="CA", zip="95969",
        latitude=39.7596, longitude=-121.6219, wildfire=risk,
    )


def mock_usfs(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(wildfire.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


@pytest.mark.parametrize("value,expected", [
    ("0.00%", 0), ("80.30%", 80.3), (" 100% ", 100),
    ("", None), (None, None), ("NaN%", None), ("101%", None),
    ("-1%", None), ("0.4", None), (40, None),
])
def test_parse_published_percentile_format(value, expected):
    assert wildfire.national_percentile(value) == expected


@pytest.mark.parametrize("percentile,level,delta", [
    (0, "Low", 10), (39.99, "Low", 10), (40, "Medium", 0), (69.99, "Medium", 0),
    (70, "High", -10), (89.99, "High", -10), (90, "Very High", -20), (100, "Very High", -20),
])
def test_official_bands_adjust_only_resilience(percentile, level, delta):
    home = home_fixture(risk_fixture(percentile))
    before = score_home(home_fixture())
    after = score_home(home)
    assert wildfire.risk_level(percentile) == level
    assert wildfire_adjustment(home) == delta
    assert after["resilience"] == before["resilience"] + delta
    assert {k: v for k, v in after.items() if k != "resilience"} == {k: v for k, v in before.items() if k != "resilience"}
    explanation = explain_score(home, after)["resilience"]
    assert f"{delta:+d} Resilience points" in explanation
    assert "not a home fire-resistance assessment" in explanation


@pytest.mark.parametrize("overrides", [
    {"status": "unavailable"}, {"status": "no_data"}, {"status": "no_coordinates"},
    {"nationalPercentile": None}, {"source": "unverified"}, {"latitude": 40},
    {"longitude": None}, {"datasetVersion": "old"}, {"areaType": None},
])
def test_missing_stale_or_mismatched_risk_is_neutral(overrides):
    home = home_fixture(risk_fixture(20, **overrides))
    assert wildfire_adjustment(home) == 0
    assert score_home(home) == score_home(home_fixture())
    assert "no wildfire score adjustment" in wildfire_explanation(home)


def test_coordinate_change_and_clamp_preserve_home_hardening_points():
    home = home_fixture(risk_fixture(95))
    base = score_home(home)["resilience"]
    home.fortified = "Wildfire Prepared Home"
    assert score_home(home)["resilience"] == base + 60
    home.latitude = None
    assert wildfire_adjustment(home) == 0
    home = home_fixture(risk_fixture(0))
    home.fortified = "FORTIFIED Gold"
    home.roof = "Metal"
    home.flood = "Elevated"
    home.moisture = "Enhanced"
    home.backup = "Battery"
    assert score_home(home)["resilience"] == 200


def test_client_queries_lon_lat_and_uses_community(monkeypatch):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(200, json={"features": [{"attributes": {
            "NAMELSAD": "Paradise town", "STUSPS": "CA", "GEOID": "0655520",
            "RISK_NATIO": "80.30%", "vintage": "2023", "exclude": 0,
        }}]})

    mock_usfs(monkeypatch, handle)
    result = asyncio.run(wildfire.UsfsWildfireClient().risk_for_point(39.7596, -121.6219))
    assert result.status == "available" and result.level == "High"
    assert result.areaName == "Paradise town, CA" and result.areaType == "community"
    assert result.nationalPercentile == 80.3 and result.boundaryVintage == "2023"
    assert len(calls) == 1
    assert calls[0].url.params["geometry"] == "-121.6219,39.7596"
    assert calls[0].url.params["inSR"] == "4326"


@pytest.mark.parametrize("community_payload", [
    {"features": []},
    {"features": [{"attributes": {"exclude": 1, "RISK_NATIO": "25%"}}]},
    {"features": [{"attributes": {"exclude": 0, "RISK_NATIO": ""}}]},
    {"error": {"code": 500}},
])
def test_county_fallback_including_arcgis_http_200_errors(monkeypatch, community_payload):
    def handle(request):
        if "place_boundaries" in str(request.url):
            return httpx.Response(200, json=community_payload)
        assert "exclude" not in request.url.params["outFields"]
        return httpx.Response(200, json={"features": [{"attributes": {
            "NAMELSAD": "Test County", "STUSPS": "CA", "GEOID": "06007", "RISK_NATIO": "95.00%",
        }}]})

    mock_usfs(monkeypatch, handle)
    result = asyncio.run(wildfire.UsfsWildfireClient().risk_for_point(39.7596, -121.6219))
    assert result.areaType == "county" and result.level == "Very High"


@pytest.mark.parametrize("mode,status", [("empty", "no_data"), ("error", "unavailable"), ("timeout", "unavailable"), ("invalid", "unavailable")])
def test_service_failures_never_become_low_risk(monkeypatch, mode, status):
    def handle(request):
        if mode == "timeout":
            raise httpx.ReadTimeout("offline", request=request)
        if mode == "invalid":
            return httpx.Response(200, text="invalid json")
        return httpx.Response(200, json={"features": []} if mode == "empty" else {"error": {"code": 500}})

    mock_usfs(monkeypatch, handle)
    result = asyncio.run(wildfire.UsfsWildfireClient().risk_for_point(0, 0))
    assert result.status == status and result.level == "Unknown" and result.nationalPercentile is None


@pytest.fixture
def risk_api(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'risk.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    application = FastAPI()
    for router in (properties.router, scoring.router, tracking.router):
        application.include_router(router)

    def db_session():
        with Session(engine) as db:
            yield db

    application.dependency_overrides[get_db] = db_session
    with TestClient(application) as client:
        yield client, engine
    engine.dispose()


def test_disk_cache_archive_and_score_snapshots_survive_new_sessions(risk_api, monkeypatch):
    client, engine = risk_api
    calls = []

    async def usfs(self, latitude, longitude):
        calls.append((latitude, longitude))
        return risk_fixture()

    async def fema(self, latitude, longitude):
        raise httpx.ConnectError("FEMA offline")

    monkeypatch.setattr(wildfire.UsfsWildfireClient, "risk_for_point", usfs)
    monkeypatch.setattr(properties.FemaFloodClient, "flood_zone_for_point", fema)
    coords = {"latitude": 39.7596, "longitude": -121.6219, "state": "CA"}
    first = client.post("/api/properties/risk", json=coords)
    assert first.status_code == 200
    assert first.json()["wildfire"]["level"] == "Very High"
    assert first.json()["flood"] == "FEMA lookup unavailable"

    async def offline(*args):
        raise AssertionError("A cached lookup must not call USFS")

    monkeypatch.setattr(wildfire.UsfsWildfireClient, "risk_for_point", offline)
    engine.dispose()
    second = client.post("/api/properties/risk", json=coords)
    assert second.json()["wildfire"] == first.json()["wildfire"]
    assert len(calls) == 1
    home = home_fixture(WildfireRisk.model_validate(second.json()["wildfire"]))
    scored = client.post("/api/score", json=home.model_dump(mode="json"))
    assert scored.status_code == 200
    assert scored.json()["scores"]["resilience"] == 20
    with Session(engine) as db:
        stored = db.get(ScoreRunRecord, scored.json()["scoreRunId"])
        assert stored.input_snapshot["wildfire"]["retrievedAt"]
        assert stored.model_version == "vpsf-0.2.0-usfs"
        assert len(db.scalars(select(WildfireRiskCacheRecord)).all()) == 1
    payload = dict(sessionId="usfs-test", address=home.address, city=home.city, state=home.state, zip=home.zip,
                   snapshot=home.model_dump(mode="json"), source="saved_archive")
    saved = client.post("/api/tracking/property-query", json=payload)
    assert saved.status_code == 200
    with Session(engine) as db:
        archive = db.get(PropertyQueryRecord, saved.json()["id"])
        assert archive.latest_snapshot["wildfire"] == second.json()["wildfire"]
    restored = client.get("/api/tracking/saved-property", params={"address": "10 Test Street", "city": "Test", "state": "California", "zip": "95969"})
    assert restored.json()["found"]
    assert restored.json()["property"]["latestSnapshot"]["wildfire"] == second.json()["wildfire"]


def test_usfs_failure_is_retryable_and_does_not_break_fema(risk_api, monkeypatch):
    client, engine = risk_api

    async def usfs(*args):
        return WildfireRisk(status="unavailable")

    async def fema(*args):
        return {"FLD_ZONE": "X", "SFHA_TF": "F"}

    monkeypatch.setattr(wildfire.UsfsWildfireClient, "risk_for_point", usfs)
    monkeypatch.setattr(properties.FemaFloodClient, "flood_zone_for_point", fema)
    body = client.post("/api/properties/risk", json={"latitude": 28.5, "longitude": -81.3}).json()
    assert body["wildfire"]["status"] == "unavailable"
    assert body["fema"]["FLD_ZONE"] == "X"
    with Session(engine) as db:
        assert not db.scalars(select(WildfireRiskCacheRecord)).all()


def test_no_data_result_is_cached_but_never_scored(risk_api, monkeypatch):
    _, engine = risk_api
    calls = []

    async def no_data(self, latitude, longitude):
        calls.append((latitude, longitude))
        return WildfireRisk(status="no_data", latitude=latitude, longitude=longitude)

    monkeypatch.setattr(wildfire.UsfsWildfireClient, "risk_for_point", no_data)
    for _ in range(2):
        with Session(engine) as db:
            result = asyncio.run(wildfire.cached_wildfire_risk(db, 0, 0))
            assert result.status == "no_data"
            assert wildfire_adjustment(home_fixture(result)) == 0
    assert len(calls) == 1


def test_missing_and_invalid_coordinates_do_not_query_usfs(risk_api, monkeypatch):
    client, _ = risk_api

    async def unexpected(*args):
        raise AssertionError("Must not query without coordinates")

    monkeypatch.setattr(wildfire.UsfsWildfireClient, "risk_for_point", unexpected)
    for coords in ({}, {"latitude": 20}):
        response = client.post("/api/properties/risk", json=coords)
        assert response.status_code == 200
        assert response.json()["wildfire"]["status"] == "no_coordinates"
    for coords in ({"latitude": 91}, {"longitude": -181}, {"latitude": "NaN"}):
        assert client.post("/api/properties/risk", json=coords).status_code == 422
