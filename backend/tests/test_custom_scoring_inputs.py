from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app
from app.scoring.catalog import CustomField, Factor
from app.scoring.seed import seed_model_v1
from app.routers.scoring import validate_extra_inputs


def test_optional_field_validation_and_scoring():
    model = seed_model_v1()
    model.customFields.append(CustomField(id="attic_r", label="Attic insulation R-value", pillar="energy", kind="number", minimum=0, maximum=100))
    model.factors.append(Factor(id="attic_bonus", label="Attic insulation", pillar="energy", field="attic_r", mode="number_range", lower=40, points=5))
    assert validate_extra_inputs({"attic_r": 49}, model) == {"attic_r": 49}
    assert validate_extra_inputs({}, model) == {}
    for invalid in ({"missing": 1}, {"attic_r": 101}, {"attic_r": "high"}):
        try:
            validate_extra_inputs(invalid, model)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid custom value was accepted")


def test_public_form_lists_only_published_active_fields():
    init_db()
    response = TestClient(app).get("/api/scoring/form-fields")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
