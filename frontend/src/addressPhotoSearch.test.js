import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAddressForSearch } from "./addressSearch.js";

test("photo search uses the geocoder's complete normalized address", async () => {
  const calls = [];
  const result = await normalizeAddressForSearch("22 dow Street, portland, main", async address => {
    calls.push(address);
    return {
      normalizedAddress: "22 Dow Street, Portland, Maine 04102, United States",
      address: "22 Dow Street",
      city: "Portland",
      state: "ME",
      zip: "04102",
    };
  });

  assert.deepEqual(calls, ["22 dow Street, portland, main"]);
  assert.equal(result, "22 Dow Street, Portland, ME 04102");
});

test("the address field provides an immediate Search action with Enter-key form submission", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /<form className="addressLookup" onSubmit=\{searchAddress\}>/);
  assert.match(app, /type="submit"[\s\S]*aria-label="Search address"/);
  assert.match(app, /<Search size=\{18\}/);
  assert.match(app, /normalizeAddressForSearch\(query, geocodeProperty\)[\s\S]*setPhotoSearchRequest/);
  assert.match(app, /onChange=\{\(event\) => \{[^\r\n]*setScanNote\(""\);[^\r\n]*setAddress\(event\.target\.value\)/);
});

test("exterior-photo discovery runs only from an explicit search request without a typing delay", () => {
  const source = readFileSync(new URL("./AddressPhoto.jsx", import.meta.url), "utf8");
  assert.match(source, /searchRequest/);
  assert.match(source, /getPropertyPhoto\(searchRequest\.address/);
  assert.doesNotMatch(source, /setTimeout\(/);
  assert.match(source, /Searching for an exterior photo/);
  assert.match(source, /No exterior photo was found/);
  assert.match(source, /found\?\.sourceUrl/);
  assert.match(source, /rel="noopener noreferrer"/);
});

test("the entry photo exposes a desktop property caption without replacing mobile content", () => {
  const source = readFileSync(new URL("./AddressPhoto.jsx", import.meta.url), "utf8");
  assert.match(source, /desktopPropertyCaption/);
  assert.match(source, /Property found/);
});
