import assert from "node:assert/strict";
import test from "node:test";
import { DESKTOP_STAGES, desktopContextForScreen } from "./desktopWorkflow.js";

test("desktop workflow exposes the approved four stages", () => {
  assert.deepEqual(DESKTOP_STAGES.map(stage => stage.label), [
    "Choose the home",
    "Document the home",
    "Review scores",
    "Explore recommendations"
  ]);
});

test("desktop workflow maps core production screens to their stages", () => {
  assert.equal(desktopContextForScreen(0).stage, 1);
  for (const screen of [1, 2, 3, 11, 14, 29, 30]) assert.equal(desktopContextForScreen(screen).stage, 2);
  for (const screen of [4, 5, 9, 10, 12, 24, 31]) assert.equal(desktopContextForScreen(screen).stage, 3);
  for (const screen of [6, 7, 8, 13, 15, 16, 17, 18, 19, 20, 21, 22, 28]) assert.equal(desktopContextForScreen(screen).stage, 4);
});

test("desktop workflow gives every production screen a safe context", () => {
  for (let screen = 0; screen <= 31; screen += 1) {
    const context = desktopContextForScreen(screen);
    assert.ok(context.stage >= 1 && context.stage <= 4, `screen ${screen}`);
    assert.equal(typeof context.title, "string");
    assert.ok(context.title.length > 0);
  }
});

