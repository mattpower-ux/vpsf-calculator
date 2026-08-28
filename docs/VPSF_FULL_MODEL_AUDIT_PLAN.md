# VPSF Full Working Model Audit and Build Plan

## Purpose

Build the VPSF calculator into a real backend-driven product while preserving the existing frontend concept, visual design, mobile flow, and admin prototype as much as possible.

The frontend should remain the product shell. The backend should become the system of record for property ingestion, document extraction, scoring, product recommendations, lead capture, reports, and admin configuration.

## Current Repo State

### Frontend

The existing Vite/React application now lives in `frontend/`.

What already works:

- Mobile calculator shell and screen-by-screen flow.
- Start screen with ingestion choices.
- Manual property/spec entry.
- Demo MLS-style import flow.
- Demo analysis/progress screen.
- VPSF score dashboard with seven pillars.
- Pillar detail screens.
- Recommendations, matching products, product detail, and lead-form UI.
- Marketing Studio and VPSF label screens.
- Admin prototype with products, brand weighting, properties, users, reports, and scoring-control screens.

What is still prototype-only:

- Scoring is still calculated in frontend state for the live user flow.
- Demo listings are imported from static `demoProperties`.
- Demo products are imported from static `demoProducts`.
- Recommendation details and matching products are hardcoded in `App.jsx`.
- Lead forms do not submit to a persistent backend.
- Admin screens mutate only local React state.
- Report generation is simulated with a timeout.
- Uploaded files/photos are UI placeholders.
- There is no login, role model, audit trail, database, job queue, or persistent storage.

### Backend

The new FastAPI scaffold lives in `backend/`.

What exists:

- `/api/health`
- `/api/properties/manual`
- `/api/properties/import`
- `/api/properties/ocr`
- `/api/score`
- `/api/products/recommendations`
- `/api/leads`
- Provider adapter boundary for `mls`, `zillow`, `realtor`, and `redfin`.
- OCR boundary.
- Product recommendation boundary.
- Backend scoring logic ported from the frontend prototype.

What is still missing:

- Database models and migrations.
- Real provider API integrations.
- Real OCR and structured extraction.
- Durable uploaded-file storage.
- Product catalog seed/import pipeline.
- Admin CRUD APIs.
- Authentication and authorization.
- Lead routing/export.
- Report generation.
- Backend/frontend API client integration.
- Render deployment config.

## Product Principle

Keep the frontend intact. Add backend capabilities behind the current screens instead of redesigning the experience.

Frontend changes should be limited to:

- Replacing demo constants with API calls.
- Preserving demo fallbacks while backend work is staged.
- Showing loading/error states where real API calls can fail.
- Passing selected ingestion source to backend.
- Submitting lead forms and admin updates.
- Rendering backend scores, recommendations, products, and reports.

## Target Architecture

```txt
/
  frontend/
    src/
      App.jsx
      admin/AdminDemo.jsx
      demo/
      assets/
    package.json
    vite.config.js

  backend/
    app/
      main.py
      config.py
      db.py
      models/
      schemas.py
      routers/
      services/
      adapters/
      scoring/
      ocr/
      products/
      reports/
      auth/
    migrations/
    scripts/
    tests/
    requirements.txt

  render.yaml
  README.md
```

## Core Data Model

### Property

Store normalized property facts independently from any single listing provider.

Required fields:

- Address, city, state, ZIP, geocode, county.
- Listing source, listing ID, listing URL, source timestamp.
- Home type, year built, square feet, bedrooms, bathrooms, stories, lot size.
- Roof type, roof age, windows, insulation, HVAC, water heater.
- Solar, battery, EV readiness.
- Certifications: HERS, WaterSense, Indoor airPLUS, FORTIFIED, Zero Carbon, WELL/Fitwel, etc.
- Resilience context: flood zone, wind/hurricane risk, wildfire risk, grid outage risk.
- Water context: drought exposure, fixture assumptions, irrigation, leak detection, reuse.
- Community context: walkability, transit, bike access, broadband, greenspace.
- Ownership context: insurance signal, maintenance risk, warranty signal, PIETIM inputs.

### Source Document

Every uploaded or imported artifact should be retained as evidence.

Fields:

- Property ID.
- File name, MIME type, storage URL/path.
- Source type: listing PDF, listing screenshot, seller disclosure, spec sheet, appraisal, photo, admin upload.
- OCR text.
- Extracted facts.
- Extraction confidence by field.
- Human review status.

### Score Run

Every score should be versioned.

Fields:

- Property ID.
- Scoring model version.
- Input snapshot.
- Pillar scores.
- Total score.
- Classification.
- Explanation blocks.
- Missing-data penalties.
- Confidence score.
- Created timestamp.

