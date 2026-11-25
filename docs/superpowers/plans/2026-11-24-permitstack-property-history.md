# PermitStack Property History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace VPSF's one-page PermitStack summary search with a feature-flagged, parcel-aware property-history lookup that returns bounded pagination and explicit completeness metadata without changing scoring.

**Architecture:** Extend the existing PermitStack adapter rather than adding a second public endpoint. A provider client selects parcel history when a trusted parcel ID exists, otherwise address history, follows a configurable page budget, and falls back to the current exact-address search only when needed. The normalized response remains review/archive evidence and is never promoted directly into a scoring fact.

**Tech Stack:** Python 3, FastAPI, Pydantic 2, httpx, SQLAlchemy, pytest; React, JavaScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-24-property-record-enrichment-design.md`

## Global Constraints

- Do not bypass CAPTCHA, login, paywall, robots, or provider access controls.
- Permit evidence must not award points or establish current installed condition.
- Preserve existing score results and stored historical snapshots.
- Enforce upstream request budgets atomically across workers.
- Never expose API credentials, owner contact fields, raw provider payloads, or upstream exception text.
- Optional provider failure must not prevent manual home analysis.
- Use GitHub plus Render for deployment; do not use OpenAI Sites.
- Keep existing untracked QA artifacts and unrelated user files untouched.

## File Structure

- `backend/app/config.py`: bounded PermitStack history feature settings.
- `backend/app/permitstack_schemas.py`: normalized public evidence and completeness contract.
- `backend/app/integrations/permitstack.py`: fixed-origin provider requests, pagination, normalization, cache, quota, and fallback.
- `backend/app/routers/integrations.py`: non-secret operational status.
- `backend/app/routers/properties.py`: optional parcel mapping from normalized property data.
- `backend/app/schemas.py`: non-scoring `parcelId` property identity field.
- `backend/tests/test_permitstack.py`: provider, API, persistence, safety, and scoring-invariance coverage.
- `backend/tests/test_property_sources.py`: RentCast parcel mapping coverage, creating the file only if no focused source test already exists at implementation time.
- `frontend/src/permitEvidence.js`: request and response sanitization for the expanded contract.
- `frontend/src/permitEvidence.test.js`: client identity, compatibility, and late-response tests.
- `frontend/src/PermitHistory.jsx`: concise completeness and coverage display.
- `frontend/src/permitHistory.css`: compact metadata presentation if existing styles are insufficient.

## Review Focus

- A parcel belongs to several addresses: return `ambiguous`, attach no scoring facts, and retain the provider warning.
- The monthly quota is exhausted after page one: return the records already obtained as `partial`, not a fabricated complete result or a lost first page.
- A page repeats records or reports `has_more` forever: deduplicate by stable ID and stop at the configured page/record budget.
- A cached legacy 25-record response is read after deployment: validate and display it without migration or data loss.
- The homeowner changes the address or parcel while a request is running: discard the late response rather than attaching evidence to the new home.

---

### Task 1: Expanded Evidence Contract and Safe Configuration

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/permitstack_schemas.py`
- Modify: `backend/app/routers/integrations.py`
- Modify: `backend/tests/test_permitstack.py`

**Interfaces:**
- Produces: `Settings.permit_stack_history_enabled: bool`, `Settings.permit_stack_max_pages: int`, `Settings.permit_stack_page_size: int`, and `Settings.permit_stack_max_records: int`.
- Produces: `PermitStackResponse.lookupMode`, `matchedBy`, `parcelId`, `completeness`, `pagesChecked`, `recordsChecked`, `stopReason`, and expanded `PermitCoverage` fields.
- Preserves: `searchTruncated` and `searchedRecords` for stored-response and frontend compatibility.

- [ ] **Step 1: Write failing schema and status tests**

Add `test_history_settings_are_bounded_and_status_is_nonsecret` and `test_expanded_evidence_contract_accepts_legacy_and_history_shapes` to `backend/tests/test_permitstack.py`. Assert defaults of disabled history mode, maximum three pages, 50 rows per page, 150 records, and status output containing only non-secret limits. Assert a legacy response still validates while a history response accepts:

```python
{
    "lookupMode": "address-history",
    "matchedBy": "address",
    "parcelId": "",
    "completeness": "partial",
    "pagesChecked": 2,
    "recordsChecked": 75,
    "stopReason": "page-budget",
    "coverage": {
        "jurisdiction": "Example County",
        "dataStatus": "active",
        "freshness": "current",
        "captureRatio": 0.82,
    },
}
```

Also assert environment values are clamped to pages 1-10, page size 1-50, and records 1-500.

