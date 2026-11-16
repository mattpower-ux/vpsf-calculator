import test from 'node:test';
import assert from 'node:assert/strict';
import * as scoring from './scoreSession.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}

function effects(events) {
  return {
    onSuccess:(result,input)=>{events.push(['result',result.total],['track',input.address]);},
    onError:()=>events.push(['error']),
    onFinish:success=>events.push(['busy',false],['navigate',success ? 4 : 3])
  };
}

test('delayed score after edit or certificate removal has no result, tracking or navigation', async () => {
  for (const change of ['edit','remove claim','back']) {
    const session = scoring.createScoreRequestSession();
    const response = deferred(), events = [];
    const run = session.run({input:{address:'A',certifications:[{programId:'watersense'}]},request:()=>response.promise,...effects(events)});
    assert.equal(session.pending(),true);
    session.invalidate(); // Same synchronous boundary used by App's setters.
    response.resolve({total:600});
    await run;
    assert.deepEqual(events,[],change);
    assert.equal(session.pending(),false);
  }
});

test('new run wins even when an older score completes later for the same input', async () => {
  const session = scoring.createScoreRequestSession();
  const old = deferred(), latest = deferred(), events = [];
  const input = {address:'A'};
  const first = session.run({input,request:()=>old.promise,...effects(events)});
  const second = session.run({input,request:()=>latest.promise,...effects(events)});
  latest.resolve({total:450});
  await second;
  old.resolve({total:800});
  await first;
  assert.deepEqual(events,[['result',450],['track','A'],['busy',false],['navigate',4]]);
});

test('old rejection cannot clear the busy state or show an error during a newer run', async () => {
  const session = scoring.createScoreRequestSession();
  const old = deferred(), latest = deferred(), events = [];
  const first = session.run({input:{address:'A'},request:()=>old.promise,...effects(events)});
  const second = session.run({input:{address:'B'},request:()=>latest.promise,...effects(events)});
  old.reject(Error('network failed'));
  await first;
  assert.deepEqual(events,[]);
  assert.equal(session.pending(),true);
  latest.resolve({total:450});
  await second;
  assert.deepEqual(events,[['result',450],['track','B'],['busy',false],['navigate',4]]);
});

test('back or edit during the analyzing delay suppresses all completion effects', async () => {
  const session = scoring.createScoreRequestSession();
  const delay = deferred(), startedDelay = deferred(), events = [];
  const run = session.run({input:{address:'A'},request:async()=>({total:700}),minimumDelay:10000,
    wait:()=>{startedDelay.resolve();return delay.promise;},...effects(events)});
  await startedDelay.promise;
  session.invalidate();
  delay.resolve();
  await run;
  assert.deepEqual(events,[]);
});

test('current request failure returns to review without recording a result', async () => {
  const session = scoring.createScoreRequestSession(), events = [];
  await session.run({input:{address:'A'},request:async()=>{throw Error('offline');},...effects(events)});
  assert.deepEqual(events,[['error'],['busy',false],['navigate',3]]);
  assert.equal(session.pending(),false);
});
