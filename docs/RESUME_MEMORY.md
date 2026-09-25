# VPSF Resume Memory

## Latest Update: September 25, 2026

The seven Know-How pillar pages now use a generated Green Builder Media article
catalog rather than four-to-five starter links. Each has up to 100 actual blog
articles, with 12 per page, page-jump selectors, and title/description search.
The index ships with the frontend, so browsing it uses no property API calls;
individual articles continue to use the persistent clean-reader cache.
See `docs/KNOW_HOW_ARCHIVE.md` and `scripts/build_know_how_catalog.py` for refresh
instructions and source/relevance rules.

Know-How collection links (`/blog/topic/...`, including paginated pages) now use
the clean reader as compact linked-title lists with dates and excerpts, not full
site pages or large photos. Article links stay in the clean reader. Existing
cached article links are upgraded without refetching their content. Topic lists
are persisted in `article_cache` on the same Render disk. Logos, ads, topic tags,
and the floating chatbot are excluded from both list and article views.

USFS Wildfire Risk to Communities is integrated into `/api/properties/risk`
alongside FEMA. It uses free community/county ArcGIS layers, no API key.
`wildfire_risk_cache` persists results in the existing Render `/var/data/vpsf.db`;
coordinates and wildfire provenance are retained in saved property/score snapshots.
Saved scans reuse them without a paid property lookup. Older archives without
coordinates remain unknown rather than spending API pulls or guessing.

Scoring model `vpsf-0.2.0-usfs` adjusts Resilience (out of 200): Low +10,
Medium 0, High -10, Very High -20, unknown 0. These are provisional VPSF
weights for area exposure, not a home fire-resistance certification.
Browser fallback uses the same policy. See `docs/WILDFIRE_RISK.md` for sources,
cache behavior, limitations, and tests. Existing admin regional percentages
are not changed by this integration. The sections below describe the original
foundation and may no longer reflect the full current application.

## Where We Left Off

The local staging folder is:

`C:\Users\mattp\Desktop\VPSF DASH`

The GitHub repo is:

`mattpower-ux/vpsf-calculator`

The repo has been reorganized into:

- `frontend/`: existing Vite/React VPSF calculator and admin prototype.
- `backend/`: new FastAPI backend foundation.

Important instruction from Matt: do not use OpenAI Sites unless Matt explicitly says, "use OpenAI Sites." Default deployment path is GitHub plus Render.

## Current Build State

The frontend has been preserved as much as possible. The main structural change is that it now lives under `frontend/`.

Small frontend additions already made:

- Start screen has separate ingestion buttons for MLS, Zillow, Realtor.com, and Redfin.
- Manual score generation calls backend `/api/score` when available.
- Existing frontend scoring remains as fallback if backend is offline.
- Product recommendations call backend when available and fall back to demo products.
- Product lead forms submit to backend when available.
- Admin product weighting calls backend when available and keeps local optimistic behavior.

Backend foundation already added:

- FastAPI app.
- SQLAlchemy database setup.
- Local SQLite default.
- Render/Postgres URL support.
- Models for properties, score runs, source documents, products, and leads.
- Provider adapter boundary for MLS/Zillow/Realtor.com/Redfin.
- OCR extraction boundary with lightweight text parsing placeholder.
- Prototype scoring ported to backend model version `vpsf-0.1.0`.
- Score responses include explanations, confidence, property ID, and score-run ID.
- Product seed catalog and CSV product importer scaffold.
- Admin API foundation.
- Render blueprint in `render.yaml`.

## Verification Completed

Last known verification:

- Frontend production build passed from `frontend/`.
- Backend syntax compile passed.
- Backend tests passed: `5 passed`.

Use Python 3.12 for backend verification. The machine's Python 3.14 had trouble installing `pydantic-core` because MSVC build tools were unavailable. The working verification venv is:

`backend/.venv312`

## Git State

Changes were staged with `git add -A`.

They were not committed or pushed.

When resuming, first run:

```powershell
git status --short
git diff --cached --stat
```

Expect the frontend move to show as renames from root `src/`, `index.html`, `package.json`, and `vite.config.js` into `frontend/`.

## Key Local Docs

- `docs/VPSF_FULL_MODEL_AUDIT_PLAN.md`: full audit and build plan.
- `docs/AUTONOMOUS_BUILD_CHECKPOINT.md`: summary of what was built independently.
- `docs/RESUME_MEMORY.md`: this resume note.

## Recommended Next Steps

1. Review staged changes.
2. Commit the foundation if it looks good.
3. Push to GitHub.
4. Start backend and frontend locally together.
5. Click through manual scoring and lead submission.
6. Confirm Render service names/domains before deploying.
7. Add Alembic migrations.
8. Build score-run history endpoints and real admin CRUD.
9. Decide OCR provider and listing API strategy.
10. Extract/import the Green Builder Sustainable Product of the Year catalog.

## Higher-Touch Decisions Still Needed

- MLS/Zillow/Realtor.com/Redfin provider choices, credentials, and terms.
- OCR provider: Tesseract, OpenAI extraction, cloud OCR, or hybrid.
- Product source extraction details and image rights.
- Final scoring policy for roof age, missing documentation, insurance risk, regional weighting, and confidence penalties.
- Render service names/domains.
- Admin authentication and role policy.
