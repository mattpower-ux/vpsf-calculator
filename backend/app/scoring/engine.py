from app.schemas import PropertyInput

PILLAR_MAX = {
    "energy": 200,
    "water": 100,
    "health": 200,
    "resilience": 200,
    "carbon": 150,
    "financial": 100,
    "community": 50,
}


def _contains(value: str, needle: str) -> bool:
    return needle.lower() in (value or "").lower()


def score_home(home: PropertyInput) -> dict[str, int]:
    energy = {
        "<= 0": 160,
        "≤ 0": 160,
        "1-10": 150,
        "1–10": 150,
        "11-20": 140,
        "11–20": 140,
        "21-30": 130,
        "21–30": 130,
        "31-40": 120,
        "31–40": 120,
        "41-50": 110,
        "41–50": 110,
        "51-60": 100,
        "51–60": 100,
        "61-70": 85,
        "61–70": 85,
        "71-80": 70,
        "71–80": 70,
        "81-90": 55,
        "81–90": 55,
        "Code-Minimum": 40,
    }.get(home.hers, 40)
    if _contains(home.solar, "Solar PV"):
        energy += 10
    if _contains(home.solar, "Battery"):
        energy += 10
    if _contains(home.hvac, "Heat Pump") or _contains(home.hvac, "Geothermal"):
        energy += 10
    if home.evReady != "None":
        energy += 5
    energy = min(200, energy)

    resilience = {
        "FORTIFIED Gold": 160,
        "FORTIFIED Silver": 140,
        "FORTIFIED Bronze": 120,
        "Wildfire Prepared Home": 100,
        "None": 40,
    }.get(home.fortified, 40)
    if _contains(home.flood, "Elevated") or _contains(home.flood, "Flood"):
        resilience += 10
    if _contains(home.roof, "Impact") or _contains(home.roof, "Metal"):
        resilience += 10
    if _contains(home.moisture, "Enhanced"):
        resilience += 10
    if home.backup != "None":
        resilience += 10
    resilience = min(200, resilience)

    health = {
        "WELL or Fitwel Residential": 120,
        "EPA Indoor airPLUS": 90,
        "RESET Air or Equivalent": 80,
        "None": 40,
    }.get(home.healthCert, 40)
    if _contains(home.ventilation, "ERV") or _contains(home.ventilation, "Balanced"):
        health += 20
    if _contains(home.materials, "VOC"):
        health += 20
    if _contains(home.iaq, "Monitoring"):
        health += 20
    if _contains(home.daylighting, "Daylighting"):
        health += 20
    health = min(200, health)

    carbon = {
        "Zero Carbon Certified": 120,
        "Documented EPDs + CLF Benchmark": 90,
        "Partial Material Disclosure": 60,
        "No Accounting": 30,
    }.get(home.carbonStrategy, 30)
    if _contains(home.carbonConcrete, "Low-Carbon"):
        carbon += 10
    if _contains(home.structure, "Wood"):
        carbon += 10
    if _contains(home.hvac, "Heat Pump") or _contains(home.hvac, "Geothermal"):
        carbon += 10
    carbon = min(150, carbon)

    water = {
        "WaterSense Home v2": 60,
        "HERS H2O": 50,
        "WERS Rated": 40,
        "Code-Minimum": 20,
    }.get(home.waterStandard, 20)
    if _contains(home.leak, "Auto"):
        water += 15
    if home.reuse != "None":
        water += 15
    if _contains(home.landscape, "Drought"):
        water += 10
    water = min(100, water)

    financial = {
        "< 25%": 60,
        "25-30%": 50,
        "25–30%": 50,
        "30-35%": 40,
        "30–35%": 40,
        "35-40%": 25,
        "35–40%": 25,
        "> 40%": 10,
    }.get(home.pietim, 40)
    if _contains(home.insurance, "Verified"):
        financial += 15
    if _contains(home.warranty, "Long"):
        financial += 15
    if _contains(home.maintenance, "Model"):
        financial += 10
    if _contains(home.leak, "Auto"):
        financial += 10
    financial = min(100, financial)

    community = 0
    if home.walkscore == "70+":
        community += 15
    if _contains(home.transit, "Nearby"):
        community += 10
    if _contains(home.greenspace, "Green") or _contains(home.greenspace, "Park"):
        community += 10
    if _contains(home.amenities, "Shared"):
        community += 10
    if _contains(home.bike, "Bike"):
        community += 5
    community = min(50, community)

    return {
        "energy": energy,
        "water": water,
        "health": health,
        "resilience": resilience,
        "carbon": carbon,
        "financial": financial,
        "community": community,
    }


def classify_score(total: int) -> dict[str, str]:
    if total >= 850:
        return {"label": "Exceptional", "meaning": "Future-proof asset", "grade": "A+"}
    if total >= 700:
        return {"label": "High Performance", "meaning": "Low-risk, low-cost home", "grade": "A"}
    if total >= 550:
        return {"label": "Good / Efficient", "meaning": "Above-market quality", "grade": "B"}
    if total >= 400:
        return {"label": "Code Plus", "meaning": "Typical new home", "grade": "C"}
    return {"label": "High Risk", "meaning": "High operating + insurance cost", "grade": "D"}


def explain_score(home: PropertyInput, scores: dict[str, int]) -> dict[str, str]:
    return {
        "energy": f"Energy reflects HERS '{home.hers}', HVAC '{home.hvac}', solar '{home.solar}', and EV readiness '{home.evReady}'.",
        "water": f"Water reflects '{home.waterStandard}', leak protection '{home.leak}', reuse '{home.reuse}', and landscape '{home.landscape}'.",
        "health": f"Health reflects certification '{home.healthCert}', ventilation '{home.ventilation}', materials '{home.materials}', and IAQ '{home.iaq}'.",
        "resilience": f"Resilience reflects '{home.fortified}', flood design '{home.flood}', roof '{home.roof}', moisture details, and backup power.",
        "carbon": f"Carbon reflects strategy '{home.carbonStrategy}', concrete '{home.carbonConcrete}', structure '{home.structure}', and electrification.",
        "financial": f"Financial risk reflects PIETIM '{home.pietim}', insurance '{home.insurance}', warranty '{home.warranty}', and maintenance documentation.",
        "community": f"Community reflects walk score '{home.walkscore}', transit '{home.transit}', greenspace '{home.greenspace}', amenities, and bike access.",
        "summary": f"Current backend model scored this property at {sum(scores.values())} out of 1000 using prototype-parity rules.",
    }


def confidence_for_input(home: PropertyInput) -> int:
    fields = [
        home.address,
        home.squareFeet,
        home.yearBuilt,
        home.hvac,
        home.waterHeater,
        home.roof,
        home.hers,
        home.fortified,
        home.waterStandard,
        home.healthCert,
    ]
    known = sum(1 for value in fields if value and value not in {"Unknown", "None", "None / Unknown", "Code-Minimum"})
    return min(95, 45 + known * 5)
