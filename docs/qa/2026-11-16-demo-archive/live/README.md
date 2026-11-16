# Live demo archive verification — release 649c5d3

November 16, 2026. Chrome via cached Playwright ESM. Calculator: https://vpsf-calculator.onrender.com; API: https://vpsf-api.onrender.com.

Final result: PASS on phone 390×844 and laptop 1366×900, seven checks each.

- Generated the Basic California demo score; archived raw request and score response match exactly, including demoScenario and model metadata.
- My Scores → ARCHIVE displays the completed evaluation.
- Restart defaults to the California demo address.
- Reload preserves the archive unchanged.
- View saved score restores identical total, ranking and pillar scores, with no new score request (including 3.5 seconds of observation).
- Edit home details restores saved property inputs without scoring.
- Confirmed removal survives reload.

Final run: zero browser runtime errors, failed HTTP responses, or blocked requests. Exactly one POST to `/api/demos/hardie-wildfire/score` per viewport. The script blocks lead/tracking requests, non-demo scoring, and traffic outside the two authorized Render hosts. No lead submissions or real-property evaluations were made.

Twelve passing screenshots and `results.json` are in this directory. Reproduction script: `tmp/demo-archive-live.mjs` from the repository root.

The initial attempt during API rollout showed “We couldn't load the home details” before scoring. After the API deployment was confirmed, its demo endpoint returned HTTP 200 and a fresh complete run passed. Superseded rollout-failure artifacts were removed after validating the clean final results. No code fixes or deployment actions were performed during QA.
