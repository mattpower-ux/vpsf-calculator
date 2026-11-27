import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const desktopSource = () => readFileSync(new URL("./DesktopCalculatorChrome.jsx", import.meta.url), "utf8");
const appSource = () => readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("desktop chrome provides the approved workflow and return control", () => {
  const source = desktopSource();
  for (const label of ["Choose the home", "Document the home", "Review scores", "Explore recommendations"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Return to mobile view/);
  assert.match(source, /YOUR AUDIT/);
  assert.match(source, /Why we.re asking/);
});

test("mobile chrome exposes the desktop switch above the measuring footer", () => {
  const source = appSource();
  const switchIndex = source.indexOf("Open Desktop Version");
  const measuringIndex = source.indexOf("MEASURING");
  assert.ok(switchIndex >= 0);
  assert.ok(switchIndex < measuringIndex);
});

test("application chooses one shell around one shared active screen tree", () => {
  const source = appSource();
  assert.match(source, /viewMode === "desktop"/);
  assert.match(source, /<DesktopCalculatorChrome/);
  assert.match(source, /<MobileCalculatorChrome/);
  assert.doesNotMatch(source, /desktopChildren|mobileChildren/);
});

