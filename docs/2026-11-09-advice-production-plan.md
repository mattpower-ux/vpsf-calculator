# VPSF Takeaways, Product Matching and Eco-Tips Production Plan

Status: proposed for Matt's approval. November 9, 2026. No implementation or deployment authorized by this document alone.

**Goal:** Make the next action useful for the specific home, make product selection explainable, and let admins maintain a larger educational tip library.

**Architecture:** Use one deterministic backend advisory service for home facts, takeaway selection and product matching. Keep the existing score model unchanged. Extend the existing database, catalog and authenticated admin interface; use the same React components on phone and laptop.

**Tech stack:** React/Vite, FastAPI/Pydantic, SQLAlchemy and the project's existing database and Render deployment.

**Execution after approval:** Native implementation in this repository, focused automated tests, independent review, phone/laptop browser checks, GitHub and Render deployment. No OpenAI Sites.

## Findings from the current code

- `frontend/src/App.jsx:PillarBreakdown` chooses strength using raw pillar points, favors Water for opportunity, and always shows a leak detector with a fixed +8 points and under-$2,000 estimate. Unequal pillar maximums make raw-point comparisons misleading.
- The catalog endpoint returns the same product collection to everyone. The frontend filters by pillar/category but does not evaluate home compatibility. `MatchingProducts` additionally uses a separate `demoMatchingProducts` map.
- The database already has product tags, status, technical text and URL fields, but the public schema exposes only part of them. Admin supports Priority/Standard/Downgrade/Hidden; those values do not establish sponsorship.
- `frontend/src/ecoTips.js` has three static tips selected by menu-visit modulo. There is no tip administration.
- Property input defaults include values such as None and Code-Minimum. These are not sufficient evidence that a homeowner confirmed a feature is absent. Provenance must be handled before writing confident personalized advice.

## Design choices proposed for approval

Use explicit rules and edited building-science text. A copy-only refresh would leave the personalization problem unresolved. Generating advice with an LLM on every visit would add latency, cost and inconsistent decisions; it is unnecessary for this release.

Keep a single master catalog and its existing category directory. Add a personalized view of that catalog, rather than separate product lists per home or pillar. Do not interpret Priority as Sponsored. Sponsorship never changes a house's VPSF score.

Make tips database-managed, with draft/preview/publish/retire controls. A larger hard-coded list would be quicker but would still require developer deployments for editorial changes.

## 1. Home-specific Key Takeaway

Replace the current strength/opportunity/affordable-upgrade layout with four sections, always ordered Energy, Water, Health and Resilience. Keep the street-only address beneath the heading and the existing navigation.

Each section contains:

1. **What was found:** one short sentence identifying a recorded feature or an explicit information gap.
2. **Why it matters:** one sentence explaining comfort, resource use, indoor conditions or durability.
3. **Best next action:** one concrete action, with a contextual button to update details, view the relevant recommendation/products, or read the pillar's Insights.

Target 45–75 words per section, excluding the heading/buttons. Show the pillar's existing score/max without implying missing records mean equipment is defective. Use sentence labels, not a wall of text. Preserve Path to 700 access. Remove the fixed leak-detector promotion and fixed cost/gain claims.

Examples of behavior, not claims about an actual property:

| Home record | Takeaway behavior |
|---|---|
| Oil hydronic heating confirmed | Explain combustion and distribution; suggest a load/water-temperature assessment before choosing a replacement. |
| Heat pump already documented | Prioritize sizing, maintenance, controls or envelope assessment; do not repeat a generic heat-pump replacement suggestion. |
| Conventional irrigation confirmed | Discuss scheduling/controller improvements; no irrigation-controller upsell for a confirmed no-irrigation home. |
| Ventilation unknown | Say ventilation is not documented and offer a verification step; do not claim unhealthy air. |
| Elevated sourced wildfire exposure and mitigation unknown | Recommend checking ember hardening and defensible space, with the geographic source resolution identified. |
| Efficient systems already recorded | Suggest maintenance/documentation, not an invented weakness or mandatory purchase. |

