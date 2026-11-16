# Demo default and browser archive — November 16, 2026

- Entry and Restart show 53017 Double View Lane, Idyllwild, CA 92549, with the established demo photo/profile.
- My Scores → ARCHIVE stores completed raw inputs and exact score responses locally (50 runs, bounded storage).
- Reopen preserves original scores; edit generates a new run. Product recommendations may refresh.
- Lookup cancellation prevents delayed searches from replacing a reopened archive.
- Help describes browser-local retention and PDF export without claiming unavailable cross-device saving.

Validation: 216 frontend tests, 461 backend tests, production build. Phone 390×844 and laptop 1366×900 passed generation, archive, restart, reload, original-score restoration without another scoring request, input restoration, removal, and no horizontal overflow. See verify.mjs, results.json, and screenshots.

Corrected real-property check: live Mapbox returned an exact match for 4123 Harbor View Drive, Jacksonville, FL 32208 (Duval County). Photo endpoint returned not_configured; Google Street View key setup remains required. No photos from that address were attributed to the incorrect 123 Harbor View address.
