# VPSF Autonomous Build Checkpoint

## Completed Without Higher-Touch Inputs

- Reorganized the repo into `frontend/` and `backend/`.
- Preserved the existing calculator/admin UI and moved it under `frontend/`.
- Added listing-source buttons for MLS, Zillow, Realtor.com, and Redfin.
- Added a FastAPI backend with health, property, scoring, product, lead, and admin routes.
- Added SQLAlchemy database setup with SQLite local default and Render/Postgres support.
- Added persistent models for properties, score runs, source documents, products, and leads.
- Ported prototype scoring into backend model version `vpsf-0.1.0`.
- Added backend score explanations, confidence, property IDs, and score-run IDs.
- Wired frontend manual score generation to backend `/api/score` with prototype fallback.
- Wired frontend products and lead forms to backend APIs with demo fallback.
- Wired admin product weighting to backend admin APIs with local optimistic fallback.
- Added seed product records based on the prototype catalog.
- Added CSV product importer scaffold for the Green Builder Sustainable Product of the Year catalog.
- Added lightweight upload text extraction as an OCR placeholder.
- Added Render blueprint for backend, frontend, and PostgreSQL.
- Added backend API/scoring tests and frontend build verification.

## Verified

- Backend tests: `5 passed`.
- Backend syntax compile: passed.
- Frontend production build: passed.

## Still Higher-Touch

- Final MLS/Zillow/Realtor.com/Redfin API provider choices, credentials, and terms.
- Real OCR provider choice: Tesseract, OpenAI extraction, cloud OCR, or hybrid.
- Exact Green Builder Sustainable Product of the Year source extraction and image rights.
- Final scoring philosophy for missing evidence, roof age, insurance risk, and regional weighting.
- Render service/domain confirmation before production deployment.
- Admin authentication and role policy.

## Recommended Next Session

1. Start backend and frontend locally together.
2. Click through manual scoring and product lead submission.
3. Confirm Render service names/domains.
4. Commit and push the current staged foundation.
5. Begin persistence polish: Alembic migrations, score-run history endpoints, and real admin CRUD.
