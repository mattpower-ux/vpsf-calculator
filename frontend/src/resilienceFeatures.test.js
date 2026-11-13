import test from 'node:test';
import assert from 'node:assert/strict';
import { resilienceFeatures, resilienceRecordNotes } from './resilienceFeatures.js';

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
