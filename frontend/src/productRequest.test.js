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

import { leadForHome, companyWebsite, inquiryHomeFor } from './productInquiry.js';
test('demo inquiries omit fictional address and preserve real customer contact',()=>{
 const lead={name:'Local QA',email:'qa@example.com',productId:'james-hardie-plank'};
 const demo = leadForHome(lead,{demoScenario:'hardie-wildfire',address:'Fictional',zip:'92549'});
 assert.equal(demo.isDemo,true); assert.equal(demo.propertyAddress,undefined); assert.equal(demo.zip,undefined); assert.equal(demo.email,lead.email);
 assert.equal(leadForHome(lead,{address:'Real',zip:'12345'}).propertyAddress,'Real');
 assert.equal(companyWebsite({brand:'James Hardie'}),'https://www.jameshardie.com/');
 assert.equal(companyWebsite({brand:'Moen',sourceUrl:'https://www.epa.gov/watersense/'}),'https://www.moen.com/');
});


test('inquiries preserve explicit project ZIP and only attach bounded assessment context',()=>{
 const payload=leadForHome({zip:'01234',scope:'Siding replacement'}, {address:'12 Test Street',zip:'99999',siding:'Wood clapboard',roof:'Asphalt',roofAge:'20 years',provenance:{siding:{origin:'user-confirmed'},roof:{origin:'imported'},roofAge:{origin:'inferred'}},email:'private@example.com'}, {total:320,scores:{resilience:20},modelVersion:'model-1'}, {match:{reasons:['Combustible siding','Regional wildfire exposure']}});
 assert.equal(payload.zip,'01234'); assert.equal(payload.propertyAddress,'12 Test Street'); assert.equal(payload.isDemo,false);
 assert.deepEqual(payload.assessmentContext,{sidingType:'Homeowner confirmed: Wood clapboard',roofType:'Imported record: Asphalt',roofAge:'Inferred; review needed: 20 years',resilienceScore:20,totalScore:320,modelVersion:'model-1',reason:'Combustible siding Regional wildfire exposure'});
 assert.equal(JSON.stringify(payload).includes('private@example.com'),false);
});

test('demo inquiries retain useful context without implying the demo address is the customer property',()=>{
 const payload=leadForHome({zip:'10001'},{demoScenario:'hardie-wildfire',address:'Fictional',siding:'Wood clapboard'}, {total:320});
 assert.equal(payload.isDemo,true); assert.equal(payload.propertyAddress,undefined); assert.equal(payload.zip,'10001'); assert.equal(payload.assessmentContext.totalScore,320);
});


test('pre-score demo remains excluded from real lead reporting',()=>{
 const home={demoScenario:'hardie-wildfire',siding:'Wood clapboard'};
 const context=inquiryHomeFor({resultMode:'manual',hasAssessedHome:false,home});
 assert.equal(leadForHome({zip:'92549'},context).isDemo,true);
 assert.deepEqual(inquiryHomeFor({resultMode:'manual',hasAssessedHome:false,home:{address:'Default'}}),{});
});

test('unknown and unprovenanced defaults never become documented home features',()=>{
 const home={roof:'Architectural Shingle',siding:'Wood',roofAge:'Unknown',provenance:{roof:{origin:'unknown'}}};
 assert.deepEqual(leadForHome({zip:'12345'},home).assessmentContext,{});
});
