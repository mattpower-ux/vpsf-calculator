import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("every custom result page shows the current street below its heading", async () => {
  const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  for (const component of ["Dashboard", "PillarBreakdown", "Recommendations", "PathTo700Screen", "FutureCostExposureScreen", "CompetingHomeComparisonScreen", "LabelScreen"]) {
    const start = source.indexOf(`function ${component}(`);
    assert.ok(start >= 0, `${component} exists`);
    const next = source.indexOf("\nfunction ", start + 1);
    const block = source.slice(start, next < 0 ? undefined : next);
    assert.match(block, /<ResultStreetAddress streetAddress=\{streetAddress\} \/>/, `${component} includes the subtitle`);
  }
  assert.match(source, /streetAddress=\{streetAddress\}/);
  assert.match(source, /className="reportProperty"/);
});
