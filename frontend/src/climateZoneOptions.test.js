import assert from "node:assert/strict";
import test from "node:test";
import { climateZoneOptionsFor } from "./climateZoneOptions.js";

test("the climate selector includes Bangor's county-derived zone", () => {
  assert.ok(climateZoneOptionsFor("6A - Cold Humid").includes("6A - Cold Humid"));
});

test("an unknown or unmatched zone never appears as 1A", () => {
  assert.equal(climateZoneOptionsFor("Unknown")[0], "Unknown");
  assert.equal(climateZoneOptionsFor("Unverified local zone")[0], "Unverified local zone");
});
