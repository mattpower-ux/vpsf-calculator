import test from 'node:test';
import assert from 'node:assert/strict';
import { permitRequest, permitEvidenceForHome, attachPermitEvidence, fetchPermitEvidence, schedulePermitLookup, mergeArchivedPermitEvidence, permitCoverageSummary, permitFactsFromEvidence, permitDiscoveriesFromEvidence, confirmPermitWork, appliedPermitFacts, confirmedPermitNumbers } from './permitEvidence.js';
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

test('permit request includes a safe parcel identity', () => {
  assert.deepEqual(permitRequest({...home(),parcelId:'12-34-567'}),
    {address:'123 Main Street',city:'Denver',state:'CO',zip:'80202',parcel:'12-34-567'});
  assert.deepEqual(permitRequest({...home(),parcelId:'bad\u0000parcel'}),permitRequest(home()));
  assert.deepEqual(permitRequest({...home(),parcelId:'x'.repeat(101)}),permitRequest(home()));
  assert.equal(permitRequest({...home(),parcelId:'12-34-567',demoScenario:'demo'}),null);
});

test('parcel changes invalidate existing and late permit evidence', () => {
  const withParcel={...home(),parcelId:'12-34-567'};
  const parcelEvidence={...evidence(),parcelId:'12-34-567',matchedBy:'parcel'};
  const current={...withParcel,permitEvidence:parcelEvidence};
  assert.equal(confirmedEdit(current,'parcelId','98-76-543').permitEvidence,null);
  assert.equal(permitEvidenceForHome(current).parcelId,'12-34-567');
  const moved={...current,parcelId:'98-76-543',permitEvidence:null};
  assert.equal(attachPermitEvidence(moved,withParcel,parcelEvidence),moved);
  const fresh=applyAnalysisEvidence(current,{address:'999 Other Street'},undefined,{fresh:true});
  assert.ok(!fresh.parcelId);
  assert.equal(fresh.permitEvidence ?? null,null);
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

test('final permits prefill specific home facts while issued work only asks for confirmation', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'hp',permitNumber:'201700251',status:'FINAL',category:'HVAC',
      description:'Installation of 3 Mitsubishi heat pumps',dateIssued:'2017-03-13',dateCompleted:'2017-04-12'},
    {...evidence().permits[0],id:'pv',permitNumber:'201700130',status:'FINAL',category:'SOLAR',
      description:'For the installation of 26 solar panels onto the roof of the building.',dateIssued:'2017-02-23',dateCompleted:'2017-04-12'},
    {...evidence().permits[0],id:'boiler',permitNumber:'HVAC2018-00100',status:'ISSUED',category:'HVAC',
      description:'Replacement of 2 Baxi boilers with 1 Viessmann',dateIssued:'2018-09-07',dateCompleted:null},
  ],searchedRecords:3};
  const facts=permitFactsFromEvidence(permitEvidenceForHome({...home(),permitEvidence:history}));
  assert.deepEqual(facts.patch,{hvac:'Heat Pump (Electric)',hvacAge:'Installed 2017 (permit)',solar:'Solar PV'});
  assert.equal(facts.provenance.hvac.origin,'imported');
  assert.match(facts.provenance.hvac.source,/Permit records.*201700251/);
  assert.equal(facts.confirmations.length,1);
  assert.match(facts.confirmations[0].summary,/Viessmann/i);

  const enriched=attachPermitEvidence(home(),home(),history);
  assert.equal(enriched.hvac,'Heat Pump (Electric)');
  assert.equal(enriched.hvacAge,'Installed 2017 (permit)');
  assert.equal(enriched.solar,'Solar PV');
  assert.equal(enriched.provenance.solar.origin,'imported');
});

