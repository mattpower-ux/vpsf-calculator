import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resultForCurrentAssessment, requiresAssessmentScore } from "./scoreSession.js";

const assessed = { total: 360 };
const demo = { total: 520 };

test("an assessed home keeps its API score across results pages", () => {
  assert.equal(resultForCurrentAssessment("manual", demo, assessed), assessed);
  for (const screen of [4, 5, 6, 9, 10, 17, 18, 19]) {
    assert.equal(requiresAssessmentScore(screen), true);
  }
});

test("a missing assessed score never becomes the prefilled sample score", () => {
  assert.equal(resultForCurrentAssessment("manual", demo, null), null);
  assert.equal(resultForCurrentAssessment("demo", demo, assessed), demo);
  assert.equal(requiresAssessmentScore(23), false);
});

test("the app does not silently fall back to locally computed sample results", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /apiResult\s*\|\|\s*manualResult/);
  assert.doesNotMatch(source, /setApiResult\(manualResult\)/);
});
