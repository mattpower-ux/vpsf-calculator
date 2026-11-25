import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { themeFromSearch } from "./theme.js";

test("legacy GreenPro links use the current approved brand", () => {
  assert.equal(themeFromSearch("?theme=greenpro"), "brand");
});

test("uses the approved brand styling by default and keeps the preview URL compatible", () => {
  assert.equal(themeFromSearch(""), "brand");
  assert.equal(themeFromSearch("?theme=brandpreview"), "brand");
  assert.equal(themeFromSearch("?theme=brand"), "brand");
});

test("unknown themes fall back to the branded calculator", () => {
  assert.equal(themeFromSearch("?theme=unknown"), "brand");
});

test("the branded calculator uses the approved logo and a self-hosted UI font", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const entry = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
  assert.match(app, /brandPreviewLogo/);
  assert.match(app, /data-theme="brand"/);
  assert.match(app, /Source Sans 3 Variable/);
  assert.match(entry, /@fontsource-variable\/source-sans-3\/wght\.css/);
});

test("the FREE seal is integrated into the logo header with accessible restrained motion", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /<div className="bannerWrap">[\s\S]*className="freeSeal"/);
  assert.match(app, /freeSealSparkle/);
  assert.match(app, /freeSealSparkleMotion/);
  assert.match(app, /prefers-reduced-motion:\s*reduce/);
  assert.match(app, /border:\s*1px solid #d6a52e/);
  assert.doesNotMatch(app, /className="freeBadge"/);
});

test("the four measured qualities sit in a footer band directly above navigation", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /className="measurementFooter"/);
  assert.match(app, /className="measurementFooter"[\s\S]*<BottomNav/);
  for (const label of ["MEASURING", "Performance", "Durability", "Efficiency", "Resilience"]) {
    assert.match(app, new RegExp(`>${label}<`));
  }
  assert.match(app, /\.measurementValues\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*max-content\)/s);
});
