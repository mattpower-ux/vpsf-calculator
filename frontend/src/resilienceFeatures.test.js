import test from 'node:test';
import assert from 'node:assert/strict';
import { resilienceFeatures, resilienceRecordNotes, resilienceActionSummary } from './resilienceFeatures.js';

test('older combustible home gets specific weaknesses', () => {
  const result = resilienceFeatures({roof:'Asphalt shingles', roofAge:'20 years', siding:'Wood clapboard', wildfireMitigation:'None', backup:'None'});
  assert.match(result.cons.join(' '), /20 years/);
  assert.match(result.cons.join(' '), /Wood clapboard.*combustible/);
  assert.match(result.cons.join(' '), /No notable risk-reduction measures recorded/);
});
test('protected home gets specific strengths without invented weaknesses', () => {
  const result = resilienceFeatures({siding:'Fiber cement', roof:'Metal', roofAge:'Less than 2 years', wildfireMitigation:'Ember Hardening + Defensible Space', backup:'Battery Storage'});
  assert.match(result.pros.join(' '), /Noncombustible/);
  assert.match(result.pros.join(' '), /Ember Hardening/);
  assert.doesNotMatch(result.cons.join(' '), /Older|No notable/);
});
test('unknown features are not described as absent or flammable', () => {
  const result = resilienceFeatures({});
  assert.doesNotMatch(result.cons.join(' '), /combustible|No notable|Older/);
});

test('record notes remain separate from home-specific pros and cons', () => {
  const home = {fortified:'None', wildfireMitigation:'None', backup:'None', flood:'Unknown', moisture:'Unknown', temperatureProtection:'Unknown', windProtection:'Unknown'};
  assert.equal(resilienceRecordNotes(home), 'Not recorded: resilience certification, wildfire protection and backup power. Still to confirm: flood protection, moisture control, extreme-temperature protection and wind protection.');
});

test('wildfire home summary prioritizes specific siding roof and landscape actions', () => {
 const home={siding:'Wood clapboard',roof:'Asphalt shingles',roofAge:'20 years',wildfireMitigation:'None',backup:'None',latitude:33,longitude:-116,wildfire:{status:'available',source:'USFS Wildfire Risk to Communities',datasetVersion:'wrc-2024',areaType:'community',nationalPercentile:95,latitude:33,longitude:-116}};
 const text=resilienceActionSummary(home);
 assert.match(text,/wood clapboard siding with noncombustible siding/);
 assert.match(text,/20-year-old asphalt roof with a fire-resistant roofing system/);
 assert.match(text,/landscaping.*defensible space/);
 assert.doesNotMatch(text,/This score reflects/);
});
test('summary does not invent missing features or replace already protected materials',()=>{
 assert.doesNotMatch(resilienceActionSummary({}),/Replace|clear dry|Add backup/);
 assert.doesNotMatch(resilienceActionSummary({siding:'Fiber cement',roof:'Metal',roofAge:'2',wildfireMitigation:'Ember Hardening + Defensible Space',backup:'Battery Backup'}),/Replace|create defensible space/);
});
