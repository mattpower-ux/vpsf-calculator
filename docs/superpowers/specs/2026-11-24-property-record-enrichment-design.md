# VPSF Property Record Enrichment Design

Date: 2026-11-24

## Purpose and success criteria

VPSF should populate substantially more of a home's Basic score before asking the homeowner questions. The backend will search legally accessible, source-labeled property records, combine them without overstating certainty, and ask only precise questions that fill high-value gaps. The homeowner experience remains address-first and concise.

The first delivery phase deepens the existing PermitStack integration and establishes stable evidence contracts for future county, municipal, assessor, tax, recorder, and licensed listing sources. It does not attempt to bypass CAPTCHAs or treat an archived listing as authoritative evidence.

Suggested acceptance targets for a geographically varied 100-property benchmark are:

- At least 95% correct address, county, and parcel identity resolution.
- At least 85% coverage for year built, conditioned area, lot size, beds, and baths.
- At least 70% meaningful permit-history coverage where a jurisdiction publishes records.
- Regional resilience enrichment attempted for every geocoded property.
- Every populated fact carries its source, retrieval date, and confidence.
- Initial results return within 10 seconds; slower enrichment continues asynchronously.
- Basic analysis asks no more than three to five high-value follow-up questions.

These are VPSF product targets, not guarantees that every jurisdiction publishes the underlying data.

## Current system and constraints

- Mapbox normalizes and geocodes the address.
- RentCast provides the first normalized property-fact response.
- FEMA, climate, wildfire, walkability, and other location services enrich regional context.
- PermitStack is configured and its credentials work in production, but VPSF currently sends one `/v1/permits/search` request and accepts at most 25 summary records from page one.
- PermitStack evidence is attached to the property archive but intentionally does not establish completed work, equipment age, installed performance, or scoring credit.
- The current integration-status endpoint reports one request and 25 records as the maximum per property lookup. VPSF also imposes a monthly request budget.
- Zillow, Realtor.com, and Redfin imports read public HTML without executing JavaScript, logging in, or bypassing a challenge. CAPTCHA and login pages are rejected.
- No backend adapter currently discovers and queries the relevant county assessor, property appraiser, tax, recorder, municipal permit, ArcGIS, Socrata, Accela, Tyler, or OpenGov source for an arbitrary address.
- No scoring input is currently populated from the Wayback Machine.

## Chosen architecture

Use an address-to-parcel enrichment pipeline with independent source adapters and one normalized evidence store. Each adapter returns facts and records using the same provenance contract. A coordinator runs low-cost authoritative sources first, observes source-specific budgets and timeouts, and returns partial results without blocking the analysis when an optional source fails.

The alternatives considered were continuing to scrape consumer listing pages, which is brittle and conflicts with access controls, and selecting one national aggregator as the sole source, which cannot represent municipal coverage or provenance accurately. A source-adapter architecture permits national coverage while adding authoritative local sources incrementally.

The pipeline has five stages:

1. **Identity resolution:** standardize the address, geocode it, resolve county FIPS and municipality, and attach parcel/APN when available.
2. **National enrichment:** query configured providers such as RentCast, PermitStack, FEMA, and other existing location services.
3. **Jurisdiction enrichment:** consult a jurisdiction registry and query official assessor, parcel, tax, recorder, permit, inspection, and code-enforcement services when supported.
4. **Evidence fusion:** normalize field values, preserve conflicts, choose a display value according to source precedence, and calculate confidence without erasing the underlying records.
5. **Gap selection:** identify the few unanswered fields that could materially change the score and present only those questions to the homeowner.

## Evidence and provenance contract

Every candidate fact must include:

- Stable field key and normalized value.
- Source name, source class, and source URL.
- Provider or jurisdiction record identifier when available.
- Retrieval timestamp and record date.
- Property match method: parcel, exact normalized address, coordinates, or user confirmation.
- Confidence: confirmed, strong, provisional, conflicting, unavailable, or historical.
- Scoring eligibility and the reason for that eligibility.
- Optional raw evidence reference retained server-side for audit.

Source precedence is parcel-matched official records, exact-address official records, licensed listing feeds, normalized commercial aggregators, permits, homeowner documents/photos, homeowner confirmation, and historical web evidence. This ordering does not make every official record current; field-specific rules can prefer a recent homeowner-confirmed value over an older assessor characteristic.

Conflicting values are retained. The public interface shows the selected value and a concise confirmation prompt only when the conflict can materially affect scoring. Admin tools retain all sources and the resolution decision.

## PermitStack property-history phase

