import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes,no) => {resolve=yes; reject=no;});
  return {promise,resolve,reject};
};
const tick = () => new Promise(resolve => setImmediate(resolve));

// Execute the production handler bodies with a minimal hook adapter, without
// importing JSX/assets or replacing the asynchronous control flow under test.
function mount(overrides = {}, propOverrides = {}) {
  const effects = [], writes = [], lookupGeneration = {current:0};
  const record = name => value => writes.push([name,value]);
  const env = {
    useState: initial => [initial,record('local')], useReducer: (_reducer,initial) => [initial,record('flow')], useRef: value => ({current:value}),
    analysisEntryReducer:(state)=>state, analysisEntryInitialState:{page:'address',expanded:null,confirmed:null},
    useEffect: effect => effects.push(effect),
    presentationAddress:'Demo address', isPresentationAddress: address => address === 'Demo address',
    savedMatchForAddress:()=>null, parseAddressParts:address=>({address}),
    demoProperties:[{}], prepareAnalysisHome:home=>home, importedHome:home=>home,
    analysisRoute:()=>1, homeFromExistingScan:address=>({address}),
    savedPropertyToHomeForEnteredAddress:home=>home, formatSavedAddress:home=>home.address,
    getHardieDemo:async()=>({home:{address:'Demo address'}}),
    findSavedProperty:async()=>({found:false}), geocodeProperty:async()=>({normalizedAddress:'12 First Street'}),
    enrichPropertyWithRentCast:async()=>({}), enrichPropertyRisk:async()=>({}),
    console:{warn(){}}, window:{setTimeout:()=>1,clearTimeout(){}},
    ...overrides,
  };
  const props = {initialAddress:'12 First Street',lookupGeneration,
    setScreen:record('screen'),setSelectedProperty:record('selected'),setResultMode:record('mode'),
    setHome:record('home'),onQueryStarted:async(...args)=>writes.push(['query',...args]),
    onPermitLookup:record('permits'), ...propOverrides};
  const start = source.indexOf('function StartScreen(');
  const end = source.indexOf('\n  return (',start);
  const addressChange = source.slice(end).match(/onChange=\{(\(event\) => \{ lookupGeneration[^\n]+)\}/)[1];
  const factory = vm.runInNewContext(`(${source.slice(start,end)}\nreturn {startExistingHomeScan, changeAddress:${addressChange}};\n})`,env);
  const handlers = factory(props);
  const cleanups = effects.map(effect=>effect()).filter(Boolean);
  writes.length = 0;
  return {...handlers,writes,lookupGeneration,unmount:()=>cleanups.forEach(cleanup=>cleanup())};
}

for (const action of ['unmount','navigate']) {
  for (const failure of [false,true]) {
    test(`late property ${failure ? 'failure' : 'response'} after ${action} cannot restore state`, async()=>{
      const pending = deferred();
      const view = mount({findSavedProperty:()=>pending.promise});
      const running = view.startExistingHomeScan('inclusive');
      if (action === 'unmount') view.unmount(); else view.lookupGeneration.current++;
      view.writes.length=0;
      if (failure) pending.reject(Error('offline')); else pending.resolve({found:false});
      await running;
      assert.deepEqual(view.writes,[]);
    });
  }
}

test('an older lookup generation cannot overwrite a newer completed lookup',async()=>{
  const first=deferred(); let calls=0;
  const view=mount({findSavedProperty:()=>++calls === 1 ? first.promise : Promise.resolve({found:false})});
  const old=view.startExistingHomeScan('inclusive');
  await view.startExistingHomeScan('moderate');
  assert.ok(view.writes.some(([kind])=>kind === 'home'));
  view.writes.length=0;
  first.resolve({found:false}); await old;
  assert.deepEqual(view.writes,[]);
});

test('navigation while risk enrichment is pending prevents home and query writes',async()=>{
  const risk=deferred();
  const view=mount({enrichPropertyRisk:()=>risk.promise});
  const running=view.startExistingHomeScan('inclusive');
  await tick(); view.lookupGeneration.current++; view.writes.length=0;
  risk.resolve({}); await running;
  assert.deepEqual(view.writes,[]);
});

test('late demo profile cannot replace a reopened historical score',async()=>{
  const pending=deferred();
  const view=mount({getHardieDemo:()=>pending.promise},{initialAddress:'Demo address'});
  const running=view.startExistingHomeScan('inclusive');
  view.unmount(); view.writes.length=0;
  pending.resolve({home:{address:'Demo address'}}); await running;
  assert.deepEqual(view.writes,[]);
});

test('editing the address releases busy state and suppresses the previous response',async()=>{
  const pending=deferred(), view=mount({findSavedProperty:()=>pending.promise});
  const running=view.startExistingHomeScan('inclusive');
  view.writes.length=0;
  view.changeAddress({target:{value:'99 Second Street'}});
  assert.ok(view.writes.some(([kind,value])=>kind === 'local' && value === false));
  view.writes.length=0;
  pending.resolve({found:false}); await running;
  assert.deepEqual(view.writes,[]);
});

test('a current lookup still commits its home, query and destination',async()=>{
  const view=mount();
  await view.startExistingHomeScan('inclusive');
  assert.equal(view.writes.filter(([kind])=>kind === 'home').length,1);
  assert.equal(view.writes.filter(([kind])=>kind === 'query').length,1);
  assert.deepEqual(view.writes.filter(([kind])=>kind === 'screen'),[['screen',1]]);
});

test('navigation invalidates lookup generation synchronously before React cleanup',()=>{
  const start=source.indexOf('  const setScreen = useCallback(');
  const end=source.indexOf('\n  const setHome =',start);
  const lookupGeneration={current:0}, screens=[];
  const setScreen=vm.runInNewContext(`(()=>{${source.slice(start,end)};return setScreen;})()`,{
    useCallback:callback=>callback,lookupGeneration,scoreRequests:{pending:()=>false},
    setScreenState:screen=>screens.push(screen),setIsScoring:()=>{}});
  setScreen(31);
  assert.equal(lookupGeneration.current,1);
  assert.deepEqual(screens,[31]);
});

for (const cancel of [true,false]) test(`archive tracking ${cancel ? 'ignores cancelled responses' : 'keeps accepted state updates after navigation'}`,async()=>{
  const pending=deferred(), writes=[]; let current=true;
  const start=source.indexOf('  const handleQueryStarted =');
  const end=source.indexOf('\n  const handleGenerateScore',start);
  const env={sessionId:'test',trackPropertyQuery:()=>pending.promise,
    setHasAssessedHome:value=>writes.push(['assessed',value]),setApiResult:value=>writes.push(['result',value]),
    setScoreError:value=>writes.push(['error',value]),setQueryId:value=>writes.push(['id',value]),
    setHome:value=>writes.push(['home',value]),queryIdRef:{current:null},previousArchivedHomeRef:{current:null},
    prepareAnalysisHome:value=>value,mergeSavedPropertySnapshot:value=>value,
    mergeArchivedPermitEvidence:(_,value)=>value};
  const handler=vm.runInNewContext(`(()=>{${source.slice(start,end)};return handleQueryStarted;})()`,env);
  const running=handler({address:'12 First Street'},'saved_archive',()=>current);
  if (cancel) current=false;
  writes.length=0;
  pending.resolve({id:99,latestSnapshot:{}}); await running;
  if (cancel) {
    assert.deepEqual(writes,[]);
    assert.equal(env.queryIdRef.current,null);
  } else {
    current=false; // Successful navigation can precede React evaluating a queued updater.
    const updater=writes.find(([kind])=>kind === 'home')[1];
    assert.equal(updater({}).address,'12 First Street');
    assert.equal(env.queryIdRef.current,99);
  }
});
