import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopPillarProgress, advanceDesktopPillar, selectDesktopPillar, desktopPillarDestination } from "./desktopPillarFlow.js";

test("advancing marks the current pillar complete and opens the next pillar", () => {
  const start = createDesktopPillarProgress();
  const next = advanceDesktopPillar(start);

  assert.equal(start.active, "energy");
  assert.deepEqual(next, { active: "water", completed: ["energy"], finished: false });
});

test("every pillar can be advanced without requiring all answers", () => {
  let progress = createDesktopPillarProgress();
  for (let index = 0; index < 7; index += 1) progress = advanceDesktopPillar(progress);

  assert.equal(progress.active, "community");
  assert.equal(progress.finished, true);
  assert.deepEqual(progress.completed, ["energy", "water", "health", "resilience", "carbon", "financial", "community"]);
});

test("completed pillars remain selectable for review without losing completion", () => {
  const progress = advanceDesktopPillar(advanceDesktopPillar(createDesktopPillarProgress()));
  const revisited = selectDesktopPillar(progress, "energy");

  assert.equal(revisited.active, "energy");
  assert.deepEqual(revisited.completed, ["energy", "water"]);
  assert.equal(revisited.finished, false);
  assert.equal(desktopPillarDestination(revisited), 29);
});

test("unknown pillar selections are ignored", () => {
  const progress = advanceDesktopPillar(createDesktopPillarProgress());
  assert.deepEqual(selectDesktopPillar(progress, "not-a-pillar"), progress);
});

test("finishing the final pillar routes forward to consolidated full review", () => {
  let progress = createDesktopPillarProgress();
  for (let index = 0; index < 7; index += 1) progress = advanceDesktopPillar(progress);

  assert.equal(desktopPillarDestination(progress), 3);
});
