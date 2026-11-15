import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCapturedFacts, applyAnalysisEvidence } from './captureFacts.js';
test('capture starts without demo equipment and confirms only reviewed facts', () => {
  const result = applyCapturedFacts({address:'Demo', hvac:'Geothermal', solar:'Solar PV', provenance:{}, extraInputs:{bonus:10}}, {siding:'Wood clapboard'}, true);
  assert.equal(result.hvac, 'Unknown'); assert.equal(result.address, '');
  assert.deepEqual(result.extraInputs, {}); assert.equal(result.provenance.siding.origin, 'user-confirmed');
});
test('adding evidence keeps real features but changed address clears regional data', () => {
  const result = applyCapturedFacts({address:'Old', hvac:'Gas Furnace', wildfire:{level:'High'}, city:'Old city', epaWalkability:{value:18}}, {address:'New'});
  assert.equal(result.hvac,'Gas Furnace'); assert.equal(result.city,''); assert.equal(result.wildfire,null); assert.equal(result.epaWalkability,null);
});
test('automatic photo findings remain inferred and review notes survive merging',()=>{
  const result=applyCapturedFacts({address:'Real',photoObservations:{paintCondition:'Existing note'}},{roof:'Metal Roof',photoObservations:{flooringType:'Carpet visible'}},false,[{field:'roof'}]);
  assert.equal(result.provenance.roof.origin,'inferred');
  assert.equal(result.photoObservations.paintCondition,'Existing note');
  assert.equal(result.photoObservations.flooringType,'Carpet visible');
  assert.deepEqual(result.photoReview,[{field:'roof'}]);
});

test('same-home evidence preserves analysis level, demo identity and existing facts', () => {
  const current={address:'12 QA Street',city:'Test City',state:'CA',zip:'90210',analysisLevel:'inclusive',demoScenario:'hardie-wildfire',siding:'Wood',provenance:{siding:{origin:'demo-assumption'}}};
  const before=structuredClone(current);
  const result=applyAnalysisEvidence(current,{roof:'Metal'},[{field:'roof'}]);
  assert.equal(result.analysisLevel,'inclusive'); assert.equal(result.demoScenario,'hardie-wildfire');
  assert.equal(result.siding,'Wood'); assert.equal(result.city,'Test City');
  assert.equal(result.provenance.roof.origin,'inferred');
  assert.deepEqual(current,before);
});

test('a new address clears old features, risk, private extras and demo identity', () => {
  const current={address:'Old home',city:'Old city',state:'CA',zip:'90210',analysisLevel:'inclusive',demoScenario:'hardie-wildfire',hvac:'Heat Pump',solar:'Solar PV',fortified:'FORTIFIED Gold',latitude:33,longitude:-116,wildfire:{status:'available'},extraInputs:{bonus:10},photoObservations:{old:'old'},photoReview:[{field:'solar'}],provenance:{solar:{origin:'demo-assumption'}}};
  const result=applyAnalysisEvidence(current,{address:'New home',city:'New city',state:'NY',zip:'10001',roof:'Metal'});
  assert.equal(result.analysisLevel,'inclusive'); assert.equal(result.demoScenario,'');
  assert.equal(result.address,'New home'); assert.equal(result.city,'New city'); assert.equal(result.state,'NY'); assert.equal(result.zip,'10001');
  assert.equal(result.roof,'Metal');
  for (const field of ['hvac','solar','fortified','homeType','occupancy','stories']) assert.equal(result[field],'');
  assert.equal(result.latitude,null); assert.equal(result.wildfire,null);
  assert.deepEqual(result.extraInputs,{}); assert.deepEqual(result.photoObservations,{});
  assert.equal(result.photoReview,undefined); assert.equal(result.provenance.solar,undefined);
});

test('blank parse fields without an address do not erase identity or imported city/state', () => {
  const current={address:'12 QA Street',city:'Existing city',state:'CA',zip:'90210',analysisLevel:'moderate'};
  const result=applyAnalysisEvidence(current,{address:'',city:'Imported city',state:'NY',zip:'',roof:'Metal'});
  assert.equal(result.address,current.address); assert.equal(result.city,'Imported city');
  assert.equal(result.state,'NY'); assert.equal(result.zip,'90210');
  const empty=applyAnalysisEvidence(current,{address:' ',city:'',state:undefined,zip:null});
  assert.equal(empty.address,current.address); assert.equal(empty.city,current.city); assert.equal(empty.state,current.state); assert.equal(empty.zip,current.zip);
});

test('same address with casing/whitespace changes does not reset the house', () => {
  const current={address:'12 QA Street',city:'Test City',analysisLevel:'inclusive',demoScenario:'hardie-wildfire',roof:'Metal'};
  const result=applyAnalysisEvidence(current,{address:' 12 qa   street ',hvac:'Gas Furnace'});
  assert.equal(result.roof,'Metal'); assert.equal(result.city,'Test City'); assert.equal(result.demoScenario,'hardie-wildfire');
});

test('explicit fresh capture clears old defaults even without a new address', () => {
  const result=applyAnalysisEvidence({address:'Old',hvac:'Heat Pump',analysisLevel:'moderate',demoScenario:'demo'}, {roof:'Metal'}, undefined, {fresh:true});
  assert.equal(result.address,''); assert.equal(result.hvac,''); assert.equal(result.roof,'Metal'); assert.equal(result.demoScenario,'');
});

test('new address without locality cannot inherit the previous locality or imported metadata', () => {
  const result=applyAnalysisEvidence({address:'Old',city:'Old City',state:'CA',zip:'90210',analysisLevel:'inclusive',demoScenario:'demo'},
    {address:'New',city:'',state:'',zip:'',analysisLevel:'broad',demoScenario:'injected',provenance:{roof:{origin:'imported'}}});
  assert.equal(result.address,'New');
  for (const key of ['city','state','zip']) assert.equal(result[key],'');
  assert.equal(result.analysisLevel,'inclusive'); assert.equal(result.demoScenario,'');
  assert.equal(result.provenance.roof,undefined);
});