test('permit discoveries expose equipment quantity year and completion confidence', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'hp',permitNumber:'201700251',status:'FINAL',category:'HVAC',
      description:'Installation of 3 Mitsubishi heat pumps',dateIssued:'2017-03-13',dateCompleted:'2017-04-12'},
    {...evidence().permits[0],id:'pv',permitNumber:'201700130',status:'FINAL',category:'SOLAR',
      description:'For the installation of 26 solar panels onto the roof of the building.',dateIssued:'2017-02-23',dateCompleted:'2017-04-12'},
    {...evidence().permits[0],id:'boiler',permitNumber:'HVAC2018-00100',status:'ISSUED',category:'HVAC',
      description:'Replacement of 2 Baxi boilers with 1 Viessmann',dateIssued:'2018-09-07',dateCompleted:null},
  ],searchedRecords:3};
  const discoveries=permitDiscoveriesFromEvidence(permitEvidenceForHome({...home(),permitEvidence:history}));
  assert.deepEqual(discoveries.map(({field,value,quantity,year,evidenceStatus,permitNumber})=>
    ({field,value,quantity,year,evidenceStatus,permitNumber})),[
      {field:'hvac',value:'Heat Pump (Electric)',quantity:3,year:'2017',evidenceStatus:'verified',permitNumber:'201700251'},
      {field:'solar',value:'Solar PV',quantity:26,year:'2017',evidenceStatus:'verified',permitNumber:'201700130'},
      {field:'hvac',value:'Boiler',quantity:1,year:null,evidenceStatus:'review',permitNumber:'HVAC2018-00100'},
    ]);
});

test('permit discoveries use installed replacement quantity and completion year only',()=>{
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'hp-replace',permitNumber:'HVAC2024-00022',status:'FINAL',category:'HVAC',
      description:'Replace 3 old heat pumps with 2 new heat pumps',dateFiled:'2023-12-20',dateIssued:'2024-01-05',dateCompleted:'2025-02-14'},
    {...evidence().permits[0],id:'issued',permitNumber:'SOLAR2024-00023',status:'ISSUED',category:'SOLAR',
      description:'Install 18 solar panels',dateFiled:'2024-02-01',dateIssued:'2024-03-01',dateCompleted:null},
  ],searchedRecords:2};
  const discoveries=permitDiscoveriesFromEvidence(permitEvidenceForHome({...home(),permitEvidence:history}));
  assert.deepEqual(discoveries.map(({quantity,year,evidenceStatus})=>({quantity,year,evidenceStatus})),[
    {quantity:2,year:'2025',evidenceStatus:'verified'},
    {quantity:18,year:null,evidenceStatus:'review'},
  ]);
});

test('replacement quantity ignores unrelated electrical counts',()=>{
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'hp-service',permitNumber:'HVAC2025-10',status:'FINAL',category:'HVAC',
      description:'Replace 3 old heat pumps and upgrade service to 200 amps',dateCompleted:'2025-06-01'},
    {...evidence().permits[0],id:'hp-circuits',permitNumber:'HVAC2025-11',status:'FINAL',category:'HVAC',
      description:'Replace 3 heat pumps and upgrade service with 2 new circuits',dateCompleted:'2025-06-01'},
  ]};
  const discoveries=permitDiscoveriesFromEvidence(permitEvidenceForHome({...home(),permitEvidence:history}));
  assert.deepEqual(discoveries.map(item=>item.quantity),[null,null]);
});

test('permit autofill never overwrites stronger facts and conflicts remain review prompts', () => {
  const base={...home(),hvac:'Geothermal',provenance:{hvac:{origin:'user-confirmed',source:'Home details'}}};
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'hp',status:'FINAL',category:'HVAC',description:'Install heat pump',dateCompleted:'2022-06-01'},
    {...evidence().permits[0],id:'gas',status:'FINAL',category:'HVAC',description:'Install gas furnace',dateCompleted:'2023-06-01'},
  ],searchedRecords:2};
  const enriched=attachPermitEvidence(base,base,history);
  assert.equal(enriched.hvac,'Geothermal');
  const facts=permitFactsFromEvidence(enriched.permitEvidence);
  assert.equal(facts.patch.hvac,undefined);
  assert.ok(facts.confirmations.some(item=>/conflicting completed permits/i.test(item.reason)));
  assert.ok(facts.confirmations.every(item=>item.permitNumber));
});

