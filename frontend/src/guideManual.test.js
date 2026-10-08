import assert from "node:assert/strict";
import test from "node:test";

import { manualChapters, manualChapterAt } from "./guideManual.js";

const guide = {
  topics: [
    { id: "faq", title: "A question", faq: true, category: "Getting Started" },
    { id: "address", title: "Address and public records", category: "Property Data" },
    { id: "systems", title: "Documenting key systems", category: "Property Data" },
    { id: "score", title: "Reading the VPSF score", category: "Results" }
  ]
};

test("manual contains the existing non-FAQ guide chapters in source order", () => {
  const chapters = manualChapters(guide);
  assert.deepEqual(chapters.map(({ id, number }) => [id, number]), [
    ["address", 1], ["systems", 2], ["score", 3]
  ]);
  assert.deepEqual(manualChapters(null), []);
});

test("manual navigation stays within the first and last chapter", () => {
  const chapters = manualChapters(guide);
  assert.equal(manualChapterAt(chapters, -1), null);
  assert.equal(manualChapterAt(chapters, 0)?.id, "address");
  assert.equal(manualChapterAt(chapters, 2)?.id, "score");
  assert.equal(manualChapterAt(chapters, 3), null);
});

test("Help opens a dedicated manual screen instead of expanding an inline list", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /function FullGuideScreen\(/);
  assert.match(source, /screen === 27 && <FullGuideScreen/);
  assert.match(source, /onOpenGuide\(guide\)/);
  assert.doesNotMatch(source, /<details className="helpBrowse">/);
});
