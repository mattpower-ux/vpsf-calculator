from app.schemas import PropertyInput
from app.advice.context import build_home_context
from app.advice.takeaways import build_takeaways
from app.advice.products import match_products


def context(**values):
    return build_home_context(PropertyInput(**values), {}, {"energy": 100, "water": 40}, {"energy": 200, "water": 100})


def test_unknown_is_not_absent_and_four_pillars():
    c = context()
    assert not c.known("leak")
    tips = build_takeaways(c)
    assert [t["pillar"] for t in tips] == ["energy", "water", "health", "resilience"]
    assert all(t["action"]["destination"] == "details" for t in tips)


def test_confirmed_absence_and_installed_heat_pump():
    c = build_home_context(PropertyInput(hvac="Heat Pump (Electric)", leak="None"), {"leak": {"origin": "user-confirmed"}}, {}, {})
    assert c.known("leak")
    tips = build_takeaways(c)
    assert "maintain" in tips[0]["action"]["text"].lower()
    assert "shutoff" in tips[1]["action"]["text"].lower()
    assert tips[0]["evidence"] == "Recorded; confirm details"


def test_sourced_wildfire_and_unknown_mitigation():
    c = context(wildfire={"status": "available", "level": "High", "areaType": "county", "areaName": "Example County"})
    tip = build_takeaways(c)[3]
    assert "county" in tip["finding"].lower()
    assert "ember" in tip["action"]["text"].lower()


def test_compatibility_precedes_priority():
    p = dict(id="boiler", pillar="Energy", weight="Priority", isSponsored=True, needTags=["heating"], requirements=["hydronic", "gas"], reviewedAt="2026-11-09")
    assert match_products(context(hvac="Heat Pump (Electric)", heatingDistribution="Ducted"), [p]) == []
    matches = match_products(context(hvac="Boiler", heatingDistribution="Hydronic Radiators / Baseboards", hydronicSource="Natural Gas"), [p])
    assert matches[0]["group"] == "verification"
    assert match_products(context(hvac="Boiler"), [{**p, "weight": "Hidden"}]) == []


def test_irrigation_need_not_invented():
    p = dict(id="controller", pillar="Water", needTags=["irrigation"], requirements=["irrigation"], reviewedAt="2026-11-09")
    assert match_products(context(irrigation="No irrigation"), [p]) == []
    assert match_products(context(), [p]) == []
    assert match_products(context(irrigation="Conventional Irrigation"), [p])[0]["group"] == "verification"


def test_explicit_unknown_provenance_blocks_prefilled_features():
    c = build_home_context(PropertyInput(hvac="Heat Pump (Electric)"), {"hvac": {"origin": "unknown"}}, {}, {})
    assert not c.known("hvac")
    assert build_takeaways(c)[0]["action"]["destination"] == "details"


def test_confirmed_unknown_requires_verification():
    c = build_home_context(PropertyInput(hvac="Boiler", heatingDistribution="Unknown", hydronicSource="Unknown"), {k: {"origin": "user-confirmed"} for k in ["hvac", "heatingDistribution", "hydronicSource"]}, {}, {})
    matches = match_products(c, [dict(id="boiler", needTags=["heating"], requirements=["gas", "hydronic"], reviewedAt="2026-11-09")])
    assert matches[0]["group"] == "verification"
    assert len(matches[0]["verification"]) == 2


def test_condensing_boiler_does_not_trigger_equivalent_replacement():
    assert match_products(context(hvac="Condensing Boiler (AFUE 90%+)"), [dict(id="boiler", needTags=["heating"])]) == []
