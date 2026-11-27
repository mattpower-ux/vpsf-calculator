import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const desktopCss = readFileSync(new URL("./desktopImprovementPath.css", import.meta.url), "utf8");

test("desktop product-directory photos preserve the full source image", () => {
  assert.match(desktopCss, /\.app\[data-view-mode="desktop"\] \.products \.productCardWithPhoto \.productImage\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s);
  assert.match(desktopCss, /\.app\[data-view-mode="desktop"\] \.products \.productCardWithPhoto \.productImage img\s*\{[^}]*object-fit:\s*contain/s);
});
