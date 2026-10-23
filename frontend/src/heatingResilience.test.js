import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { heatingResilienceDefaults, heatingResilienceOptions, assessmentImprovements, heatingSelectionPatch } from "./heatingResilience.js";

test("new heating and resilience facts default to unknown rather than earning assumed points", () => {
  for (const [field, value] of Object.entries(heatingResilienceDefaults)) {
    assert.equal(value, "Unknown");
    assert.ok(heatingResilienceOptions[field].includes(value));
  }
  assert.ok(heatingResilienceOptions.heatingDistribution.includes("Hydronic Radiant"));
  assert.ok(heatingResilienceOptions.hydronicSource.includes("Heating Oil"));
  assert.ok(heatingResilienceOptions.hydronicSource.includes("Ground-Source Heat Pump"));
});

test("recommendations retain server estimates without inventing points for older saved results", () => {
  assert.deepEqual(assessmentImprovements({ total: 450 }), []);
  const item = { id: "heating-controls", gainPoints: 3 };
  assert.deepEqual(assessmentImprovements({ improvements: [item, { gainPoints: 0 }] }), [item]);
});

test("recommendations and path use the assessed model and never default to water products", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /<Recommendations result=\{result\}/);
  assert.match(app, /const steps = assessmentImprovements\(result\)/);
  assert.doesNotMatch(app, /demoMatchingProducts\[recommendation.id\] \|\| demoMatchingProducts/);
});

test("switching from hydronic heat pump to boiler clears the incompatible heat source", () => {
  assert.equal(heatingSelectionPatch({ hydronicSource: "Ground-Source Heat Pump" }, "hvac", "Condensing Boiler (AFUE 90%+)").hydronicSource, "Unknown");
  assert.equal(heatingSelectionPatch({}, "hydronicSource", "Air-to-Water Heat Pump").hvac, "Hydronic Heating");
  assert.equal(heatingSelectionPatch({}, "heatingDistribution", "Electric Radiant").heatingControls, "Unknown");
});
