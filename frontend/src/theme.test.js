import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { themeFromSearch } from "./theme.js";

test("selects the GreenPro skin from the theme query parameter", () => {
  assert.equal(themeFromSearch("?theme=greenpro"), "greenpro");
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
