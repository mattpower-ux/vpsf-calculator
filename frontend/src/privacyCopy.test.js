import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("the unsupported privacy assurance is not shown in the calculator", async () => {
  const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Your data is secure and private\./i);
  assert.doesNotMatch(source, /className="privacy(?: small)?"/);
});
