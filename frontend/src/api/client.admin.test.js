import test from "node:test";
import assert from "node:assert/strict";
import { saveScoringDraft } from "./client.js";

test("admin JSON write sends both bearer token and content type", async () => {
  const original = global.fetch;
  let options;
  global.fetch = async (_, requestOptions) => {
    options = requestOptions;
    return { ok: true, json: async () => ({ revision: 2 }) };
  };
  try {
    await saveScoringDraft("secret-session", { revision: 1, model: {} });
    assert.equal(options.headers.Authorization, "Bearer secret-session");
    assert.equal(options.headers["Content-Type"], "application/json");
  } finally { global.fetch = original; }
});
