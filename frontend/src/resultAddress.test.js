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

test("Report Card has one restart route in the bottom navigation", async () => {
  const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  const start = source.indexOf("function LabelScreen(");
  const end = source.indexOf("\nexport default function App()", start);
  const reportCard = source.slice(start, end);
  assert.doesNotMatch(reportCard, /Start New Evaluation/);
  assert.match(reportCard, /<BottomNav/);
  const nav = await readFile(new URL("./bottomNavigation.js", import.meta.url), "utf8");
  assert.match(nav, /Restart/);
});
