import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnalysisLevel, analysisLevelLabel, routeAfterLookup, prepareHomeForLevel, prepareAnalysisHome, analysisLabel, analysisRoute } from './analysisLevels.js';
import { importedHome } from './homeAdvice.js';

test('levels normalize safely and route independently of saved home state', () => {
  for (const [input, level, label, route] of [[' BROAD ', 'broad', '1. Essentials', 3], ['Moderate', 'moderate', '2. Systems', 1], ['inclusive', 'inclusive', '3. Full Audit', 29]]) {
    assert.equal(normalizeAnalysisLevel(input), level);
    assert.equal(analysisLevelLabel(input), label);
    assert.equal(routeAfterLookup(input), route);
  }
  for (const input of [undefined, null, '', 'advanced', {}, 1]) {
    assert.equal(normalizeAnalysisLevel(input), 'moderate');
    assert.equal(routeAfterLookup(input), 1);
  }
});

const evidence = (origin, source = 'Property record') => ({origin, source});
const sample = () => ({address:'12 QA Street', zip:'01234', yearBuilt:'1982', roof:'Metal', hvac:'Heat Pump (Electric)', solar:'Solar PV', waterHeater:'Heat Pump Water Heater', fortified:'FORTIFIED Silver', backup:'None',
  provenance:{yearBuilt:evidence('imported','RentCast'), roof:evidence('imported','ATTOM'), hvac:evidence('unknown','Initial form default'), solar:evidence('user-confirmed','Home details'), waterHeater:evidence('inferred','Home Walk photos'), backup:evidence('user-confirmed','Home details')},
  extraInputs:{bonus:true}, photoObservations:{roof:'metal visible'}, photoReview:[{field:'roof'}], sourceNote:'Homeowner private notes', analysisLevel:'inclusive'});

test('Broad retains public facts but blanks unknown and private saved equipment', () => {
  const result = prepareHomeForLevel(sample(), 'broad');
  assert.equal(result.address, '12 QA Street'); assert.equal(result.zip, '01234');
  assert.equal(result.yearBuilt, '1982'); assert.equal(result.roof, 'Metal');
  for (const key of ['hvac','solar','waterHeater','fortified','backup']) assert.equal(result[key], '');
  for (const key of ['extraInputs','photoObservations','photoReview','sourceNote']) assert.equal(Object.hasOwn(result,key), false);
  assert.deepEqual(Object.keys(result.provenance).sort(), ['roof','yearBuilt']);
  assert.equal(result.analysisLevel, 'broad');
});

test('Moderate and Inclusive keep evidenced additions and preserve explicit None', () => {
  for (const level of ['moderate','inclusive']) {
    const result = prepareHomeForLevel(sample(), level);
    assert.equal(result.solar, 'Solar PV'); assert.equal(result.waterHeater, 'Heat Pump Water Heater');
    assert.equal(result.backup, 'None'); assert.equal(result.hvac, ''); assert.equal(result.fortified, '');
    assert.deepEqual(result.extraInputs,{bonus:true}); assert.equal(result.photoReview[0].field,'roof');
    assert.equal(result.provenance.waterHeater.origin,'inferred');
    assert.equal(result.analysisLevel, level);
  }
});

test('Broad does not treat arbitrary imported documents as public records', () => {
  const home={roof:'Metal',provenance:{roof:evidence('imported','Homeowner invoice')}};
  assert.equal(prepareHomeForLevel(home,'broad').roof,'');
  assert.equal(prepareHomeForLevel(home,'moderate').roof,'Metal');
});

test('only designated demo facts bypass public-only filtering', () => {
  const home={demoScenario:'hardie-wildfire',siding:'Wood',solar:'Solar PV',hvac:'Heat Pump',roof:'Metal',extraInputs:{bonus:10},provenance:{siding:evidence('demo-assumption'),solar:evidence('demo-assumption'),roof:evidence('unknown')}};
  const result=prepareHomeForLevel(home,'broad');
  assert.equal(result.siding,'Wood'); assert.equal(result.solar,'Solar PV');
  assert.equal(result.hvac,''); assert.equal(result.roof,''); assert.equal(result.demoScenario,'hardie-wildfire');
  assert.equal(Object.hasOwn(result,'extraInputs'),false);
  assert.equal(prepareHomeForLevel({...home,demoScenario:''},'inclusive').siding,'');
});

