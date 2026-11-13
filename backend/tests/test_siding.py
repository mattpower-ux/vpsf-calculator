from app.demo_hardie import hardie_demo_home
from app.scoring.seed import seed_model_v1
from app.scoring.siding import with_noncombustible_siding
from app.scoring.catalog import evaluate_model
from app.scoring.improvements import improvement_plan


def test_siding_gain_and_no_repeat_credit():
    model = with_noncombustible_siding(seed_model_v1())
    home = hardie_demo_home()
    upgraded = home.model_copy(update={"siding": "Fiber cement"})
    assert evaluate_model(upgraded, model)["resilience"] - evaluate_model(home, model)["resilience"] == 30
    plan = improvement_plan(home, model)
    assert next(r for r in plan if r["id"] == "resilience-siding")["gainPoints"] == 30
    assert not any(r["id"] == "resilience-siding" for r in improvement_plan(upgraded, model))
    model.pillars["resilience"] = 40
    assert next(r for r in improvement_plan(home, model) if r["id"] == "resilience-siding")["gainPoints"] == 20


def test_migration_preserves_admin_weight():
    model = with_noncombustible_siding(seed_model_v1())
    factor = next(f for f in model.factors if f.id == "noncombustible_siding")
    factor.points = 17
    upgraded = with_noncombustible_siding(model)
    assert len([f for f in upgraded.factors if f.id == factor.id]) == 1
    assert next(f for f in upgraded.factors if f.id == factor.id).points == 17