test('removal repair and relocation permits never become installed features', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'move',permitNumber:'MOVE-1',status:'FINAL',category:'HVAC',description:'Moving an outdoor heat pump unit from the side to the back',dateCompleted:'2018-10-01'},
    {...evidence().permits[0],id:'remove',permitNumber:'PV-REMOVE',status:'FINAL',category:'SOLAR',description:'Remove 26 roof mounted solar panels for roof repair',dateCompleted:'2024-10-01'},
    {...evidence().permits[0],id:'service',permitNumber:'SERVICE-1',status:'FINAL',category:'HVAC',description:'Repair existing boiler controls',dateCompleted:'2023-01-01'},
  ],searchedRecords:3};
  const facts=permitFactsFromEvidence(permitEvidenceForHome({...home(),permitEvidence:history}));
  assert.deepEqual(facts.patch,{});
  assert.equal(facts.confirmations.length,3);
  assert.deepEqual(new Set(facts.confirmations.map(item=>item.permitNumber)),new Set(['MOVE-1','PV-REMOVE','SERVICE-1']));
});

test('an installation verb for unrelated work cannot substantiate existing equipment', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'light',permitNumber:'ELEC-1',status:'FINAL',category:'Electrical',
      description:'Install new exterior light. Existing gas furnace noted in basement.',dateCompleted:'2025-02-01'},
  ]};
  const facts=permitFactsFromEvidence(permitEvidenceForHome({...home(),permitEvidence:history}));
  assert.deepEqual(facts.patch,{});
  assert.equal(facts.confirmations[0].permitNumber,'ELEC-1');
});

test('equipment subtype is derived only from its own installation clause', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'solar',permitNumber:'PV-1',status:'FINAL',category:'SOLAR',
      description:'Install solar panels. Existing battery system remains unchanged.',dateCompleted:'2025-02-01'},
    {...evidence().permits[0],id:'water',permitNumber:'WH-1',status:'FINAL',category:'PLUMBING',
      description:'Install gas water heater. Upgrade electric panel.',dateCompleted:'2025-02-01'},
    {...evidence().permits[0],id:'roof',permitNumber:'ROOF-1',status:'FINAL',category:'ROOFING',
      description:'Replace roof with asphalt shingles. Existing metal awning remains.',dateCompleted:'2025-02-01'},
  ],searchedRecords:3};
  const facts=permitFactsFromEvidence(permitEvidenceForHome({...home(),permitEvidence:history}));
  assert.equal(facts.patch.solar,'Solar PV');
  assert.equal(facts.patch.waterHeater,'Tank Gas');
  assert.equal(facts.patch.roof,'Asphalt shingles');
});

test('each HVAC clause is classified independently and dual installations combine', () => {
  const mixed={...evidence(),permits:[
    {...evidence().permits[0],id:'mixed',permitNumber:'HVAC-1',status:'FINAL',category:'HVAC',
      description:'Install new gas furnace. Remove existing heat pump.',dateCompleted:'2025-02-01'},
  ]};
  const mixedFacts=permitFactsFromEvidence(permitEvidenceForHome({...home(),permitEvidence:mixed}));
  assert.equal(mixedFacts.patch.hvac,'Gas Furnace');
  assert.ok(mixedFacts.confirmations.some(item=>item.value === 'Heat Pump (Electric)'));

  const dual={...evidence(),permits:[
    {...evidence().permits[0],id:'dual',permitNumber:'HVAC-2',status:'FINAL',category:'HVAC',
      description:'Install air-source heat pumps. Install a shared boiler.',dateCompleted:'2025-02-01'},
  ]};
  const dualFacts=permitFactsFromEvidence(permitEvidenceForHome({...home(),permitEvidence:dual}));
  assert.equal(dualFacts.patch.hvac,'Heat Pump (Electric) + Boiler');
  assert.equal(dualFacts.confirmations.length,0);
});

