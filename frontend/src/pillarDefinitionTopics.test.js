import assert from "node:assert/strict";
import test from "node:test";

import { pillarDefinitionTopics } from "./pillarDefinitionTopics.js";

test("every scoring pillar has general educational topics", () => {
  const keys = ["energy", "water", "health", "resilience", "carbon", "financial", "community"];
  assert.deepEqual(Object.keys(pillarDefinitionTopics), keys);
  for (const key of keys) {
    assert.ok(pillarDefinitionTopics[key].intro.length > 40, `${key} needs a plain-language introduction`);
    assert.ok(pillarDefinitionTopics[key].topics.length >= 3, `${key} needs useful definition topics`);
    assert.ok(pillarDefinitionTopics[key].topics.every((topic) => typeof topic === "string" && topic.length > 12));
  }
});
