from app.scoring.catalog import Factor, ScoreModel


CAPS = {"energy": 200, "water": 100, "health": 200, "resilience": 200, "carbon": 150, "financial": 100, "community": 50}


def seed_model_v1() -> ScoreModel:
    factors = []

    def lookup(id, label, pillar, field, options, default):
        factors.append(Factor(id=id, label=label, pillar=pillar, field=field, mode="lookup", options=options, default=default))

    def add(id, label, pillar, field, mode, points, *matches):
        factors.append(Factor(id=id, label=label, pillar=pillar, field=field, mode=mode, points=points, matches=list(matches)))

    lookup("hers", "HERS rating", "energy", "hers", {
        "<= 0": 160, "≤ 0": 160, "1-10": 150, "1–10": 150, "11-20": 140, "11–20": 140,
        "21-30": 130, "21–30": 130, "31-40": 120, "31–40": 120, "41-50": 110, "41–50": 110,
        "51-60": 100, "51–60": 100, "61-70": 85, "61–70": 85, "71-80": 70, "71–80": 70,
        "81-90": 55, "81–90": 55, "Code-Minimum": 40,
    }, 40)
    add("solar_pv", "Solar PV", "energy", "solar", "contains", 10, "Solar PV")
    add("battery", "Battery storage", "energy", "solar", "contains", 10, "Battery")
    add("heat_pump_energy", "Heat pump or geothermal HVAC", "energy", "hvac", "contains_any", 10, "Heat Pump", "Geothermal")
    add("ev_ready", "EV readiness", "energy", "evReady", "not_equals", 5, "None")

    lookup("fortified", "Resilience certification", "resilience", "fortified", {
        "FORTIFIED Gold": 160, "FORTIFIED Silver": 140, "FORTIFIED Bronze": 120,
        "Wildfire Prepared Home": 100, "None": 40,
    }, 40)
    add("flood_design", "Flood design", "resilience", "flood", "contains_any", 10, "Elevated", "Flood")
    add("roof_resilience", "Roof impact or metal", "resilience", "roof", "contains_any", 10, "Impact", "Metal")
    add("moisture", "Enhanced moisture protection", "resilience", "moisture", "contains", 10, "Enhanced")
    add("backup", "Backup power", "resilience", "backup", "not_equals", 10, "None")
    factors.append(Factor(id="usfs_wildfire", label="USFS area wildfire risk", pillar="resilience", field="wildfire", mode="wildfire", source="USFS Wildfire Risk to Communities"))

    lookup("health_cert", "Health certification", "health", "healthCert", {
        "WELL or Fitwel Residential": 120, "EPA Indoor airPLUS": 90, "RESET Air or Equivalent": 80, "None": 40,
    }, 40)
    add("ventilation", "Balanced ventilation or ERV", "health", "ventilation", "contains_any", 20, "ERV", "Balanced")
    add("low_voc", "Low-VOC materials", "health", "materials", "contains", 20, "VOC")
    add("iaq", "IAQ monitoring", "health", "iaq", "contains", 20, "Monitoring")
    add("daylighting", "Daylighting", "health", "daylighting", "contains", 20, "Daylighting")

    lookup("carbon_strategy", "Carbon strategy", "carbon", "carbonStrategy", {
        "Zero Carbon Certified": 120, "Documented EPDs + CLF Benchmark": 90,
        "Partial Material Disclosure": 60, "No Accounting": 30,
    }, 30)
    add("concrete", "Low-carbon concrete", "carbon", "carbonConcrete", "contains", 10, "Low-Carbon")
    add("wood", "Wood structure", "carbon", "structure", "contains", 10, "Wood")
    add("heat_pump_carbon", "Heat pump or geothermal HVAC", "carbon", "hvac", "contains_any", 10, "Heat Pump", "Geothermal")

    lookup("water_standard", "Water standard", "water", "waterStandard", {
        "WaterSense Home v2": 60, "HERS H2O": 50, "WERS Rated": 40, "Code-Minimum": 20,
    }, 20)
    add("leak_water", "Automatic leak protection", "water", "leak", "contains", 15, "Auto")
    add("reuse", "Water reuse", "water", "reuse", "not_equals", 15, "None")
    add("landscape", "Drought-tolerant landscape", "water", "landscape", "contains", 10, "Drought")

    lookup("pietim", "PIETIM ownership-cost ratio", "financial", "pietim", {
        "< 25%": 60, "25-30%": 50, "25–30%": 50, "30-35%": 40, "30–35%": 40,
        "35-40%": 25, "35–40%": 25, "> 40%": 10,
    }, 40)
    add("insurance", "Verified insurance", "financial", "insurance", "contains", 15, "Verified")
    add("warranty", "Long warranty", "financial", "warranty", "contains", 15, "Long")
    add("maintenance", "Maintenance model", "financial", "maintenance", "contains", 10, "Model")
    add("leak_financial", "Automatic leak protection", "financial", "leak", "contains", 10, "Auto")

    add("walkscore_legacy", "WalkScore above 70 (legacy)", "community", "walkscore", "equals", 15, "70+")
    for minimum in (6, 11, 16):
        factors.append(Factor(id=f"epa_walk_{minimum}", label=f"EPA index at least {minimum}", pillar="community", field="epaWalkability", mode="epa_range", lower=minimum, points=5, active=False, source="EPA National Walkability Index"))
    add("transit", "Nearby transit", "community", "transit", "contains", 10, "Nearby")
    add("greenspace", "Green space or park", "community", "greenspace", "contains_any", 10, "Green", "Park")
    add("amenities", "Shared amenities", "community", "amenities", "contains", 10, "Shared")
    add("bike", "Bike access", "community", "bike", "contains", 5, "Bike")
    return ScoreModel(version="vpsf-0.2.0-usfs", pillars=CAPS, factors=factors)
