import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCapturedFacts, applyAnalysisEvidence, applyReviewedPhotoValue, photoFindingConflictText } from './captureFacts.js';
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

test('photo findings fill gaps without replacing stronger existing home evidence',()=>{
  const current={
    address:'22 Dow Street',
    hvac:'Heat Pump (Electric) + Boiler',
    solar:'Solar PV',
    roof:'Unknown',
    provenance:{
      hvac:{origin:'imported',source:'Admin-verified public records'},
      solar:{origin:'imported',source:'Completed permit'},
    },
    photoObservations:{paintCondition:'Existing note'},
  };
  const review=[
    {field:'hvac',value:'Heat Pump (Electric)',conflict:false,evidence:'One outdoor unit is visible',uncertainty:'Other systems may serve the building'},
    {field:'solar',value:'Solar PV + Battery',conflict:false,evidence:'Roof panels and a wall cabinet are visible',uncertainty:'Cabinet purpose is unclear'},
    {field:'roof',value:'Metal Roof',conflict:false,evidence:'Standing seams are visible',uncertainty:'Limited view'},
    {field:'paintCondition',value:'Peeling or flaking paint visible',conflict:false,evidence:'Flaking paint is visible',uncertainty:'One wall shown'},
  ];
  const result=applyCapturedFacts(current,{
    hvac:'Heat Pump (Electric)',solar:'Solar PV + Battery',roof:'Metal Roof',
    photoObservations:{paintCondition:'Peeling or flaking paint visible'},
  },false,review);
  assert.equal(result.hvac,'Heat Pump (Electric) + Boiler');
  assert.equal(result.solar,'Solar PV');
  assert.equal(result.roof,'Metal Roof');
  assert.equal(result.provenance.hvac.source,'Admin-verified public records');
  assert.equal(result.provenance.solar.source,'Completed permit');
  assert.equal(result.provenance.roof.origin,'inferred');
  assert.equal(result.photoObservations.paintCondition,'Peeling or flaking paint visible');
  assert.equal(result.photoReview.find(row=>row.field==='hvac').conflict,true);
  assert.equal(result.photoReview.find(row=>row.field==='hvac').conflictReason,'existing');
  assert.equal(result.photoReview.find(row=>row.field==='hvac').existingValue,'Heat Pump (Electric) + Boiler');
  assert.equal(result.photoReview.find(row=>row.field==='solar').conflict,true);
  assert.equal(result.photoReview.find(row=>row.field==='roof').conflict,false);
});

test('photo findings can replace unsupported defaults and earlier photo inferences',()=>{
  const result=applyCapturedFacts({
    address:'Real',solar:'None',leak:'None',roof:'Asphalt shingles',
    provenance:{solar:{origin:'unknown',source:'Initial form default'},leak:{origin:'unknown'},roof:{origin:'inferred',source:'Home Walk photos'}},
  },{solar:'Solar PV',leak:'Leak Detection Only',roof:'Metal Roof'},false,[
    {field:'solar',value:'Solar PV',conflict:false},
    {field:'leak',value:'Leak Detection Only',conflict:false},
    {field:'roof',value:'Metal Roof',conflict:false},
  ]);
  assert.equal(result.solar,'Solar PV');
  assert.equal(result.leak,'Leak Detection Only');
  assert.equal(result.roof,'Metal Roof');
  for(const field of ['solar','leak','roof']) assert.equal(result.provenance[field].origin,'inferred');
});

test('photo findings do not replace an explicit homeowner-confirmed unknown',()=>{
  const result=applyCapturedFacts({
    address:'Real',solar:'Unknown',
    provenance:{solar:{origin:'user-confirmed',source:'Home details'}},
  },{solar:'Solar PV'},false,[{field:'solar',value:'Solar PV',conflict:false}]);
  assert.equal(result.solar,'Unknown');
  assert.equal(result.provenance.solar.origin,'user-confirmed');
  assert.equal(result.photoReview[0].conflict,true);
  assert.equal(result.photoReview[0].existingValue,'Unknown');
});

test('photo findings preserve backend certification-derived evidence',()=>{
  const result=applyCapturedFacts({
    address:'Certified home',wildfireMitigation:'Ember-Resistant Vents',
    provenance:{wildfireMitigation:{origin:'inferred',source:'Certification: wildfire-prepared-home'}},
  },{wildfireMitigation:'None'},false,[{field:'wildfireMitigation',value:'None',conflict:false}]);
  assert.equal(result.wildfireMitigation,'Ember-Resistant Vents');
  assert.equal(result.provenance.wildfireMitigation.source,'Certification: wildfire-prepared-home');
});

