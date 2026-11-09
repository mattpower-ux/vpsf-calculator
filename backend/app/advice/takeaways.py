from app.advice.context import needs


def build_takeaways(c):
    items = []
    def add(pillar, field, finding, why, action, destination="insights"):
        items.append(dict(pillar=pillar, finding=finding, why=why, evidence=c.evidence(field) if c.known(field) else "Information gap", score=c.scores.get(pillar), max=c.budgets.get(pillar), action=dict(text=action, destination=destination)))
    hvac = c.value("hvac")
    if c.known("hvac"):
        efficient = any(x in hvac.lower() for x in ["heat pump", "geothermal", "condensing"]) or c.value("hydronicSource") in {"Ground-Source Heat Pump", "Air-to-Water Heat Pump"}
        source = c.value("hydronicSource")
        finding = f"The home record lists {hvac}" + (f", supplied by {source}." if c.known("hydronicSource") else ".")
        add("energy", "hvac", finding, "Heating efficiency depends on equipment, building heat loss and delivery temperatures; the equipment label alone does not establish annual savings.", "Maintain the installed system, verify its sizing and controls, and assess air leakage before considering replacement." if efficient else "Arrange a heating-load and distribution assessment; for hydronic heating, verify required water temperatures before comparing replacement options.", "insights" if efficient else "products")
    else:
        add("energy", "hvac", "The heating system is not sufficiently documented to select an equipment upgrade.", "Fuel, distribution and equipment condition determine which improvements are practical; the home's age cannot establish the age or efficiency of its heating system.", "Confirm heating type, fuel and installation age in the home details before comparing systems.", "details")
    n = needs(c)
    if "irrigation" in n:
        add("water", "irrigation", f"The home record lists {c.value('irrigation')}.", "Watering demand depends on landscape, weather and scheduling; controls can reduce avoidable watering without requiring a new landscape.", "Check leaks and watering schedules, then verify controller and valve compatibility before considering smart irrigation.", "products")
    elif "leaks" in n:
        add("water", "leak", f"Your water-protection selection is {c.value('leak')}.", "Hidden plumbing leaks can waste water and damage finishes; detection and automatic shutoff perform different jobs and require maintenance.", "Assess automatic leak shutoff with a plumber, including valve access and any fire-sprinkler connection.", "products")
    elif c.known("waterStandard") or c.known("irrigation"):
        field = "waterStandard" if c.known("waterStandard") else "irrigation"
        add("water", field, f"The water record lists {c.value(field)}.", "Indoor fixture performance and outdoor watering are separate sources of demand; one efficient feature does not establish whole-home water performance.", "Verify fixture flow rates and maintain existing conservation features; do not add irrigation where none is needed.")
    else:
        add("water", "waterStandard", "Fixture efficiency and outdoor watering practices need confirmation.", "A default water-standard selection does not establish actual toilet, faucet or showerhead performance. Conservation opportunities depend on the equipment and practices already in place.", "Confirm the water standard, leak protection and landscaping details, then compare measured flow rates with product labels.", "details")
    if c.known("moisture") and any(x in c.value("moisture").lower() for x in ["problem", "damp", "leak", "mold"]):
        add("health", "moisture", f"The moisture record notes {c.value('moisture')}.", "Persistent moisture can damage materials and support microbial growth; ventilation equipment cannot correct a plumbing leak or exterior water entry.", "Find and correct the moisture source with a qualified professional before selecting ventilation or finish products.")
    elif c.known("ventilation"):
        add("health", "ventilation", f"The home record lists {c.value('ventilation')} ventilation.", "Delivered fresh air, filtration and moisture-source control work together; the equipment name does not prove adequate airflow or healthy indoor air.", "Measure delivered airflow and maintain filters; review balance, occupancy needs and humidity control before adding equipment.", "products" if "ventilation" in n else "insights")
    else:
        add("health", "ventilation", "Ventilation performance is not documented; this is not a finding of unhealthy indoor air.", "Controlled fresh-air delivery and moisture management matter alongside pollutant-source control, especially after air sealing or window work.", "Confirm the ventilation system and inspect for moisture sources; an airflow assessment can identify the next useful improvement.", "details")
    risk = c.home.wildfire
    if risk and risk.status == "available" and risk.level in {"High", "Very High"}:
        hardened = "ember" in c.value("wildfireMitigation").lower() and "defensible" in c.value("wildfireMitigation").lower()
        add("resilience", "wildfireMitigation", f"USFS data indicates {risk.level.lower()} relative wildfire exposure at {risk.areaType or 'mapped area'} scale for {risk.areaName or 'this location'}.", "Area-level exposure is not an inspection of this house; roof edges, openings and nearby vegetation affect how embers can reach vulnerable materials.", "Maintain documented ember protection and defensible space; check local guidance and inspect vulnerable openings regularly." if hardened else "Verify ember-resistant openings and defensible space with local guidance before choosing hardening products.")
        items[-1]["evidence"] = "Sourced area-level risk; home protection requires verification"
    elif c.known("roof") or c.known("roofAge"):
        field = "roof" if c.known("roof") else "roofAge"
        finding = (f"The roof record lists {c.value('roof')}. " if c.known("roof") else "Roof material needs confirmation. ") + (f"Recorded age: {c.value('roofAge')}." if c.known("roofAge") else "Its age is unconfirmed.")
        add("resilience", field, finding, "Durability depends on condition, fastening, flashing and maintenance as well as material; a material label does not establish wind, hail or fire performance.", "Inspect roof condition and document installation details; match any replacement specification to verified local hazards.", "products" if "roofing" in n else "insights")
    else:
        add("resilience", "roof", "Roof condition and protective features need documentation before selecting a resilience upgrade.", "Local exposure and construction details work together. Unknown hazard data must not be treated as low risk or as evidence that a specific hazard exists.", "Confirm roof material, age and protection features, then review available location-risk sources and local requirements.", "details")
    return items
