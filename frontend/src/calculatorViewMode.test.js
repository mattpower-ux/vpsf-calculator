import assert from "node:assert/strict";
import test from "node:test";
import {
  CALCULATOR_VIEW_MODE_KEY,
  normalizeCalculatorViewMode,
  readCalculatorViewMode,
  writeCalculatorViewMode
} from "./calculatorViewMode.js";

function storageWith(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    value(key) { return values.get(key); }
  };
}

test("calculator view mode defaults invalid or missing values to mobile", () => {
  assert.equal(normalizeCalculatorViewMode(undefined), "mobile");
  assert.equal(normalizeCalculatorViewMode("wide"), "mobile");
  assert.equal(readCalculatorViewMode(storageWith()), "mobile");
  assert.equal(readCalculatorViewMode(storageWith({ [CALCULATOR_VIEW_MODE_KEY]: "broken" })), "mobile");
});

test("calculator view mode restores and persists either supported presentation", () => {
  const storage = storageWith({ [CALCULATOR_VIEW_MODE_KEY]: "desktop" });
  assert.equal(readCalculatorViewMode(storage), "desktop");
  writeCalculatorViewMode(storage, "mobile");
  assert.equal(storage.value(CALCULATOR_VIEW_MODE_KEY), "mobile");
});

test("calculator view mode tolerates unavailable browser storage", () => {
  assert.equal(readCalculatorViewMode({ getItem() { throw new Error("blocked"); } }), "mobile");
  assert.doesNotThrow(() => writeCalculatorViewMode({ setItem() { throw new Error("blocked"); } }, "desktop"));
});

