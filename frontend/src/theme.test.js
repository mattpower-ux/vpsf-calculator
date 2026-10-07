import test from "node:test";
import assert from "node:assert/strict";
import { themeFromSearch } from "./theme.js";

test("selects the GreenPro skin from the theme query parameter", () => {
  assert.equal(themeFromSearch("?theme=greenpro"), "greenpro");
});

test("unknown themes leave the standard calculator unchanged", () => {
  assert.equal(themeFromSearch("?theme=unknown"), "default");
  assert.equal(themeFromSearch(""), "default");
});