Replace the single generic search-page dependency with a bounded property-history strategy based on [PermitStack's documented property endpoints](https://permit-stack.com/docs/):

1. Use `/v1/property/by-parcel` when a validated parcel/APN is available.
2. Otherwise use `/v1/property/history` with street address, city, state, and ZIP.
3. Fall back to the existing exact-address search only when the property endpoints are unavailable or return an ambiguous result.
4. Follow pagination within a configurable per-property request and record budget. Stop on an exhausted page, the provider's history-window boundary, a response-size limit, or the VPSF budget.
5. Store the provider's coverage block, data-through date, capture ratio, tier window, pages checked, records checked, and stop reason.
6. Return completeness as complete, partial, unknown, unavailable, or ambiguous. A miss never means no work occurred.
7. Deduplicate records by provider ID and permit number plus jurisdiction.
8. Fetch or retain detailed information only for score-relevant categories such as roofing, HVAC/mechanical, water heating, plumbing, windows, envelope, solar, battery, electrical panel, generator, additions, irrigation, and resilience work.

Permit evidence remains evidence rather than an installed-feature fact. A final reroof permit can support a provisional roof-installation year, but it does not establish current roof material or condition. The user may confirm or correct the inferred field. Scoring rules decide whether a provisional field is eligible; the enrichment layer does not award points.

The production status endpoint will expose configured limits, effective PermitStack history mode, page and record budget, provider coverage window when known, and the result of a safe authentication check. It must never expose credentials.

## Jurisdiction source registry

Create a server-side registry keyed by county FIPS and, where necessary, municipality. A registry entry describes:

- Authoritative agency and public source URL.
- Portal family: ArcGIS, Socrata, Accela, Tyler, OpenGov, CKAN, or custom.
- Supported datasets: parcels, assessor characteristics, tax, sales, permits, inspections, certificates of occupancy, code violations, zoning, and building footprints.
- Query identifier: APN, normalized address, coordinates, or local account number.
- Field mapping and date semantics.
- Freshness expectations, request limits, terms, and adapter status.

The first registry release should support a small benchmark set of jurisdictions in different states rather than pretending to be nationwide. Unsupported locations return a transparent unsupported status and continue with national sources. Crawl4AI Cloud or an official-site index may discover candidate public sources, but an admin must approve a new adapter and mapping before its fields become scoring-eligible.

## Listing and historical-web strategy

Do not bypass Zillow, Redfin, Realtor.com, MLS, or other CAPTCHA and login controls. Pasted URLs may be used to identify a provider, listing ID, or address when that information is publicly available. The property pipeline then enriches by address and parcel. Users can upload a listing PDF, screenshots, disclosures, inspection reports, or photographs.

Full listing facts and photos require a licensed MLS/RESO or authorized broker feed. Provider-specific API adapters must preserve licensing, display, retention, and attribution rules.

Wayback Machine records may provide historical listing descriptions, remodel claims, or old photographs. They are stored with `historical` confidence and are not scoring-eligible without corroboration from a current official record, document, photo analysis, or homeowner confirmation. Missing or excluded archives are ordinary unavailable results, not errors.

## Data flow and user experience

The address submission starts a property-enrichment job. Fast sources return the initial form while slower permit and local-record adapters continue in the background. Completed evidence merges into the same property archive only when the address and parcel identity still match the active home.

The homeowner sees populated fields, concise source labels where useful, and a short list of consequential gaps. Backend coverage diagnostics, provider errors, pagination, and source conflicts remain in admin views unless user action is required. Basic, Informed, and Superior analysis levels use the same facts and scoring rules; they differ only in the evidence and confirmations requested.

The UI must never claim that all public records were searched. It can state which source classes were checked and whether coverage was complete, partial, unavailable, or unknown.

## Persistence and APIs

Add normalized property identity, enrichment job, source result, evidence fact, and conflict-resolution records. Existing property snapshots continue to store the facts used for a score so historical results remain reproducible.

Introduce backend boundaries for:

- Resolve property identity and parcel candidates.
- Start or refresh an enrichment job.
- Read job status and merged evidence.
- Read PermitStack property history with completeness metadata.
- Register and test an admin-approved jurisdiction source.
- Preview conflicts and source precedence in admin.

Public APIs return only sanitized evidence needed by the form. Raw provider payloads, credentials, internal failure details, and ownership/contact fields are not exposed publicly.

## Reliability, privacy, and cost controls

- Use per-source timeouts, bounded response sizes, retries only for documented transient failures, and circuit breakers for failing providers.
- Cache parcel identity and slow-changing assessor facts longer than permits or listings.
- Enforce monthly provider budgets atomically across workers.
- Deduplicate concurrent enrichment jobs for the same property.
- Do not collect owner contact details for scoring.
- Treat source terms and robots restrictions as hard boundaries.
- Record adapter health, latency, cache hit rate, match rate, completeness, and cost per successful property.
- An optional provider failure never prevents manual analysis.

## Testing and rollout

- Unit tests cover address and parcel identity, pagination, deduplication, completeness states, coverage propagation, source precedence, conflicts, and scoring eligibility.
- Contract tests use recorded, redacted provider responses and reject unexpected response growth or schema drift.
- API tests cover configured and missing credentials, provider timeouts, rate limits, stale cache, concurrent jobs, and wrong-property responses.
- Frontend tests verify that late evidence cannot attach to a different address and that only consequential gaps become questions.
- A benchmark fixture spans at least ten states and a mix of ArcGIS, Socrata/Accela, custom assessor, covered PermitStack, and unsupported jurisdictions.
- Production rollout begins with PermitStack property history behind a feature flag. Compare match rate, permit count, latency, and cost against the current search for a controlled sample before making it the default.
- Jurisdiction adapters ship incrementally after source-specific validation. No deployment retroactively changes historical scores.

## Delivery phases

1. **PermitStack depth and completeness:** property-history/parcel endpoints, pagination budget, provenance schema, status reporting, tests, and feature-flagged rollout.
2. **Property identity:** county FIPS and parcel resolver with explicit ambiguity handling.
3. **Jurisdiction registry:** adapter interface plus a small multi-state benchmark set.
4. **Evidence fusion and smart gaps:** conflict storage, source precedence, confidence, and concise homeowner confirmation questions.
5. **Licensed listings and historical hints:** authorized MLS/RESO integration and optional non-scoring Wayback evidence.

## Out of scope

- Defeating CAPTCHA, login, paywall, robots, or provider access controls.
- Guaranteeing complete records in jurisdictions that do not publish them.
- Treating permits as proof of current condition or installed performance.
- Using owner contact information for scoring or lead generation.
- Automatically enabling an unreviewed municipal scraper for scoring.
- Changing VPSF point weights in this project.
