import test from "node:test";
import assert from "node:assert/strict";
import { submitLead } from "./api/client.js";

test("product requests preserve the selected product and return the saved receipt", async (t) => {
  const lead = { name: "Local QA", email: "qa@example.com", productId: "test-product", action: "Requested specs and pricing" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(new URL(url).pathname, "/api/leads");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), lead);
    return { ok: true, json: async () => ({ id: 123 }) };
  });
  assert.deepEqual(await submitLead(lead), { id: 123 });
});

test("failed product requests reject instead of reporting a saved request", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
  await assert.rejects(submitLead({}), /API request failed: 503/);
});

test("offline product requests reject so the form can retain input for retry", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(submitLead({}), /Failed to fetch/);
});
