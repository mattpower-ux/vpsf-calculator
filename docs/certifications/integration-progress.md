# Certification integration — November 15, 2026

Approved runtime design: implementation-design.md. Implementation in existing isolated codex/advice-products-tips worktree; baseline 3c1300b.

## Plan and verification
1. Versioned, bounded reference rules and pure feature resolution, with per-program conflict/unknown/removal tests.
2. New scoring-model transition: replace certificate package bonuses with ordinary feature points, retain baselines and immutable historical versions. Inspect custom models/drafts before migration.
3. Database library publications, authenticated admin edits, preview/scoring/advice/report integration. Store raw and effective evidence separately.
4. Optional homeowner certification controls and correction workflow, existing responsive components; add fixture-category inputs.
5. Update FAQ, searchable help and Field Guide. Run backend/frontend regression suites, build, phone/laptop workflow checks and independent review.
6. GitHub/Render deployment and live smoke checks; record evidence here.

## Interface decisions
- Certification library version starts certifications-v1; ScoreModel links to immutable publication.
- Raw PropertyInput retains certificate claims; score snapshot retains raw input, effective input and resolution evidence. Never save derived defaults as homeowner facts.
- All eight families recognized; only researched edition-specific mandatory feature rules infer values. Unsupported mappings remain report-only.
- Separate worker ownership: reference package, pure model migration, homeowner UI, help content. Parent integrates database/routes/admin and verifies end-to-end.
- User asked to proceed without handholding; publication is authorized by the ongoing deploy workflow. No manufacturer emails.

## Progress
- Implementation started; research/design read and worktree confirmed.

## Completed local verification
- Versioned library and exact-edition resolver implemented for eight program families.
- Ordinary fixture credit and supported ventilation inference; unsupported/conditional claims remain report-only. Raw/effective input and rule provenance remain separate.
- Authenticated admin library drafts/publications/history, scoring-draft explicit rebase and concurrent publication guards.
- Optional homeowner claims, corrections, removal, draft restore, and stale-score response protection.
- FAQ, searchable Help, and 23-chapter Field Guide updated for current workflows and certification limits.
- Full backend: 459 passed. Full frontend: 192 passed. Vite production build passed; existing bundle-size advisory remains.
- Real Chrome responsive tests: 390x844 phone and 1366x900 laptop homeowner add/correct/remove/re-add/score; Basic and Superior navigation; Help FAQ/search/manual. Admin tested at 390x844 and 1440x1000, including save/publish/history/rebase/preview/401/409. No physical phone was used.
- Independent review fixes verified: pending drafts preserved, report-only roof scoring rejected, stale library publication prevented, publication CAS shared, explicit Unknown survives restore, delayed scoring cannot overwrite edits.
- Render SQLite startup takes an atomic, non-overwriting pre-certification backup before creating tables or migrating; backup errors stop startup. Historical score/model rows remain intact.
- Unrelated existing listing fetch hard-deadline test exposed a Windows timer race; fixed with an expiration event without weakening deadlines.

## Release
Deployment pending final GitHub push and Render verification.