test('applied permit summary contains only values actually accepted into the home', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'hp',permitNumber:'HP-1',status:'FINAL',category:'HVAC',description:'Install heat pump',dateCompleted:'2022-06-01'},
    {...evidence().permits[0],id:'pv',permitNumber:'PV-1',status:'FINAL',category:'SOLAR',description:'Install solar panels',dateCompleted:'2022-06-01'},
  ],searchedRecords:2};
  const base={...home(),hvac:'Geothermal',provenance:{hvac:{origin:'user-confirmed',source:'Home details'}}};
  const enriched=attachPermitEvidence(base,base,history);
  assert.deepEqual(appliedPermitFacts(enriched,enriched.permitEvidence),{solar:'Solar PV'});
});

test('confirming a second heating system preserves both systems for multifamily homes', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'hp',permitNumber:'HP-1',status:'FINAL',category:'HVAC',description:'Installation of 3 Mitsubishi heat pumps',dateCompleted:'2017-04-12'},
    {...evidence().permits[0],id:'boiler',permitNumber:'B-1',status:'ISSUED',category:'HVAC',description:'Replacement of 2 Baxi boilers with 1 Viessmann',dateIssued:'2018-09-07'},
  ],searchedRecords:2};
  const imported=attachPermitEvidence({...home(),homeType:'Multifamily'},home(),history);
  const confirmed=confirmPermitWork(imported,'B-1');
  assert.equal(confirmed.hvac,'Heat Pump (Electric) + Boiler');
  assert.match(confirmed.hvacAge,/Heat pumps: 2017.*boiler: year unknown/i);
  assert.equal(confirmed.provenance.hvac.origin,'user-confirmed');
  assert.equal(confirmed.extraInputs.permitConfirmations,'["B-1"]');
  let raw;
  const store={setItem:(_,value)=>{raw=value;},getItem:()=>raw};
  saveAnalysisDraft(confirmed,store);
  assert.equal(loadAnalysisDraft(store).home.extraInputs.permitConfirmations,'["B-1"]');
});

test('confirmation never downgrades stronger compatible or conflicting evidence', () => {
  const history={...evidence(),permits:[
    {...evidence().permits[0],id:'pv',permitNumber:'PV-1',status:'ISSUED',category:'SOLAR',description:'Install solar panels',dateIssued:'2024-01-01'},
    {...evidence().permits[0],id:'hp',permitNumber:'HP-1',status:'ISSUED',category:'HVAC',description:'Install heat pump',dateIssued:'2024-01-01'},
  ],searchedRecords:2};
  const base={...home(),solar:'Solar PV + Battery',hvac:'Geothermal',hvacAge:'Installed 2020',provenance:{
    solar:{origin:'user-confirmed',source:'Home details'},hvac:{origin:'user-confirmed',source:'Home details'},hvacAge:{origin:'user-confirmed',source:'Home details'},
  },permitEvidence:history};
  const solar=confirmPermitWork(base,'PV-1');
  assert.equal(solar.solar,'Solar PV + Battery');
  assert.equal(solar.provenance.solar.source,'Home details');
  const hvac=confirmPermitWork(solar,'HP-1');
  assert.equal(hvac.hvac,'Geothermal');
  assert.equal(hvac.hvacAge,'Installed 2020');
  assert.equal(hvac.provenance.hvac.source,'Home details');
  assert.deepEqual([...confirmedPermitNumbers(hvac)],['PV-1','HP-1']);
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
  assert.equal(permitEvidenceForHome({...home(),permitEvidence:{...data,permits:Array(501).fill(data.permits[0])}}),null);
  data.permits[0].address='999 Main St';
  assert.equal(permitEvidenceForHome({...home(),permitEvidence:data}),null);
  assert.equal(permitEvidenceForHome({...home(),permitEvidence:{...evidence(),status:'no_exact_match',permits:[]}}).permits.length,0);
});

