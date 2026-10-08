import assert from "node:assert/strict";
import test from "node:test";

import { buildReportModel } from "./reportModel.js";

const pillars = [
  { key: "energy", label: "Energy", short: "Energy", max: 200 },
  { key: "water", label: "Water", short: "Water", max: 100 },
  { key: "health", label: "Health", short: "Health", max: 200 },
  { key: "resilience", label: "Resilience", short: "Resilience", max: 200 },
  { key: "carbon", label: "Carbon & Materials", short: "Carbon", max: 150 },
  { key: "financial", label: "Financial Risk", short: "Financial", max: 100 },
  { key: "community", label: "Community & Mobility", short: "Community", max: 50 }
];

const result = {
  total: 360,
  scores: { energy: 40, water: 20, health: 80, resilience: 60, carbon: 50, financial: 70, community: 40 }
};

const products = [
  { id: "rheem-proterra", name: "Rheem ProTerra Heat Pump Water Heater", category: "Energy + Water" },
  { id: "rainwater-management", name: "Rainwater Management Solutions Tank", category: "Water" },
  { id: "certainteed-impact-shingles", name: "CertainTeed Impact Resistant Shingles", category: "Resilience" },
  { id: "renewaire-erv", name: "RenewAire Energy Recovery Ventilator", category: "Health" }
];

test("report summarizes only the assessed scores and ranks product options by score gaps", () => {
  const model = buildReportModel(result, { address: "1313 Cognition Drive", city: "Orlando", state: "FL", zip: "32825" }, pillars, products);
  assert.equal(model.address, "1313 Cognition Drive, Orlando, FL 32825");
  assert.equal(model.total, 360);
  assert.equal(model.rating, "High Risk");
  assert.equal(model.scores.length, 7);
  assert.equal(model.weakest.key, "energy");
  assert.equal(model.strongest.key, "community");
  assert.deepEqual(model.products.map(({ id }) => id), ["rheem-proterra", "rainwater-management", "certainteed-impact-shingles"]);
  assert.ok(model.products.every(({ url }) => url.startsWith("https://")));
  assert.ok(!model.overview.includes("savings"));
});

test("report excludes unknown manufacturers rather than creating unverified links", () => {
  const model = buildReportModel(result, {}, pillars, [{ id: "unverified", name: "Unknown Product", pillar: "Water" }]);
  assert.deepEqual(model.products, []);
  assert.equal(model.address, "Property address not provided");
});
