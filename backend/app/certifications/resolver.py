"""Pure certificate resolution against raw inputs, never the previous effective record."""
from copy import deepcopy
import json

from .schema import Claims, Library
from .seed import get_reference_library

DEFAULTS = {"toilets": {"Standard"}, "bathroomFaucets": {"Standard"},
            "showerheads": {"Standard"}, "ventilation": {"None / Unknown"}}


def _address(value):
    # Do not strip unit identifiers, infer geography, or fuzzy-match addresses.
    return " ".join(str(value or "").casefold().split())


def _missing(raw, target):
    value = raw.get(target)
    provenance = raw.get("provenance", {}).get(target, {})
    if hasattr(provenance, "model_dump"):
        provenance = provenance.model_dump()
    origin = provenance.get("origin", "unknown") if isinstance(provenance, dict) else "unknown"
    if origin == "user-confirmed" and target in raw:
        return False
    if value is None or (isinstance(value, str) and value.strip().casefold() in {"", "unknown"}):
        return True
    return (origin in {"unknown", "demo-assumption"}
            and isinstance(value, str) and value in DEFAULTS.get(target, set()))


def _property_matches(claim, raw):
    if not _address(claim.propertyAddress) or _address(claim.propertyAddress) != _address(raw.get("address")):
        return False
    return all(not supplied or _address(supplied) == _address(raw.get(field))
               for supplied, field in ((claim.propertyCity, "city"),
                                       (claim.propertyState, "state"),
                                       (claim.propertyZip, "zip")))


def _legacy_recognitions(raw):
    neutral = {"", "unknown", "none", "no", "n/a", "code-minimum", "none / unknown"}
    known = {
        ("waterStandard", "watersense home v2"): "watersense-homes",
        ("healthCert", "epa indoor airplus"): "indoor-airplus",
        ("fortified", "fortified roof"): "fortified",
        ("fortified", "fortified bronze"): "fortified",
        ("fortified", "fortified silver"): "fortified",
        ("fortified", "fortified gold"): "fortified",
        ("fortified", "wildfire prepared home"): "wildfire-prepared-home",
    }
    for field in ("waterStandard", "healthCert", "fortified", "carbonStrategy"):
        value = raw.get(field)
        if not isinstance(value, str) or _address(value) in neutral:
            continue
        # The carbon field also holds ordinary disclosure/accounting strategies.
        if field == "carbonStrategy" and _address(value) != "zero carbon certified":
            continue
        yield dict(name=value, programId=known.get((field, _address(value))),
                   legacyField=field, reason="legacy-claim-review", status="reported",
                   edition="", level="", certificate=None, reportFacts=[])


def resolve_certifications(property_dict: dict, library=None) -> dict:
    """Resolve a raw record without side effects or network calls.

    The caller gates use on its scoring-model library version. Recompute from
    raw inputs after certificate removal; never persist effectiveInput as raw.
    Conditional rules remain report-only until a trusted review mechanism exists.
    Unknown editions/levels remain recognition-only.
    """
    library = get_reference_library() if library is None else Library.model_validate(
        library.model_dump() if isinstance(library, Library) else library)
    claims = Claims(certifications=property_dict.get("certifications", [])).certifications
    replacements = {}
    def identity(claim):
        return (claim.programId, claim.edition, claim.level, claim.certificateId,
                claim.issuedDate, _address(claim.propertyAddress),
                _address(claim.propertyCity), _address(claim.propertyState), _address(claim.propertyZip))
    for claim in claims:
        replacements.setdefault(identity(claim), set()).update(claim.replacedFields)
    raw = deepcopy(property_dict)
    result = dict(effectiveInput=deepcopy(raw), derivedFeatures=[], recognitions=[],
                  conflicts=[], libraryVersion=library.version)
    programs = {p.id: p for p in library.programs}
    candidates = {}
    seen = set()
    # Duplicate claims are also removed from the effective snapshot, never raw.
    normalized_claims = []
    for claim in claims:
        certificate = claim.model_dump(mode="json")
        certificate["replacedFields"] = sorted(replacements[identity(claim)])
        key = json.dumps(certificate, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        normalized_claims.append(certificate)
        program = programs.get(claim.programId)
        edition = next((e for e in program.editions if e.id == claim.edition), None) if program else None
        reason = ("unknown-program" if not program else "unknown-edition" if not edition
                  else "unknown-level" if claim.level not in edition.levels
                  else "property-mismatch" if not _property_matches(claim, raw) else "matched")
        recognition = dict(certificate=certificate, programId=claim.programId,
                           edition=claim.edition, level=claim.level, reason=reason,
                           status=claim.status, reportFacts=[])
        result["recognitions"].append(recognition)
        if reason != "matched":
            continue
        recognition["reportFacts"] = [f.model_dump(mode="json") for f in edition.reportFacts]
        for rule in edition.rules:
            if not rule.enabled or claim.level not in rule.levels or rule.target in replacements[identity(claim)]:
                continue
            if rule.precondition == "documented-exceptions-reviewed":
                # A client assertion is not a trusted review of project exceptions.
                continue
            feature = dict(field=rule.target, target=rule.target, value=rule.value, ruleId=rule.id,
                           libraryVersion=library.version, sourceUrl=rule.sourceUrl,
                           clause=rule.clause, certificateId=claim.certificateId,
                           certificate=certificate, programId=claim.programId,
                           edition=claim.edition, level=claim.level,
                           timeBasis="at-certification", issuedDate=certificate["issuedDate"],
                           description=rule.description, exceptions=rule.exceptions)
            candidates.setdefault(rule.target, []).append(feature)
    if "certifications" in raw:
        result["effectiveInput"]["certifications"] = normalized_claims
    # Preserve historical labels without manufacturing claims or rule candidates.
    result["recognitions"].extend(_legacy_recognitions(raw))
    for target, features in candidates.items():
        values = {f["value"] for f in features}
        if not _missing(raw, target):
            if any(raw.get(target) != value for value in values):
                result["conflicts"].append(dict(field=target, target=target, reason="specific-input-wins",
                    currentValue=raw.get(target), candidates=features))
            continue
        if len(values) != 1:
            result["conflicts"].append(dict(field=target, target=target, reason="conflicting-rules", candidates=features))
            continue
        # One effective feature per field; preserve every supporting rule/claim.
        feature = deepcopy(features[0])
        feature["supportingEvidence"] = features
        result["derivedFeatures"].append(feature)
        result["effectiveInput"][target] = feature["value"]
    return result