### Product

Initial catalog should be seeded from the last three years of Green Builder Sustainable Product of the Year winners.

Fields:

- Brand, product name, manufacturer.
- Category, pillar mappings, recommendation tags.
- Product URL, image URL/path.
- Short summary and technical writeup.
- Source issue/year/page/reference.
- Admin weight: Priority, Standard, Downgrade, Hidden.
- Availability/status.
- Created/updated timestamps.

### Recommendation

Recommendations should connect score gaps to product or action pathways.

Fields:

- Trigger pillar.
- Trigger conditions.
- Suggested action.
- Estimated point impact.
- Cost range.
- Difficulty.
- Product matches.
- Explanation copy.
- Admin weight/context.

### Lead/Event

Capture user intent and product interest.

Fields:

- User/session ID.
- Email/name/role when provided.
- Product ID.
- Property ID.
- ZIP/state/market.
- Action: view, request specs, request pricing, create label, export report.
- IP and user agent where legally appropriate.
- Created timestamp.

## Scoring Model Plan

### Model Version 0.1: Prototype Parity

Goal: move the current frontend score into backend with no product behavior surprise.

Tasks:

- Keep the seven current pillars and point maximums:
  - Energy: 200
  - Water: 100
  - Health: 200
  - Resilience: 200
  - Carbon & Materials: 150
  - Financial Risk: 100
  - Community & Mobility: 50
- Return the same score object shape the frontend already expects.
- Add model version and explanations.
- Add tests using known demo homes.

### Model Version 0.2: Normalized Inputs and Confidence

Goal: make manual, listing, and OCR inputs land in one normalized schema.

Tasks:

- Convert provider/OCR strings into canonical enum values.
- Track unknown/missing inputs distinctly from negative findings.
- Add field-level confidence.
- Add human-review flags for low-confidence facts.
- Add score explanation text based on actual inputs, not static copy.

### Model Version 0.3: Existing-Home Reality

Goal: make older homes score realistically and avoid over-crediting unverified features.

Tasks:

- Add roof age and replacement-window logic.
- Add climate/region weighting profiles.
- Add flood, hurricane, wildfire, heat, water, grid, and insurance risk multipliers.
- Penalize missing evidence for claimed certifications or high-performance systems.
- Add documentation bonuses for verified HERS, WaterSense, FORTIFIED, Indoor airPLUS, EPDs, warranties, insurance discounts.

### Model Version 0.4: Upgrade Path and VPSF Delta

Goal: turn recommendations into quantified improvement paths.

Tasks:

- Calculate gap-to-threshold paths, especially path to 700.
- Estimate point gains by action and product category.
- Include rough cost, confidence, and implementation difficulty.
- Avoid double-counting overlapping upgrades.
- Support regional priorities and admin-tuned weights.

## Ingestion Plan

### Manual Entry

- Submit current form data to `/api/properties/manual`.
- Store property record.
- Run `/api/score`.
- Return score and recommendations.

### Listing Providers

Keep provider adapters separate and licensed-API-first.

Adapters:

- `MLSAdapter`
- `ZillowAdapter`
- `RealtorAdapter`
- `RedfinAdapter`

Each adapter should implement:

- `fetch_by_address`
- `fetch_by_listing_id`
- `fetch_by_url`
- `normalize_listing`
- `map_to_property_input`

Do not scrape listing sites by default. Before production integration, verify provider terms, API availability, authentication, rate limits, storage rights, photo rights, and display restrictions.

### OCR Upload

Supported upload types:

- PDF
- JPG
- PNG
- HEIC if practical

Pipeline:

1. Upload file to backend.
2. Store original file.
3. Run OCR.
4. Extract structured fields.
5. Normalize fields into `Property`.
6. Return extracted facts and confidence to frontend.
7. Let user confirm/edit before scoring.

Extraction should identify:

- Address and listing metadata.
- Square footage, year built, beds/baths, lot size.
- HVAC, water heater, roof, windows, insulation.
- Solar, battery, EV readiness.
- Certifications.
- Flood/insurance/warranty language.
- Product/spec mentions.

## Product Catalog Plan

### Seed Source

Initial release catalog should use Green Builder Sustainable Product of the Year winners from the March/April issue for the last three years.

Build a repeatable importer:

- Source year.
- Source issue.
- Product name.
- Brand/manufacturer.
- Category.
- Image.
- Writeup.
- URL/reference.
- Suggested VPSF pillar mapping.
- Recommended initial admin weight.

Use `gbm-visual-chatbot` as an optional source assistant if it can retrieve the relevant issue content and product records cleanly. Still store normalized product records in this repository's backend database.

### Matching Logic

Match products to properties by:

- Pillar gap.
- Category relevance.
- Climate/region.
- Existing system type.
- Estimated point impact.
- Admin weight.
- Hidden/downgraded status.

## API Build Plan

### Public Calculator APIs

- `POST /api/properties/manual`
- `POST /api/properties/import`
- `POST /api/properties/ocr`
- `GET /api/properties/{id}`
- `POST /api/score`
- `GET /api/properties/{id}/score-runs`
- `GET /api/properties/{id}/recommendations`
- `GET /api/products/recommendations`
- `POST /api/leads`

### Admin APIs

- `GET /api/admin/properties`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PATCH /api/admin/products/{id}`
- `DELETE /api/admin/products/{id}`
- `PATCH /api/admin/products/{id}/weighting`
- `GET /api/admin/leads`
- `GET /api/admin/reports/leads`
- `GET /api/admin/reports/products`
- `GET /api/admin/scoring-profiles`
- `PATCH /api/admin/scoring-profiles/{id}`

## Frontend Integration Plan

Do this incrementally to avoid disrupting the current UX.

1. Add `frontend/src/api/client.js`.
2. Read API base URL from `VITE_API_BASE_URL`.
3. Add a small data hook layer for properties, scoring, products, leads, and admin.
4. Keep demo fallback if API is unavailable.
5. Replace manual score generation with backend `/api/score`.
6. Replace products/recommendations with backend responses.
7. Wire lead forms to `/api/leads`.
8. Wire admin tables to admin APIs.
9. Add loading/error/empty states using existing visual patterns.

## Admin Build Plan

The current admin prototype is the right shape. Make it real without redesigning it.

Priority order:

1. Product Recommendation Manager.
2. Lead Reports.
3. Properties list and score-run history.
4. Scoring profile controls.
5. User/session analytics.
6. Export tools.

Admin auth can start as a simple environment-protected admin login, then mature into role-based access:

- Admin
- Editor
- Manufacturer
- Realtor/partner
- Read-only analyst

## Deployment Plan

Default deployment path is GitHub plus Render.

Do not use OpenAI Sites unless Matt explicitly says: "use OpenAI Sites."

Recommended Render setup:

- Backend: Render Web Service running FastAPI/Uvicorn.
- Database: Render PostgreSQL.
- Frontend: Render Static Site built from `frontend/`.
- Environment variables:
  - `DATABASE_URL`
  - `FRONTEND_ORIGIN`
  - `VITE_API_BASE_URL`
  - Provider API keys as they become available.
  - OCR/extraction provider keys as needed.

This repo now includes a starter `render.yaml` for two Render services from one repo: a FastAPI backend, a static frontend, and a PostgreSQL database. Confirm the final Render service names/domains before production deployment.

## Milestones

### Milestone 1: Full-stack Foundation

- Keep frontend building from `frontend/`.
- Backend health and score endpoints working.
- Frontend calls backend score with demo fallback.
- Add basic tests.

### Milestone 2: Persistence

- Add PostgreSQL.
- Add SQLAlchemy/SQLModel and Alembic.
- Persist properties, score runs, products, leads, and source documents.
- Seed demo data.

### Milestone 3: OCR and Review

- Implement file upload.
- Store source documents.
- Extract text.
- Map extracted facts to property fields.
- Add user confirmation step.

### Milestone 4: Product Intelligence

- Build Sustainable Product of the Year importer.
- Seed three-year product catalog.
- Add image/writeup storage.
- Build recommendation matching from score gaps.

### Milestone 5: Listing Provider Readiness

- Implement adapter config and credential loading.
- Add provider-specific adapters once APIs/terms are confirmed.
- Normalize provider responses into the property schema.
- Add provider audit logs.

### Milestone 6: Admin Reality

- Product CRUD and weighting.
- Lead reports and exports.
- Property history.
- Scoring-profile controls.
- Role-based auth.

### Milestone 7: Production Launch

- Render deployment.
- CORS/env hardening.
- Error monitoring.
- Backup/restore plan.
- Seed/import scripts.
- Smoke tests against production endpoints.

## Highest-Risk Items

- Provider data rights and API availability.
- OCR accuracy on low-quality listing photos.
- Overstated score precision before enough evidence is collected.
- Product recommendation bias without clear admin/audit controls.
- Lead privacy and consent requirements.
- Admin screens becoming operational before auth and audit logs exist.

## Immediate Next Build Task

The next implementation step should be Milestone 1:

1. Add a frontend API client.
2. Call backend `/api/score` from the manual review flow.
3. Preserve frontend fallback scoring if backend is unavailable.
4. Add a backend score response that includes model version and explanation stubs.
5. Add tests proving backend scoring matches the current prototype for demo inputs.