test('unanswered forms are blank, not assumed absent or code minimum', () => {
  const result=prepareHomeForLevel({hvac:'Unknown',solar:'None',hers:'Code-Minimum',pietim:'30-35%', roof:'  unknown ',provenance:{roof:evidence('imported')}},'moderate');
  for (const key of ['hvac','solar','hers','pietim','roof','waterHeater','siding']) assert.equal(result[key],'');
  assert.equal(Object.hasOwn(result.provenance,'roof'),false);
});

test('preparation is detached, idempotent, and cannot inherit a saved analysis level', () => {
  const home=sample(); const original=structuredClone(home);
  const result=prepareHomeForLevel(home,'moderate');
  assert.deepEqual(prepareHomeForLevel(result,'moderate'),result);
  result.provenance.roof.source='changed'; result.photoReview[0].field='changed'; result.extraInputs.bonus=false;
  assert.deepEqual(home,original);
  assert.equal(prepareHomeForLevel(home).analysisLevel,'moderate');
});

test('parent-facing aliases preserve contracts and provide full analysis labels', () => {
  assert.equal(prepareAnalysisHome, prepareHomeForLevel);
  assert.equal(analysisRoute, routeAfterLookup);
  assert.equal(analysisLabel('broad'), '1. Essentials');
  assert.equal(analysisLabel('moderate'), '2. Systems');
  assert.equal(analysisLabel('inclusive'), '3. Full Audit');
  assert.equal(analysisLabel(undefined), '2. Systems');
  assert.equal(analysisRoute('inclusive'), 29);
});

test('only location-matched official risk evidence survives', () => {
  const home={latitude:33,longitude:-116,wildfire:{source:'USFS Wildfire Risk to Communities',datasetVersion:'wrc-2024',status:'available',areaType:'county',nationalPercentile:99,latitude:33,longitude:-116},epaWalkability:{source:'EPA National Walkability Index',status:'available',value:12,latitude:33,longitude:-116}};
  const result=prepareHomeForLevel(home,'broad');
  assert.deepEqual(result.wildfire,home.wildfire); assert.deepEqual(result.epaWalkability,home.epaWalkability);
  const moved=prepareHomeForLevel({...home,latitude:34},'broad');
  assert.equal(moved.wildfire,null); assert.equal(moved.epaWalkability,null);
});

test('initial location defaults are not preserved as entered addresses', () => {
  assert.equal(prepareHomeForLevel({address:'Demo default',provenance:{address:evidence('unknown')}},'broad').address,'');
  assert.equal(prepareHomeForLevel(null,'moderate').address,'');
});

test('wrapping a fallback scan does not promote existing unknown equipment provenance', () => {
  const home=importedHome({ventilation:'Exhaust Only',provenance:{ventilation:evidence('unknown','Initial form default')}});
  assert.equal(home.provenance.ventilation.origin,'unknown');
  assert.equal(prepareAnalysisHome(home,'broad').ventilation,'');
  assert.equal(prepareAnalysisHome(home,'moderate').ventilation,'');
});

test('Broad allows geographic sources only for their applicable climate/flood fields', () => {
  for (const source of ['PNNL county climate data','IECC 2021 climate zone','Geographic risk enrichment','Location risk enrichment','Public geographic risk']) {
    const home={climateZone:'2A',hvac:'Heat Pump',provenance:{climateZone:evidence('imported',source),hvac:evidence('imported',source)}};
    assert.equal(prepareAnalysisHome(home,'broad').climateZone,'2A');
    assert.equal(prepareAnalysisHome(home,'broad').hvac,'');
  }
  const home={flood:'Mapped flood zone AE',climateZone:'2A',provenance:{flood:evidence('imported','FEMA flood mapping'),climateZone:evidence('imported','FEMA flood mapping')}};
  assert.equal(prepareAnalysisHome(home,'broad').flood,'Mapped flood zone AE');
  assert.equal(prepareAnalysisHome(home,'broad').climateZone,'');
  home.provenance.flood=evidence('user-confirmed','FEMA flood mapping');
  assert.equal(prepareAnalysisHome(home,'broad').flood,'');
});
