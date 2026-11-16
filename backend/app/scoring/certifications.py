"""Pure, fail-closed migration from certificate packages to physical features.

Publication and live/draft reconciliation belong to the store's caller. Historical
models are never edited here, and a conflict must be reviewed before publication.
"""

from app.schemas import PropertyInput
from app.scoring.catalog import Factor, ScoreModel, factor_points


CERTIFICATION_LIBRARY_VERSION = "certifications-v1"
CERTIFICATION_MODEL_SUFFIX = "-certifications-v1"
_CERTIFICATE_BASELINES = {
    "fortified": "None",
    "healthCert": "None",
    "waterStandard": "Code-Minimum",
}
_CERTIFICATE_CHOICES = {
    "fortified": {"FORTIFIED Gold", "FORTIFIED Silver", "FORTIFIED Bronze", "Wildfire Prepared Home"},
    "healthCert": {"WELL or Fitwel Residential", "EPA Indoor airPLUS", "RESET Air or Equivalent"},
    "waterStandard": {"WaterSense Home v2", "HERS H2O", "WERS Rated"},
}
_ZERO_CARBON = "Zero Carbon Certified"


class CertificationMigrationConflict(ValueError):
    """A custom rule cannot be migrated without an administrator's decision."""


def _conflict(factor: Factor, reason: str) -> None:
    raise CertificationMigrationConflict(
        f"Certification migration conflict for factor {factor.id!r} "
        f"({factor.field}): {reason}"
    )


def _baseline(factor: Factor, neutral: str) -> int:
    # A single constant cannot preserve different uncertified/unknown baselines.
    values = {factor.options.get(value, factor.default)
              for value in (neutral, "Unknown", "", "None")}
    if values != {factor.default}:
        _conflict(factor, "uncertified and unknown baselines differ; review required")
    return factor.default


def _fixture_factors() -> list[Factor]:
    return [
        Factor(id=id_, label=label, pillar="water", field=field, mode="lookup",
               options={"Unknown": 0, "Standard": 0, "Low-flow": low_flow, "WaterSense": 5},
               default=0)
        for id_, label, field, low_flow in (
            ("toilets", "Efficient toilets", "toilets", 4),
            ("bathroom_faucets", "Efficient bathroom faucets", "bathroomFaucets", 3),
            ("showerheads", "Efficient showerheads", "showerheads", 5),
        )
    ]


def with_certification_features(model: ScoreModel) -> ScoreModel:
    """Return an independent, validated model linked to certifications-v1.

    Dedicated certificate lookups become constant *existing* baseline factors;
    carbon's noncertificate disclosure options retain their current allocations.
    No global offsets are introduced. Ambiguous predicates, split allocations,
    and fixture collisions stop the migration instead of discarding custom work.
    Applying this function repeatedly produces identical model content.
    """
    if model.certificationLibraryVersion not in (None, CERTIFICATION_LIBRARY_VERSION):
        raise CertificationMigrationConflict(
            f"Model requires a different certification library: {model.certificationLibraryVersion}"
        )
    result = model.model_copy(deep=True)
    for factor in result.factors:
        if not factor.active:
            continue
        if factor.field in _CERTIFICATE_BASELINES:
            if factor.mode != "lookup" or factor.parentId:
                _conflict(factor, "custom certificate condition or split allocation requires review")
            known = _CERTIFICATE_CHOICES[factor.field] | {
                _CERTIFICATE_BASELINES[factor.field], "Unknown", "", "None",
            }
            if set(factor.options) - known:
                _conflict(factor, "unrecognized certificate choices may include physical features; review required")
            baseline = _baseline(factor, _CERTIFICATE_BASELINES[factor.field])
            factor.options = {choice: baseline for choice in factor.options}
        elif factor.field == "carbonStrategy":
            if factor.mode == "lookup":
                if _ZERO_CARBON in factor.options:
                    if factor.parentId:
                        _conflict(factor, "split certificate allocation requires review")
                    factor.options[_ZERO_CARBON] = _baseline(factor, "No Accounting")
            elif factor_points(PropertyInput(carbonStrategy=_ZERO_CARBON), factor):
                _conflict(factor, "custom condition awards certificate points; review required")
        elif factor.field == "roofFireRating":
            _conflict(factor, "roof fire rating is report-only; custom scoring requires review")

    for fixture in _fixture_factors():
        existing = [f for f in result.factors if f.active and f.field == fixture.field]
        if existing:
            # Reuse an equivalent category rule, including renamed admin rules.
            if len(existing) != 1:
                _conflict(existing[0], "multiple fixture rules could double-count the category")
            candidate = existing[0]
            ignored = {"id", "label", "source"}
            if candidate.model_dump(exclude=ignored) != fixture.model_dump(exclude=ignored):
                _conflict(candidate, "existing fixture allocation differs from the approved category weights")
        else:
            collision = next((f for f in result.factors if f.id == fixture.id), None)
            if collision is not None:
                _conflict(collision, "fixture factor ID is already in use")
            result.factors.append(fixture)

    if not result.version.endswith(CERTIFICATION_MODEL_SUFFIX):
        result.version += CERTIFICATION_MODEL_SUFFIX
    result.certificationLibraryVersion = CERTIFICATION_LIBRARY_VERSION
    return ScoreModel.model_validate(result.model_dump())
