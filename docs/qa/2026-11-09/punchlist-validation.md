# Sara's first-batch fixes — November 9, 2026

## Scope
- Replace the fixed Future Cost Exposure values with explicit national replacement planning ranges for the home's roof, primary HVAC and water heater. Preserve unknowns, show assumptions and source links, and identify the subtotal as partial. Local utility rates, incentives and additional upgrade categories remain later work.
- Prevent the report card from shrinking and hiding its download/share controls.
- Route Menu > Product Categories to the complete catalog directory, retaining recommendation-specific product matches separately.

## Verification
- Production Vite build passed.
- 78 frontend/API-client/admin model tests passed (including cost-model and category regressions).
- Before the report fix: card client height 515px, content 642px; screen could not scroll to the hidden controls.
- After the fix: card and content both 642px; outer screen scrolls normally.
- Browser checked laptop 1366 × 768 and phone 390 × 844 with the actual phone CSS enabled via the development preview option. No horizontal overflow in the revised report or cost screen; report controls remain above the bottom navigation after scrolling.
- PDF download button produced the success status; existing PDF tests cover one-page dimensions, links, long addresses and missing products.
- Category selection, product details, return to filtered products, and Back to directory verified in the browser.
- Live catalog read before deployment: 13 products across 7 distinct categories. Local offline fallback has 4 products across 4 categories; directory is derived from whichever catalog is loaded.

Screenshots retained locally alongside this note: report-laptop.png, report-phone.png, cost-phone.png.
