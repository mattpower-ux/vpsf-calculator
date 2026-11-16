import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from './client.js';

test('catalog and preview use certification endpoints and send raw inputs unchanged', async t => {
  const requests = [];
  const raw = {address:'12 Main St',toilets:'',certifications:[{programId:'watersense'}]};
  t.mock.method(globalThis,'fetch',async (url, options) => {
    requests.push({path:new URL(url).pathname,options});
    return {ok:true,json:async()=>requests.length === 1 ? {version:'v1',programs:[]} : {effectiveInput:{...raw,toilets:'WaterSense'}}};
  });
  assert.deepEqual(await client.getCertificationCatalog(),{version:'v1',programs:[]});
  assert.equal((await client.previewCertifications(raw)).effectiveInput.toilets,'WaterSense');
  assert.deepEqual(requests.map(r=>r.path),['/api/certifications/catalog','/api/certifications/preview']);
  assert.equal(requests[1].options.method,'POST');
  assert.deepEqual(JSON.parse(requests[1].options.body),raw);
  assert.equal(raw.toilets,'');
});
