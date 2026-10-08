import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pillar detail skip button names its Key Takeaway destination", async () => {
  const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /Skip to Key Takeaway <Sparkles size=\{18\} \/>/);
  assert.doesNotMatch(source, /Skip to Key Insights/);
});
