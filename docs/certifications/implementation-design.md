# Certification-derived feature discovery

Date: 2026-11-15
Status: approved implementation, November 15, 2026. See integration-progress.md for verification and deployment. The runtime supports all eight families with conservative exact-edition mappings; unsupported and conditional requirements remain recognition/report-only.

## Outcome

Use a home's certification as evidence of specific required features. Populate missing physical-feature information, then apply the ordinary VPSF model once per feature. Keep certification recognition quiet. Cover WaterSense, ENERGY STAR homes, Indoor AirPlus, LEED residential, NGBS Green, Phius/Passive House, FORTIFIED and Wildfire Prepared Home. Phius and Passive House Institute require separate rule sets.

## Library and administration

Store a versioned reference library in the VPSF API database, seeded from reviewed project data. Host it on the existing Render API, not a third-party service. Use the existing admin authentication for drafts, edits and publication. Each publication is immutable and audited; evaluation reads an in-memory cached published snapshot. No live web search or generative model is needed at scoring time.

Each program edition contains:

- Stable program ID, issuer, version/revision, levels, residential scope and applicable jurisdiction/path.
- Effective-date information and separately the actual certificate date; never resolve an edition by date alone when overlap is possible.
- Rules with a stable ID, concise feature description, mandatory/conditional/optional status, exact clause/page, official URL and review date.
- Preconditions, permitted exceptions, target field/value, and whether the target is already supported or report-only.
- Status: recognition-only, candidate, or published inference rule. Having a reference entry does not imply every requirement is production-ready.

The admin list shows coverage, source links and unresolved mappings. Admins can revise rules, but publish requires valid field/value mappings and an official source. Arbitrary code, formulas, remote fetch instructions and uncontrolled source URLs are not executable rules. Source links are references only.

## Property evidence

Store certificate claims with program/version/level, scope, issue date, issuer or certificate identifier where available, evidence reference, and reported/document-supported status. OCR may extract a candidate claim; it must not manufacture certificate authenticity. Match the claim to the assessed property, including unit, before applying it.

For each derived feature retain rule/library version, certificate ID, underlying clause, value and time basis. Keep observed/reported facts separate from derived values. Resolve an effective record for scoring without permanently replacing the raw facts. Removing a certificate therefore removes its derived features on reassessment, while explicit user edits survive.

Resolve conflicts deterministically:

1. Specific current documents/measurements and explicit homeowner confirmations take priority.
2. Certificate-derived requirements fill genuinely unknown fields only. A default-looking value without provenance is not a confirmed answer; an explicit No/None is.
3. Conflicting specific evidence triggers one targeted question; do not pick the higher-scoring claim.
4. Unknown program edition, scope, relevant exception or certificate/property mismatch prevents automatic inference.
5. Optional credits require the actual project scorecard. A certification level alone cannot select its optional credits.
6. Older certificates describe installation at certification. Capture relevant replacement information; do not infer equipment age from certification date. Known replaced features no longer inherit the old certificate's assumption. Unknown validity/status remains visible in admin rather than presented as verified.

## Scoring and report behavior

First release must retire direct certificate bonuses in a new scoring-model version when enabling derived feature credits. Do not stack the old WaterSense/health/FORTIFIED package points with new feature points. Preserve existing uncertified baselines for unrelated evaluations; do not add new blanket offsets or normalize scores upward.

Before publishing, inspect the live administrator model and draft for custom certification factors; do not rely only on seed IDs. Preserve unrelated custom rules and stop a conflicting draft from being overwritten. Saved score runs retain their model and library versions and effective input snapshot.

Some reference facts currently have no exact PropertyInput representation. Add narrowly defined fields only where needed. In particular, WaterSense fixture-category inputs are absent from this checkout's built-in schema. Define toilets, bathroom sink faucets and showerheads explicitly before mapping them; certificate alone cannot infer quantities. Reuse previously approved fixture-category weights only with confirmed scope, and never multiply by an invented fixture count. Other unmapped facts remain useful report information and receive no fabricated points.

The homeowner sees a small line such as `Fixture details filled from your WaterSense certification` and can review/correct. The report distinguishes features supported by a certification from homeowner-entered facts, without filling the page with caveats. Sources and complete rule logic stay in admin. Manufacturer leads may include the resulting feature needs but must not receive documents or private certificate evidence automatically.

## Initial mapping policy

- WaterSense v2: candidate fixture-label defaults for toilets, bathroom faucets and showerheads. Dishwasher, irrigation and automatic shutoff are not implied.
- ENERGY STAR SFNH: record certification and verification facts; obtain the actual rating and equipment report rather than infer a fixed equipment package or HERS number.
- Indoor AirPlus v2 Gold: balanced ventilation is a supported candidate. Certified tier is only general mechanical ventilation. Keep material/filtration claims at their actual scope.
- LEED and NGBS: distinguish prerequisites/mandatory items from optional point choices; project scorecards drive optional feature discovery.
- Phius and PHI: keep standards separate; record performance requirements and obtain equipment/test details. Do not infer fuel, solar, window product, or exact test measurement from a generic label.
- FORTIFIED: distinguish roof/silver/gold and peril/version; a roof designation does not establish noncombustible siding.
- Wildfire Prepared Home: distinguish Base and Plus and applicable edition. Infer only the specified assembly/feature, not a preferred material or manufacturer. Class A roofing is not synonymous with metal roofing.

## Verification

Use paired fixtures for each program: valid edition/level, unknown edition, optional-credit omission, stale/replaced feature and contradictory current information. Check exact fields and score deltas. Duplicate certificates must not increase points; removing a certificate must remove only its derived assumptions. Report-only rules must never influence scores. Identical effective features must produce identical scores regardless of certificate source.

Test migration idempotence, historical reproducibility, custom admin draft preservation, immutable library publications, revision conflicts, authorization, malformed claims, bounded payloads and safe evidence access. Exercise Basic/Informed/Superior, upload/restore/report and phone/laptop correction flows. Build frontend and run backend/frontend regression suites. Deploy only after the model transition and UI paths have been verified together.

## Approval and release boundary

The user approved the eight-family library and requested calculator integration on November 15, 2026. Implementation follows that scope and the existing GitHub/Render deployment workflow. Runtime publications are versioned separately from this research index; new evidence does not rewrite historical score runs. See integration-progress.md for completed verification and live deployment identifiers.
