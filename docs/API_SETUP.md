# VPSF API Setup Guide

This guide gets the four MVP integrations configured locally:

1. Mapbox for geocoding and address normalization.
2. RentCast or ATTOM for property records, public facts, tax, sales, permits, and AVM-style enrichment.
3. OpenAI for structured extraction and scoring explanations.
4. OCR through Mistral first, with Google Document AI as the heavier backup option.

The app also includes no-key enrichment for climate-zone estimation and FEMA flood-zone lookup.

Do not commit real API keys. Copy `backend/.env.example` to `backend/.env`, then paste secrets into `backend/.env`.

## 1. Create Local Env File

```powershell
cd backend
Copy-Item .env.example .env
```

## 2. Mapbox

Use Mapbox for address search, geocoding, and normalizing user-entered addresses.

- Sign up: https://account.mapbox.com/auth/signup/
- Pricing: https://www.mapbox.com/pricing
- Env key: `MAPBOX_ACCESS_TOKEN`

After signup:

1. Open the Mapbox account dashboard.
2. Create or copy a public access token.
3. Paste it into `backend/.env`.
4. Test it:

```powershell
python scripts/check_mapbox.py "1600 Pennsylvania Ave NW, Washington, DC"
```

## 3. RentCast

Use RentCast first when you want lower-cost, self-serve property records and valuation data.

- Sign up: https://app.rentcast.io/
- API/docs: https://developers.rentcast.io/
- Pricing: https://www.rentcast.io/api
- Env key: `RENTCAST_API_KEY`

After signup:

1. Create a RentCast account.
2. Pick an API plan. The free developer plan is enough for testing.
3. Create an API key in the RentCast dashboard.
4. Paste it into `backend/.env`.
5. Test it:

```powershell
python scripts/check_rentcast.py "5500 Grand Lake Dr, San Antonio, TX 78244"
```

For depth testing, run 5-10 known addresses in different regions and compare the returned year built, square footage, beds, baths, lot size, tax, sale history, and valuation fields against known records.

## 4. ATTOM

Use ATTOM for property records, owner/tax data where licensed, sales history, property characteristics, valuation signals, and building permit data where available.

- Developer docs/signup: https://api.developer.attomdata.com/docs
- Main site: https://www.attomdata.com/
- Env key: `ATTOM_API_KEY`

ATTOM pricing is usually plan or contract based. Confirm the package includes the specific endpoints VPSF needs: property profile, sales history, assessment/tax, valuation, and permits.

After signup:

1. Create an ATTOM developer account.
2. Request access to property profile and permit endpoints.
3. Paste the API key into `backend/.env`.
4. Test it:

```powershell
python scripts/check_attom.py "1600 Pennsylvania Ave NW" "Washington, DC"
```

## 5. OpenAI

Use OpenAI to turn messy listing text, OCR output, and uploaded document text into structured VPSF facts and concise score explanations.

- Platform: https://platform.openai.com/
- API keys: https://platform.openai.com/api-keys
- Pricing: https://openai.com/api/pricing/
- Env key: `OPENAI_API_KEY`

After signup:

1. Create or open a Platform project.
2. Add billing.
3. Create an API key.
4. Paste it into `backend/.env`.
5. Test it:

```powershell
python scripts/check_openai.py
```

## 6. OCR Option A: Mistral

Mistral is the recommended first OCR path because setup is lighter than Google Cloud.

- Platform: https://console.mistral.ai/
- Product: https://mistral.ai/products/studio/
- Env keys: `OCR_PROVIDER=mistral`, `MISTRAL_API_KEY`

After signup:

1. Create a Mistral account.
2. Create an API key.
3. Set `OCR_PROVIDER=mistral`.
4. Paste the key into `MISTRAL_API_KEY`.
5. Test it:

```powershell
python scripts/check_ocr.py
```

## 7. OCR Option B: Google Document AI

Use Google Document AI if the project needs a more enterprise document-processing stack.

- Console: https://console.cloud.google.com/
- Document AI: https://cloud.google.com/document-ai
- Pricing: https://cloud.google.com/products/document-ai/pricing
- Env keys:
  - `OCR_PROVIDER=google_document_ai`
  - `GOOGLE_APPLICATION_CREDENTIALS`
  - `GOOGLE_DOCUMENT_AI_PROJECT_ID`
  - `GOOGLE_DOCUMENT_AI_LOCATION`
  - `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`

After setup:

```powershell
python scripts/check_ocr.py
```

The current Google smoke test verifies local configuration only. Add a live processor request once the Google client library is added.

## 8. Check Backend Status

Start the backend:

```powershell
uvicorn app.main:app --reload
```

Then open:

```text
http://localhost:8000/api/integrations/status
```

Each integration should show `configured: true` once its required keys are present.

Climate-zone and FEMA flood enrichment do not require API keys.