- [ ] **Step 2: Run the focused tests and verify RED**

Run from `backend`: `python -m pytest tests/test_permitstack.py -k "history_settings or expanded_evidence" -q`

Expected: FAIL because the settings and response fields do not exist.

- [ ] **Step 3: Implement bounded settings and backward-compatible schemas**

In `backend/app/config.py`, parse `PERMIT_STACK_HISTORY_ENABLED`, `PERMIT_STACK_MAX_PAGES`, `PERMIT_STACK_PAGE_SIZE`, and `PERMIT_STACK_MAX_RECORDS` with the exact bounds above. In `backend/app/permitstack_schemas.py`, add:

- `lookupMode: Literal['search','address-history','parcel-history'] = 'search'`
- `matchedBy: Literal['address','parcel'] = 'address'`
- `parcelId: str = ''`, bounded to 100 printable identifier characters
- `completeness: Literal['complete','partial','unknown','unavailable','ambiguous'] = 'unknown'`
- `pagesChecked: int = 1`
- `recordsChecked: int = 0`
- `stopReason: Literal['exhausted','page-budget','record-budget','provider-window','ambiguous','fallback','unknown'] = 'unknown'`
- Coverage fields `jurisdiction`, `dataStatus`, `freshness`, `captureRatio`, `captureCheckedAt`, and `captureNote`, each bounded and optional.

Raise permit and searched-record list bounds to 500 while retaining all existing validation. Update `/api/integrations/status` with `historyEnabled`, `maxPagesPerLookup`, `pageSize`, and `maxRecordsPerLookup`; remove no existing fields yet.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run from `backend`: `python -m pytest tests/test_permitstack.py -k "history_settings or expanded_evidence or status_nonsecret" -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py backend/app/permitstack_schemas.py backend/app/routers/integrations.py backend/tests/test_permitstack.py
git commit -m "Add PermitStack history evidence contract"
```

### Task 2: Property Identity and Parcel-Aware Requests

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/routers/properties.py`
- Test: `backend/tests/test_property_sources.py` or the existing focused property-source test selected during implementation
- Modify: `frontend/src/permitEvidence.js`
- Modify: `frontend/src/permitEvidence.test.js`

**Interfaces:**
- Produces: `PropertyInput.parcelId: str` as non-scoring identity metadata.
- Produces: `PermitStackRequest.parcel: str = ''`, populated from `home.parcelId` only after conservative sanitization.
- Consumes: RentCast candidate fields in order `assessorID`, `parcelNumber`, then `apn`.

- [ ] **Step 1: Write failing backend and frontend parcel tests**

Backend test `test_rentcast_maps_parcel_identity_without_scoring_provenance` asserts a RentCast record with `assessorID='12-34-567'` returns `parcelId='12-34-567'` and that scoring remains identical with and without the parcel ID. Frontend test `permit request includes a safe parcel identity` asserts `permitRequest({...home(), parcelId:'12-34-567'})` includes `parcel:'12-34-567'`, while control characters, more than 100 characters, and demo homes omit or reject it.

- [ ] **Step 2: Run tests and verify RED**

Run from `backend`: `python -m pytest tests/test_property_sources.py tests/test_permitstack.py -k "parcel" -q`

Run from `frontend`: `node --test src/permitEvidence.test.js`

Expected: FAIL because parcel identity is not modeled or sent.

- [ ] **Step 3: Implement non-scoring parcel identity**

Add `parcelId: str = Field(default='', max_length=100)` to `PropertyInput`, include it in provider provenance mapping, and map the candidate RentCast fields without showing it as a homeowner form input. Add optional `parcel` to `PermitStackRequest`, accepting only printable letters, digits, spaces, periods, slashes, and hyphens. Update `permitRequest(home)`, response sanitization, `sameProperty`, confirmed edits, archive merging, and late-response checks so a parcel is sent and preserved when present, while an exact address match remains mandatory for attaching returned evidence. A parcel change invalidates existing permit evidence even when the street address has not changed.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same backend and frontend commands.

Expected: PASS; score invariance test remains green.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/properties.py backend/tests/test_property_sources.py frontend/src/permitEvidence.js frontend/src/permitEvidence.test.js
git commit -m "Carry parcel identity into permit lookups"
```

### Task 3: Fixed-Origin Property-History Client and Pagination

**Files:**
- Modify: `backend/app/integrations/permitstack.py`
- Modify: `backend/tests/test_permitstack.py`

