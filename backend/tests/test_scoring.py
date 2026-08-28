from app.schemas import PropertyInput
from app.scoring import classify_score, score_home


def test_score_home_matches_expected_shape():
    scores = score_home(
        PropertyInput(
            hers="21-30",
            solar="5.2 kW Solar PV + Battery",
            hvac="Heat Pump (Electric)",
            evReady="EV Charger Installed",
        )
    )

    assert set(scores) == {
        "energy",
        "water",
        "health",
        "resilience",
        "carbon",
        "financial",
        "community",
    }
    assert scores["energy"] == 165


def test_classify_score():
    assert classify_score(875)["grade"] == "A+"
    assert classify_score(300)["grade"] == "D"
