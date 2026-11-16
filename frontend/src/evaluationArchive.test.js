import test from 'node:test';
import assert from 'node:assert/strict';
import * as archive from './evaluationArchive.js';

function storage() {
  const values = new Map();
  return {getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,value)};
}
const home = () => ({address:'12 Main Street',analysisLevel:'inclusive',demoScenario:'',ventilation:'Unknown',
  provenance:{ventilation:{origin:'user-confirmed',source:'Home details'}},
  certifications:[{programId:'indoor-airplus',edition:'2',level:'Gold',propertyAddress:'12 Main Street',status:'reported',replacedFields:[]}]});
const result = (id = 1) => ({scoreRunId:id,total:420,
  scores:{energy:100,water:40,health:80,resilience:70,carbon:60,financial:40,community:30},
  grade:'C',label:'Needs improvement',modelVersion:'historical-model-v1',
  effectiveInput:{...home(),ventilation:'Balanced'},
  certificationEvidence:{libraryVersion:'historical-library-v1',derivedFeatures:[{target:'ventilation',value:'Balanced'}]}});

test('completed snapshots round trip exact raw Unknown, claims, effective values and model metadata', () => {
  const store = storage(), raw = home(), scored = result();
  assert.deepEqual(archive.loadEvaluations(store),[]);
  const saved = archive.saveEvaluation(raw,scored,store);
  assert.equal(typeof saved.id,'string');
  assert.ok(Number.isFinite(Date.parse(saved.savedAt)));
  assert.deepEqual(saved.home,raw);
  assert.deepEqual(saved.result,scored);
  assert.deepEqual(archive.loadEvaluations(store),[saved]);
});

test('sanitization removes original media, unsafe keys and unsupported values without changing inputs', () => {
  const store = storage(), raw = {...home(),demoScenario:'hardie-wildfire',
    photo:new Blob(['private photo']), imageData:'PRIVATE BASE64', preview:'data:image/png;base64,AAAA',
    nested:{attachment:'blob:private',file:new Uint8Array([1,2]),kept:false,zero:0,empty:'',nil:null},
    photoObservations:{roof:'Visible metal panels'},provenance:home().provenance};
  Object.defineProperty(raw.nested,'__proto__',{value:{polluted:true},enumerable:true});
  const scored = {...result(),photo:'private-original',extra:undefined};
  const saved = archive.saveEvaluation(raw,scored,store);
  assert.equal(saved.home.demoScenario,'hardie-wildfire');
  assert.deepEqual(saved.home.nested,{kept:false,zero:0,empty:'',nil:null});
  assert.deepEqual(saved.home.photoObservations,{roof:'Visible metal panels'});
  assert.doesNotMatch(JSON.stringify(saved),/private|PRIVATE|base64|polluted/);
  assert.equal(raw.preview,'data:image/png;base64,AAAA');
  assert.equal(raw.photo.size,13);
  saved.home.provenance.ventilation.origin = 'changed';
  saved.result.effectiveInput.ventilation = 'changed';
  assert.equal(raw.provenance.ventilation.origin,'user-confirmed');
  assert.equal(scored.effectiveInput.ventilation,'Balanced');
  const loaded = archive.loadEvaluations(store);
  assert.equal(loaded[0].home.provenance.ventilation.origin,'user-confirmed');
  loaded[0].home.address = 'Mutation';
  assert.equal(archive.loadEvaluations(store)[0].home.address,'12 Main Street');
});

test('invalid or incomplete scores and addresses reject without changing an existing archive', () => {
  const store = storage(); archive.saveEvaluation(home(),result(),store);
  const before = store.getItem(archive.EVALUATION_ARCHIVE_KEY);
  for (const address of ['', 'Unknown', '1234567', null, {}, 'x'.repeat(501)]) {
    assert.throws(()=>archive.saveEvaluation({...home(),address},result(2),store),/address/i);
  }
  for (const score of [null,{}, {total:420}, {...result(2),total:NaN}, {...result(2),total:Infinity},
    {...result(2),total:-1}, {...result(2),total:1001}, {...result(2),scores:{energy:100}},
    {...result(2),scores:{...result().scores,water:'40'}}, {...result(2),status:'pending'}]) {
    assert.throws(()=>archive.saveEvaluation(home(),score,store));
  }
  assert.equal(store.getItem(archive.EVALUATION_ARCHIVE_KEY),before);
});

test('corrupt or unsupported storage throws on read, save and removal without discarding data', () => {
  const store = storage();
  for (const corrupted of ['{','null','[]',JSON.stringify({version:99,evaluations:[]}),
    JSON.stringify({version:1,evaluations:[{id:'bad',savedAt:'yesterday',home:home(),result:result()}]}),
    'x'.repeat(2 * 1024 * 1024 + 1)]) {
    store.setItem(archive.EVALUATION_ARCHIVE_KEY,corrupted);
    assert.throws(()=>archive.loadEvaluations(store),/invalid|corrupt|unsupported|large/i);
    assert.throws(()=>archive.saveEvaluation(home(),result(),store));
    assert.throws(()=>archive.removeEvaluation('bad',store));
    assert.equal(store.getItem(archive.EVALUATION_ARCHIVE_KEY),corrupted);
  }
});

