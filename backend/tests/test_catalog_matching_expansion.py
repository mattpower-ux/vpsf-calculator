import pytest

from app.advice.context import build_home_context, needs
from app.advice.products import match_products
from app.schemas import PropertyInput


def context(origin="user-confirmed", **values):
    return build_home_context(PropertyInput(**values), {k: {"origin": origin} for k in values}, {}, {})


def product(tag, **extra):
    return {"id": tag, "needTags": [tag], "reviewedAt": "2026-11-20", **extra}


@pytest.mark.parametrize("field,value,tag", [
    ("windows", "Single Pane", "windows"),
    ("insulation", "Uninsulated", "insulation"),
    ("temperatureProtection", "Air Sealing", "insulation"),
    ("temperatureProtection", "Insulation Upgrade", "air-sealing"),
    ("solar", "None", "solar"),
    ("backup", "None", "battery"),
    ("evReady", "EV Ready", "ev-charging"),
    ("windProtection", "None", "storm-protection"),
    ("moisture", "Standard Moisture Details", "moisture-control"),
    ("heatingControls", "Standard Thermostat", "smart-thermostat"),
    ("toilets", "Standard", "toilets"),
    ("bathroomFaucets", "Standard", "faucets"),
    ("showerheads", "Standard", "showerheads"),
])
def test_known_specific_conditions_match_and_unknown_provenance_does_not(field, value, tag):
    values = {field: value}
    if field == "heatingControls":
        values.update(hvac="Boiler", heatingDistribution="Hydronic Radiant")
    c = context(**values)
    assert needs(c)[tag]["field"] == field
    assert match_products(c, [product(tag)])[0]["reasons"]
    assert match_products(context(origin="unknown", **values), [product(tag)]) == []
    inferred = match_products(context(origin="inferred", **values), [product(tag)])
    if value in {"None", "Standard"}:
        assert inferred == []
    else:
        assert inferred[0]["group"] == "verification"


def test_defaults_and_unrelated_fields_do_not_manufacture_needs():
    tags = ["insulation", "air-sealing", "windows", "solar", "battery", "energy-management", "lighting", "appliances", "water-treatment", "graywater", "low-carbon-materials", "smart-thermostat", "ember-protection", "storm-protection", "moisture-control", "ev-charging", "toilets", "faucets", "showerheads", "dishwasher"]
    catalog = [product(tag) for tag in tags]
    assert match_products(build_home_context(PropertyInput(), {}, {}, {}), catalog) == []
    c = context(hers="Code-Minimum", daylighting="Standard", waterStandard="Code-Minimum", carbonConcrete="Standard Concrete", carbonStrategy="No Accounting", evReady="None")
    assert match_products(c, catalog) == []


def test_individual_fixture_need_does_not_select_other_fixture_types():
    c = context(toilets="Standard", bathroomFaucets="WaterSense", showerheads="Low-flow", waterStandard="Code-Minimum")
    catalog = [product("toilets"), product("faucets"), product("showerheads"), product("dishwasher")]
    catalog[1]["needTags"].append("fixtures")
    assert [m["productId"] for m in match_products(c, catalog)] == ["toilets"]


def test_installed_features_are_not_replacement_needs():
    c = context(windows="Double Pane, Low-E", insulation="R-19 Walls / R-38 Attic", temperatureProtection="Air Sealing + Insulation", solar="Solar PV + Battery", backup="None", evReady="EV Charger Installed", moisture="Enhanced Moisture Management", windProtection="Rated Opening Protection")
    assert needs(c) == {}


def test_graywater_requires_known_outdoor_use_and_absence():
    assert "graywater" in needs(context(reuse="None", irrigation="Conventional Irrigation"))
    assert "graywater" not in needs(context(reuse="None"))
    assert "graywater" not in needs(context(reuse="Greywater", irrigation="Conventional Irrigation"))


def test_gas_boiler_does_not_match_nonhydronic_heating_need():
    boiler = product("heating", requirements=["hydronic", "gas"])
    assert match_products(context(hvac="Electric Resistance"), [boiler]) == []
    assert match_products(context(hvac="Gas Furnace"), [boiler]) == []
    assert match_products(context(hvac="Boiler", heatingDistribution="Hydronic Radiant", hydronicSource="Natural Gas"), [boiler])
    assert "heating" not in needs(context(hvac="No heating"))


def test_new_installation_checks_are_specific():
    match = match_products(context(solar="None"), [product("solar", requirements=["solar-design"])])[0]
    assert match["group"] == "verification"
    assert any("shading" in check.lower() and "interconnection" in check.lower() for check in match["verification"])


def test_ember_need_requires_matching_elevated_exposure_and_missing_protection():
    from app.demo_hardie import hardie_demo_home
    home = hardie_demo_home().model_dump()
    home["wildfireMitigation"] = "None"
    assert "ember-protection" in needs(build_home_context(PropertyInput(**home), {}, {}, {}))
    for update in ({"wildfire": None}, {"latitude": 0}, {"wildfireMitigation": "Ember-Resistant Vents"}):
        changed = PropertyInput(**{**home, **update})
        assert "ember-protection" not in needs(build_home_context(changed, {}, {}, {}))


def test_reuse_match_verifies_both_absence_and_outdoor_demand():
    home = PropertyInput(reuse="None", irrigation="Conventional Irrigation")
    c = build_home_context(home, {"reuse": {"origin": "user-confirmed"}, "irrigation": {"origin": "imported"}}, {}, {})
    assert match_products(c, [product("graywater")])[0]["group"] == "verification"


def test_hidden_and_inactive_new_products_still_excluded():
    c = context(windows="Single Pane")
    assert match_products(c, [product("windows", weight="Hidden")]) == []
    assert match_products(c, [product("windows", status="inactive")]) == []


def test_premiere_partners_lead_only_after_need_and_compatibility_filtering():
    c = context(windows="Single Pane", hvac="Electric Resistance")
    catalog = [
        product("windows", id="ordinary", weight="Priority"),
        product("windows", id="partner", isSponsored=True, requirements=["window-fit"]),
        product("irrigation", id="unrelated-partner", isSponsored=True),
        product("heating", id="incompatible-partner", isSponsored=True, requirements=["hydronic", "gas"]),
        product("windows", id="hidden-partner", isSponsored=True, weight="Hidden"),
    ]
    assert [m["productId"] for m in match_products(c, catalog)] == ["partner", "ordinary"]
