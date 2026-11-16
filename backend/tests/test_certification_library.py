from copy import deepcopy
from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.certifications import (
    CertificateClaim, Library, catalog_for_library, get_reference_library,
    resolve_certifications,
)


def claim(program="watersense-homes", edition="2.0", level="Certified", **kw):
    return dict(programId=program, edition=edition, level=level,
                propertyAddress="123 Main St Unit 2", certificateId="cert-1",
                issuedDate="2025-04-01", **kw)


def home(*claims, **kw):
    return dict(address="123 Main St Unit 2", certifications=list(claims), **kw)


def test_fixture_inference_is_pure_traceable_and_never_invents_counts_or_age():
    raw = home(claim(), toilets="Standard", roofAge="Unknown")
    before = deepcopy(raw)
    result = resolve_certifications(raw)
    assert raw == before
    assert result["libraryVersion"] == "certifications-v1"
    assert {k: result["effectiveInput"][k] for k in ("toilets", "bathroomFaucets", "showerheads")} == {
        "toilets": "WaterSense", "bathroomFaucets": "WaterSense", "showerheads": "WaterSense"}
    assert result["effectiveInput"]["roofAge"] == "Unknown"
    assert not any("count" in k.lower() for k in result["effectiveInput"])
    for feature in result["derivedFeatures"]:
        assert feature["field"] == feature["target"]
        assert feature["ruleId"] and feature["sourceUrl"].startswith("https://www.epa.gov/")
        assert feature["certificateId"] == "cert-1"
        assert feature["libraryVersion"] == "certifications-v1"
        assert feature["clause"] and feature["certificate"]["issuedDate"] == "2025-04-01"


@pytest.mark.parametrize("field,value,provenance", [
    ("toilets", "Standard", {"toilets": {"origin": "user-confirmed"}}),
    ("toilets", "Unknown", {"toilets": {"origin": "user-confirmed"}}),
    ("toilets", "No", {}), ("toilets", "None", {}),
    ("toilets", "Low-flow", {}),
    ("toilets", "Standard", {"toilets": {"origin": "imported"}}),
])
def test_specific_values_and_explicit_negative_beat_certificate(field, value, provenance):
    result = resolve_certifications(home(claim(), **{field: value}, provenance=provenance))
    assert result["effectiveInput"][field] == value
    assert field not in [f["target"] for f in result["derivedFeatures"]]
    assert any(c["target"] == field for c in result["conflicts"])


@pytest.mark.parametrize("changes", [dict(edition="unknown"), dict(level="Gold"),
    dict(propertyAddress="123 Main St Unit 3"), dict(propertyAddress=""), dict(programId="other")])
def test_unmatched_claims_never_infer(changes):
    c = claim(); c.update(changes)
    result = resolve_certifications(home(c))
    assert result["derivedFeatures"] == []
    assert result["recognitions"][0]["reason"]


def test_duplicates_replacement_and_removal():
    c = claim(replacedFields=["toilets"])
    once = resolve_certifications(home(c))
    assert resolve_certifications(home(c, c)) == once
    assert "toilets" not in once["effectiveInput"]
    assert len(once["derivedFeatures"]) == 2
    assert resolve_certifications(home())["derivedFeatures"] == []
    assert "showerheads" not in resolve_certifications(home())["effectiveInput"]


def test_catalog_and_report_only_families():
    library = get_reference_library()
    catalog = catalog_for_library(library)
    assert catalog["version"] == "certifications-v1"
    assert len(catalog["programs"]) == 8
    passive = next(p for p in catalog["programs"] if p["id"] == "passive-house")
    assert any(e["id"].startswith("phius-") for e in passive["editions"])
    assert any(e["id"].startswith("phi-") for e in passive["editions"])
    for p in catalog["programs"]:
        for e in p["editions"]:
            assert e["label"] and e["levels"]
            for level in e["levels"]:
                result = resolve_certifications(home(claim(p["id"], e["id"], level)))
                assert result["recognitions"][0]["reportFacts"]
                if p["id"] in {"leed-residential", "ngbs-green", "passive-house", "fortified", "energy-star-homes"}:
                    assert result["derivedFeatures"] == []


