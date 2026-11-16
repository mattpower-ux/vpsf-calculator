# Admin certification QA — 2026-11-15

Tested real headless Chrome (Playwright bundled runtime, Chrome channel) against frontend http://127.0.0.1:5197 and API http://127.0.0.1:8197, isolated temporary database. Viewports: laptop 1440×1000; phone 390×844. No production changes or commits.

## Passed on both viewports

- Admin login and Certifications navigation; eight program families, WaterSense search, mandatory/conditional/enabled-rule and report-only coverage.
- Description edits and rule enabled toggles; Publish disabled while unsaved; draft save and reload persisted both edits.
- Library publication succeeded; returned version appeared in read-only history. Temporary text and disabled-rule changes restored and published afterward.
- Library publication made the scoring draft stale. Attempted scoring publication displayed the server rejection and explicit rebase guidance.
- Rebase adopted the latest certification library; pillar budgets and complete factors remained identical to the pre-rebase draft.
- Publish disabled after rebase until a successful saved-property preview. Preview returned HTTP 200; published and draft totals were 210 for the QA fixture, and Publish became available.
- Real unauthenticated POST /api/admin/scoring/rebase returned 401; revision 0 returned 409. These assertions run in the Playwright integration script.
- Document scroll width matched viewport width at 1440 and 390. No overflowing certification child elements; no browser page errors.

## Evidence

- `admin-laptop-coverage.png`, `admin-phone-coverage.png`
- `admin-laptop-history.png`, `admin-phone-history.png`
- `admin-laptop-rebase.png`, `admin-phone-rebase.png`
- `admin-laptop-preview.png`, `admin-phone-preview.png`
- `admin-qa-results.json`, `admin-rebase-qa-results.json`
- Reproduction scripts: `tmp/admin-certification-qa.mjs`, `tmp/admin-rebase-qa.mjs` (local QA tools).

## Environment findings and final state

The localhost frontend origin could not complete API requests; using the configured 127.0.0.1 origin resolved login without application changes. An API restart interrupted one cleanup save; both complete certification flows passed after restart. The isolated database initially had no scored properties, so one clearly named `Admin certification QA fixture` was created through /api/score. It remains available for preview. Test publications remain as immutable local audit history. No scoring publication was performed after rebase; the final draft is rebased and previewed.

Added `rebaseScoringDraft` client method and explicit scoring-editor rebase control. Local unsaved edits disable rebase. Server error details remain visible; failed rebase retains local draft. Successful rebase clears the old preview and requires a fresh preview before publication in the current editor session. The backend independently enforces revision/library guards; preview gating is UI state, not a server-side audit requirement.

Verification: `npm run build` passed (existing large-bundle warning); five targeted tests in scoringModel.test.js, weightingRationale.test.js and client.certifications.test.js passed; git diff --check passed (unrelated line-ending warnings only). No certification layout fixes were necessary.
