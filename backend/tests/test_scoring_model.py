import pytest

from app.schemas import PropertyInput
from app.scoring.catalog import evaluate_model
from app.scoring.seed import seed_model_v1
from app.scoring.engine import score_home


@pytest.mark.parametrize("facts,expected", [
    ({}, {"energy": 40, "water": 20, "health": 40, "resilience": 40, "carbon": 30, "financial": 40, "community": 0}),
    ({"hers": "1-10", "solar": "5 kW Solar PV + Battery", "hvac": "Heat Pump (Electric)", "evReady": "EV Charger Installed"},
     {"energy": 185, "water": 20, "health": 40, "resilience": 40, "carbon": 40, "financial": 40, "community": 0}),
    ({"fortified": "FORTIFIED Gold", "flood": "Elevated", "roof": "Metal", "moisture": "Enhanced", "backup": "Battery", "healthCert": "WELL or Fitwel Residential", "ventilation": "Balanced ERV", "materials": "Low VOC", "iaq": "Monitoring", "daylighting": "Daylighting", "carbonStrategy": "Zero Carbon Certified", "carbonConcrete": "Low-Carbon", "structure": "Wood", "waterStandard": "WaterSense Home v2", "leak": "Auto Shutoff", "reuse": "Rainwater", "landscape": "Drought Tolerant", "pietim": "< 25%", "insurance": "Verified", "warranty": "Long", "maintenance": "Model", "walkscore": "70+", "transit": "Nearby", "greenspace": "Park", "amenities": "Shared", "bike": "Bike"},
     {"energy": 40, "water": 100, "health": 200, "resilience": 200, "carbon": 140, "financial": 100, "community": 50}),
])
def test_seed_preserves_existing_scores(facts, expected):
    assert evaluate_model(PropertyInput(**facts), seed_model_v1()) == expected


def test_all_legacy_choices_match_previous_scorer():
    choices = {
        "hers": ["Code-Minimum", "≤ 0", "11–20", "41-50", "61–70", "81-90"],
        "fortified": ["None", "FORTIFIED Gold", "FORTIFIED Silver", "Wildfire Prepared Home"],
        "healthCert": ["None", "WELL or Fitwel Residential", "EPA Indoor airPLUS"],
        "carbonStrategy": ["No Accounting", "Partial Material Disclosure", "Zero Carbon Certified"],
        "waterStandard": ["Code-Minimum", "WaterSense Home v2", "HERS H2O"],
        "pietim": ["< 25%", "25–30%", "35-40%", "> 40%"],
        "solar": ["None", "Solar PV", "Battery", "Solar PV + Battery"],
        "hvac": ["Unknown", "Heat Pump", "Geothermal"],
        "leak": ["None", "Auto Shutoff"],
        "walkscore": ["Unknown", "70+"],
    }
    model = seed_model_v1()
    for offset in range(40):
        facts = {key: values[(offset + index * 3) % len(values)] for index, (key, values) in enumerate(choices.items())}
        home = PropertyInput(**facts)
        assert evaluate_model(home, model) == score_home(home)
