from app.advice.context import needs

REQUIREMENTS = {"hydronic", "gas", "irrigation", "space-and-electrical", "ventilation-design", "roof-design", "reuse-code", "fixture-fit", "siding-assembly"}
NEED_TAGS = {"heating", "water-heating", "irrigation", "leaks", "fixtures", "rainwater", "ventilation", "roofing", "fire-resistant-siding"}


def match_products(c, catalog):
    home_needs = needs(c)
    matches = []
    for item in catalog:
        p = item.model_dump() if hasattr(item, "model_dump") else item
        if p.get("weight") == "Hidden" or p.get("status", "active") != "active":
            continue
        relevant = [home_needs[tag] for tag in p.get("needTags", []) if tag in home_needs]
        if not relevant:
            continue
        checks = []
        mismatch = False
        for req in p.get("requirements", []):
            if req == "hydronic":
                v = c.value("heatingDistribution").lower()
                if c.known("heatingDistribution") and "hydronic" not in v: mismatch = True
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
                checks.append({"siding-assembly": "Verify the wall assembly, sheathing, flashing, clearances, installation instructions and local wildfire requirements; siding alone is not a fire-rated wall or a guarantee of survival.", "space-and-electrical": "Confirm space, electrical supply, condensate drainage and capacity.", "ventilation-design": "Confirm measured airflow, duct layout, climate and moisture-control design.", "roof-design": "Confirm roof condition, assembly ratings, structural loads and local requirements.", "reuse-code": "Confirm local reuse rules, storage sizing and separate nonpotable plumbing.", "fixture-fit": "Confirm actual flow rate, dimensions, pressure and installation compatibility."}.get(req, "Confirm installation requirements with a qualified professional."))
        if mismatch:
            continue
        if not p.get("reviewedAt"): checks.append("Product specifications need editorial verification.")
        if not all(n["confirmed"] for n in relevant): checks.append("Confirm the recorded home details before selecting equipment.")
        if p.get("verificationNotes"): checks.append(p["verificationNotes"])
        pillar = str(p.get("pillar", "")).lower()
        pillars = p.get("pillars") or [pillar]
        gap = max((c.gap(x.lower()) for x in pillars), default=0)
        group = "verification" if checks else "matched"
        matches.append(dict(productId=p["id"], group=group, reasons=[n["reason"] for n in relevant], verification=list(dict.fromkeys(checks)), _sort=(group != "matched", not all(n["confirmed"] for n in relevant), -int("fire-resistant-siding" in p.get("needTags", []) and "fire-resistant-siding" in home_needs), -gap, -len(relevant), {"Priority": 0, "Standard": 1, "Downgrade": 2}.get(p.get("weight"), 1), p.get("product", p.get("name", "")), p["id"])))
    matches.sort(key=lambda x: x["_sort"])
    return [{k: v for k, v in m.items() if k != "_sort"} for m in matches]
