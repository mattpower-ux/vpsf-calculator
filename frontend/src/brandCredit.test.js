import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("shared logo header includes the Green Builder Media credit", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /alt="VPSF Value Per Square Foot"[^]*?<span className="brandCredit">POWERED BY GREEN BUILDER MEDIA<\/span>/);
});