test('history evidence with 75 records survives sanitization and draft round trips', () => {
  const permits=Array.from({length:75},(_,index)=>({...evidence().permits[0],id:`permit-${index}`}));
  const history={...evidence(),lookupMode:'address-history',matchedBy:'address',completeness:'partial',
    pagesChecked:2,recordsChecked:75,stopReason:'page-budget',searchedRecords:75,searchTruncated:true,
    permits,coverage:{confidence:'high',covered:true,dataThrough:'2026-11-18',jurisdiction:'Denver',
      dataStatus:'active',freshness:'current',captureRatio:0.82,captureCheckedAt:'2026-11-20',
      captureNote:'Representative municipal coverage.',tierWindowClamped:false,tierWindowFrom:null}};
  const clean=permitEvidenceForHome({...home(),permitEvidence:history});
  assert.equal(clean.permits.length,75);
  assert.equal(clean.recordsChecked,75);
  let raw;
  const store={setItem:(_,value)=>{raw=value;},getItem:()=>raw};
  saveAnalysisDraft({...home(),permitEvidence:history},store);
  assert.equal(loadAnalysisDraft(store).home.permitEvidence.permits.length,75);
  const archived=prepareAnalysisHome({...home(),permitEvidence:history},'inclusive');
  assert.equal(mergeArchivedPermitEvidence({...home(),permitEvidence:history},archived,home()).permitEvidence.permits.length,75);
});

test('legacy evidence receives safe history defaults', () => {
  const clean=permitEvidenceForHome({...home(),permitEvidence:evidence()});
  assert.equal(clean.lookupMode,'search');
  assert.equal(clean.completeness,'unknown');
  assert.equal(clean.pagesChecked,1);
  assert.equal(clean.recordsChecked,1);
  assert.equal(clean.stopReason,'unknown');
});

test('malformed history metadata rejects only the evidence object', () => {
  const valid={...evidence(),lookupMode:'address-history',completeness:'complete',pagesChecked:1,
    recordsChecked:1,stopReason:'exhausted'};
  for (const changed of [
    {...valid,lookupMode:'everything'}, {...valid,completeness:'certain'},
    {...valid,stopReason:'provider-secret'}, {...valid,pagesChecked:11},
    {...valid,recordsChecked:501},
    {...valid,coverage:{...valid.coverage,captureRatio:1.1}},
  ]) assert.equal(permitEvidenceForHome({...home(),permitEvidence:changed}),null);
  assert.equal(permitEvidenceForHome({...home(),permitEvidence:null}),null);
  assert.equal(home().address,'123 Main Street');
});

test('coverage summary is concise and never claims every public record was searched', () => {
  const complete=permitEvidenceForHome({...home(),permitEvidence:{...evidence(),lookupMode:'address-history',
    completeness:'complete',pagesChecked:2,recordsChecked:1,stopReason:'exhausted'}});
  assert.match(permitCoverageSummary(complete),/^Complete available history/);
  const partial={...complete,completeness:'partial'};
  assert.match(permitCoverageSummary(partial),/^Partial available history/);
  assert.match(permitCoverageSummary({...complete,completeness:'unknown'}),/^Coverage unknown/);
  assert.match(permitCoverageSummary({...complete,completeness:'ambiguous'}),/^Property-history match ambiguous/);
  for (const item of [complete,partial]) assert.doesNotMatch(permitCoverageSummary(item),/all public records/i);
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

test('completed permit facts survive a slower archive merge', () => {
  const finalHistory={...evidence(),permits:[{...evidence().permits[0],id:'pv',permitNumber:'PV-1',status:'FINAL',category:'SOLAR',description:'Install solar panels',dateCompleted:'2024-05-01'}]};
  const requested=home(), current=attachPermitEvidence(requested,requested,finalHistory);
  const archived=prepareAnalysisHome(requested,'inclusive');
  const merged=mergeArchivedPermitEvidence(current,archived,requested);
  assert.equal(merged.solar,'Solar PV');
  assert.equal(merged.provenance.solar.origin,'imported');
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
