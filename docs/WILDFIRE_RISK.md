# USFS Wildfire Location Context

## Source and Scope

The free USDA Forest Service (USFS, not USFA) Wildfire Risk to Communities
dataset supplies regional context, not a parcel inspection, home fire-resistance
rating, insurance quote, current fire alert, or future climate forecast.
No API key or paid ATTOM/RentCast request is needed for the wildfire lookup.

- Source: https://wildfirerisk.org/
- Limitations: https://wildfirerisk.org/about/faq/
- Downloads: https://wildfirerisk.org/download/
- Official USFS web map: https://www.arcgis.com/home/item.html?id=00303ccd4d4047be9dbc715a845f029d
- Community service: https://services1.arcgis.com/gGHDlz6USftL5Pau/arcgis/rest/services/place_boundaries_conus_ak_hi/FeatureServer/0
- County service: https://services1.arcgis.com/gGHDlz6USftL5Pau/arcgis/rest/services/county_boundaries_conus_ak_hi/FeatureServer/0

Service schemas and map expressions checked September 25, 2026. The published
risk model is the 2024 release; `vintage` is the boundary vintage, not the fire
model year. Store both separately. Revalidate services and change the cache
dataset version when adopting a new model release.

## Lookup and Storage

`POST /api/properties/risk` uses verified latitude/longitude for a point-in-polygon
community lookup, falling back to county context outside covered communities,
for excluded/missing community data, or if the community service fails.
Never substitute a statewide average or claim parcel-level precision.
FEMA and USFS run independently. Network/ArcGIS errors remain unknown and retryable.

`RISK_NATIO` is a percentage-formatted national rank of the area's risk to
potential structures. It is NOT the annual probability that this house burns.
The official map classifies ranks <40 as Low, <70 as Medium, <90 as High,
and 90-100 as Very High, within the corresponding geography type.

The `wildfire_risk_cache` table stores successful and no-data results by dataset
version and coordinates rounded to six decimals in the existing database
(`/var/data/vpsf.db` on Render). A new table is created automatically at startup.
Results also travel with property query archives and score input snapshots,
including coordinates, area, scope, boundary vintage, and retrieval time.
Saved scans with results reuse their snapshot without a property-data lookup.
Saved scans with coordinates but no result can use the free risk endpoint;
legacy archives without coordinates remain unknown rather than spending a paid
geocode/property lookup or guessing location. A changed address clears the old
coordinates and wildfire context. No new environment variables or disk are required.

## Initial VPSF Scoring Policy

Model version: `vpsf-0.2.0-usfs`.

| USFS relative area risk | Resilience adjustment |
| --- | ---: |
| Low | +10 |
| Medium | 0 |
| High | -10 |
| Very High | -20 |
| Missing, unavailable, or mismatched location | 0 |

These bounded, provisional point adjustments are a VPSF editorial policy, not
USFS-endorsed weights or actuarially calibrated losses. They are added to the
existing Resilience score and clamped to 0-200. Other pillar scores and the
1,000-point total scale are unchanged. Existing home-hardening inputs retain
their existing credit; a map result does not certify those features. The admin
regional profile percentages are separate and are not overwritten.

Both backend scoring and the browser's offline fallback use the same thresholds.
The Resilience explanation identifies the area's risk, geographic scope and
applied policy adjustment. Original saved score runs retain their model version;
generating a new score uses the current policy.

## Verification

Backend: `.venv312/Scripts/python.exe -m pytest tests` from `backend`.
Frontend: `node --test src/wildfire.test.js` and `npm run build` from `frontend`.
Tests cover classification boundaries, unknowns, coordinate mismatch, independent
provider failure, county fallback, persistent cache, saved address aliases,
score snapshots, preserved hardening credits, and browser scoring parity.
