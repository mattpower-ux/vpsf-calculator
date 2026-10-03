import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = fileURLToPath(new URL("../", import.meta.url));
const topics = JSON.parse(readFileSync(join(project, "src/generated-series.json"), "utf8"));
const manifestPath = join(project, "src/seriesVisuals.json");

test("every narrated topic has distinct images and a sourced chart", () => {
  assert.ok(existsSync(manifestPath), "seriesVisuals.json is missing");
  const visuals = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(visuals.length, topics.length);
  for (const topic of topics) {
    const visual = visuals.find(({ id }) => id === topic.id);
    assert.ok(visual, `missing visuals for ${topic.id}`);
    assert.ok([1, 2].includes(visual.chartScene), `${topic.id} needs a chart in scene 1 or 2`);
    assert.equal(visual.photos.length, 3, `${topic.id} needs three photos`);
    assert.equal(new Set(visual.photos.map(({ file }) => file)).size, 3);
    for (const photo of visual.photos) {
      assert.ok(existsSync(join(project, "public", photo.file)), `missing ${photo.file}`);
      if (photo.article) {
        assert.match(photo.article, /^https:\/\/www\.greenbuildermedia\.com\//);
        if (photo.imageUrl) assert.match(photo.imageUrl, /^https:\/\/www\.greenbuildermedia\.com\//);
      }
    }
    assert.ok(visual.chart.title);
    assert.ok(visual.chart.unit);
    assert.ok(visual.chart.note);
    assert.ok(visual.chart.source);
    assert.ok(visual.chart.rows.length >= 2);
    for (const row of visual.chart.rows) {
      assert.ok(row.label);
      assert.ok(Number.isFinite(row.value) && row.value >= 0);
    }
  }
});
