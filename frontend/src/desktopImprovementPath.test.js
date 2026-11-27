import assert from "node:assert/strict";
import test from "node:test";
import { productsForRecommendation } from "./desktopImprovementPath.js";

const products = [
  { id: "partner", name: "Partner siding", pillar: "resilience", isSponsored: true },
  { id: "standard", name: "Roofing", pillars: ["resilience"] },
  { id: "third", name: "Windows", category: "resilience windows" },
  { id: "water", name: "Efficient faucet", pillar: "water" }
];

test("desktop improvement path keeps relevant catalog order and limits each recommendation to two products", () => {
  assert.deepEqual(productsForRecommendation({ pillar: "resilience" }, products).map(product => product.id), ["partner", "standard"]);
});

test("desktop improvement path matches pillar gains and returns an empty list without fabrication", () => {
  assert.deepEqual(productsForRecommendation({ pillarGains: { water: 12 } }, products).map(product => product.id), ["water"]);
  assert.deepEqual(productsForRecommendation({ pillar: "community" }, products), []);
});