def test_gold_is_balanced_not_erv_and_certified_is_report_only():
    gold = resolve_certifications(home(claim("indoor-airplus", "2", "Gold"), ventilation="None / Unknown"))
    assert gold["effectiveInput"]["ventilation"] == "Balanced"
    assert resolve_certifications(home(claim("indoor-airplus", "2", "Certified")))["derivedFeatures"] == []


def test_wildfire_base_and_plus_cladding_stays_report_only_without_trusted_review():
    c = claim("wildfire-prepared-home", "2025-12", "Base")
    result = resolve_certifications(home(c))
    assert result["effectiveInput"]["roofFireRating"] == "Class A"
    assert "siding" not in result["effectiveInput"] and "roof" not in result["effectiveInput"]
    c.update(level="Plus", status="document-supported", evidenceReference="document:inspection")
    assert "siding" not in resolve_certifications(home(c))["effectiveInput"]
    result = resolve_certifications(home(c, certificationEvidence={"cert-1": {"exceptionsReviewed": True}}))
    assert "siding" not in result["effectiveInput"]


def test_disabled_rule_never_derives_feature():
    data = get_reference_library().model_dump(mode="json")
    data["programs"][0]["editions"][0]["rules"][0]["enabled"] = False
    result = resolve_certifications(home(claim()), data)
    assert "toilets" not in result["effectiveInput"]
    assert result["effectiveInput"]["showerheads"] == "WaterSense"


def test_duplicate_certificate_with_replacement_cannot_reintroduce_replaced_feature():
    result = resolve_certifications(home(claim(), claim(replacedFields=["toilets"])))
    assert "toilets" not in result["effectiveInput"]


@pytest.mark.parametrize("changes", [dict(programId="x" * 81), dict(evidenceReference="x" * 1001),
    dict(status="verified"), dict(replacedFields=["x"] * 65), dict(issuedDate="not-a-date"),
    dict(execute="dangerous"), dict(propertyAddress="x" * 501)])
def test_claims_are_bounded(changes):
    c = claim(); c.update(changes)
    with pytest.raises(ValidationError):
        CertificateClaim.model_validate(c)


@pytest.mark.parametrize("changes", [dict(target="roofAge", value="New"),
    dict(target="ventilation", value="ERV"), dict(sourceUrl="https://epa.gov.evil.test/x"),
    dict(sourceUrl="http://www.epa.gov/x"), dict(expression="__import__('os')"),
    dict(precondition="run-code"), dict(levels=["Invented"]), dict(requirement="optional")])
def test_publication_rejects_unsafe_rules(changes):
    data = get_reference_library().model_dump(mode="json")
    data["programs"][0]["editions"][0]["rules"][0].update(changes)
    with pytest.raises(ValidationError):
        Library.model_validate(data)


def test_conflicting_rules_never_select_a_winner():
    data = get_reference_library().model_dump(mode="json")
    rules = data["programs"][0]["editions"][0]["rules"]
    other = deepcopy(rules[0]); other.update(id="alternate-toilet", value="Low-flow")
    rules.append(other)
    result = resolve_certifications(home(claim()), data)
    assert "toilets" not in result["effectiveInput"]
    assert any(c["reason"] == "conflicting-rules" for c in result["conflicts"])


def test_invalid_claims_and_bounded_claim_list_fail_closed():
    with pytest.raises(ValidationError):
        resolve_certifications(home(claim(issuedDateBad="invalid")))
    with pytest.raises(ValidationError):
        resolve_certifications(home(*[claim() for _ in range(33)]))


def test_seed_is_detached_and_duplicate_identifiers_rejected():
    data = get_reference_library().model_dump(mode="json")
    data["programs"].append(deepcopy(data["programs"][0]))
    with pytest.raises(ValidationError):
        Library.model_validate(data)
    lib = get_reference_library()
    lib.programs.clear()
    assert len(get_reference_library().programs) == 8