**Interfaces:**
- Produces: `PermitStackClient.property_history(request: PermitStackRequest, page: int, per_page: int) -> dict`.
- Produces: `PermitStackClient.property_by_parcel(request: PermitStackRequest, page: int, per_page: int) -> dict`.
- Produces: `collect_history(client, request, settings, reserve_page) -> HistoryCollection`, where `HistoryCollection` is an internal validated model containing records, lookup mode, coverage, page/record counts, completeness, and stop reason.
- Preserves: `PermitStackClient.search(request)` as the bounded compatibility fallback.

- [ ] **Step 1: Write failing fixed-origin and pagination tests**

Add tests that assert:

- Parcel requests use only `https://api.permit-stack.com/v1/property/by-parcel`, send the key only in `X-API-Key`, and include `parcel`, `state`, `page`, and `per_page`.
- Address requests use only `https://api.permit-stack.com/v1/property/history` and include separated address, city, state, ZIP, page, and per-page values.
- Two pages with a repeated permit yield one deduplicated record and `pagesChecked == 2`.
- `has_more=true` on the last allowed page yields `partial` and `page-budget`.
- Exhaustion yields `complete` unless provider coverage says the tier window is clamped, in which case it yields `partial` and `provider-window`.
- `fan_out_warning=true` or multiple distinct addresses yields `ambiguous` with no accepted permits.
- Quota exhaustion after page one returns page-one records as `partial`; quota exhaustion before page one remains HTTP 429.
- A malicious redirect, oversized page, repeated page, invalid UUID, or unexpected schema is rejected without caching or leaking upstream text.

- [ ] **Step 2: Run the client and pagination tests and verify RED**

Run from `backend`: `python -m pytest tests/test_permitstack.py -k "property_history or property_by_parcel or pagination or fan_out or quota_exhaustion" -q`

Expected: FAIL because property-history methods and collection do not exist.

- [ ] **Step 3: Implement the provider client and validated page model**

Add fixed constants for `/v1/property/history` and `/v1/property/by-parcel`. Validate provider pages with exact fields `permits`, `page`, `per_page`, `has_more`, `found`, `total_matches`, `truncated`, `distinct_addresses`, `distinct_jurisdictions`, `fan_out_warning`, `coverage`, and `data_currency`. Reuse the existing bounded byte reader, disabled redirects, disabled environment proxies, safe error mapping, UUID/status/date sanitizers, and exact address matching.

