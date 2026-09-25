import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ARCHIVE_PAGE_SIZE, getArchivePage } from "./archivePagination.js";
import { getArticleReaderUrl } from "./api/client.js";

const catalog = JSON.parse(readFileSync(new URL("./data/knowHowArticles.json", import.meta.url)));

test("all seven pillar collections contain substantial, unique clean-reader articles", () => {
  assert.deepEqual(Object.keys(catalog.pillars).sort(), ["carbon", "community", "energy", "financial", "health", "resilience", "water"]);
  for (const articles of Object.values(catalog.pillars)) {
    assert.ok(articles.length >= 50 && articles.length <= 100);
    assert.equal(new Set(articles.map((article) => article.url)).size, articles.length);
    for (const article of articles) {
      assert.ok(article.title.trim() && article.description.trim());
      assert.match(article.url, /^https:\/\/www\.greenbuildermedia\.com\/blog\/[^/]+$/);
      assert.match(getArticleReaderUrl(article.url), /\/api\/articles\/read\?url=/);
      if (article.date) assert.ok(!Number.isNaN(Date.parse(article.date)));
    }
  }
});

test("paging reaches every article exactly once including the last partial page", () => {
  for (const articles of Object.values(catalog.pillars)) {
    const { pageCount } = getArchivePage(articles);
    const visited = [];
    for (let page = 1; page <= pageCount; page++) {
      const result = getArchivePage(articles, page);
      assert.equal(result.start, (page - 1) * ARCHIVE_PAGE_SIZE + 1);
      assert.ok(result.articles.length <= ARCHIVE_PAGE_SIZE);
      visited.push(...result.articles);
    }
    assert.deepEqual(visited, articles);
    assert.equal(getArchivePage(articles, 999).page, pageCount);
    assert.equal(getArchivePage(articles, -2).page, 1);
  }
});

test("search checks title and description, ignores case, and resets out-of-range pages", () => {
  const articles = [
    { title: "Heat Pumps", description: "Comfort with efficient HVAC." },
    { title: "Better insulation", description: "Reduce heat loss." }
  ];
  assert.equal(getArchivePage(articles, 9, " HEAT hvac ").total, 1);
  assert.equal(getArchivePage(articles, 9, " HEAT hvac ").page, 1);
  const empty = getArchivePage(articles, 8, "zzzz");
  assert.deepEqual(empty.articles, []);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
  assert.equal(empty.pageCount, 1);
});
