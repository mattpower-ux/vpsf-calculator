# Certification recognition without certification points

Date: November 15, 2026
Status: SUPERSEDED by certifications/implementation-design.md. Retained as audit history only; no scoring or production changes applied. The user subsequently chose certification-derived feature discovery, not recognition alone.

## Approved intent

Recognize a home's green-building certifications quietly as optional documentation. VPSF evaluates the underlying home features rather than awarding points for the certification name. Keep questions simple and backend provenance out of the main homeowner flow.

## Code audit

The repository currently awards substantial certification-dependent points in both backend/scoring seed rules and the frontend fallback calculator. These are repository defaults, not a verified export of the currently published administrator model.

| Field / factor | Existing rule | Maximum additional points versus baseline |
| --- | --- | --- |
| fortified | FORTIFIED Gold 160 versus None 40 | 120 Resilience |
| healthCert / health_cert | WELL or Fitwel Residential 120 versus None 40 | 80 Health |
| waterStandard / water_standard | WaterSense Home v2 60 versus Code-Minimum 20 | 40 Water |
| carbonStrategy / carbon_strategy | Zero Carbon Certified 120 versus No Accounting 30 | 90 Carbon |

Other certification options also award points. HERS H2O and WERS are currently represented by rating names without actual numeric water-performance results. Those labels must not earn points either. The HERS energy input contains numeric performance bands and is a separate issue from a certification badge; retain its current scoring in this change.

Relevant files: backend/app/scoring/seed.py, engine.py, catalog.py, store.py; frontend/src/App.jsx, analysisCompleteness.js, recordedFeatures.js, resilienceFeatures.js, AnalysisFlow.jsx and admin/weightingRationale.js. Recommendations, report output and OCR/import provenance must be checked as consumers.

The published scoring model is database-versioned. Editing only the seed would not reliably update an existing deployment. Previous assessments must retain their original model version and results.

## Homeowner presentation

1. Add one collapsed, optional `Certifications & Recognition` section within Add Supporting Information. It is available in Informed and Superior, and in later editing; Basic does not gain a required question.
2. Support multiple entries with program name, optional level and year, and optional supporting document. Use a short suggested-program list with Other. Do not require users to complete a program-specific questionnaire.
3. Reuse the existing document-upload flow and its storage/access controls for certificate evidence. Do not build a second file store. Allow a recognition entry without evidence.
4. Display recorded recognitions as a quiet text line near the bottom of the home overview and a compact report entry below the scorecard. Expand to see details. No oversized badges, sponsor-style styling or points.
5. Hide results/report recognition sections when there are no entries. In the editing form, keep the optional section available.
6. Certification absence must not appear as a home weakness, required documentation gap, negative recommendation or incomplete-performance criterion.

Example: `Certifications & Recognition — LEED Gold · 2021`.

## Evidence and data

Add a bounded recognition list to the property record. Each entry stores program, level, year, scope, source and optional evidence reference. Store homeowner-reported versus document-supported provenance separately. Scope distinguishes whole-home credentials from product labels; do not treat a certified appliance as a certified home.

Validate lengths, count, year and evidence-reference ownership on the server. Render text safely. Recognition metadata must not be selectable as a scoring field through the admin editor.

Normalize existing fortified, healthCert and waterStandard certificate labels into recognition entries without inventing levels, award dates or verified status. Convert the `Zero Carbon Certified` label into recognition while leaving genuinely recorded EPD/material information intact. Keep legacy values readable for old assessments and backward compatibility.

Uploaded certificates may support actual feature inputs only where their contents explicitly document those features. Record source and provenance using existing mechanisms and let homeowners correct extracted facts. A program name alone must not imply air leakage, insulation, equipment efficiency or other features. Do not automatically translate old certificate bonuses into new physical attributes.

## Scoring transition

1. Export and inspect the active published model and any pending admin draft before implementing the migration. Check custom factors as well as default IDs.
2. Create a new model version. Remove certification-dependent variation while preserving the prior uncertified baseline for affected pillars. This is a neutral baseline, not a bonus for lacking certification.
3. Remove the Zero Carbon Certified option's bonus; retain existing feature/documentation choices such as EPDs and material disclosure.
4. Preserve existing physical-feature weights, pillar caps and 1,000-point total. Do not silently redistribute removed points or rescale scores.
5. Calculate and document attainable pillar maxima and representative before/after scores. Some pillars may no longer reach their nominal cap with currently available feature rules. Any later calibration needs a separate evidence-based model decision; do not hide this effect through normalization.
6. Apply equivalent behavior to backend evaluation, frontend fallback, recommendation gain estimates and admin rationale. For new models, prevent active certificate-label factors from being published. Historical model payloads remain readable and reproducible.
7. Preserve saved assessments exactly. Explicit reassessment uses the new version. Retain an audit record and idempotent upgrade behavior. Preserve unrelated administrator edits and detect conflicting drafts rather than overwriting them silently.

## Verification and release

- Identical physical features with different recognition entries produce identical new-model scores and recommendation gains.
- Each legacy certification label also has no incremental effect under the new model.
- Actual feature changes still receive their existing credit, with no certificate double-counting.
- Missing certification does not reduce documentation completeness or generate a gap question.
- Recognition data survives edit, save, restore, imports, report download and reassessment.
- Old published model results remain reproducible; migration is idempotent and preserves unrelated administrator changes.
- Test invalid and oversized entries, unauthorized evidence references, unsafe URLs/text, and admin attempts to add certification points.
- Inspect phone and laptop layouts: collapsed form, multiple recognitions, no-recognition results, and single-page PDF fit.
- Run targeted backend/frontend regression suites and production build; compare active-model before/after fixtures before deployment through GitHub and Render.

## Review boundary

This is a scoring-model migration, not only a visual metadata addition. Review this design before implementation planning and production changes. In particular, the proposal preserves uncertified baselines and does not invent replacement weights to fill the capacity formerly supplied by certifications.
