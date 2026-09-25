import assert from "node:assert/strict";
import test from "node:test";
import { wildfireAdjustment, wildfireExplanation } from "./wildfire.js";

const home = {
  latitude: 39.7596, longitude: -121.6219,
  wildfire: {
    source: "USFS Wildfire Risk to Communities", datasetVersion: "wrc-2024", status: "available",
    latitude: 39.7596, longitude: -121.6219, nationalPercentile: 95,
    areaType: "community", areaName: "Test community, CA"
  }
};

test("fallback uses the same percentile thresholds and weights as the backend", () => {
  for (const [rank, delta] of [[0, 10], [39.99, 10], [40, 0], [69.99, 0], [70, -10], [89.99, -10], [90, -20], [100, -20]]) {
    const input = { ...home, wildfire: { ...home.wildfire, nationalPercentile: rank } };
    assert.equal(wildfireAdjustment(input), delta);
    assert.match(wildfireExplanation(input), /not a home fire-resistance assessment/);
  }
});

test("missing, stale and mismatched data never earns a low-risk bonus", () => {
  for (const overrides of [
    { status: "unavailable" }, { status: "no_data" }, { nationalPercentile: null },
    { nationalPercentile: NaN }, { nationalPercentile: -1 }, { nationalPercentile: 101 },
    { latitude: 30 }, { longitude: null }, { source: "unverified" }, { datasetVersion: "old" }, { areaType: null }
  ]) {
    assert.equal(wildfireAdjustment({ ...home, wildfire: { ...home.wildfire, ...overrides } }), 0);
  }
  assert.equal(wildfireAdjustment({}), 0);
  assert.equal(wildfireAdjustment({ ...home, latitude: null }), 0);
  assert.equal(wildfireAdjustment(JSON.parse(JSON.stringify(home))), -20);
});
