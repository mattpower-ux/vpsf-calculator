import test from 'node:test';
import assert from 'node:assert/strict';
import { permitRequest, permitEvidenceForHome, attachPermitEvidence, fetchPermitEvidence, schedulePermitLookup, mergeArchivedPermitEvidence } from './permitEvidence.js';
import { prepareAnalysisHome } from './analysisLevels.js';
import { saveAnalysisDraft, loadAnalysisDraft } from './analysisDraft.js';
import { confirmedEdit } from './homeAdvice.js';
import { applyAnalysisEvidence } from './captureFacts.js';
import { lookupPermitHistory, scoreProperty } from './api/client.js';

const home = () => ({address:'123 Main Street',city:'Denver',state:'CO',zip:'80202',analysisLevel:'inclusive'});
const evidence = () => ({status:'matched',source:'PermitStack',address:'123 Main St',state:'CO',zip:'80202',
  fetchedAt:'2026-11-15T12:00:00Z',cacheHit:false,searchTruncated:false,searchedRecords:1,
  permits:[{id:'p1',permitNumber:'R-1',status:'ISSUED',category:'Roof',description:'Roof work',jurisdiction:'Denver',
    address:'123 Main St',city:'Denver',state:'CO',zip:'80202',dateFiled:null,dateIssued:'2024-01-01',dateCompleted:null}],
  coverage:{confidence:'high',covered:true,tierWindowClamped:false},sourceNote:'Permit records are not proof of completed work.'});

test('request is street-only and excludes demo, incomplete and invalid identities', () => {
  assert.deepEqual(permitRequest(home()),{address:'123 Main Street',city:'Denver',state:'CO',zip:'80202'});
  for(const input of [{...home(),demoScenario:'demo'},{...home(),address:'53017 Double View Lane'},
    {...home(),address:'123 Main St, Denver, CO 80202'},{...home(),state:''},{...home(),zip:''}]) assert.equal(permitRequest(input),null);
});

test('permits persist through each preparation level and drafts without becoming home facts', () => {
  const input = {...home(),permitEvidence:evidence()};
  for(const level of ['broad','moderate','inclusive']) {
    const prepared = prepareAnalysisHome(input,level);
    assert.equal(prepared.permitEvidence.permits[0].id,'p1');
    assert.equal(prepared.roof,''); assert.equal(prepared.roofAge,'');
    assert.equal(prepared.provenance.roof,undefined);
  }
  let raw;
  const store={setItem:(_,value)=>{raw=value;},getItem:()=>raw};
  saveAnalysisDraft(input,store);
  assert.equal(loadAnalysisDraft(store).home.permitEvidence.permits[0].description,'Roof work');
});

test('changed identity, units, and demo never retain permits or late responses', () => {
  const input={...home(),permitEvidence:evidence()};
  for(const [key,value] of [['address','999 Main Street'],['state','UT'],['zip','99999'],['city','Boulder']]) {
    assert.equal(confirmedEdit(input,key,value).permitEvidence,null);
    assert.equal(applyAnalysisEvidence(input,{[key]:value}).permitEvidence ?? null,null);
    const moved={...input,[key]:value};
    assert.equal(attachPermitEvidence(moved,home(),evidence()),moved);
  }
  assert.equal(permitEvidenceForHome({...input,address:'123 Main Street #2'}),null);
  assert.equal(permitEvidenceForHome({...input,demoScenario:'demo'}),null);
});

test('sanitize evidence and reject oversized/mismatched records', () => {
  const data=evidence(); data.photo='secret';data.permits[0].raw='secret';
  const clean=permitEvidenceForHome({...home(),permitEvidence:data});
  assert.doesNotMatch(JSON.stringify(clean),/secret/);
  assert.equal(permitEvidenceForHome({...home(),permitEvidence:{...data,permits:Array(26).fill(data.permits[0])}}),null);
  data.permits[0].address='999 Main St';
  assert.equal(permitEvidenceForHome({...home(),permitEvidence:data}),null);
  assert.equal(permitEvidenceForHome({...home(),permitEvidence:{...evidence(),status:'no_exact_match',permits:[]}}).permits.length,0);
});

test('optional lookup does not query demos and provider failure is nonfatal', async () => {
  let calls=0;
  const lookup=async()=>{calls++;throw Error('unavailable');};
  assert.equal(await fetchPermitEvidence({...home(),demoScenario:'demo'},lookup),null);
  assert.equal(calls,0);
  assert.equal(await fetchPermitEvidence(home(),lookup),null);assert.equal(calls,1);
  assert.equal((await fetchPermitEvidence(home(),async()=>evidence())).permits.length,1);
});

test('API posts only address parts and score serialization retains permit evidence', async () => {
  const original=globalThis.fetch; const requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>evidence()};};
  try {
    await lookupPermitHistory({...home(),private:'omit'});
    assert.match(requests[0].url,/\/api\/properties\/permitstack$/);
    assert.deepEqual(JSON.parse(requests[0].options.body),permitRequest(home()));
    await scoreProperty({...home(),permitEvidence:evidence()});
    assert.equal(JSON.parse(requests[1].options.body).permitEvidence.permits[0].id,'p1');
  } finally {globalThis.fetch=original;}
});

test('fast cached permits survive a slow archive response and stale archives cannot change identity', () => {
  const requested=home(), current={...requested,permitEvidence:evidence()};
  const archived=prepareAnalysisHome(requested,'inclusive');
  assert.equal(mergeArchivedPermitEvidence(current,archived,requested).permitEvidence.permits[0].id,'p1');
  const edited={...current,address:'999 Other Street',permitEvidence:null};
  assert.equal(mergeArchivedPermitEvidence(edited,archived,requested),edited);
});

test('manual fallback and completed corrections query after debounce; cancelled callbacks never apply', async () => {
  let current=home(), run, calls=0, release;
  const setHome=updater=>{current=updater(current);};
  const options={schedule:callback=>{run=callback;return 1;},unschedule:()=>{}};
  const cancel=schedulePermitLookup(current,async()=>{calls++;return new Promise(resolve=>{release=resolve;});},setHome,options);
  assert.equal(calls,0); // A completed manual identity is enough; no provider record needed.
  const pending=run(); assert.equal(calls,1);
  cancel();
  current={...home(),address:'999 Other Street'};
  release(evidence()); await pending;
  assert.equal(current.permitEvidence,undefined);
  const corrected={...evidence(),address:current.address,permits:[{...evidence().permits[0],address:current.address}]};
  schedulePermitLookup(current,async()=>corrected,setHome,options);
  await run();
  assert.equal(current.permitEvidence.address,'999 Other Street');
  const cancelTyping=schedulePermitLookup(current,async()=>{calls++;return corrected;},setHome,options);
  cancelTyping(); await run(); assert.equal(calls,1);
});
