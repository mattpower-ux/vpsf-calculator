# Capture and listings release — November 15, 2026

## Behavior

- Upload Documents accepts multiple local files and comma-separated public HTTPS document URLs, with bounded downloads and reviewed extraction.
- Guided Home Walk offers native mobile photo capture, local photo uploads, and bounded video frame extraction. Six generated photos are preloaded only for the fictional demonstration address.
- A compact area selector and collapsed capture controls sit above the thumbnail grid. PROCESS shows the animated Cognition logo and “Reviewing images for value data.” while the real service evaluates the images, with a minimum 2.5-second success transition.
- Analysis returns directly to editable house details. Conflicting values are not automatically applied. Photo-derived fields retain inferred provenance; descriptive observations are stored separately from score weights. Undocumented ages, certifications, and hidden performance are not invented.
- Current branding is used for legacy theme links. The initial screen no longer contains backend source explanations or document suggestion cards.
- Exterior image follows the address input; Change exterior photo opens a file picker. Real-address Street View lookup requires GOOGLE_STREET_VIEW_API_KEY on the API service and otherwise offers upload fallback.
- Four visible listing tiles open source-specific URL/ID forms. Public structured listing data can be imported; restricted listings and number-only searches offer address/document fallback rather than fabricated data.
- Removed the source-note callout on Review & Confirm. No Add Photos action is present there.

## Verification

- Frontend: 101 tests; production build passes (existing bundle-size advisory remains).
- Backend: full regression suite, including URL SSRF protection, multipart bounds, photo evidence schema, structured listing imports, and shared inference rate/concurrency limits.
- Browser: phone portrait, phone landscape, and laptop dialog bounds; six thumbnails; animated processing; automatic editable-details return; correction persists into Home Specs; review callout absent. Deterministic local provider fixtures used for transition testing; production provider smoke test performed after release.
- Physical iOS/Android camera hardware is not available in desktop browser testing. The photo input uses capture="environment"; users can upload when native capture is unavailable.

## Assets and limits

Demo exterior and six walk photos were generated for this fictional California house. They are illustrative product assets, not images of a real property. Listing wordmarks are sourced from Wikimedia Commons (Zillow_logo.svg, Realtor.com_logo.png, Redfin_logo.png); MLS is a generic text mark.

Public inference is limited to 30 requests/minute and 120/hour/client, with four active requests per worker. Multi-replica deployments need a shared limiter. No raw photo archive is persisted by the Home Walk endpoint.
