import assert from "node:assert/strict";
import test from "node:test";
import { getArticleReaderUrl } from "./client.js";

test("article, transcript and topic links use the clean reader", () => {
  for (const path of ["/blog/healthy-home", "/blog/mechanical-ventilation.-heres-why", "/transcripts/healthy-home", "/blog/topic/healthy-homes", "/blog/topic/healthy-homes/page/2"])
    for (const host of ["www.greenbuildermedia.com", "greenbuildermedia.com"]) {
      const source = `https://${host}${path}`;
      const reader = new URL(getArticleReaderUrl(source));
      assert.equal(reader.pathname, "/api/articles/read");
      assert.equal(reader.searchParams.get("url"), source);
    }
});

test("PDFs, other sites and unsupported topic routes are not proxied", () => {
  for (const source of [
    "https://www.greenbuildermedia.com/hubfs/guide.pdf", "https://www.greenbuildermedia.com/",
    "https://other.example/blog/topic/healthy-homes", "https://www.greenbuildermedia.com.evil.example/blog/test",
    "https://www.greenbuildermedia.com:8000/blog/test", "https://user@www.greenbuildermedia.com/blog/test",
    "https://www.greenbuildermedia.com/blog/topic/healthy-homes/page/0",
    "https://www.greenbuildermedia.com/blog/topic/healthy-homes/page/2/extra"
  ]) assert.equal(getArticleReaderUrl(source), source);
});
