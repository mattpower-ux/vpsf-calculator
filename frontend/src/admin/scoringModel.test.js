import test from "node:test";
import assert from "node:assert/strict";
import { addFactor, retireFactor, splitFactor, totalBudget } from "./scoringModel.js";

const model = { pillars: { energy: 200, water: 100, health: 200, resilience: 200, carbon: 150, financial: 100, community: 50 }, factors: [{ id: "solar_pv", label: "Solar PV", pillar: "energy", field: "solar", mode: "contains", points: 10, matches: ["Solar PV"], active: true }], customFields: [] };

test("budget stays explicit and retirement removes contribution", () => {
  assert.equal(totalBudget(model), 1000);
  assert.equal(retireFactor(model, "solar_pv").factors[0].active, false);
});

test("adding and splitting factors keeps stable IDs", () => {
  const added = addFactor(model, { id: "new_factor", label: "New", pillar: "water", field: "leak", mode: "equals", points: 4, matches: ["Auto"], active: true });
  assert.equal(added.factors.length, 2);
  const split = splitFactor(model, "solar_pv");
  assert.equal(split.factors.filter((factor) => factor.parentId === "solar_pv").length, 2);
  assert.equal(split.factors.find((factor) => factor.id === "solar_pv").active, false);
});
