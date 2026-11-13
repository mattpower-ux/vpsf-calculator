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
        add("fire-resistant-siding", "siding", f"{c.value('siding')} is recorded in an area with elevated USFS wildfire exposure; assess noncombustible cladding.")
    hvac = c.value("hvac").lower()
    if c.known("hvac") and not any(x in hvac for x in ["heat pump", "geothermal", "condensing"]):
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
    if c.known("ventilation") and not any(x in c.value("ventilation").lower() for x in ["balanced", "erv", "hrv"]):
        add("ventilation", "ventilation", "Your recorded ventilation warrants an airflow and balance assessment.")
    age = c.value("roofAge").lower()
    import re
    number = re.search(r"\d+", age)
    if c.known("roofAge") and number and int(number.group()) >= 20:
        add("roofing", "roofAge", "The recorded roof age warrants inspection before planning a replacement.")
    return result
