# Heating and Resilience Update

October 23, 2026. Policy defaults are editable under admin Scores and Weighting; they are not measured energy savings or carbon-emission calculations.

## New Factors

- Condensing boiler with documented AFUE of at least 90%: +5 Energy, once for the HVAC equipment, not again for domestic hot water.
- Hydronic outdoor reset: +3 Energy; zoning plus outdoor reset: +5 instead of +3.
- Hydronic heat source: oil +0 Carbon, natural gas +5, air-to-water heat pump +10, ground-source heat pump +15. Unspecified, propane, and resistance-electric sources receive no new carbon bonus.
- Air-to-water or ground-source hydronic heat pump: +10 Energy. Normalize its equipment type to Hydronic Heating to prevent stacking the condensing-boiler bonus.
- Wildfire: defensible space or ember-resistant vents +5 Resilience; both as an ember-hardening package +10 instead.
- Extreme temperatures: air sealing or insulation upgrade +5 Resilience; both +10 instead.
- Wind/tornado: rated opening protection or engineered load path +5 Resilience; a FEMA/ICC safe room +10 instead. A safe room protects occupants, not the entire property.
- Unknown or absent features receive no new bonus. Existing pillar limits and the 1,000-point maximum remain unchanged.

Radiant is a distribution type, not proof of efficiency. Boiler AFUE is not heat-pump COP. Ground-source performance does not follow a universal 40 F outdoor-air cutoff. Electric resistance's high point-of-use conversion efficiency does not imply low cost or low carbon.

## Persistence and Recommendations

Startup appends a versioned model migration, retaining prior models and score runs. Existing factors, admin weights, budgets, and draft edits remain intact. Draft revisions advance to reject stale saves. The migration is applied once and does not re-enable subsequently retired factors.

Recommendations simulate improvements against the published model in order. Each gain is incremental after preceding steps, so overlapping credits and pillar caps are respected. Older results without an improvement plan show no invented estimates and ask for a new assessment.

## Verified Product Examples

- U.S. Boiler ALTA ALTAC-200, 95% AFUE: https://www.energystar.gov/productfinder/product/certified-boilers/details/2385559/export/pdf
- U.S. Boiler Alpine, 95% AFUE: https://www.usboiler.net/product/alpine-high-efficiency-condensing-gas-boiler.html
- Navien NCB-250/150H, 95% AFUE: https://www.navieninc.com/products/ncb-250-150h
- Boiler buying guidance: https://www.energystar.gov/products/boilers
- Ground-source background: https://www.energy.gov/hgeo/geothermal/geothermal-heat-pumps
- Outdoor reset: https://www.usboiler.net/outdoor-reset-doesnt-work.html
- Safe-room guidance: https://www.fema.gov/sites/default/files/documents/fema_rsl_fema-p-361-safe-rooms-for-tornadoes-and-hurricanes_042025.pdf

Product inquiries remain in VPSF's existing lead storage and admin workflow. No automatic manufacturer emailing or lead sale/distribution is implemented. Product brands do not earn standalone score points. Manufacturer specifications and certification should be rechecked for the exact model before purchase.
