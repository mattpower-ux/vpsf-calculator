import assert from "node:assert/strict";
import test from "node:test";
import { bottomNavigationItems } from "./bottomNavigation.js";

test("bottom navigation keeps Restart and Menu while opening My Scores and Help", () => {
  assert.deepEqual(bottomNavigationItems.map(({ label, screen }) => [label, screen]), [
    ["Restart", 0],
    ["My Scores", 24],
    ["Help?", 25],
    ["Menu", 23]
  ]);
});
