# PermitStack property-history verification

Date: 2026-11-24

## Local verification

- Backend: `python -m pytest tests -q` — 543 passed.
- Frontend: `node --test src/*.test.js src/api/*.test.js src/admin/*.test.js` — 235 passed.
- Frontend production build: `npm run build` — completed successfully.
- Diff audit: no scoring-model files, credential values, owner fields, contractor contacts, or raw provider responses were added to the public evidence contract.

## Rollout state

The implementation is committed with `PERMIT_STACK_HISTORY_ENABLED` defaulting to `false`. Production deployment, the feature-flag change, and live benchmark calls have not been performed from this worktree. They require the existing GitHub/Render release path and should remain separate from local implementation verification.

## Production gate

1. Deploy with history mode disabled and confirm legacy lookups, saved evidence, phone flow, and laptop flow.
2. Enable history mode only on the VPSF API with the default limits: three pages, 50 rows per page, 150 accepted records.
3. Test at least five already-public properties in different jurisdictions.
4. Record only non-contact metrics in `live-results.json`: match state, permit count, completeness, pages, latency, cache behavior, and provider-call count.
5. Disable the flag immediately for a wrong-property attachment, unbounded behavior, blocking provider failure, or unexplained call usage.

No owner, applicant, contractor, or other contact information belongs in this QA folder.
