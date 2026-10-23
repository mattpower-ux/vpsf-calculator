import test from "node:test";
import assert from "node:assert/strict";
import { phonePrototypeEnabled } from "./phonePrototype.js";

test("phone layout follows the device, not a narrow desktop embed", () => {
  assert.equal(phonePrototypeEnabled(false, "", 390, 844), true);
  assert.equal(phonePrototypeEnabled(false, "", 1440, 900), false);
  assert.equal(phonePrototypeEnabled(false, "", 768, 1024), false);
  assert.equal(phonePrototypeEnabled(true, "?phonePreview=1"), true);
  assert.equal(phonePrototypeEnabled(true, ""), false);
  assert.equal(phonePrototypeEnabled(false, "?phonePreview=1"), false);
});
