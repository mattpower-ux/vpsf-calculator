# Automatic Property Photo Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically discover exact-address property photos, let users review them alongside saved homeowner photos, and analyze the highest-priority evidence without persistently copying public images.

**Architecture:** A backend photo-evidence service normalizes discovery results into short-lived database candidates, serves no-store previews, and resolves selected candidates for transient analysis. Homeowner images are capability-protected, recorded in Postgres, and written atomically beneath the VPSF API service's Render disk mount; the browser archive retains only opaque asset capabilities and metadata. A shared frontend context component keeps the selected level and address visible.

**Tech Stack:** FastAPI, SQLAlchemy/PostgreSQL, Render persistent disk, httpx, existing Crawl4AI and Street View integrations, React/Vite, Node test runner, pytest.

**Spec:** `docs/superpowers/specs/2026-11-26-automatic-property-photo-evidence-design.md`

## Global Constraints

- Public image bytes are transient and must never be written to the database, filesystem, CDN, archive, or backups.
- Homeowner images are stored only beneath `/var/data/vpsf-photos`; database rows store metadata and hashed capability tokens, never image bytes.
- Accept HTTPS public sources only; never bypass login, CAPTCHA, paywall, or robots restrictions.
- Require exact house number, normalized street, city plus state or ZIP, and unit identity when supplied.
- Show no more than 12 candidates and analyze no more than 12 selected images.
- Existing VPSF scoring rules remain unchanged; photos provide evidence, not bonus points.
- Public candidates never silently overwrite homeowner-confirmed values.
- Every photo-bearing response uses `Cache-Control: private, no-store`.

## Review Focus

- A listing search returns a nearby address or different unit: reject it and show no thumbnail.
- A public candidate expires between review and PROCESS: continue with remaining evidence and identify the skipped item.
- The disk is unavailable, full, or temporarily unmounted: keep the evaluation usable, do not claim the upload succeeded, and preserve the current browser preview for retry.
- A browser archive is cleared without notifying the server: expire the inaccessible capability-protected asset after 365 days without authorized access.
- A public provider returns redirects, private-network URLs, oversized images, unsupported MIME, or portrait logos: reject safely without delaying the remaining sources.

---

### Task 1: Candidate model and exact-address normalization

**Files:**
- Create: `backend/app/photo_evidence.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/db.py`
- Test: `backend/tests/test_photo_evidence.py`

**Interfaces:**
- Consumes: `address_identity`, `contains_exact_street`, `trusted_provider`, and public-image validation from `app.routers.property_photo`.
- Produces: `PhotoCandidate`, `match_photo_candidate(raw: dict, address: str) -> PhotoCandidate | None`, `rank_photo_candidates(candidates: list[PhotoCandidate], limit: int = 12) -> list[PhotoCandidate]`, and SQLAlchemy `PropertyPhotoCandidateRecord`.

- [ ] **Step 1: Write failing model and matching tests** for exact directional suffixes, suffix variants, unit matches, nearby addresses, house-number prefixes, untrusted providers, duplicate images, source diversity, and the 12-item limit.
- [ ] **Step 2: Run** `python -m pytest -q tests/test_photo_evidence.py` from `backend`; expect failures because the module/model do not exist.
- [ ] **Step 3: Implement the candidate dataclass, exact-address matcher, ranker, and database record** with random candidate ID, normalized property identity, provider, source page URL, remote image URL, kind hint, dimensions, confidence evidence, creation time, and expiration time. Do not add an image/blob column.
- [ ] **Step 4: Run** `python -m pytest -q tests/test_photo_evidence.py`; expect all Task 1 tests to pass.
- [ ] **Step 5: Commit** `feat: add exact-address photo candidate model`.

### Task 2: Automatic discovery and short-lived candidate API

**Files:**
- Create: `backend/app/routers/photo_evidence.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/routers/property_photo.py`
- Test: `backend/tests/test_photo_evidence.py`

**Interfaces:**
- Consumes: Task 1 matcher/ranker and existing Street View/Crawl4AI provider helpers.
- Produces: `POST /api/photo-evidence/discover` with `{address}` input and `{candidates, expiresAt}` output; `discover_photo_candidates(address: str, settings) -> list[PhotoCandidate]`.

- [ ] **Step 1: Write failing API/provider tests** proving discovery starts from a normalized address, accepts Street View and exact listing/assessor results, reads both row-level and top-level search images, rejects wrong-property imagery, stores metadata only, and degrades to an empty candidate list when providers fail.
- [ ] **Step 2: Run** `python -m pytest -q tests/test_photo_evidence.py`; expect endpoint/provider failures.
- [ ] **Step 3: Implement provider adapters and discovery orchestration** with bounded parallel calls, lazy deletion of expired rows, a maximum of 12 stored candidates, and no public image download during discovery unless dimensions require validation.
- [ ] **Step 4: Run** the focused test file and `python -m pytest -q tests/test_property_photo.py`; expect both suites to pass.
- [ ] **Step 5: Commit** `feat: discover exact-address property photos`.

