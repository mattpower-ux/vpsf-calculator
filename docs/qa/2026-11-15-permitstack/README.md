# PermitStack rollout verification — November 15, 2026

Release: `6bc3140ac07e9512c1e578c17f86cf4b492f6f84`.

- PermitStack account dashboard verified Developer ACTIVE, 10,000 requests/day. No subscription or add-on changed. Invoice amount was not verified.
- Existing Cognition key copied into VPSF API environment with Matt's explicit approval. Cognition unchanged. No credential stored in repository.
- VPSF starts with 100 upstream requests/month, 3 requests/minute and 10/hour per client; same-address concurrent calls coalesce per worker. Persistent atomic monthly cap is shared across workers.
- Matching permit history cached 24 hours; empty history cached 1 hour. Exact normalized street/state/ZIP checks after bounded provider prefix search. No automatic installed-feature or age inference.
- 162 frontend tests, 64 targeted backend tests (API, permits, admission limits, scoring model/store) passed. Production Vite build passed; existing large-bundle warning remains.
- PermitHistory component expanded at 390x844 and 1366x900 using a local synthetic fixture; readable without clipping. Fixture excluded from deployment.
- Live API: Austin, TX 12703 Timberside Dr returned five final 1982 electrical/plumbing/mechanical/building records. Bangor, ME 346 Lincoln St returned zero records. Austin repeated as Drive returned five cached records. Upstream usage increased from zero to two, not three.
- These are historical permits, not proof of current equipment. No score or lead created by the API checks.
- Frontend and API deployed via GitHub/Render. Original Desktop/VPSF DASH fast-forwarded to this release, preserving untracked previews/backups.

See `live-checks.json` for sanitized public permit responses and request counters.

Live browser check: Austin Basic analysis displayed Permit history (5), including source, statuses and dates, at phone and laptop sizes. Initial rapid test calls triggered the intended 3/minute admission limit; retry after its window expired succeeded from cache. Live health returned ok; ATTOM returned HTTP 410. Browser testing created a normal property-query archive entry, but no score or lead.
