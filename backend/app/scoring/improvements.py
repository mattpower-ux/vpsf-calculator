"""Incremental improvement estimates evaluated by the same published score model."""

from app.schemas import PropertyInput
from app.scoring.catalog import ScoreModel, evaluate_model


def improvement_plan(home: PropertyInput, model: ScoreModel) -> list[dict]:
    candidates = []

    def add(id, pillar, title, copy, changes):
        candidates.append(dict(id=id, pillar=pillar, title=title, copy=copy, changes=changes))

    if home.hydronicSource in {"Heating Oil", "Natural Gas", "Propane", "Electric Resistance"}:
        add("heating-ground-source", "energy", "Assess Ground-Source Hydronic Heating",
            "Check ground-loop feasibility, design heat loss, and the water temperature needed by existing radiators or radiant floors. A ground-source heat pump avoids on-site combustion; actual carbon savings depend on electricity supply and system performance.",
            {"hvac": "Hydronic Heating", "hydronicSource": "Ground-Source Heat Pump"})
    elif "boiler" in home.hvac.lower():
        combi = "combination" in home.hvac.lower()
        equipment = "Condensing Combination Boiler (AFUE 90%+)" if combi else "Condensing Boiler (AFUE 90%+)"
        changes = {"hvac": equipment}
        if combi and "combination" in home.waterHeater.lower():
            changes["waterHeater"] = equipment
        add("heating-boiler", "energy", "Assess a Condensing Boiler Upgrade",
            "Check the boiler's AFUE and sizing. Condensing performance depends on low return-water temperatures; a combination unit also needs enough domestic hot-water capacity. Keep combustion venting and condensate drainage in the installation review.", changes)
    elif home.hvac != "Hydronic Heating" and "heat pump" not in home.hvac.lower() and "geothermal" not in home.hvac.lower():
        add("energy-hvac", "energy", "Assess Heat Pump Heating",
            "Use a heating and cooling load calculation, climate-rated capacity, and a distribution-system review before selecting equipment. Update existing equipment records first if a heat pump is already installed.", {"hvac": "Heat Pump (Electric)"})
    if home.heatingDistribution in {"Hydronic Radiant", "Hydronic Radiators / Baseboards"}:
        add("heating-controls", "energy", "Optimize Hydronic Heating Controls",
            "Review zoning and outdoor-reset settings with the installer. Reset adjusts water temperature to outdoor conditions; minimum temperatures, floor limits, and boiler compatibility still matter.", {"heatingControls": "Zoning + Outdoor Reset"})
    add("resilience-wildfire", "resilience", "Assess Ember Hardening and Defensible Space",
        "Where wildfire exposure warrants it, review ember-resistant vents, vulnerable openings, and vegetation near the home. Confirm local requirements and maintain defensible space; these measures do not eliminate wildfire risk.", {"wildfireMitigation": "Ember Hardening + Defensible Space"})
    add("resilience-temperature", "resilience", "Improve Extreme-Temperature Protection",
        "Use an energy assessment to identify air leakage and insulation gaps. Coordinate air sealing with ventilation, moisture control, and combustion safety. A stronger envelope can slow indoor temperature changes during outages.", {"temperatureProtection": "Air Sealing + Insulation"})
    add("resilience-wind", "resilience", "Assess Wind and Tornado Protection",
        "For tornado exposure, consult a qualified designer about a safe room meeting applicable FEMA guidance and ICC 500. Rated shutters and structural connections serve different purposes and are not substitutes for a tornado safe room.", {"windProtection": "FEMA / ICC Safe Room"})
    add("water-leak-detection", "water", "Add Automatic Leak Shutoff",
        "Review whole-home leak detection and automatic shutoff, including valve access, maintenance, and compatibility with fire-sprinkler systems.", {"leak": "Leak Detection + Auto Shutoff"})
    add("health-ventilation", "health", "Review Balanced Fresh-Air Ventilation",
        "Size balanced ventilation for occupancy and climate, verify delivered airflow, and plan filter maintenance. Heat or energy recovery reduces ventilation losses but does not replace moisture-source control.", {"ventilation": "Balanced ERV"})
    add("health-materials", "health", "Document Low-Emitting Materials",
        "Check product emissions documentation for paints, adhesives, flooring, and cabinetry. Lower-emitting materials support source control alongside ventilation; a whole-home certification is not required for this recorded feature.", {"materials": "Low-VOC Materials"})
    # Apply each accepted step before evaluating the next, avoiding overlapping gains.
    current = home
    plan = []
    for candidate in candidates:
        proposed = PropertyInput.model_validate({**current.model_dump(), **candidate["changes"]})
        before, after = evaluate_model(current, model), evaluate_model(proposed, model)
        gain = sum(after.values()) - sum(before.values())
        if gain <= 0:
            continue
        plan.append({**candidate, "gainPoints": gain, "pillarGains": {key: after[key] - before[key] for key in before if after[key] != before[key]}})
        current = proposed
    return plan
