import assert from "node:assert/strict";
import test from "node:test";

let buildMenuGroups;
try {
  ({ buildMenuGroups } = await import("./menuNavigation.js"));
} catch {
  // The first run records the missing menu behavior before implementation.
}

const pillars = [
  { key: "energy", label: "Energy" },
  { key: "water", label: "Water" }
];
const recommendations = [
  { id: "hvac", title: "Upgrade HVAC" },
  { id: "water-heater", title: "Install Heat Pump Water Heating" }
];

test("menu gives direct routes to the main calculator sections", () => {
  assert.equal(typeof buildMenuGroups, "function");
  const groups = buildMenuGroups(pillars, recommendations);
  assert.deepEqual(groups.map(({ title }) => title), ["Evaluate", "Results", "Explore", "Products & Value"]);
  const routes = groups.flatMap(({ items }) => items).map(({ target }) => target.screen);
  for (const screen of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 14, 17, 18, 19]) {
    assert.ok(routes.includes(screen), `missing section ${screen}`);
  }
  assert.ok(!routes.includes(12), "the temporary calculating screen must not be a destination");
});

test("knowledge buttons preserve their selected pillar or recommendation", () => {
  const groups = buildMenuGroups(pillars, recommendations);
  const items = groups.flatMap(({ items }) => items);
  assert.deepEqual(items.find(({ id }) => id === "pillar-energy").target, { screen: 10, pillar: "energy" });
  assert.deepEqual(items.find(({ id }) => id === "archive-water").target, { screen: 22, pillar: "water" });
  assert.deepEqual(items.find(({ id }) => id === "learn-water-heater").target, { screen: 21, recommendationId: "water-heater" });
});
