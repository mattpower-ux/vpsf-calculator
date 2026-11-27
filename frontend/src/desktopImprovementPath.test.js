import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { productsForRecommendation } from "./desktopImprovementPath.js";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

const products = [
  { id: "siding-partner", product: "Partner siding", category: "Siding", pillars: ["resilience", "energy"], needTags: ["fire-resistant-siding"], isSponsored: true },
  { id: "heat-pump-standard", product: "Standard heat pump", category: "Heat Pumps", pillar: "energy", needTags: ["heating"] },
  { id: "heat-pump-partner", product: "Partner heat pump", category: "Heat Pumps", pillar: "energy", needTags: ["heating"], isSponsored: true },
  { id: "heat-pump-water-heater", product: "Heat pump water heater", category: "Water Heating", pillars: ["energy", "water"], needTags: ["water-heating"] },
  { id: "roofing", product: "Roofing", pillars: ["resilience"], needTags: ["roofing"] },
  { id: "window", product: "Windows", category: "Windows", pillar: "resilience", needTags: ["windows"] },
  { id: "ember-soffit", product: "Ember-resistant soffit", category: "Soffits", pillar: "resilience", needTags: ["ember-protection"] },
  { id: "faucet", product: "Efficient faucet", pillar: "water", needTags: ["faucets"] }
];

test("heat-pump recommendations prioritize matching products and never recycle energy-related siding", () => {
  assert.deepEqual(
    productsForRecommendation({ title: "Heat Pump Heating", pillar: "energy" }, products).map(product => product.id),
    ["heat-pump-partner", "heat-pump-standard"]
  );
  assert.deepEqual(
    productsForRecommendation({ title: "Heat Pump Water Heater", pillar: "energy" }, products).map(product => product.id),
    ["heat-pump-water-heater"]
  );
});

test("desktop improvement path matches siding, roofing, and water topics before broad pillars", () => {
  assert.deepEqual(productsForRecommendation({ title: "Noncombustible Siding", pillar: "resilience" }, products).map(product => product.id), ["siding-partner"]);
  assert.deepEqual(productsForRecommendation({ title: "Replace an aging roof", pillar: "resilience" }, products).map(product => product.id), ["roofing"]);
  assert.deepEqual(productsForRecommendation({ title: "Use efficient faucets", pillarGains: { water: 12 } }, products).map(product => product.id), ["faucet"]);
  assert.deepEqual(productsForRecommendation({ title: "Ember hardening", pillar: "resilience" }, products).map(product => product.id), ["ember-soffit"]);
});

test("desktop improvement path uses pillar fallback and returns an empty list without fabricating products", () => {
  assert.deepEqual(productsForRecommendation({ title: "General resilience upgrade", pillar: "resilience" }, products).map(product => product.id), ["siding-partner", "roofing"]);
  assert.deepEqual(productsForRecommendation({ pillar: "community" }, products), []);
});

test("desktop product sets include a filtered More like this action and a TK empty state", () => {
  assert.match(appSource, /className="moreLikeThis"/);
  assert.match(appSource, /More like this/);
  assert.match(appSource, /className="desktopRecProductPlaceholder"/);
  assert.match(appSource, />TK</);
});

