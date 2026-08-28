# VPSF Calculator

This repository is organized as a staged full-stack project for the Value Per Square Foot calculator.

## Structure

- `frontend/` contains the existing Vite/React calculator and admin prototype.
- `backend/` contains the FastAPI service that will own ingestion, OCR extraction, scoring, recommendations, leads, and admin APIs.

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
- `vpsf-frontend`: static frontend service from `frontend/`.
- `vpsf-db`: PostgreSQL database.

Do not use OpenAI Sites unless Matt explicitly says: "use OpenAI Sites."
