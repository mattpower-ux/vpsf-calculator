"""Regression checks against the shipped award manifest, not synthetic products."""
import pytest

from app.advice.context import build_home_context, needs
from app.advice.products import match_products
from app.products.award_catalog import load_manifest
from app.schemas import PropertyInput


WATER_HEATERS = {
    "ge-profile-geospring-smart-hybrid-heat-pump-water-heater",
    "a-o-smith-voltex-max-smart-hybrid-electric-heat-pump-water-heater",
}
WATER_TREATMENT = "nuvoh2o-pro-7000-saltless-water-softener-system"
BROWSE_ONLY_FIXTURES = {
    "kohler-wastelab-vox-sink",
    "niagara-hydrotech-non-electric-bidet-seat",
}


@pytest.fixture(scope="module")
def catalog():
    manifest = load_manifest()
    assert manifest is not None, "The shipped award manifest must exist"
    products = {p.product_id: p for p in manifest.products}
    assert WATER_HEATERS | BROWSE_ONLY_FIXTURES | {WATER_TREATMENT} <= products.keys()
    return products


def confirmed_context(**values):
    return build_home_context(
        PropertyInput(**values),
        {field: {"origin": "user-confirmed"} for field in values},
        {}, {},
    )


def matched_ids(context, catalog):
    return {m["productId"] for m in match_products(context, catalog.values())}


def test_missing_leak_shutoff_does_not_recommend_replacement_appliances(catalog):
    context = confirmed_context(leak="None", waterHeater="Heat Pump")
    assert set(needs(context)) == {"leaks"}
    matches = matched_ids(context, catalog)
    assert "moen-flo-smart-water-monitor-and-shutoff" in matches
    assert not matches & (WATER_HEATERS | {WATER_TREATMENT})
    assert not any(
        catalog[identifier].category in {"Water Heating", "Water Treatment"}
        for identifier in matches
    )


def test_water_heaters_still_match_an_actual_water_heating_need(catalog):
    context = confirmed_context(waterHeater="Electric Tank")
    assert set(needs(context)) == {"water-heating"}
    assert WATER_HEATERS <= matched_ids(context, catalog)
    assert catalog[WATER_TREATMENT].needTags == ["water-treatment"]


def test_generic_fixture_need_does_not_recommend_sink_or_bidet_seat(catalog):
    context = confirmed_context(
        waterStandard="Code-Minimum", toilets="WaterSense",
        bathroomFaucets="WaterSense", showerheads="WaterSense",
    )
    assert set(needs(context)) == {"fixtures"}
    assert not matched_ids(context, catalog) & BROWSE_ONLY_FIXTURES
    for identifier in BROWSE_ONLY_FIXTURES:
        assert catalog[identifier].needTags == [], identifier


def test_award_blurbs_remain_concise(catalog):
    for identifier, product in catalog.items():
        assert 25 <= len(product.summary.split()) <= 40, identifier


def test_community_is_not_assigned_to_every_award(catalog):
    # Permit justified Community entries; these equipment awards do not establish it.
    assert not all("community" in p.pillars for p in catalog.values())
    for identifier in WATER_HEATERS | {WATER_TREATMENT}:
        assert "community" not in catalog[identifier].pillars, identifier


@pytest.mark.parametrize("values,category", [
    ({"windows": "Single Pane"}, "Windows and Doors"),
    ({"insulation": "Uninsulated"}, "Insulation"),
    ({"toilets": "Standard"}, "Fixtures"),
    ({"irrigation": "Conventional Irrigation", "reuse": "None"}, "Water Reuse"),
    ({"roofAge": "25"}, "Roofing"),
    ({"backup": "None"}, "Battery Storage"),
])
def test_new_award_products_enter_specific_home_paths(catalog, values, category):
    matches = matched_ids(confirmed_context(**values), catalog)
    assert any(catalog[identifier].category == category for identifier in matches)
    assert all(match["reasons"] for match in match_products(confirmed_context(**values), catalog.values()))