`collect_history` must reserve quota immediately before each upstream page, stop at both page and record limits, deduplicate by provider UUID, and never request another page after a terminal or ambiguous response. If history mode is disabled, call only the existing search path.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same focused backend command.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/integrations/permitstack.py backend/tests/test_permitstack.py
git commit -m "Add bounded PermitStack property history"
```

### Task 4: Normalize, Cache, and Expose Complete History Safely

**Files:**
- Modify: `backend/app/integrations/permitstack.py`
- Modify: `backend/app/permitstack_schemas.py`
- Modify: `backend/tests/test_permitstack.py`

**Interfaces:**
- Consumes: `HistoryCollection` from Task 3.
- Produces: `history_evidence_response(request: PermitStackRequest, collection: HistoryCollection) -> PermitStackResponse`.
- Produces: versioned cache keys that include lookup mode, normalized parcel/address identity, and history limits.

- [ ] **Step 1: Write failing normalization and compatibility tests**

Add tests asserting that normalized history:

- Omits owner, contractor contact, raw enrichment, and unrecognized fields.
- Maps provider coverage and data currency into the expanded public coverage model.
- Preserves up to 150 validated permits with accurate page/record counts.
- Reads a cached legacy search response and returns it unchanged except `cacheHit` and requested address casing.
- Uses a new cache key when parcel identity, history mode, page size, page budget, or record budget changes.
- Never changes `/api/score` totals, confidence, explanations, or recommendations.

- [ ] **Step 2: Run normalization tests and verify RED**

Run from `backend`: `python -m pytest tests/test_permitstack.py -k "history_evidence or cache_key or score_endpoint_retains" -q`

Expected: FAIL because history collection is not yet converted or cache-versioned.

- [ ] **Step 3: Implement history normalization and cache versioning**

Build `history_evidence_response` using the existing safe permit field mapping. Update `_lookup_permits_once` to choose history collection only when the feature flag is enabled, retain exact-search fallback, cache only fully validated normalized responses, and use distinct cache namespaces for legacy search and history contracts. Empty or ambiguous results retain the short empty-cache TTL; matched history uses the normal cache TTL.

- [ ] **Step 4: Run the full backend PermitStack tests and verify GREEN**

Run from `backend`: `python -m pytest tests/test_permitstack.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/integrations/permitstack.py backend/app/permitstack_schemas.py backend/tests/test_permitstack.py
git commit -m "Normalize and cache permit property history"
```

### Task 5: Frontend Compatibility and Concise Coverage Display

**Files:**
- Modify: `frontend/src/permitEvidence.js`
- Modify: `frontend/src/permitEvidence.test.js`
- Modify: `frontend/src/PermitHistory.jsx`
- Modify: `frontend/src/permitHistory.css`

**Interfaces:**
- Consumes: expanded `PermitStackResponse` from Tasks 1 and 4.
- Produces: sanitized evidence that accepts legacy responses and up to 500 records but renders only normalized public fields.

- [ ] **Step 1: Write failing client and rendering tests**

Extend `frontend/src/permitEvidence.test.js` to assert:

- A 75-record history response survives sanitization and draft/archive round trips.
- Legacy evidence with no new fields receives safe defaults.
- Unknown completeness, lookup mode, stop reason, or out-of-range coverage values reject only the malformed evidence and do not break the form.
- Address or parcel edits discard an in-flight history response.

Add a focused component test only if the repository's existing React test setup supports it without a new dependency; otherwise pin copy through the evidence helper and build snapshot. Expected user copy distinguishes `Complete available history`, `Partial available history`, and `Coverage unknown`, and never says all public records were searched.

- [ ] **Step 2: Run frontend tests and verify RED**

Run from `frontend`: `node --test src/permitEvidence.test.js`

Expected: FAIL because the sanitizer caps records at 25 and drops the new fields.

- [ ] **Step 3: Implement expanded sanitization and compact display**

Accept and bound the Task 1 fields, preserve legacy defaults, and keep exact address attachment checks. Update `PermitHistory` to show the completeness phrase, permit count, pages checked, data-through date, jurisdiction, and retrieved/cache date in one compact coverage paragraph. Do not expose provider internals, quota state, or raw stop reasons.

- [ ] **Step 4: Run frontend tests and production build**

Run from `frontend`:

```bash
node --test src/*.test.js src/api/*.test.js src/admin/*.test.js
npm run build
```

Expected: all tests PASS and Vite build exits 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/permitEvidence.js frontend/src/permitEvidence.test.js frontend/src/PermitHistory.jsx frontend/src/permitHistory.css
git commit -m "Display permit history completeness"
```

### Task 6: Full Verification, Controlled Rollout, and Production Audit

**Files:**
- Create: `docs/qa/2026-11-24-permit-history/README.md`
- Create: `docs/qa/2026-11-24-permit-history/live-results.json`
- Modify only if tests reveal a defect: files owned by Tasks 1-5, with a failing regression test first.

**Interfaces:**
- Consumes: all Phase 1 code and the existing GitHub-to-Render deployment path.
- Produces: reproducible local and production evidence; no scoring-model change.

- [ ] **Step 1: Run the complete backend suite**

Run from `backend`: `python -m pytest tests -q`

Expected: PASS with zero failures.

- [ ] **Step 2: Run the complete frontend suite and build**

Run from `frontend`:

```bash
node --test src/*.test.js src/api/*.test.js src/admin/*.test.js
npm run build
```

Expected: all tests PASS and build exits 0.

- [ ] **Step 3: Review the branch diff**

Run: `git diff --check` and inspect `git diff <phase-start-commit>...HEAD` for credential exposure, raw owner/contact fields, unbounded pagination, scoring changes, and unrelated files.

Expected: no whitespace errors and no prohibited data or scoring changes.

- [ ] **Step 4: Deploy history mode disabled and verify compatibility**

Push the reviewed branch through the existing GitHub/Render path. Confirm `/api/integrations/status` reports `historyEnabled: false`, the legacy live lookup still works, saved evidence loads, and phone/laptop flows complete.

- [ ] **Step 5: Enable history mode for a controlled production sample**

Set `PERMIT_STACK_HISTORY_ENABLED=true` on the VPSF API only after the compatibility deploy. Keep page/record defaults at 3/50/150. Test at least five already-public benchmark properties across different jurisdictions, recording match status, permit count, completeness, pages, latency, cache behavior, and provider-call usage in `live-results.json`. Do not include owner/contact data.

- [ ] **Step 6: Apply the rollout gate**

Keep history enabled only if no wrong-property attachment occurs, all responses remain within limits, manual analysis remains available during provider failure, and PermitStack usage matches actual pages requested. Otherwise disable the flag, record the failing cases, add regression tests, and fix before re-enabling.

- [ ] **Step 7: Commit QA evidence**

```bash
git add docs/qa/2026-11-24-permit-history/README.md docs/qa/2026-11-24-permit-history/live-results.json
git commit -m "Document permit history production verification"
```
