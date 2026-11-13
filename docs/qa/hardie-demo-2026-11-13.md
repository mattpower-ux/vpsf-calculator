# Idyllwild presentation verification — November 13, 2026

Default intake: 53017 Double View Lane, Idyllwild, CA 92549. This is a fictional address; the UI has no demo label at Matt's request. Internal provenance preserves scenario assumptions. Coordinates represent the Idyllwild neighborhood; USFS 2024 community risk snapshot was checked November 13, 2026 (99.9 national percentile, not a probability of the home burning).

Building scenario: wood clapboard siding, asphalt shingles aged 20 years, no recorded wildfire protection or FORTIFIED certification. Existing scoring model produces Resilience 20/200 without a score override. Siding and roof age guide recommendations; no invented siding score gain. All ordinary users keep the same scoring model.

## Verified journeys
- Laptop 1366 x 768: initial address → Start Existing Home Scan → Review → Generate Score → Resilience → Recommendations → Product Options → James Hardie details.
- Phone 390 x 844: initial address → Review → Generate Score → Key Takeaway → Explore resilience options → James Hardie details.
- First resilience match: Hardie Plank Fiber Cement Lap Siding, marked Sponsored · James Hardie. Explanation connects combustible siding and regional exposure; wall-assembly verification and no fireproof guarantee retained.
- Manufacturer reference uses the official James Hardie fire-resistance page and opens separately, retaining the evaluation.
- No horizontal overflow in either viewport; fixed product detail hero collapsing under flex shrink.
- Normalized fictional address variations bypass paid lookup/archive writes; preview scoring uses the published model and shared EPA evidence preparation without creating property, score-run or lead records.
- Fiber-cement siding or unavailable/mismatched regional wildfire evidence suppresses the siding replacement match.

## Checks
146 backend tests, 87 frontend tests, production Vite build, git diff --check. Independent code review: no remaining blockers. Existing Vite large-bundle warning remains.

## Scope
This release supplies the presentation and reusable combustible-siding matching. It does not add a new earthquake hazard adapter or change flood scoring weights. Regional USFS evidence is community-level screening, not a parcel inspection.