### Task 3: No-store previews and transient public-image resolution

**Files:**
- Modify: `backend/app/photo_evidence.py`
- Modify: `backend/app/routers/photo_evidence.py`
- Test: `backend/tests/test_photo_evidence.py`

**Interfaces:**
- Consumes: Task 1 candidate records.
- Produces: `GET /api/photo-evidence/candidates/{candidate_id}/preview`; `fetch_candidate_image(candidate_id: str, db: Session) -> tuple[str, bytes, PhotoCandidate]`.

- [ ] **Step 1: Write failing security and lifecycle tests** for expiry, unknown IDs, no-store headers, HTTPS-only fetches, DNS pinning, redirects to private networks, MIME/signature mismatch, byte/dimension limits, portrait/logo rejection, and proof that no bytes are persisted.
- [ ] **Step 2: Run** the focused tests; expect preview/resolver failures.
- [ ] **Step 3: Implement preview/resolution** by reusing the hardened downloader, generating a bounded thumbnail response in memory, and never returning the remote image URL to the browser.
- [ ] **Step 4: Run** `python -m pytest -q tests/test_photo_evidence.py tests/test_property_photo.py`; expect all tests to pass.
- [ ] **Step 5: Commit** `feat: serve transient property photo previews`.

### Task 4: Render-disk homeowner photo assets

**Files:**
- Create: `backend/app/photo_assets.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/routers/photo_evidence.py`
- Test: `backend/tests/test_photo_assets.py`

**Interfaces:**
- Produces: `store_photo_asset(data: bytes, mime: str, property_identity: str, category: str, db: Session) -> PhotoAssetCapability`, `read_photo_asset(asset_id: str, token: str, db: Session) -> tuple[str, bytes]`, `delete_photo_asset(...)`, `expire_photo_assets(...)`, SQLAlchemy `PropertyPhotoAssetRecord`, and upload/read/delete API routes.

- [ ] **Step 1: Write failing storage/security tests** using a temporary mount for atomic write, generated sharded paths, path traversal, MIME/signature/byte/dimension limits, metadata stripping, token hashing, incorrect capability, no-store reads, delete, missing file, disk full/write failure, and 365-day expiry.
- [ ] **Step 2: Run** `python -m pytest -q tests/test_photo_assets.py`; expect missing-module/route failures.
- [ ] **Step 3: Implement capability-protected disk storage** rooted exclusively at `PHOTO_STORAGE_PATH`, with atomic temporary-file replacement, generated filenames, database metadata, authorized last-access updates, and idempotent deletion.
- [ ] **Step 4: Run** the focused test file and `python -m pytest -q`; expect all backend tests to pass.
- [ ] **Step 5: Commit** `feat: persist homeowner photos on Render disk`.

### Task 5: Mixed public and homeowner photo analysis

**Files:**
- Modify: `backend/app/routers/home_walk.py`
- Modify: `backend/app/ocr/home_walk.py`
- Test: `backend/tests/test_home_walk.py`
- Test: `backend/tests/test_photo_evidence.py`

**Interfaces:**
- Consumes: Task 3 `fetch_candidate_image` and Task 4 `read_photo_asset`.
- Produces: extended `POST /api/home-walk/analyze` accepting repeated `candidate_ids` and homeowner asset capabilities; suggestions include `evidence_type`, `evidence_reference`, and `source_provider`.

- [ ] **Step 1: Write failing mixed-analysis tests** for public-only, homeowner-only, mixed, expired candidate, one failed image, six-image batch bounds, 12-image request bounds, and homeowner evidence metadata.
- [ ] **Step 2: Run** the two focused backend test files; expect request-schema and provenance failures.
- [ ] **Step 3: Extend the bounded request parser and analysis manifest** so candidate IDs and homeowner asset capabilities resolve server-side, homeowner assets retain higher evidence priority, failures are item-specific, and all buffers are released after analysis.
- [ ] **Step 4: Run** the focused tests and then `python -m pytest -q`; expect the complete backend suite to pass.
- [ ] **Step 5: Commit** `feat: analyze mixed property photo evidence`.

### Task 6: Automatic-photo review and evidence priority UI

**Files:**
- Create: `frontend/src/photoEvidence.js`
- Create: `frontend/src/photoEvidence.test.js`
- Modify: `frontend/src/evaluationArchive.js`
- Modify: `frontend/src/evaluationArchive.test.js`
- Modify: `frontend/src/GuidedHomeWalk.jsx`
- Modify: `frontend/src/guidedHomeWalk.js`
- Modify: `frontend/src/GuidedHomeWalk.css`
- Modify: `frontend/src/guidedHomeWalk.test.js`
- Modify: `frontend/src/AnalysisFlow.jsx`

