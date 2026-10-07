import assert from "node:assert/strict";
import test from "node:test";
import { ecoTips, ecoTipForVisit, nextMenuVisit } from "./ecoTips.js";

test("first menu visit shows the irrigation tip and each reopening advances", () => {
  assert.equal(ecoTips[0].id, "irrigation");
  const first = nextMenuVisit(-1);
  assert.equal(first, 0);
  assert.equal(ecoTipForVisit(first).id, "irrigation");
  assert.notEqual(ecoTipForVisit(nextMenuVisit(first)).id, "irrigation");
  assert.equal(ecoTipForVisit(ecoTips.length).id, "irrigation");
});

test("each eco-tip has display copy, a local image key, and a primary source", () => {
  assert.ok(ecoTips.length >= 3);
  for (const tip of ecoTips) {
    assert.ok(tip.text);
    assert.ok(tip.image);
    assert.match(tip.source, /^https:\/\/(www\.)?(epa|energy)\.gov\//);
  }
});
