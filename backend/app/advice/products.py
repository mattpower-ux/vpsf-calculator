from app.advice.context import needs

INSTALLATION_CHECKS = {
    "siding-assembly": "Verify the wall assembly, sheathing, flashing, clearances, installation instructions and local wildfire requirements; siding alone is not a fire-rated wall or a guarantee of survival.",
    "space-and-electrical": "Confirm space, electrical supply, condensate drainage and capacity.",
    "ventilation-design": "Confirm measured airflow, duct layout, climate and moisture-control design.",
    "roof-design": "Confirm roof condition, assembly ratings, structural loads and local requirements.",
    "reuse-code": "Confirm local reuse rules, storage sizing and separate nonpotable plumbing.",
    "fixture-fit": "Confirm actual flow rate, dimensions, pressure and installation compatibility.",
    "envelope-design": "Confirm insulation levels, air leakage, climate, vapor control, ventilation and combustion safety.",
    "window-fit": "Confirm opening dimensions, flashing, egress, glazing ratings and climate suitability.",
    "solar-design": "Confirm shading, roof or site condition, structural capacity, electrical design and utility interconnection.",
    "battery-design": "Confirm critical loads, inverter compatibility, electrical capacity, siting and fire-code clearances.",
    "controls-compatibility": "Confirm equipment protocols, thermostat wiring, voltage and control compatibility.",
    "water-quality": "Test source water and confirm contaminant-specific treatment, certified performance and maintenance needs.",
    "material-assembly": "Confirm assembly compatibility, structural requirements, product EPDs and project-specific material impacts.",
    "ember-design": "Confirm tested ember resistance, required ventilation area, local WUI requirements and the complete assembly.",
    "storm-design": "Confirm local wind and impact design loads, tested assembly ratings, anchorage and installation requirements.",
    "moisture-design": "Identify moisture sources and confirm drainage, flashing, vapor control and drying paths.",
    "ev-electrical": "Confirm vehicle connector, charging load, panel and circuit capacity, permits and installation location.",
    "appliance-fit": "Confirm dimensions, utility connections, electrical load, ventilation and installation clearances.",
}
REQUIREMENTS = {"hydronic", "gas", "irrigation", *INSTALLATION_CHECKS}
NEED_TAGS = {
    "heating", "water-heating", "irrigation", "leaks", "fixtures", "rainwater",
    "ventilation", "roofing", "fire-resistant-siding", "insulation", "air-sealing",
    "windows", "solar", "battery", "energy-management", "lighting", "appliances",
    "water-treatment", "graywater", "low-carbon-materials", "smart-thermostat",
    "ember-protection", "storm-protection", "moisture-control", "ev-charging",
    "toilets", "faucets", "showerheads", "dishwasher",
}
FIXTURE_TAGS = {"toilets", "faucets", "showerheads", "dishwasher"}


def match_products(c, catalog):
    home_needs = needs(c)
    matches = []
    for item in catalog:
        p = item.model_dump() if hasattr(item, "model_dump") else item
        if p.get("weight") == "Hidden" or p.get("status", "active") != "active":
            continue
        tags = set(p.get("needTags", []))
        # A legacy generic tag must not bypass a product's more precise type.
        if tags & FIXTURE_TAGS:
            tags.discard("fixtures")
        relevant = [home_needs[tag] for tag in sorted(tags) if tag in home_needs]
        if not relevant:
            continue
        checks = []
        mismatch = False
        for req in p.get("requirements", []):
            if req == "hydronic":
                v = c.value("heatingDistribution").lower()
                hvac = c.value("hvac").lower()
                if c.known("hvac") and not any(term in hvac for term in ("boiler", "hydronic")): mismatch = True
                elif c.known("heatingDistribution") and "hydronic" not in v: mismatch = True
                elif not c.known("heatingDistribution") or not c.confirmed("heatingDistribution"): checks.append("Confirm hydronic distribution and operating water temperatures.")
            elif req == "gas":
                v = c.value("hydronicSource")
                if c.known("hydronicSource") and v not in {"Natural Gas", "Propane"}: mismatch = True
                elif not c.known("hydronicSource") or not c.confirmed("hydronicSource"): checks.append("Confirm gas or propane supply; do not assume a fuel conversion is feasible.")
            elif req == "irrigation":
                v = c.value("irrigation").lower()
                if "no irrigation" in v or "xeriscap" in v: mismatch = True
                else: checks.append("Confirm existing irrigation valves, wiring and controller compatibility.")
            else:
                checks.append(INSTALLATION_CHECKS.get(req, "Confirm installation requirements with a qualified professional."))
        if mismatch:
            continue
        if not p.get("reviewedAt"): checks.append("Product specifications need editorial verification.")
        if not all(n["confirmed"] for n in relevant): checks.append("Confirm the recorded home details before selecting equipment.")
        if p.get("verificationNotes"): checks.append(p["verificationNotes"])
        pillar = str(p.get("pillar", "")).lower()
        pillars = p.get("pillars") or [pillar]
        gap = max((c.gap(x.lower()) for x in pillars), default=0)
        group = "verification" if checks else "matched"
        # Partner priority applies only to products that survived the home's
        # need and compatibility filters; it never creates eligibility.
        matches.append(dict(productId=p["id"], group=group, reasons=[n["reason"] for n in relevant], verification=list(dict.fromkeys(checks)), _sort=(not p.get("isSponsored", False), group != "matched", not all(n["confirmed"] for n in relevant), -int("fire-resistant-siding" in p.get("needTags", []) and "fire-resistant-siding" in home_needs), -gap, -len(relevant), {"Priority": 0, "Standard": 1, "Downgrade": 2}.get(p.get("weight"), 1), p.get("product", p.get("name", "")), p["id"])))
    matches.sort(key=lambda x: x["_sort"])
    return [{k: v for k, v in m.items() if k != "_sort"} for m in matches]
