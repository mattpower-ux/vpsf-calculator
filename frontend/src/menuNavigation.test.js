import assert from "node:assert/strict";
import test from "node:test";

let buildMenuGroups;
let getResultsMenuItems;
let hasEntryNavigation;
try {
  ({ buildMenuGroups, getResultsMenuItems, hasEntryNavigation } = await import("./menuNavigation.js"));
} catch {
  // The first run records the missing menu behavior before implementation.
}

const pillars = [
  { key: "energy", label: "Energy" },
  { key: "water", label: "Water" },
  { key: "health", label: "Health" },
  { key: "resilience", label: "Resilience" },
  { key: "carbon", label: "Carbon & Materials" },
  { key: "financial", label: "Financial Risk" },
  { key: "community", label: "Community & Mobility" }
];
const recommendations = [
  { id: "hvac", title: "Upgrade HVAC" },
  { id: "water-heater", title: "Install Heat Pump Water Heating" }
];

test("menu gives direct routes to the main calculator sections", () => {
  assert.equal(typeof buildMenuGroups, "function");
  const groups = buildMenuGroups(pillars, recommendations);
  assert.deepEqual(groups.map(({ title }) => title), ["Evaluate", "Your Custom Results", "The Seven Pillars", "Building Science Basics", "Products & Value", "Share Your Score"]);
  const routes = groups.flatMap(({ items = [], target }) => target ? [{ target }] : items).map(({ target }) => target.screen);
  for (const screen of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 14, 17, 18, 19]) {
    assert.ok(routes.includes(screen), `missing section ${screen}`);
  }
  assert.ok(!routes.includes(12), "the temporary calculating screen must not be a destination");
});

test("knowledge buttons preserve their selected pillar or recommendation", () => {
  const groups = buildMenuGroups(pillars, recommendations);
  const items = groups.flatMap(({ items = [] }) => items);
  assert.deepEqual(items.find(({ id }) => id === "pillar-energy").target, { screen: 26, pillar: "energy" });
  assert.deepEqual(items.find(({ id }) => id === "archive-water").target, { screen: 22, pillar: "water" });
  assert.deepEqual(items.find(({ id }) => id === "learn-water-heater").target, { screen: 21, recommendationId: "water-heater" });
});

test("the seven pillar links sit together after Your Custom Results, not in Building Science Basics", () => {
  const groups = buildMenuGroups(pillars, recommendations);
  const pillarGroup = groups.find(({ title }) => title === "The Seven Pillars");
  assert.deepEqual(pillarGroup.items.map(({ id }) => id), pillars.map(({ key }) => `pillar-${key}`));
  assert.deepEqual(pillarGroup.items.map(({ target }) => target), pillars.map(({ key }) => ({ screen: 26, pillar: key })));
  assert.ok(!pillarGroup.items.some(({ target }) => target.screen === 10), "menu definitions must not open a home's score detail");
  assert.ok(!groups.find(({ title }) => title === "Building Science Basics").items.some(({ id }) => id.startsWith("pillar-")));
});

test("My Scores uses the same links and destinations as Your Custom Results", () => {
  assert.deepEqual(getResultsMenuItems(pillars, recommendations), buildMenuGroups(pillars, recommendations).find(({ title }) => title === "Your Custom Results").items);
});

test("sharing is a direct top-level destination, separate from products", () => {
  const groups = buildMenuGroups(pillars, recommendations);
  assert.deepEqual(groups.find(({ title }) => title === "Share Your Score").target, { screen: 8 });
  assert.ok(!groups.find(({ title }) => title === "Products & Value").items.some(({ target }) => target.screen === 8));
});

test("entry and edit screens keep the bottom navigation available", () => {
  assert.equal(typeof hasEntryNavigation, "function");
  for (const screen of [0, 1, 2, 3, 14]) assert.equal(hasEntryNavigation(screen), true);
  for (const screen of [4, 11, 12, 23]) assert.equal(hasEntryNavigation(screen), false);
});
