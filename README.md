# VPSF Calculator

This repository is organized as a staged full-stack project for the Value Per Square Foot calculator.

## Structure

- `frontend/` contains the Vite/React calculator and native admin editor.
- `backend/` contains the FastAPI service for ingestion, OCR, scoring, recommendations, leads, and admin APIs.

The frontend design should remain as intact as possible while backend capabilities are added behind it.

## Local Development

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:ADMIN_PASSWORD = "a unique local-only password"
uvicorn app.main:app --reload
```

## Backend Roadmap

The backend is intentionally split around durable boundaries:

- `app/adapters/`: licensed listing providers such as MLS, Zillow, Realtor.com, and Redfin.
- `app/ocr/`: listing-sheet photo/PDF extraction.
- `app/scoring/`: VPSF score calculation.
- `app/products/`: persistent product recommendation catalog.
- `app/routers/`: public API endpoints for frontend and admin use.

Do not scrape listing providers by default. Provider adapters should be wired to licensed APIs once credentials and terms are available.

## Deployment

The default deployment path is GitHub plus Render.

`render.yaml` defines:

- `vpsf-api`: FastAPI backend service from `backend/`.
- `vpsf-calculator`: static frontend service from `frontend/`.
- `vpsf-api` stores data in SQLite on the `/var/data` persistent disk.

Set `ADMIN_PASSWORD` as a secret on the existing `vpsf-api` service before deploying this version. Render ignores new `sync: false` variables when updating an existing Blueprint, so the manifest alone does not enable admin login. The old literal passcode no longer works. Admin login issues an eight-hour session; rotating the password immediately invalidates existing sessions.

The backend creates new scoring model, draft, audit, session, and walkability-cache tables on startup. It seeds the current VPSF rules only when no scoring model exists. A deployment does not publish draft changes. Every score run retains its model version and input snapshot; previewing a draft does not save a score run. Before rollout, back up `/var/data/vpsf.db`; to recover from a bad model, publish a corrected draft or restore the database backup. Never delete historical scoring-model rows to roll back a score.

To test locally, open `http://localhost:5173/?admin=true`, sign in with `ADMIN_PASSWORD`, and select **Scores and Weighting**. Save a draft, compare a saved property, then publish only after the seven pillar budgets total 1,000. New optional homeowner fields appear after publication. EPA National Walkability Index factors are present but initially inactive; retiring the legacy WalkScore factor and activating EPA factors requires a separate reviewed publication.

Do not use OpenAI Sites unless Matt explicitly says: "use OpenAI Sites."
