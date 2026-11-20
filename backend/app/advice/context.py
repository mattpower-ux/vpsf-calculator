"""Evidence-aware advisory facts; never changes scoring inputs."""
from dataclasses import dataclass
from app.schemas import PropertyInput
from app.scoring.wildfire import has_matching_wildfire_risk

AMBIGUOUS = {"", "unknown", "none / unknown", "none", "code-minimum", "standard landscaping", "standard", "no accounting"}

@dataclass
class HomeContext:
    home: PropertyInput
    provenance: dict
    scores: dict
    budgets: dict

    def value(self, key):
        return str(getattr(self.home, key, "") or "").strip()

    def origin(self, key):
        return self.provenance.get(key, {}).get("origin", "unknown")

    def confirmed(self, key):
        return self.origin(key) == "user-confirmed"

    def known(self, key):
        if key in self.provenance and self.origin(key) == "unknown":
            return False
        value = self.value(key).lower()
        if value in {"", "unknown", "none / unknown"}:
            return False
        return self.confirmed(key) or self.origin(key) == "demo-assumption" or value not in AMBIGUOUS

    def evidence(self, key):
        return {"demo-assumption": "Provided home details; confirm conditions", "user-confirmed": "Homeowner-confirmed", "imported": "Imported record; verify details", "inferred": "Inferred; confirmation needed"}.get(self.origin(key), "Recorded; confirm details")

    def gap(self, pillar):
        budget = self.budgets.get(pillar, 0)
        return max(0, 1 - self.scores.get(pillar, 0) / budget) if budget else 0


def build_home_context(home, provenance, scores, budgets):
    raw = provenance or getattr(home, "provenance", {})
    return HomeContext(home, {k: v.model_dump() if hasattr(v, "model_dump") else v for k, v in raw.items()}, scores, budgets)


def needs(context):
    c = context
    result = {}
    def add(tag, field, reason):
        result[tag] = {"field": field, "reason": reason, "confirmed": c.confirmed(field)}
    if has_matching_wildfire_risk(c.home) and c.home.wildfire.nationalPercentile >= 70 and c.known("siding") and c.value("siding").lower() in {"wood clapboard", "wood siding", "cedar shingles", "engineered wood", "vinyl"}:
        add("fire-resistant-siding", "siding", f"{c.value('siding')} is recorded in an area with elevated USFS wildfire exposure; consider replacing it with noncombustible cladding.")
    hvac = c.value("hvac").lower()
    if c.known("hvac") and hvac in {"gas furnace", "oil furnace", "electric resistance", "boiler", "combination boiler", "hydronic heating"}:
        if c.value("hydronicSource") not in {"Ground-Source Heat Pump", "Air-to-Water Heat Pump"}:
            add("heating", "hvac", "Your recorded heating system is a candidate for an efficiency assessment.")
    wh = c.value("waterHeater").lower()
    if c.known("waterHeater") and not any(x in wh for x in ["heat pump", "solar", "combination", "combi"]):
        add("water-heating", "waterHeater", "Your recorded water heater is a candidate for an efficiency assessment.")
    land = c.value("irrigation").lower()
    if c.known("irrigation") and any(x in land for x in ["conventional irrigation", "standard irrigation", "sprinkler"]):
        add("irrigation", "irrigation", "Conventional irrigation is recorded; improved scheduling may reduce waste.")
    if c.known("leak") and "auto" not in c.value("leak").lower():
        add("leaks", "leak", "Automatic whole-home leak shutoff is not recorded in your confirmed selection.")
    if c.known("waterStandard") and c.value("waterStandard") == "Code-Minimum":
        add("fixtures", "waterStandard", "Your confirmed water standard warrants checking individual fixture flow rates.")
    if c.known("reuse") and c.value("reuse") == "None" and "irrigation" in result:
        add("rainwater", "reuse", "Outdoor watering is recorded without a rainwater reuse system.")
        add("graywater", "reuse", "Outdoor watering is recorded without water reuse; assess whether graywater is suitable.")
        # Both facts are necessary; confirming absence alone does not confirm demand.
        for tag in ("rainwater", "graywater"):
            result[tag]["confirmed"] = c.confirmed("reuse") and c.confirmed("irrigation")
    if c.known("ventilation") and not any(x in c.value("ventilation").lower() for x in ["balanced", "erv", "hrv"]):
        add("ventilation", "ventilation", "Your recorded ventilation warrants an airflow and balance assessment.")
    age = c.value("roofAge").lower()
    import re
    number = re.search(r"\d+", age)
    if c.known("roofAge") and number and int(number.group()) >= 20:
        add("roofing", "roofAge", "The recorded roof age warrants inspection before planning a replacement.")

    # Explicit selections only: no inference from scores, home age, missing data,
    # or raw R-values without an assembly/climate assessment.
    rules = [
        ("insulation", "temperatureProtection", {"none", "air sealing"}, "An insulation upgrade is not recorded in your temperature-protection selection; assess the envelope."),
        ("insulation", "insulation", {"none", "uninsulated", "no insulation"}, "No insulation is recorded; assess the assembly and climate-appropriate insulation."),
        ("air-sealing", "temperatureProtection", {"none", "insulation upgrade"}, "Air sealing is not recorded in your temperature-protection selection; assess leakage first."),
        ("windows", "windows", {"single pane", "single-pane", "single pane windows"}, "Single-pane windows are recorded; assess glazing and installation options."),
        ("solar", "solar", {"none"}, "No solar is recorded; assess site suitability and electricity use."),
        ("battery", "backup", {"none"}, "No backup power is recorded; assess critical loads and storage needs."),
        ("smart-thermostat", "heatingControls", {"standard thermostat"}, "A standard thermostat is recorded; check compatible control upgrades."),
        ("storm-protection", "windProtection", {"none"}, "No wind protection is recorded; assess local exposure and appropriate protection."),
        ("moisture-control", "moisture", {"standard moisture details"}, "Standard moisture details are recorded; review drainage and assembly details before upgrades."),
        ("ev-charging", "evReady", {"ev ready"}, "EV-ready infrastructure is recorded; verify circuit capacity and charging requirements."),
        ("toilets", "toilets", {"standard"}, "Standard toilets are recorded; verify flush volume before replacement."),
        ("faucets", "bathroomFaucets", {"standard"}, "Standard bathroom faucets are recorded; verify flow rates and fitting compatibility."),
        ("showerheads", "showerheads", {"standard"}, "Standard showerheads are recorded; verify flow rates and pressure."),
    ]
    for tag, field, values, reason in rules:
        if c.known(field) and c.value(field).lower() in values:
            add(tag, field, reason)
    if c.known("solar") and "battery" in c.value("solar").lower():
        result.pop("battery", None)
    if (has_matching_wildfire_risk(c.home) and c.home.wildfire.nationalPercentile >= 70
            and c.known("wildfireMitigation")
            and c.value("wildfireMitigation").lower() in {"none", "defensible space"}):
        add("ember-protection", "wildfireMitigation", "Elevated USFS wildfire exposure is recorded without ember protection; assess vulnerable openings.")
    # Other catalog tags are browse-only until the schema captures a relevant
    # condition or project intent (e.g. no accounting does not mean replace concrete).
    return result
