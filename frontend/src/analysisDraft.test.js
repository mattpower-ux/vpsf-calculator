import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_KEY, MAX_DRAFT_BYTES, saveAnalysisDraft, loadAnalysisDraft, deleteAnalysisDraft } from './analysisDraft.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const home = () => ({ address: '12 QA Street', analysisLevel: 'inclusive', roof: 'Metal',
  provenance: { roof: { origin: 'user-confirmed', source: 'Home details' } } });

test('explicit save round trips version, timestamp, facts and demo provenance', () => {
  const store = storage();
  assert.equal(loadAnalysisDraft(store), null);
  const input = { ...home(), demoScenario: 'hardie', siding: 'Wood clapboard' };
  input.provenance.siding = { origin: 'demo-assumption', source: 'Demo' };
  const saved = saveAnalysisDraft(input, store);
  assert.equal(saved.version, 1);
  assert.ok(Number.isFinite(Date.parse(saved.savedAt)));
  assert.deepEqual(loadAnalysisDraft(store), saved);
  assert.equal(saved.home.demoScenario, 'hardie');
  assert.equal(saved.home.siding, 'Wood clapboard');
  assert.equal(saved.home.roof, 'Metal');
  assert.equal(input.roof, 'Metal');
  deleteAnalysisDraft(store);
  assert.equal(loadAnalysisDraft(store), null);
});

test('Superior drafts save and legacy Informed drafts migrate to Superior', () => {
  for (const level of ['moderate', 'inclusive']) assert.equal(saveAnalysisDraft({ ...home(), analysisLevel: level }, storage()).home.analysisLevel, 'inclusive');
  for (const input of [null, [], {}, { ...home(), analysisLevel: 'broad' }, { ...home(), address: ' ' },
    { ...home(), address: {} }, { ...home(), provenance: { address: { origin: 'unknown' } } }]) {
    assert.throws(() => saveAnalysisDraft(input, storage()));
  }
});

test('drops photos, blobs, arbitrary objects, unsafe provenance and unknown top-level fields', () => {
  const input = { ...home(), photoReview: [{ image: 'data:image/jpeg;base64,AAAA' }], image: new Blob(['photo']),
    extraInputs: { private: { bytes: 'secret' } }, unknown: 'secret', windows: { image: 'secret' },
    photoObservations: { roof: 'Visible metal panels', bad: { image: 'secret' }, image: 'data:image/jpeg;base64,AAAA' } };
  input.provenance.roof.image = 'secret';
  const saved = saveAnalysisDraft(input, storage());
  for (const field of ['photoReview', 'image', 'unknown']) assert.equal(Object.hasOwn(saved.home, field), false);
  assert.deepEqual(saved.home.extraInputs, {});
  assert.deepEqual(saved.home.photoObservations, { roof: 'Visible metal panels' });
  assert.equal(saved.home.provenance.roof.image, undefined);
  assert.equal(saved.home.windows, '');
  assert.doesNotMatch(JSON.stringify(saved), /secret|base64/);
});

test('custom scoring scalars survive save and resume without coercion', () => {
  const store = storage();
  const extraInputs = { custom_score: 12.5, zero: 0, enabled: true, disabled: false, label: 'Verified', empty: '' };
  const input = { ...home(), extraInputs };
  saveAnalysisDraft(input, store);
  assert.deepEqual(loadAnalysisDraft(store).home.extraInputs, extraInputs);
  assert.deepEqual(input.extraInputs, extraInputs);
});

test('custom scoring dictionary drops unsafe keys, nested data and invalid scalars', () => {
  const store = storage();
  const extraInputs = Object.fromEntries([
    ['valid-key', 3], ['x'.repeat(80), 'a'.repeat(500)], ['x'.repeat(81), 1],
    ['__proto__', 'bad'], ['constructor', 'bad'], ['prototype', 'bad'], ['a.b', 1], ['', 1],
    ['nested', {}], ['list', []], ['blob', new Blob(['private'])], ['nil', null],
    ['nan', NaN], ['infinite', Infinity], ['long', 'x'.repeat(501)],
    ['photo', 'data:image/jpeg;base64,AAAA'], ['url', 'blob:private'],
  ]);
  saveAnalysisDraft({ ...home(), extraInputs }, store);
  assert.deepEqual(loadAnalysisDraft(store).home.extraInputs, { 'valid-key': 3, ['x'.repeat(80)]: 'a'.repeat(500) });
});

test('custom scoring dictionary enforces 64 entries without replacing an existing draft', () => {
  const store = storage();
  const extraInputs = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`field${index}`, index]));
  saveAnalysisDraft({ ...home(), extraInputs }, store);
  assert.deepEqual(loadAnalysisDraft(store).home.extraInputs, extraInputs);
  const before = store.getItem(DRAFT_KEY);
  assert.throws(() => saveAnalysisDraft({ ...home(), extraInputs: { ...extraInputs, overflow: 1 } }, store), /64/);
  assert.equal(store.getItem(DRAFT_KEY), before);
});

test('defaults are not promoted to confirmed facts', () => {
  const saved = saveAnalysisDraft({ ...home(), occupancy: 'Owner Occupied', solar: 'None' }, storage());
  assert.equal(saved.home.occupancy, '');
  assert.equal(saved.home.solar, '');
});

test('bad JSON, versions, dates, oversized payloads and invalid stored home fail safely', () => {
  const store = storage();
  for (const raw of ['{', 'null', '[]', 'x'.repeat(MAX_DRAFT_BYTES + 1),
    JSON.stringify({ version: 2, savedAt: new Date().toISOString(), home: home() }),
    JSON.stringify({ version: 1, savedAt: 'invalid', home: home() }),
    JSON.stringify({ version: 1, savedAt: new Date().toISOString(), home: {} })]) {
    store.setItem(DRAFT_KEY, raw);
    assert.throws(() => loadAnalysisDraft(store));
  }
});

test('storage denial, quota failure and deletion failures are reported', () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); } };
  assert.throws(() => saveAnalysisDraft(home(), denied), /could not be saved/i);
  assert.throws(() => loadAnalysisDraft(denied), /could not be read/i);
  assert.throws(() => deleteAnalysisDraft(denied), /could not be deleted/i);
});

test('oversized drafts do not replace an existing saved draft', () => {
  const store = storage();
  saveAnalysisDraft(home(), store);
  const before = store.getItem(DRAFT_KEY);
  const input = { ...home(), photoObservations: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`note${i}`, '界'.repeat(300)])) };
  for (const key of Object.keys(loadAnalysisDraft(store).home)) {
    if (typeof input[key] === 'undefined' && typeof loadAnalysisDraft(store).home[key] === 'string') {
      input[key] = '界'.repeat(500);
      input.provenance[key] = { origin: 'user-confirmed', source: 'Home details' };
    }
  }
  assert.throws(() => saveAnalysisDraft(input, store), /too large/i);
  assert.equal(store.getItem(DRAFT_KEY), before);
});
