from app.integrations.wildfire import DATASET_VERSION, risk_level
from app.schemas import PropertyInput

ADJUSTMENTS = {"Low": 10, "Medium": 0, "High": -10, "Very High": -20}


def has_matching_wildfire_risk(home: PropertyInput) -> bool:
    risk = home.wildfire
    if not risk or risk.status != "available" or risk.nationalPercentile is None:
        return False
    if risk.source != "USFS Wildfire Risk to Communities" or risk.datasetVersion != DATASET_VERSION:
        return False
    if risk.areaType not in {"community", "county"}:
        return False
    for home_coordinate, risk_coordinate in ((home.latitude, risk.latitude), (home.longitude, risk.longitude)):
        if home_coordinate is None or risk_coordinate is None or abs(home_coordinate - risk_coordinate) > 0.000001:
            return False
    return True


def wildfire_adjustment(home: PropertyInput) -> int:
    if not has_matching_wildfire_risk(home):
        return 0
    risk = home.wildfire
    return ADJUSTMENTS[risk_level(risk.nationalPercentile)]


def wildfire_explanation(home: PropertyInput) -> str:
    risk = home.wildfire
    adjustment = wildfire_adjustment(home)
    if not risk or risk.status != "available" or risk.nationalPercentile is None:
        return "USFS area wildfire risk is unknown; no wildfire score adjustment was applied."
    if not has_matching_wildfire_risk(home):
        return "USFS area wildfire risk could not be matched to this location; no wildfire score adjustment was applied."
    return (
        f"USFS area wildfire risk: {risk_level(risk.nationalPercentile)} ({risk.areaName}; {risk.areaType} scale). "
        f"VPSF wildfire adjustment: {adjustment:+d} Resilience points, subject to the 0-200 pillar limit. "
        "This is regional exposure, not a home fire-resistance assessment or current fire warning."
    )