@pytest.mark.parametrize("claim_field,home_field,value", [
    ("propertyCity", "city", "Springfield"),
    ("propertyState", "state", "MA"),
    ("propertyZip", "zip", "01103"),
])
@pytest.mark.parametrize("actual", ["Different", "", None])
def test_supplied_geography_blocks_same_street_at_different_or_unknown_location(claim_field, home_field, value, actual):
    result = resolve_certifications(home(claim(**{claim_field: value}), **{home_field: actual}))
    assert result["derivedFeatures"] == []
    assert result["recognitions"][0]["reason"] == "property-mismatch"


def test_matching_geography_normalizes_only_case_and_whitespace():
    raw = home(claim(propertyCity=" Springfield ", propertyState="ma", propertyZip="01103"),
               city="SPRINGFIELD", state="MA", zip="01103")
    before = deepcopy(raw)
    assert len(resolve_certifications(raw)["derivedFeatures"]) == 3
    assert raw == before


@pytest.mark.parametrize("field,limit", [("propertyCity", 160), ("propertyState", 80), ("propertyZip", 20)])
def test_optional_geography_is_bounded(field, limit):
    assert getattr(CertificateClaim.model_validate(claim(**{field: "x" * limit})), field) == "x" * limit
    with pytest.raises(ValidationError):
        CertificateClaim.model_validate(claim(**{field: "x" * (limit + 1)}))


def test_future_issue_date_is_rejected_but_today_is_accepted():
    c = claim()
    c["issuedDate"] = date.today().isoformat()
    assert CertificateClaim.model_validate(c).issuedDate == date.today()
    c["issuedDate"] = (date.today() + timedelta(days=1)).isoformat()
    with pytest.raises(ValidationError):
        CertificateClaim.model_validate(c)


@pytest.mark.parametrize("field,label,program", [
    ("waterStandard", "WaterSense Home v2", "watersense-homes"),
    ("waterStandard", "HERS H2O", None),
    ("waterStandard", "WERS Rated", None),
    ("healthCert", "EPA Indoor airPLUS", "indoor-airplus"),
    ("healthCert", "WELL or Fitwel Residential", None),
    ("healthCert", "RESET Air or Equivalent", None),
    ("fortified", "FORTIFIED Gold", "fortified"),
    ("fortified", "FORTIFIED Silver", "fortified"),
    ("fortified", "Wildfire Prepared Home", "wildfire-prepared-home"),
    ("carbonStrategy", "Zero Carbon Certified", None),
    ("healthCert", "Custom certification", None),
])
def test_legacy_certificates_are_recognized_without_claims_or_inference(field, label, program):
    raw = {"address": "123 Main St Unit 2", field: label}
    before = deepcopy(raw)
    result = resolve_certifications(raw)
    assert result["effectiveInput"] == before and raw == before
    assert result["derivedFeatures"] == []
    assert len(result["recognitions"]) == 1
    recognition = result["recognitions"][0]
    assert recognition["reason"] == "legacy-claim-review"
    assert recognition["name"] == label
    assert recognition["programId"] == program
    assert recognition["legacyField"] == field
    assert recognition["reportFacts"] == []
    assert recognition["edition"] == "" and recognition["level"] == ""


@pytest.mark.parametrize("neutral", [None, "", "Unknown", "None", "No", "N/A", "Code-Minimum", "None / Unknown"])
def test_neutral_legacy_values_are_not_recognitions(neutral):
    result = resolve_certifications({field: neutral for field in ("waterStandard", "healthCert", "fortified", "carbonStrategy")})
    assert result["recognitions"] == []


@pytest.mark.parametrize("strategy", ["No Accounting", "Documented EPDs + CLF Benchmark", "Whole-Building LCA"])
def test_noncertificate_carbon_strategies_are_not_recognitions(strategy):
    assert resolve_certifications({"carbonStrategy": strategy})["recognitions"] == []


def test_legacy_label_does_not_add_features_to_explicit_claim():
    result = resolve_certifications(home(claim(), waterStandard="WaterSense Home v2"))
    assert len(result["derivedFeatures"]) == 3
    assert len(result["recognitions"]) == 2
    assert result["recognitions"][0]["reason"] == "matched"
    assert result["recognitions"][1]["reason"] == "legacy-claim-review"
