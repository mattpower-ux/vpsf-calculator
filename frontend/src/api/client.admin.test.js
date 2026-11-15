import test from "node:test";
import assert from "node:assert/strict";
import { saveScoringDraft } from "./client.js";
import { getLeadReport, updateLead, exportLeadReport } from "./client.js";

test("lead reporting filters and review updates use authenticated endpoints", async (t) => {
  const calls=[];
  t.mock.method(globalThis,"fetch",async (url,options) => {calls.push({url,options});return {ok:true,json:async()=>({total:0,rows:[]})};});
  await getLeadReport("session",{manufacturer:"James Hardie",includeDemo:false,page:2,pageSize:25,status:""});
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("manufacturer"),"James Hardie");
  assert.equal(url.searchParams.get("includeDemo"),"false");
  assert.equal(url.searchParams.has("status"),false);
  await updateLead("session",12,{status:"reviewed",revision:1,adminNotes:"Follow up"});
  assert.equal(calls[1].options.method,"PATCH");
  assert.equal(calls[1].options.headers.Authorization,"Bearer session");
  assert.deepEqual(JSON.parse(calls[1].options.body),{status:"reviewed",revision:1,adminNotes:"Follow up"});
});

test("CSV downloads require admin authentication and fail visibly", async (t) => {
  t.mock.method(globalThis,"fetch",async(url,options)=> {
    assert.equal(new URL(url).pathname,"/api/admin/reports/leads/export");
    assert.equal(options.headers.Authorization,"Bearer session");
    return {ok:false,status:401};
  });
  await assert.rejects(exportLeadReport("session",{includeDemo:false}),/could not be exported/);
});

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
