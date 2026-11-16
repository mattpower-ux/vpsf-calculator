"""Reviewed local research seed; no runtime network or dependency on docs paths."""
from .schema import Library

VERSION = "certifications-v1"
REVIEWED = "2026-11-15"
WATER = "https://www.epa.gov/sites/default/files/2021-02/documents/watersense_final_homes_specification_v2.0.pdf"
AIR = "https://www.epa.gov/system/files/documents/2024-07/iap-v2-verification-requirements_508.pdf"
FIRE = "https://wildfireprepared.org/wp-content/uploads/WFPH-Technical-Standard-12-25.pdf"


def fact(description, source, clause):
    return dict(description=description, sourceUrl=source, clause=clause)


def edition(id, label, levels, scope, description, source, clause, rules=()):
    return dict(id=id, label=label, levels=levels, scope=scope,
                reportFacts=[fact(description, source, clause)], rules=list(rules))


def rule(id, levels, target, value, description, source, clause, conditional=False, exceptions="No exceptions identified for this mandatory category in the reviewed source."):
    return dict(id=id, levels=levels, target=target, value=value,
                **fact(description, source, clause), reviewedAt=REVIEWED, exceptions=exceptions,
                requirement="conditional" if conditional else "mandatory",
                precondition="documented-exceptions-reviewed" if conditional else "none")


