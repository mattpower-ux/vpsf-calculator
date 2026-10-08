import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the content scrolls below the logo instead of scrolling the phone frame", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const shell = source.match(/\.phoneShell\s*\{([^}]+)\}/)?.[1] || "";
  const banner = source.match(/\.bannerWrap\s*\{([^}]+)\}/)?.[1] || "";
  const screen = source.match(/\.screen\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(shell, /display:\s*flex/);
  assert.match(shell, /flex-direction:\s*column/);
  assert.match(shell, /overflow:\s*hidden/);
  assert.match(banner, /flex:\s*0 0 72px/);
  assert.match(screen, /overflow-y:\s*auto/);
});
