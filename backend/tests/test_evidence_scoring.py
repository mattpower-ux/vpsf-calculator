from app.schemas import PropertyInput
from app.scoring.catalog import evaluate_model
from app.scoring.seed import seed_model_v1


def test_multifamily_permit_features_change_only_their_scoring_factors_once():
    model = seed_model_v1()
    base = PropertyInput(homeType="Multifamily", unitCount="3", hvac="Unknown", solar="None")
    enriched = base.model_copy(update={"hvac": "Heat Pump (Electric) + Boiler", "solar": "Solar PV"})

    before = evaluate_model(base, model)
    after = evaluate_model(enriched, model)

    assert after["energy"] - before["energy"] == 20
    assert after["carbon"] - before["carbon"] == 10
    for pillar in {"water", "health", "resilience", "financial", "community"}:
        assert after[pillar] == before[pillar]


def test_equipment_quantity_does_not_multiply_property_level_points():
    model = seed_model_v1()
    one_system = PropertyInput(hvac="Heat Pump (Electric)", solar="Solar PV")
    shared_multifamily = PropertyInput(homeType="Multifamily", unitCount="3", hvac="Heat Pump (Electric) + Boiler", solar="Solar PV")

    assert evaluate_model(shared_multifamily, model)["energy"] == evaluate_model(one_system, model)["energy"]
    assert evaluate_model(shared_multifamily, model)["carbon"] == evaluate_model(one_system, model)["carbon"]