def get_reference_library() -> Library:
    """Return a fresh validated snapshot. Caller edits cannot change the seed."""
    programs = []

    def add(id, name, issuer, editions):
        programs.append(dict(id=id, name=name, issuer=issuer, editions=editions))

    add("watersense-homes", "WaterSense labeled homes", "EPA", [edition(
        "2.0", "2.0 (February 2021)", ["Certified"], "Whole-home single-family or multifamily certification; not a product label or rating alone.",
        "Required fixture labels and specified leak checks at certification; no current leak-free or equipment-count claim.", WATER, "Sections 1–2; Appendix B, B-1",
        [rule("watersense-v2-" + target, ["Certified"], target, "WaterSense", description, WATER, "Appendix B, B-1")
         for target, description in [("toilets", "WaterSense-labeled toilets at certification"),
             ("bathroomFaucets", "WaterSense-labeled bathroom sink faucets at certification"),
             ("showerheads", "WaterSense-labeled showerheads at certification")]])])
    add("energy-star-homes", "ENERGY STAR Certified Homes", "EPA", [edition(
        "sfnh-3.2-rev14", "Single-Family New Homes national 3.2 Rev.14", ["Certified"], "National single-family new homes; regional and other program editions excluded.",
        "Edition-specific performance and field verification; installed equipment and actual energy rating require project reports.",
        "https://www.energystar.gov/sites/default/files/2025-01/National%20Program%20Requirements%20Version%203.2_Rev%2014.pdf", "Certification Process steps 1–4; Exhibit 2; footnotes 5, 10")])
    add("indoor-airplus", "EPA Indoor AirPlus", "EPA", [edition(
        "2", "Version 2 (July 2024)", ["Certified", "Gold"], "Completed residential certification at the stated tier.",
        "Mechanical ventilation and scoped material requirements; Gold requires balanced ventilation, not necessarily ERV.", AIR, "4.6.1; 6.1–6.7",
        [rule("iap-v2-gold-balanced", ["Gold"], "ventilation", "Balanced", "Balanced mechanical ventilation at certification", AIR, "4.6.1")])])
    leed_source = "https://www.usgbc.org/tools/leed-certification/residential"
    add("leed-residential", "LEED residential", "USGBC", [edition(id, label, ["Certified", "Silver", "Gold", "Platinum"], scope,
        "Applicable prerequisites and awarded level; optional feature selections require the final scorecard and awarded options.", leed_source, "Register: Identify your rating system; Certify: Certification levels") for id, label, scope in [
        ("homes-2008", "LEED for Homes v2008", "Legacy Homes; home-size-adjusted thresholds."),
        ("midrise-2010", "Homes Midrise Pilot v2010", "Legacy midrise pilot."),
        ("v4-homes-lowrise", "v4 BD+C Homes and Multifamily Lowrise", "Applicable lowrise residential scope and addenda."),
        ("v4-multifamily-midrise", "v4 BD+C Multifamily Midrise", "Multifamily midrise scope and addenda."),
        ("v4.1-single-family", "v4.1 Residential Single Family", "Single family and qualifying individually certified units."),
        ("v4.1-multifamily", "v4.1 Residential Multifamily", "Outside US/Canada; multifamily pathway."),
        ("v4.1-multifamily-core-shell", "v4.1 Residential Multifamily Core and Shell", "Outside US/Canada; dwelling equipment excluded from installation scope.")]])
    add("ngbs-green", "NGBS Green", "Home Innovation Research Labs", [edition(
        f"{year}-{path}", f"ICC 700 {year}: {label}", levels, label,
        "Applicable mandatory practices and verified award; individual equipment and optional practices require the verifier report.",
        "https://www.ngbs.com/get-certified/certification-types-levels", "Certification types and levels")
        for year in (2020, 2025) for path, label, levels in [
            ("new-construction", "New construction", ["Bronze", "Silver", "Gold", "Emerald"]),
            ("chapter-11", "Existing buildings, Chapter 11", ["Bronze", "Silver", "Gold", "Emerald"]),
            ("chapter-12", "Streamlined single-family, Chapter 12", ["Certified"])]])
    phius = "https://www.phius.org/sites/default/files/2026-10/Phius%20Certification%20Guidebook%20v26.1.2%20%281%29.pdf"
    phi = "https://univention.passiv.de/nextcloud/s/version10c-2023/download"
    add("passive-house", "Phius / Passive House Institute", "Phius; Passive House Institute (separate standards)", [
        edition("phius-2024-26.1.2", "Phius 2024, Guidebook 26.1.2", ["CORE Performance", "CORE Prescriptive", "ZERO Performance"],
            "Final completed-building certification; path-specific scope and retrofit exceptions apply.",
            "Path-specific modeled performance and tested airtightness; no fixed HVAC, ventilation type, solar or fuel assumption.", phius, "0.6.1; 1.3; 2.3; 3.3–3.5"),
        edition("phi-v10c-passive-house", "PHI v10c: Passive House", ["Classic", "Plus", "Premium"], "Final Passive House certification; PHPP 10.",
            "Passive House performance requirements; renewable balance does not identify rooftop PV or equipment.", phi, "2.1; Table 1; 3.2.9"),
        edition("phi-v10c-enerphit", "PHI v10c: EnerPHit", ["Classic", "Plus", "Premium"], "Completed retrofit; staged precertification excluded.",
            "EnerPHit retrofit criteria with applicable exceptions, distinct from Passive House thresholds.", phi, "2.2–2.2.4"),
        edition("phi-v10c-low-energy", "PHI v10c: Low Energy Building", ["Certified"], "Final PHI Low Energy Building certification, not Passive House Classic.",
            "Distinct Low Energy Building performance requirements, not measured equipment performance.", phi, "2.3; Table 5")])
    add("fortified", "FORTIFIED Home", "IBHS", [edition(
        "2025-" + peril, "2025 FORTIFIED Home: " + label, ["Roof", "Silver", "Gold"], "Eligible single-/two-family homes; " + label + "; optional hail supplement is not implied.",
        "Designation-specific roof, opening and structural requirements; no roof material, age, noncombustible siding or universal impact-glass claim.",
        "https://fortifiedhome.org/wp-content/uploads/2025-FORTIFIED-Home-Standard.pdf", "1.1–1.3; 2.2; Sections 3–7")
        for peril, label in [("hurricane", "Hurricane"), ("high-wind", "High Wind")]])
    fire = edition("2025-12", "December 2025 (effective June 2026; 2026 bulletins)", ["Base", "Plus"], "Eligible Wildfire Prepared Home dwelling; not Multifamily. Historical evidence, not current maintenance verification.",
        "Base requires Class A roofing and a six-inch noncombustible wall-base strip; Plus requires noncombustible wall coverings with scoped decorative-feature allowances.", FIRE, "2.1.1; 2.1.4; 3.1.4", [
            rule("wfph-2025-roof-class-a", ["Base", "Plus"], "roofFireRating", "Class A", "Class A roof assembly at certification; no material or age inference", FIRE, "2.1.1, p.8"),
            rule("wfph-2025-plus-cladding", ["Plus"], "siding", "Noncombustible", "Noncombustible wall cladding, not the composition of every decorative element", FIRE, "3.1.4, p.14", True,
                 "Review WP 2026-01 decorative wood members and WP 2026-02 isolated coated-foam features. Neither permits combustible wall cladding; retain inspection/product evidence.")])
    fire["reportFacts"].extend([
        fact("Scoped decorative wood allowances require plans or field verification; not permission for wood siding.", "https://wildfireprepared.org/wp-content/uploads/TechnicalBulletin-DecorativeWoodElements.pdf", "WP 2026-01, pp.1–3"),
        fact("Isolated coated-foam features require specified testing and separation; continuous EIFS excluded.", "https://wildfireprepared.org/wp-content/uploads/WP-TB-Stucco-Coated-Foam-Shutters-and-Architectural-Features.pdf", "WP 2026-02, pp.1–2")])
    add("wildfire-prepared-home", "Wildfire Prepared Home", "IBHS", [fire])
    return Library.model_validate(dict(version=VERSION, reviewedAt=REVIEWED, programs=programs))


def catalog_for_library(library):
    library = Library.model_validate(library.model_dump() if isinstance(library, Library) else library)
    return {"version": library.version, "programs": [
        {"id": p.id, "name": p.name, "editions": [
            {"id": e.id, "label": e.label, "levels": list(e.levels)} for e in p.editions]}
        for p in library.programs]}


def get_ui_catalog():
    return catalog_for_library(get_reference_library())
