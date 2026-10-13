import asyncio

import httpx

from app.integrations.epa_walkability import fetch_walkability
from app.schemas import PropertyInput, WalkabilityEvidence
from app.scoring.catalog import evaluate_model
from app.scoring.seed import seed_model_v1


def test_epa_point_query_records_sourced_block_group():
    def respond(request):
        assert request.url.params["geometryType"] == "esriGeometryPoint"
        assert request.url.params["spatialRel"] == "esriSpatialRelIntersects"
        return httpx.Response(200, json={"features": [{"attributes": {"NatWalkInd": 13.5, "GEOID20": "230190001001"}}]})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await fetch_walkability(44.8012, -68.7712, client)
    result = asyncio.run(run())
    assert result.status == "available"
    assert result.value == 13.5
    assert result.blockGroup == "230190001001"


def test_epa_missing_or_malformed_response_is_unverified():
    async def run(payload):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))) as client:
            return await fetch_walkability(44.8012, -68.7712, client)
    assert asyncio.run(run({"features": []})).status == "unverified"
    assert asyncio.run(run({"features": [{"attributes": {"NatWalkInd": 12}}]})).status == "unverified"


def test_verified_index_is_location_bound_and_unverified_never_scores():
    model = seed_model_v1()
    model.factors = [factor for factor in model.factors if factor.id != "walkscore_legacy"]
    for factor in model.factors:
        if factor.mode == "epa_range":
            factor.active = True
    evidence = WalkabilityEvidence(status="available", value=13.5, blockGroup="230190001001", latitude=44.8012, longitude=-68.7712)
    home = PropertyInput(latitude=44.8012, longitude=-68.7712, epaWalkability=evidence)
    assert evaluate_model(home, model)["community"] == 10
    home.longitude = -68.72
    assert evaluate_model(home, model)["community"] == 0
    home.epaWalkability = WalkabilityEvidence(status="unverified")
    assert evaluate_model(home, model)["community"] == 0
