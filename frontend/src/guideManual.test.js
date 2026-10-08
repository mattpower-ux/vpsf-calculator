import assert from "node:assert/strict";
import test from "node:test";

import { manualChapters, manualChapterAt } from "./guideManual.js";

const guide = {
  topics: [
    { id: "faq", title: "A question", faq: true, category: "Getting Started" },
    { id: "address", title: "Address and public records", category: "Property Data" },
    { id: "improve", title: "Using recommendations", category: "Improvements" },
    { id: "systems", title: "Documenting key systems", category: "Property Data" },
    { id: "score", title: "Reading the VPSF score", category: "Results" },
    { id: "limits", title: "Data, privacy, and limits", category: "Getting Started" }
  ]
};

test("manual groups chapters in reading order and numbers them to match the contents", () => {
  const chapters = manualChapters(guide);
  assert.deepEqual(chapters.map(({ id, number }) => [id, number]), [
    ["limits", 1], ["address", 2], ["systems", 3], ["score", 4], ["improve", 5]
  ]);
  assert.deepEqual(manualChapters(null), []);
});

test("manual navigation stays within the first and last chapter", () => {
  const chapters = manualChapters(guide);
  assert.equal(manualChapterAt(chapters, -1), null);
  assert.equal(manualChapterAt(chapters, 0)?.id, "limits");
  assert.equal(manualChapterAt(chapters, 4)?.id, "improve");
  assert.equal(manualChapterAt(chapters, 5), null);
});

test("Help opens a dedicated manual screen instead of expanding an inline list", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /function FullGuideScreen\(/);
  assert.match(source, /screen === 27 && <FullGuideScreen/);
  assert.match(source, /onOpenGuide\(guide\)/);
  assert.doesNotMatch(source, /<details className="helpBrowse">/);
});

test("saved-property data-pull question is absent from Help and the manual", async () => {
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile(new URL("../../backend/app/data/help_guide.json", import.meta.url), "utf8"));
  assert.ok(data.every(({ id, question }) => id !== "saved-property" && question !== "Will rescanning a saved property use another data pull?"));
  assert.ok(manualChapters({ topics: data }).every(({ id }) => id !== "saved-property"));
});

test("every Help entry has a concise lead and scannable points", async () => {
  const { readFile } = await import("node:fs/promises");
  const entries = JSON.parse(await readFile(new URL("../../backend/app/data/help_guide.json", import.meta.url), "utf8"));
  assert.equal(entries.length, 19);
  for (const entry of entries) {
    assert.ok(entry.body.split(/\s+/).length <= 30, `${entry.id} lead is too long`);
    assert.ok(entry.sections?.length >= 2, `${entry.id} needs entry points`);
    assert.ok(entry.sections.every(({ heading, text }) => heading && text && text.split(/\s+/).length <= 30), `${entry.id} has an overly long point`);
    const totalWords = [entry.body, ...entry.sections.map(({ heading, text }) => `${heading} ${text}`)].join(" ").split(/\s+/).length;
    assert.ok(totalWords <= (entry.id === "seven-pillars" ? 90 : 80), `${entry.id} is too wordy`);
  }
  assert.deepEqual(entries.find(({ id }) => id === "seven-pillars").sections.slice(0, 7).map(({ heading }) => heading), [
    "Energy", "Water", "Health", "Resilience", "Carbon & Materials", "Financial Risk", "Community & Mobility"
  ]);
});

test("Help answers, search results, and manual chapters render the same structured points", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /function GuideEntryBody\(/);
  assert.match(source, /<GuideEntryBody entry=\{entry\}/);
  assert.match(source, /<GuideEntryBody entry=\{results\[0\]\}/);
  assert.match(source, /<GuideEntryBody entry=\{chapter\}/);
});
