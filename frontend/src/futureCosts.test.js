import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFutureCosts } from './futureCosts.js';

const home = {
  squareFeet: '2000', stories: '2', zip: '02108', yearBuilt: '1900',
  roof: 'Architectural Shingle', roofAge: '25',
  hvac: 'Heat Pump (Electric)', hvacAge: '15',
  waterHeater: 'Tank Gas', waterHeaterAge: '12',
};
const row = (h, id) => buildFutureCosts(h).rows.find(r => r.id === id);

test('listing records use their explicit roof material and age without assuming stories', () => {
  const r = row({roofType:'Asphalt shingle',roofAgeYears:12,squareFeet:2450},'roof');
  assert.equal(r.ageYears,12);
  assert.equal(r.timing.earliestYears,3);
  assert.equal(r.low,null);
});

test('older home totals only priced replacements wholly within ten years', () => {
  const result = buildFutureCosts(home);
  assert.deepEqual(result.total.includedIds, ['roof', 'hvac', 'waterHeater']);
  assert.equal(result.total.low, 15000); // 4400 roof + 10000 heat pump + 600 tank
  assert.equal(result.total.high, 32100); // 9000 + 20000 + 3100
  assert.equal(result.total.partial, true);
});

test('contrasting new metal-roof home has later windows and no asserted zero exposure', () => {
  const newer = buildFutureCosts({ ...home, roof: 'Metal Roof', roofAge: 0,
    hvacAge: 0, waterHeater: 'Tankless Gas', waterHeaterAge: 0 });
  assert.equal(newer.rows[0].timing.status, 'beyond-horizon');
  assert.equal(newer.total.low, null);
  assert.deepEqual(newer.total.includedIds, []);
  assert.ok(newer.rows.every(r => r.low > 0));
});

test('unknown ages retain costs but never assert replacement timing', () => {
  const result = buildFutureCosts({ ...home, roofAge: 'Unknown', hvacAge: '', waterHeaterAge: null });
  assert.equal(result.total.low, null);
  for (const r of result.rows) {
    assert.equal(r.timing.status, 'unknown');
    assert.equal(r.timing.earliestYears, null);
    assert.ok(r.low > 0);
    assert.equal(r.includedInTotal, false);
    assert.ok(r.missingData.some(s => /age/i.test(s)));
  }
});

test('age zero is known and yearBuilt never supplies equipment ages', () => {
  assert.equal(row({ ...home, hvacAge: '0 years' }, 'hvac').ageYears, 0);
  const a = buildFutureCosts({ ...home, hvacAge: 'Unknown', yearBuilt: '2026' });
  const b = buildFutureCosts({ ...home, hvacAge: 'Unknown', yearBuilt: '1800' });
  assert.deepEqual(a, b);
});

test('ten-year boundary includes whole windows and excludes overlapping windows', () => {
  assert.equal(row({ ...home, roofAge: 20 }, 'roof').includedInTotal, true);
  const uncertain = row({ ...home, roofAge: 19 }, 'roof');
  assert.equal(uncertain.timing.status, 'possible-within-horizon');
  assert.equal(uncertain.includedInTotal, false);
  assert.equal(uncertain.timing.latestYears, 11);
});

test('size and stories change roof proxy, never equate floor area with roof area', () => {
  const small = row(home, 'roof');
  const large = row({ ...home, squareFeet: '4,000' }, 'roof');
  assert.equal(large.low, small.low * 2);
  assert.equal(row({ ...home, stories: '1' }, 'roof').high, small.high * 2);
  assert.equal(row({ ...home, stories: '3+' }, 'roof').low, null);
  assert.equal(row({ ...home, squareFeet: '' }, 'roof').low, null);
});

test('roof materials and equipment technologies have distinct estimates', () => {
  assert.ok(row({ ...home, roof: 'Tile Roof' }, 'roof').high > row(home, 'roof').high);
  assert.ok(row({ ...home, hvac: 'Boiler' }, 'hvac').high < row(home, 'hvac').high);
  assert.ok(row({ ...home, waterHeater: 'Heat Pump Water Heater' }, 'waterHeater').low > row(home, 'waterHeater').low);
  assert.equal(row({ ...home, roof: 'Impact-Rated Roof' }, 'roof').low, null);
});

test('ambiguous resistance and hydronic systems require details; geothermal needs replacement scope', () => {
  for (const hvac of ['Electric Resistance', 'Hydronic Heating', 'Geothermal', 'Mystery HVAC']) {
    const r = row({ ...home, hvac }, 'hvac');
    assert.equal(r.low, null);
    assert.ok(r.missingData.length);
  }
  assert.ok(row({ ...home, hvac: 'Electric Resistance', heatingDistribution: 'Forced Air' }, 'hvac').low > 0);
  assert.ok(row({ ...home, hvac: 'Hydronic Heating', hydronicSource: 'Natural Gas' }, 'hvac').low > 0);
  assert.equal(row({ ...home, hvac: 'Boiler', hydronicSource: 'Air-to-Water Heat Pump' }, 'hvac').low, null);
});

test('combination boilers are counted once; conflicting shared ages remain unresolved', () => {
  const shared = { ...home, hvac: 'Combination Boiler', waterHeater: 'Combination Boiler', hvacAge: 20, waterHeaterAge: 20 };
  const result = buildFutureCosts(shared);
  assert.equal(result.rows[2].sharedWith, 'hvac');
  assert.deepEqual(result.total.includedIds, ['roof', 'hvac']);
  assert.equal(row({ ...shared, waterHeaterAge: 2 }, 'hvac').timing.status, 'unknown');
});

test('invalid input cannot become zero ages, invented costs, NaN, or infinity', () => {
  for (const input of [undefined, null, false, [], 'home', 42]) {
    const result = buildFutureCosts(input);
    assert.equal(result.rows.length, 3);
    assert.equal(result.total.low, null);
  }
  for (const age of [true, [], {}, -1, Infinity, NaN, '2020', '12-15', '12ish', ' ', '1e2']) {
    assert.equal(row({ ...home, hvacAge: age }, 'hvac').ageYears, null);
  }
  for (const size of ['-20', '2,00', Infinity, '1e309', 0, true]) {
    assert.equal(row({ ...home, squareFeet: size }, 'roof').low, null);
  }
});

test('ZIP preserves leading zeros without inventing a regional price adjustment', () => {
  const a = buildFutureCosts(home);
  const b = buildFutureCosts({ ...home, zip: '90210' });
  assert.equal(a.location.zip, '02108');
  assert.match(a.location.note, /national.*local quote/i);
  assert.deepEqual(a.rows.map(r => [r.low, r.high]), b.rows.map(r => [r.low, r.high]));
  assert.equal(buildFutureCosts({ zip: 'bad' }).location.zip, null);
});

test('source provenance and assumptions are returned; calls are deterministic and isolated', () => {
  const input = Object.freeze({ ...home });
  const result = buildFutureCosts(input);
  assert.deepEqual(result, buildFutureCosts(input));
  for (const r of result.rows) {
    assert.ok(r.assumptions.length);
    assert.ok(r.sources.length);
    for (const source of r.sources) {
      assert.match(source.url, /^https:\/\//);
      assert.match(source.accessedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  result.rows[0].sources[0].url = 'changed';
  assert.match(buildFutureCosts(input).rows[0].sources[0].url, /^https:/);
});
