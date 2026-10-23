from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models import ScoringModelRecord
from app.schemas import PropertyInput
from app.scoring.catalog import evaluate_model
from app.scoring.seed import seed_model_v1
from app.scoring.store import seed_published, load_published, load_or_create_draft


def test_new_facts_survive_property_round_trip():
    facts = dict(heatingDistribution="Hydronic Radiant", heatingControls="Zoning + Outdoor Reset",
                 wildfireMitigation="Ember Hardening + Defensible Space",
                 temperatureProtection="Air Sealing + Insulation", windProtection="FEMA / ICC Safe Room")
    home = PropertyInput(**facts)
    assert all(home.model_dump().get(key) == value for key, value in facts.items())


def current_model():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_published(db)
        return load_published(db)


def test_qualified_heating_scores_once_not_for_radiant_or_combi_name_alone():
    model = current_model()
    base = evaluate_model(PropertyInput(), model)["energy"]
    ordinary = PropertyInput(hvac="Combination Boiler", waterHeater="Combination Boiler", heatingDistribution="Hydronic Radiant")
    assert evaluate_model(ordinary, model)["energy"] == base
    efficient = ordinary.model_copy(update={"hvac": "Condensing Combination Boiler (AFUE 90%+)", "waterHeater": "Condensing Combination Boiler (AFUE 90%+)", "heatingControls": "Zoning + Outdoor Reset"})
    assert evaluate_model(efficient, model)["energy"] == base + 10


def test_resilience_options_are_mutually_exclusive_and_capped():
    model = current_model()
    home = PropertyInput(wildfireMitigation="Ember Hardening + Defensible Space", temperatureProtection="Air Sealing + Insulation", windProtection="FEMA / ICC Safe Room")
    assert evaluate_model(home, model)["resilience"] == 70
    home.fortified = "FORTIFIED Gold"
    home.flood = "Elevated"
    home.roof = "Metal"
    home.backup = "Battery"
    assert evaluate_model(home, model)["resilience"] == 200


def test_upgrade_preserves_old_model_admin_weights_and_draft_edits():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        old = seed_model_v1()
        old.factors[0].options["Code-Minimum"] = 43
        db.add(ScoringModelRecord(version=old.version, payload=old.model_dump(), active=True))
        db.commit()
        draft, revision = load_or_create_draft(db)
        from app.scoring.store import save_draft
        draft.factors[0].options["Code-Minimum"] = 47
        save_draft(db, draft, revision)
        seed_published(db)
        published = load_published(db)
        assert published.version != old.version
        assert published.factors[0].options["Code-Minimum"] == 43
        assert any(f.field == "wildfireMitigation" for f in published.factors)
        assert load_or_create_draft(db)[0].factors[0].options["Code-Minimum"] == 47
        assert db.scalar(select(ScoringModelRecord).where(ScoringModelRecord.version == old.version)).payload == old.model_dump()
        seed_published(db)
        assert load_published(db).version == published.version


def test_improvement_gains_follow_admin_weights_and_remaining_pillar_capacity():
    from app.scoring.improvements import improvement_plan
    model = current_model()
    next(f for f in model.factors if f.id == "hr_wildfire_mitigation").options["Ember Hardening + Defensible Space"] = 7
    home = PropertyInput(hvac="Combination Boiler", waterHeater="Combination Boiler", heatingDistribution="Hydronic Radiant")
    plan = improvement_plan(home, model)
    assert any(item["id"] == "heating-boiler" for item in plan)
    assert any(item["id"] == "heating-controls" for item in plan)
    assert next(item for item in plan if item["id"] == "resilience-wildfire")["gainPoints"] == 7
    original = evaluate_model(home, model)
    for item in plan:
        before = sum(evaluate_model(home, model).values())
        home = home.model_copy(update=item["changes"])
        assert sum(evaluate_model(home, model).values()) - before == item["gainPoints"]
    assert sum(item["gainPoints"] for item in plan) == sum(evaluate_model(home, model).values()) - sum(original.values())
    assert not improvement_plan(home, model)


def test_missing_or_retired_factors_do_not_produce_claimed_improvements():
    from app.scoring.improvements import improvement_plan
    model = current_model()
    for factor in model.factors:
        factor.active = False
    assert improvement_plan(PropertyInput(), model) == []


def test_hydronic_carbon_ranks_oil_below_gas_below_ground_source_without_stacking():
    model = current_model()
    scores = [evaluate_model(PropertyInput(hvac="Combination Boiler", hydronicSource=source), model)
              for source in ["Heating Oil", "Natural Gas", "Ground-Source Heat Pump"]]
    assert [score["carbon"] for score in scores] == [30, 35, 45]
    assert scores[2]["energy"] == 50
    assert evaluate_model(PropertyInput(hvac="Gas Furnace", hydronicSource="Ground-Source Heat Pump"), model)["carbon"] == 30


def test_air_to_water_and_resistance_electric_are_distinct_and_controls_need_hydronic_distribution():
    model = current_model()
    heat_pump = PropertyInput(hvac="Condensing Boiler (AFUE 90%+)", hydronicSource="Air-to-Water Heat Pump")
    assert heat_pump.hvac == "Hydronic Heating"
    assert evaluate_model(heat_pump, model)["energy"] == 50
    assert evaluate_model(heat_pump, model)["carbon"] == 40
    resistance = PropertyInput(hvac="Boiler", hydronicSource="Electric Resistance", heatingDistribution="Electric Radiant", heatingControls="Zoning + Outdoor Reset")
    assert evaluate_model(resistance, model)["energy"] == 40


def test_legacy_properties_receive_no_new_points_and_retired_new_factors_stay_retired():
    model = current_model()
    assert evaluate_model(PropertyInput(), model) == evaluate_model(PropertyInput(), seed_model_v1())
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_published(db)
        draft, revision = load_or_create_draft(db)
        next(f for f in draft.factors if f.id == "hr_wind_protection").active = False
        from app.scoring.store import save_draft, publish_draft
        revision = save_draft(db, draft, revision)
        published = publish_draft(db, revision, "test")
        seed_published(db)
        assert load_published(db).version == published.version
        assert not next(f for f in load_published(db).factors if f.id == "hr_wind_protection").active