test('later photo scans preserve homeowner-corrected observations while adding new notes',()=>{
  const result=applyCapturedFacts({
    address:'Real',
    photoObservations:{paintCondition:'Painted surface visible; condition unclear'},
    provenance:{photoObservations:{origin:'user-confirmed',source:'Home details'}},
  },{photoObservations:{paintCondition:'Peeling or flaking paint visible',flooringType:'Tile flooring visible'}},false,[
    {field:'paintCondition',value:'Peeling or flaking paint visible',conflict:false},
    {field:'flooringType',value:'Tile flooring visible',conflict:false},
  ]);
  assert.equal(result.photoObservations.paintCondition,'Painted surface visible; condition unclear');
  assert.equal(result.photoObservations.flooringType,'Tile flooring visible');
  assert.equal(result.provenance.photoObservations.origin,'user-confirmed');
  assert.equal(result.photoReview.find(row=>row.field==='paintCondition').conflict,true);
  assert.equal(result.photoReview.find(row=>row.field==='flooringType').conflict,false);
});

test('photo HVAC finding cannot indirectly erase protected hydronic evidence',()=>{
  const result=applyCapturedFacts({
    address:'Multifamily home',hvac:'Unknown',hydronicSource:'Natural Gas',
    provenance:{hvac:{origin:'unknown'},hydronicSource:{origin:'imported',source:'Completed boiler permit'}},
  },{hvac:'Heat Pump (Electric)'},false,[
    {field:'hvac',value:'Heat Pump (Electric)',conflict:false,evidence:'Outdoor unit visible',uncertainty:'Other systems may serve the building'},
  ]);
  assert.equal(result.hvac,'Unknown');
  assert.equal(result.hydronicSource,'Natural Gas');
  assert.equal(result.provenance.hydronicSource.source,'Completed boiler permit');
  assert.equal(result.photoReview[0].conflict,true);
  assert.equal(result.photoReview[0].conflictReason,'dependent');
  assert.equal(result.photoReview[0].existingValue,'Unknown');
});

test('photo conflict copy follows the reviewed value instead of staying stale',()=>{
  const row={value:'Heat Pump (Electric)',existingValue:'Heat Pump (Electric) + Boiler',conflict:true,conflictReason:'existing'};
  assert.match(photoFindingConflictText(row,'Heat Pump (Electric) + Boiler'),/existing detail was kept/i);
  assert.equal(photoFindingConflictText(row,'Heat Pump (Electric)'), '');
  assert.match(photoFindingConflictText(row,'Geothermal'),/reviewed value above will be used/i);
  const dependent={value:'Heat Pump (Electric)',existingValue:'Unknown',conflict:true,conflictReason:'dependent'};
  assert.match(photoFindingConflictText(dependent,'Unknown'),/related documented heating detail/i);
  assert.equal(photoFindingConflictText(dependent,'Heat Pump (Electric)'), '');
  assert.match(photoFindingConflictText(dependent,'Geothermal'),/reviewed value above will be used/i);
});

test('reviewing a photo HVAC suggestion preserves documented related heating evidence',()=>{
  const current={
    hvac:'Unknown',hydronicSource:'Natural Gas',
    provenance:{hvac:{origin:'unknown'},hydronicSource:{origin:'imported',source:'Completed boiler permit'}},
  };
  const result=applyReviewedPhotoValue(current,'hvac','Heat Pump (Electric)');
  assert.equal(result.hvac,'Heat Pump (Electric) + Boiler');
  assert.equal(result.hydronicSource,'Natural Gas');
  assert.equal(result.provenance.hvac.origin,'user-confirmed');
  assert.equal(result.provenance.hydronicSource.source,'Completed boiler permit');
});

test('reviewing a primary HVAC system preserves a permit-backed boiler as a secondary system',()=>{
  const current={
    hvac:'Heat Pump (Electric) + Boiler',hydronicSource:'Unknown',
    provenance:{hvac:{origin:'imported',source:'Permit records: FINAL HVAC2018-00100'},hydronicSource:{origin:'unknown'}},
  };
  for(const [selection,expected,origin] of [
    ['Heat Pump (Electric)','Heat Pump (Electric) + Boiler','imported'],
    ['Gas Furnace','Gas Furnace + Boiler','user-confirmed'],
    ['Geothermal','Geothermal + Boiler','user-confirmed'],
  ]) {
    const result=applyReviewedPhotoValue(current,'hvac',selection);
    assert.equal(result.hvac,expected);
    assert.equal(result.provenance.hvac.origin,origin);
  }
  const boiler=applyReviewedPhotoValue(current,'hvac','Boiler');
  assert.equal(boiler.hvac,'Boiler');
  assert.equal(boiler.provenance.hvac.origin,'user-confirmed');
});

test('explicit photo review may override a non-permit certification HVAC assumption',()=>{
  const current={
    hvac:'Heat Pump (Electric) + Boiler',hydronicSource:'Unknown',
    provenance:{hvac:{origin:'inferred',source:'Certification: energy-star'},hydronicSource:{origin:'unknown'}},
  };
  const result=applyReviewedPhotoValue(current,'hvac','Geothermal');
  assert.equal(result.hvac,'Geothermal');
  assert.equal(result.provenance.hvac.origin,'user-confirmed');
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