Selection rules: confirmed relevant concern first; meaningful missing information next; maintenance/documentation otherwise. Evaluate hazards only from available sourced risk records; do not infer tornado, flood or wildfire exposure from a broad state label. If comparing score performance, use score/max, not raw points. A positive modeled improvement alone is not proof of a missing feature.

The initial advice uses fields already collected: heating and distribution, water heating, insulation, water standard/leak/reuse/landscape, ventilation/materials/IAQ/moisture, roof and protection inputs, sourced risk context, and published custom fields where their meaning is known. Fixture-specific advice appears only when a real collected field provides that information. This release does not create the entire previously discussed equipment-input expansion.

## 2. Personalized products from one catalog

Separate two views:

- **Recommended for this home:** ranked products with a short “Why this matches” explanation and “Confirm before buying” requirements.
- **Browse all products:** the complete active public catalog, with pillar and category filters. A known mismatch may be browsed but is never presented as a recommended fit.

Use the same product IDs and records for recommendations, Product Options, detail pages, categories, report/PDF product selections and inquiry tracking. Remove live dependence on the duplicate demo product map. Demo mode can use clearly identified fixture data in the same schema. Preserve existing admin-routed product inquiry forms; never email manufacturers automatically.

### Matching sequence

1. Exclude Hidden/inactive products from public results.
2. Check explicit incompatibilities before ranking: fuel, hydronic versus ducted distribution, existing equivalent equipment, relevant irrigation use, and applicable documented conditions.
3. Put products with a documented need and no unresolved required condition in the first group. This is a promising match, not an engineering approval.
4. Put plausible options with unknown prerequisites in a separate **Needs verification** group. Unknown is not incompatible, and is not compatible.
5. Do not recommend products without a relevant need; retain them in Browse all.
6. Within each group, order by the matching action's priority (documented concern, information gap, maintenance), then normalized pillar opportunity, then count of supported need matches. Use Priority/Standard/Downgrade only to break otherwise equal relevance; finish with stable name/ID ordering.

No probability-of-fit percentage or unearned point-gain badge. Existing improvement gains are conditional results from the published scoring model; do not sum overlapping gains or claim a brand earns points. No numerical weights in this ranking change the scoring model.

### Catalog/admin additions

Extend the Products admin page with structured need tags, multiple pillar tags, allowlisted compatibility conditions, verification notes, technical/source URL and review date. No administrator-authored executable formulas. Preserve the existing product identity and weighting controls.

Add explicit `isSponsored` and `sponsorName` metadata. Display **Sponsored** wherever a sponsored product appears, including product detail and exported report selection. Default legacy products to not sponsored; require explicit admin designation rather than guessing from existing Priority values. Sponsorship receives no hidden ranking boost. Flag sponsorship metadata for editorial review before launch.

Audit every current catalog entry for supported tags and compatibility facts. Manufacturer/primary technical sources must support restrictions; incomplete entries remain browseable with verification text and do not receive a confident personalized-fit label. Do not promise new manufacturer coverage in this batch.

## 3. Expanded admin-managed Eco-Tips

Seed **28 total reviewed tips: four per pillar**, including the existing three after editorial review. Keep the ECO-TIP / Did you know? hierarchy, image, short text and source link. Each tip is 25–55 words; sources and image rights are recorded. Climate-sensitive statements include their applicability.

Admin fields: stable ID, pillar, tip text, image asset/key or HTTPS URL, alt text, source title/HTTPS URL, source review date, optional climate tags, editorial order and draft/published/retired status. The initial release supports a curated asset selector or HTTPS image URL; it does not build a new media-upload system.

Add an **Eco-Tips** navigation item to the authenticated admin. Actions: create, edit draft, preview phone/laptop rendering, publish, unpublish/retire and restore a prior published version. Published changes are atomic; unfinished drafts never reach the menu. Reject publication without required text, image/alt text or source. Disallow HTML/script and unsafe URL schemes. Use revision checks to prevent one admin silently overwriting another.

Rotation: a new eligible tip each time Menu is entered, not on a rerender or accordion toggle. Shuffle a bag of published IDs per browser session; exhaust it before repeating, and avoid repeating the final tip across a cycle boundary when at least two exist. Store IDs/revision only in session storage, no address. A reload preserves the bag when storage is available; blocked storage falls back to memory. Climate filtering only applies when climate is known; general tips remain eligible.