**Interfaces:**
- Consumes: Tasks 2–5 APIs and `PhotoAssetCapability`.
- Produces: `discoverPropertyPhotos(address, signal)`, `uploadHomeownerPhoto(file, metadata, signal)`, source-labeled selectable automatic thumbnails, saved homeowner thumbnails, metadata-only archive references, `buildPhotoAnalysisManifest(publicCandidates, homeownerAssets)`, and category-level homeowner precedence.

- [ ] **Step 1: Write failing frontend tests** for automatic discovery on address selection, provider/source labels, exclusion, wrong/expired candidate states, automatic-only processing, mixed processing, homeowner replacement by category, disk-backed asset restore, capability omission from rendered/logged copy, archive deletion calls, and a maximum of 12 selected images.
- [ ] **Step 2: Run** the focused Node tests; expect UI/client failures.
- [ ] **Step 3: Implement the photo-evidence client, metadata-only archive integration, and dialog changes** with separate **Photos found for this property** and **Your photos** groups, source links, remove/replace controls, accessible loading/error states, and no manual URL field.
- [ ] **Step 4: Run** the focused tests and `npm test`; expect the complete frontend suite to pass.
- [ ] **Step 5: Commit** `feat: review automatic and homeowner photo evidence`.

### Task 7: Persistent analysis context

**Files:**
- Create: `frontend/src/AnalysisContextLine.jsx`
- Create: `frontend/src/analysisContextLine.test.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/phonePrototype.css`
- Modify: `frontend/src/shellLayout.test.js`

**Interfaces:**
- Consumes: `analysisLabel(home.analysisLevel)` and the normalized home address fields.
- Produces: `<AnalysisContextLine home={home}/>` rendered under the level badge on all analysis screens.

- [ ] **Step 1: Write failing render/source tests** for Basic, Informed, Superior, multiline phone addresses, missing optional ZIP, processing screens, score screens, and recommendation screens.
- [ ] **Step 2: Run** the focused frontend tests; expect missing component/render failures.
- [ ] **Step 3: Implement the compact context component and shared shell placement** so it wraps without overlapping headings or the fixed bottom navigation.
- [ ] **Step 4: Run** the focused tests and `npm run build`; expect both to pass.
- [ ] **Step 5: Commit** `feat: keep analysis address context visible`.

### Task 8: Copy, help, observability, and end-to-end verification

**Files:**
- Modify: `backend/app/data/help_guide.json`
- Modify: `backend/tests/test_help.py`
- Modify: `frontend/src/privacyCopy.test.js`
- Modify: `frontend/src/guideManual.test.js`
- Create: `docs/qa/2026-11-26-automatic-photo-evidence/README.md`

**Interfaces:**
- Consumes: completed Tasks 1–7.
- Produces: user-facing storage/privacy explanations, non-image aggregate diagnostics, and recorded phone/laptop QA evidence.

- [ ] **Step 1: Write failing copy/help tests** asserting that automatic photos are transient, homeowner photos are stored privately with the property archive, capabilities are not share links, retention is 365 days after last authorized access, and scoring does not reward photo quantity.
- [ ] **Step 2: Implement the help/privacy copy and aggregate logging** for discovery success, rejection reason, selected count, fetch failure, disk upload failure, and analysis completion without logging image data, capabilities, or source URLs.
- [ ] **Step 3: Run** `python -m pytest -q` in `backend`, `npm test`, and `npm run build` in `frontend`; require zero failures.
- [ ] **Step 4: Test locally with `PHOTO_STORAGE_PATH` set to a temporary directory**, then test phone and laptop flows for Basic, Informed, and Superior with automatic-only, homeowner-only, and mixed evidence; verify exclusion, PROCESS, review, archive reopening, replacement, deletion, and the persistent context line. Record results in the QA README.
- [ ] **Step 5: Verify the Render disk is mounted at `/var/data/vpsf-photos` on the VPSF API service and `PHOTO_STORAGE_PATH` matches**, then deploy through GitHub main and Render. Expect a brief API interruption because disk-backed services do not use zero-downtime deploys.
- [ ] **Step 6: After deployment, verify runtime write/read/delete beneath the mount**, exact-address candidates, and analysis on at least three properties in different states; confirm no upload is written outside the mount and review disk-usage monitoring.
- [ ] **Step 7: Commit** `docs: verify automatic property photo evidence`.

## Deferred Follow-up

The overall and pillar score circles will receive a separate, bounded visual design using one shared red-to-green performance scale. That change is intentionally excluded here so photo evidence cannot alter score presentation or scoring semantics during this rollout.
