import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the address field provides an immediate Search action with Enter-key form submission", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /<form className="addressLookup" onSubmit=\{searchAddress\}>/);
  assert.match(app, /type="submit"[\s\S]*aria-label="Search address"/);
  assert.match(app, /<Search size=\{18\}/);
  assert.match(app, /setScanNote\(""\);[\s\S]*setPhotoSearchRequest/);
  assert.match(app, /onChange=\{\(event\) => \{[^\r\n]*setScanNote\(""\);[^\r\n]*setAddress\(event\.target\.value\)/);
});

test("exterior-photo discovery runs only from an explicit search request without a typing delay", () => {
  const source = readFileSync(new URL("./AddressPhoto.jsx", import.meta.url), "utf8");
  assert.match(source, /searchRequest/);
  assert.match(source, /getPropertyPhoto\(searchRequest\.address/);
  assert.doesNotMatch(source, /setTimeout\(/);
  assert.match(source, /Searching for an exterior photo/);
  assert.match(source, /No exterior photo was found/);
});
