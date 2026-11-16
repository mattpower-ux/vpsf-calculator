# Certification reference package

Public imports are available from `app.certifications`:

```python
from app.certifications import (
    CertificateClaim, Library, get_reference_library,
    catalog_for_library, resolve_certifications,
)

library = get_reference_library()  # fresh, validated certifications-v1 snapshot
published_payload = library.model_dump(mode="json")
publication_schema = Library.model_json_schema()
validated_publication = Library.model_validate(published_payload)
catalog = catalog_for_library(validated_publication)
resolution = resolve_certifications(raw_property_dict, validated_publication)
```

`PublishedLibrary` aliases `Library`; `get_ui_catalog()` returns the seed catalog.
Library fields: `version`, `reviewedAt`, `status` (`published`), `programs`.
Programs contain `id`, `name`, `issuer`, `editions`. Editions contain `id`,
`label`, `levels`, `scope`, `reportFacts`, `rules`. Source facts contain
`description`, `sourceUrl`, `clause`. Rules additionally contain `id`, `enabled`
(default true), `levels`, `target`, `value`, `requirement`, `status`,
`precondition`, `exceptions`, `reviewedAt`. Unknown fields are rejected.

The catalog is `{version, programs: [{id, name, editions: [{id, label, levels}]}]}`.
Use these edition IDs in claims; do not submit display labels as IDs.

Claims are bounded and contain `programId`, `edition`, `level`,
`propertyAddress`, optional `propertyCity` (160 characters), `propertyState`
(80 characters), `propertyZip` (20 characters), `certificateId`,
`issuedDate` (ISO date or null; future dates rejected using the server date),
`evidenceReference`, `status` (`reported` or `document-supported`) and
`replacedFields`. The raw property's `certifications` list permits at most 32
claims. Status preserves the submitted evidence category; it does not assert
server verification or certificate authenticity. Evidence references are opaque
strings and are never dereferenced.

The pure resolver returns `effectiveInput`, `derivedFeatures`, `recognitions`,
`conflicts`, `libraryVersion`. Derived features have both `field` and `target`,
`value`, `ruleId`, `libraryVersion`, `sourceUrl`, `clause`, `certificateId`,
the full `certificate`, `programId`, `edition`, `level`, `issuedDate`,
`timeBasis` (`at-certification`), `description`, `exceptions`, and
`supportingEvidence`. One field produces at most one derived feature; multiple
supporting certificates do not multiply it. Recognitions distinguish unmatched
claims using `reason` and attach sourced `reportFacts` only for matched claims.
Conflicts include the field, reason and candidate evidence. No points are awarded
by this package.

Nonneutral legacy `waterStandard`, `healthCert`, and `fortified` labels, plus
`carbonStrategy = Zero Carbon Certified`, produce recognition-only records with
`reason = legacy-claim-review`, `name` (the original display label), `legacyField`,
and `programId` when known (otherwise null). They have no inferred edition,
level, certificate or report facts and never enter feature resolution. Raw history
is preserved; ordinary carbon-disclosure strategies are not certificate claims.
An independently submitted structured claim is required for edition-specific
inference, even when a legacy display label mentions a version.

Raw input is never mutated. Reassessment/removal must start from raw inputs,
not a previous `effectiveInput`. Provenance with `user-confirmed`, `imported`
or `inferred` origins protects nonempty values. Explicit `No` and `None` always
win, and a user-confirmed `Unknown` remains unknown after a correction.
Other empty/Unknown fields can be filled; fixture `Standard` and ventilation
`None / Unknown` are default-looking only without specific provenance.
Address matching folds case and whitespace, preserving all unit, state and ZIP
text. When optional city/state/ZIP claim fields are supplied, each must match
the corresponding raw property field; missing property geography blocks matching.
Omitted claim geography remains backward compatible, so callers should capture
these fields when adding claims to avoid ambiguity between identical street names.
It does not geocode, append geography, fuzzy-match, or infer an edition
from an issue date. Unknown edition, unknown level or mismatched address blocks
inference. Replaced fields are suppressed across duplicate records of the same
certificate identity.

The published seed infers WaterSense v2 fixture categories, Indoor AirPlus v2
Gold `Balanced` ventilation, and the reviewed wildfire edition's `Class A`
roof rating. The allowlist includes `siding = Noncombustible`, restricted to the
exact reviewed Wildfire Plus edition and a conditional exception-review rule.
**All conditional rules remain report-only in this release**: there is no trusted
review mechanism, and client flags cannot enable them. The initial release has
no counts, equipment-age, optional-credit, ERV, material-product or blanket
certification inference. PHI and Phius have separate editions under one family.

All source links are references only. Rules are bounded data with fixed
preconditions and exact target/value pairs; they cannot execute formulas,
scripts, or remote fetches. The caller owns authentication, publication audit,
immutable storage/cache, scoring-model version gating and raw/effective snapshot
storage. This package deliberately performs none of those persistence tasks.