test('malformed persisted entries are rejected as a whole, never filtered or silently sanitized', () => {
  const store = storage();
  const valid = archive.saveEvaluation(home(),result(),store);
  const corruptions = [
    {version:1,evaluations:[valid],unexpected:'do not discard'},
    {version:1,evaluations:[valid,{...valid}]},
    {version:1,evaluations:[{...valid,result:{...valid.result,total:null}}]},
    {version:1,evaluations:[{...valid,home:{...valid.home,preview:'data:image/png;base64,AAAA'}}]},
    {version:1,evaluations:Array.from({length:51},(_,id)=>({...valid,id:`run:${id}`}))}
  ];
  for (const value of corruptions) {
    const raw = JSON.stringify(value);
    store.setItem(archive.EVALUATION_ARCHIVE_KEY,raw);
    assert.throws(()=>archive.loadEvaluations(store),/corrupt/i);
    assert.throws(()=>archive.saveEvaluation(home(),result(2),store));
    assert.equal(store.getItem(archive.EVALUATION_ARCHIVE_KEY),raw);
  }
});

test('blocked storage reads and writes surface errors', () => {
  const blocked = {getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.throws(()=>archive.loadEvaluations(blocked),/could not be read/i);
  assert.throws(()=>archive.saveEvaluation(home(),result(),blocked),/could not be read/i);
  assert.throws(()=>archive.removeEvaluation('run:1',blocked),/could not be read/i);
  const readonly = {getItem:()=>null,setItem(){throw Error('blocked');}};
  assert.throws(()=>archive.saveEvaluation(home(),result(),readonly),/could not be saved/i);
});

test('scoreRunId deduplicates while corrected runs for the same home remain separate', () => {
  const store = storage();
  const first = archive.saveEvaluation(home(),result(101),store);
  const duplicate = archive.saveEvaluation(home(),{...result(101),total:421},store);
  assert.deepEqual(duplicate,first);
  const next = archive.saveEvaluation({...home(),ventilation:'Exhaust Only'},result(102),store);
  assert.notEqual(first.id,next.id);
  assert.deepEqual(archive.loadEvaluations(store).map(row=>row.id),[next.id,first.id]);
});

test('no-ID snapshots deduplicate deterministically regardless of object key order', () => {
  const store = storage(), raw = home(), score = result(null);
  const first = archive.saveEvaluation(raw,score,store);
  const reversed = Object.fromEntries(Object.entries(raw).reverse());
  assert.deepEqual(archive.saveEvaluation(reversed,score,store),first);
  assert.equal(archive.loadEvaluations(store).length,1);
  assert.equal(archive.saveEvaluation(raw,score,storage()).id,first.id);
  const changed = archive.saveEvaluation({...raw,ventilation:'Exhaust Only'},score,store);
  assert.notEqual(changed.id,first.id);
  assert.equal(archive.loadEvaluations(store).length,2);
});

test('retention keeps newest 50 and quota failure cannot evict existing runs', () => {
  const store = storage();
  for (let id=1;id<=50;id++) archive.saveEvaluation(home(),result(id),store);
  const before = store.getItem(archive.EVALUATION_ARCHIVE_KEY);
  const quota = {...store,setItem(){throw Error('quota');}};
  assert.throws(()=>archive.saveEvaluation(home(),result(51),quota),/could not be saved/i);
  assert.equal(store.getItem(archive.EVALUATION_ARCHIVE_KEY),before);
  archive.saveEvaluation(home(),result(51),store);
  const rows = archive.loadEvaluations(store);
  assert.equal(rows.length,50);
  assert.equal(rows[0].result.scoreRunId,51);
  assert.equal(rows.at(-1).result.scoreRunId,2);
});

test('2 MB byte retention evicts oldest only in a successful replacement; oversized latest fails', () => {
  const store = storage();
  for (let id=1;id<=3;id++) archive.saveEvaluation(home(),{...result(id),notes:'é'.repeat(350000)},store);
  const rows = archive.loadEvaluations(store);
  assert.deepEqual(rows.map(row=>row.result.scoreRunId),[3,2]);
  assert.ok(new TextEncoder().encode(store.getItem(archive.EVALUATION_ARCHIVE_KEY)).length<=2*1024*1024);
  const before = store.getItem(archive.EVALUATION_ARCHIVE_KEY);
  assert.throws(()=>archive.saveEvaluation(home(),{...result(4),notes:'é'.repeat(1100000)},store),/large|size|MB/i);
  assert.equal(store.getItem(archive.EVALUATION_ARCHIVE_KEY),before);
});

test('removal targets one ID and failed writes keep every saved record', () => {
  const store = storage();
  const first = archive.saveEvaluation(home(),result(1),store);
  const second = archive.saveEvaluation(home(),result(2),store);
  const before = store.getItem(archive.EVALUATION_ARCHIVE_KEY);
  assert.throws(()=>archive.removeEvaluation(first.id,{...store,setItem(){throw Error('quota');}}),/could not be saved|removed/i);
  assert.equal(store.getItem(archive.EVALUATION_ARCHIVE_KEY),before);
  assert.equal(archive.removeEvaluation('missing',store),false);
  assert.equal(archive.removeEvaluation(first.id,store),true);
  assert.deepEqual(archive.loadEvaluations(store).map(row=>row.id),[second.id]);
  assert.equal(archive.removeEvaluation(second.id,store),true);
  assert.deepEqual(archive.loadEvaluations(store),[]);
});

test('cycles, excessive nesting and nonfinite facts fail without invoking getters or toJSON', () => {
  const store = storage();
  const cyclic = home(); cyclic.loop=cyclic;
  let nested = {}; for (let n=0;n<30;n++) nested={nested};
  for (const raw of [cyclic,{...home(),nested},{...home(),bad:Infinity}]) assert.throws(()=>archive.saveEvaluation(raw,result(),store));
  const raw = home();
  Object.defineProperty(raw,'secret',{enumerable:true,get(){throw Error('getter ran');}});
  assert.throws(()=>archive.saveEvaluation(raw,result(),store),/accessor|getter/i);
  const saved = archive.saveEvaluation({...home(),toJSON(){throw Error('toJSON ran');}},result(),store);
  assert.equal(saved.home.address,'12 Main Street');
});