Cache the published feed for five minutes and refresh on a later Menu entry after expiry. A successful empty feed means the admin intentionally removed all tips, so hide the tip panel. On network failure use the last successfully retrieved feed; if none exists, use a small bundled general-purpose fallback. Label nothing as a home-specific finding. Broken images show a restrained local fallback without breaking text or navigation.

## Shared data and API contract

Add a field-provenance map alongside the assessment: field name, origin (user-confirmed, imported, inferred, unknown), optional source reference/date. Carry it through import, review/edit, save/restore and advisory requests. Explicit edits become user-confirmed, not independently verified. Keep imported/inferred claims qualified. For legacy records without provenance, describe values as recorded and ask for confirmation where absence/compatibility depends on them. Never manufacture evidence from defaults.

Proposed service interfaces:

- `build_home_context(home, provenance, score_result)`: normalized facts, unknowns, sourced hazards and existing improvement references.
- `build_takeaways(context)`: four records with pillar, finding, evidence label, significance, action and supported internal destination.
- `match_products(context, catalog)`: product IDs, match group, ordering keys, reasons and verification requirements.
- `POST /api/products/advice`: validated property/provenance plus score context; returns rule version, four takeaways and matching records joined to canonical product IDs. It does not save a new score run. The server validates/recomputes model-dependent values against the applicable model version; frontend values do not become authoritative scoring facts.
- Keep `GET /api/products/recommendations` backward compatible as the public catalog endpoint, adding optional metadata fields.
- `GET /api/eco-tips`: published records and feed revision only.
- Authenticated `/api/admin/eco-tips` create/list/draft-update/publish/retire/restore operations with revision conflicts and audit timestamps; equivalent product metadata updates use existing admin auth.

Cancel/ignore stale advisory responses when switching homes; key requests by home facts and model version, not address alone. Show a loading state and retry path. On failure the calculator still scores and permits catalog browsing, but must not silently show another home's advice or fallback demo recommendations. Avoid property addresses in request/error logs.

## Implementation tasks after approval

Every task follows a failing-test, implementation, passing-test and focused-commit cycle. Extract new logic from App.jsx rather than growing its inline business rules.

### A. Evidence-aware advisory foundation

Files: new `backend/app/advice/context.py`, `takeaways.py`; modify `backend/app/schemas.py`, `frontend/src/App.jsx` and the existing property persistence/import mapping; add `backend/tests/test_home_advice.py`.

- [ ] Trace current saved/imported field evidence and reuse it before adding the minimal provenance map.
- [ ] Test confirmed versus default None, inferred/imported claims, legacy saved homes, unknown hazards, equal percentages with unequal pillar budgets, and a changed active scoring model.
- [ ] Implement context and four takeaway records with stable action destinations, source labels and deterministic copy rules.
- [ ] Verify existing score totals and existing saved-record loading remain unchanged; commit.

### B. Canonical product metadata and matching

Files: new `backend/app/advice/products.py`; modify `backend/app/models.py`, `schemas.py`, `repositories.py`, `db.py`, `products/catalog.py`, `routers/products.py`, `routers/admin.py`; add `backend/tests/test_product_matching.py` and migration coverage.

- [ ] Test hidden products, no-irrigation, existing heat pump, fuel/distribution mismatch, unknown compatibility, multiple pillars and deterministic ordering.
- [ ] Test a Priority/sponsored incompatible product never displaces an eligible match; sponsorship label is explicit and no score changes occur.
- [ ] Add backward-compatible metadata migration, schemas, admin metadata editing and canonical match service; enrich current records from verified sources.
- [ ] Ensure seed operations do not overwrite admin edits and missing metadata yields verification-required behavior; commit.

### C. Shared consumer UI and product flows

Files: new `frontend/src/KeyTakeaways.jsx`, `HomeProductRecommendations.jsx`, `homeAdvice.js` and tests; modify `App.jsx`, `api/client.js`, product detail/report export consumers and `admin/AdminDemo.jsx` (extract product editing as needed).

