import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisEntryInitialState, analysisEntryReducer, analysisLevelDetails } from './analysisEntryFlow.js';

test('opening scoring depth does not select or start an analysis', () => {
  const next = analysisEntryReducer(analysisEntryInitialState, {type:'open-depth'});
  assert.deepEqual(next, {page:'depth', expanded:null, confirmed:null});
});

test('selecting a level reveals only that description without confirming it', () => {
  const opened = analysisEntryReducer(analysisEntryInitialState, {type:'open-depth'});
  const basic = analysisEntryReducer(opened, {type:'toggle-level', level:'broad'});
  assert.deepEqual(basic, {page:'depth', expanded:'broad', confirmed:null});
  assert.deepEqual(analysisEntryReducer(basic, {type:'toggle-level', level:'moderate'}), basic);
  const superior = analysisEntryReducer(basic, {type:'toggle-level', level:'inclusive'});
  assert.deepEqual(superior, {page:'depth', expanded:'inclusive', confirmed:null});
});

test('DO IT confirms only the currently expanded level', () => {
  const opened = analysisEntryReducer(analysisEntryInitialState, {type:'open-depth'});
  assert.deepEqual(analysisEntryReducer(opened, {type:'confirm-level', level:'inclusive'}), opened);
  const selected = analysisEntryReducer(opened, {type:'toggle-level', level:'inclusive'});
  assert.equal(analysisEntryReducer(selected, {type:'confirm-level', level:'inclusive'}).confirmed, 'inclusive');
});

test('returning to the address page clears selection but keeps flow reusable', () => {
  const selected = {page:'depth', expanded:'inclusive', confirmed:null};
  assert.deepEqual(analysisEntryReducer(selected, {type:'back'}), analysisEntryInitialState);
});

test('every scoring depth has a concrete result description', () => {
  assert.deepEqual(Object.keys(analysisLevelDetails).sort(), ['broad','inclusive']);
  for (const detail of Object.values(analysisLevelDetails)) {
    assert.ok(detail.summary.length >= 40);
    assert.ok(detail.results.length >= 2);
  }
});

test('Basic explains that it needs only limited additional entry', () => {
  assert.ok(analysisLevelDetails.broad.results.includes('Limited additional entry from you'));
  assert.deepEqual(analysisLevelDetails.broad.cons, [
    'Many home records lack substantial data.',
    'Results likely to be incomplete, with weak accuracy.',
  ]);
});

test('Superior asks for more information from the homeowner', () => {
  assert.ok(analysisLevelDetails.inclusive.results.includes('More info from you'));
  assert.equal(analysisLevelDetails.broad.results.includes('More info from you'), false);
});
