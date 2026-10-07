import test from "node:test";
import assert from "node:assert/strict";
import { assessedHomeAddress } from "./assessedHomeAddress.js";

test("shows the current scanned home's entered address", () => {
  assert.equal(assessedHomeAddress({ resultMode: "manual", home: { address: "1313 Margo Lane, Orlando, FL" }, hasAssessedHome: true }), "1313 Margo Lane, Orlando, FL");
});

test("shows the selected listing rather than stale manual data", () => {
  assert.equal(assessedHomeAddress({ resultMode: "demo", selectedProperty: { address: "100 Vision Way, Orlando, FL" }, home: { address: "123 Harbor View Dr." } }), "100 Vision Way, Orlando, FL");
});

test("does not present the default home as an assessed property", () => {
  assert.equal(assessedHomeAddress({ resultMode: "manual", home: { address: "123 Harbor View Dr." } }), "");
});