- [ ] Add advisory API integration and stale-response guards; test home A/home B switching and restored evaluations.
- [ ] Replace the old takeaway cards and fixed upgrade with the four concise sections.
- [ ] Route all product entry points to canonical data, preserving pillar/category filters, back navigation, street subtitle and lead routing.
- [ ] Render match reasons, verification group and sponsorship consistently; test no suitable products and API failure.
- [ ] Verify PDF picks match the selected home's product IDs and disclose sponsorship without breaking its single-page layout; commit.

### D. Eco-Tip persistence and admin

Files: new `backend/app/eco_tips.py`, `backend/app/data/eco_tips.json`, `backend/app/routers/eco_tips.py`, `backend/tests/test_eco_tips.py`; modify models, schemas, main/router registration and admin routes; new `frontend/src/admin/EcoTips.jsx` and admin API methods/navigation.

- [ ] Test unauthenticated writes are denied; drafts/retired entries never leak into the public feed; invalid URLs/content fail validation.
- [ ] Test create/edit/publish/retire/restore, conflicting revisions, idempotent seeding and server restart persistence.
- [ ] Implement versioned records and admin list/editor/preview controls using existing styling and authentication.
- [ ] Write/source-review the 28 tips and image attributions; check all external links; commit.

### E. Tip rotation and integration

Files: modify `frontend/src/ecoTips.js`, `ecoTips.test.js`, `App.jsx`, `api/client.js`; extract `EcoTipCard.jsx` if useful.

- [ ] Test bag exhaustion, immediate-repeat prevention, one/zero tips, retired IDs, changed feed version, blocked session storage and failed images.
- [ ] Test refresh expiry, deliberate empty publication versus network failure, and switching between unknown and known climates.
- [ ] Integrate rotation only on Menu entry, preserve collapsed menu sections and accessible source links; commit.

## Acceptance and regression tests

- Four takeaway sections for every evaluated home, including incomplete and legacy records; every factual statement traceable to an input/source.
- Different profiles produce meaningfully different advice/products: cold-climate oil hydronic, warm-climate conventional irrigation, efficient heat-pump home, no-irrigation home, elevated wildfire exposure, unknown records and demo.
- All category and pillar filters work; no duplicate products, demo-only product bypasses, fabricated sponsor status or brand-based score bonuses.
- Editing a home refreshes all advice, product selection and report contents; stale network responses cannot leak previous-home data.
- Tip editor changes persist across backend restart and publish within the cache window. Only published tips appear. No draft data or admin controls are publicly accessible.
- Phone widths 360/390/430 px, tablet 768 px and laptop 1366 px: no horizontal overflow, clipped cards or covered buttons. Test keyboard navigation, focus labels, long text, image failure and WordPress embedding.
- Exercise My Scores/Menu/back navigation, saved evaluation reload, product request submission to VPSF admin, PDF download and the three fixes deployed November 9.
- Run frontend Node tests and production build; backend pytest suite; independent diff review. Add targeted tests for each new module before its implementation. Exact commands: from frontend, `node --test src/*.test.js src/api/*.test.js src/admin/*.test.js` and `npm run build`; from backend, `python -m pytest tests`.

## Release and rollback

1. Build and validate locally with isolated test data; do not change live catalog/tips during development.
2. Back up the production database and verify the actual database dialect. Use additive migrations tested on that dialect and SQLite tests; do not rely on the current SQLite-only runtime alterations for a different database.
3. Deploy backward-compatible backend endpoints and tables first. Verify existing frontend still works and migrations preserve catalog/admin settings.
4. Populate reviewed metadata/tips without changing scoring weights. Deploy frontend, then verify the live WordPress embed on phone/laptop and admin publication workflow.
5. If checks fail, roll frontend back to its previous release; leave additive schema in place. Restore prior tip publication if the problem is editorial. Keep the existing public catalog route compatible throughout rollback.
6. Mark these punchlist items complete only after live verification; list any unmet acceptance criteria explicitly.

## Approval scope

Approval covers the four-section takeaway design, deterministic evidence-based product matching, sponsorship disclosure with no relevance override, 28-tip launch library, admin editorial controls, tests and staged deployment. It does not change VPSF scoring weights, invent new sponsor contracts, add automatic manufacturer emails, buy a data service, or implement additional future-cost datasets.

No implementation has begun. Await Matt's approval of this plan.
