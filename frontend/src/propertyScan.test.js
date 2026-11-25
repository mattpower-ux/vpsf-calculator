import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProviderFields, savedMatchForAddress } from './propertyScan.js';
import { prepareAnalysisHome } from './analysisLevels.js';

test('fallback facts carry their own provenance through all analysis levels', () => {
  const primary={roof:'Unknown',hvac:'Gas Furnace',provenance:{roof:{origin:'unknown'},hvac:{origin:'imported',source:'RentCast'}}};
  const fallback={roof:'Metal',hvac:'Heat Pump',provenance:{roof:{origin:'imported',source:'ATTOM'},hvac:{origin:'imported',source:'ATTOM'}}};
  const before=structuredClone([primary,fallback]);
  const merged=mergeProviderFields(primary,fallback);
  for(const level of ['broad','moderate','inclusive']) {
    const home=prepareAnalysisHome(merged,level);
    assert.equal(home.roof,'Metal'); assert.equal(home.hvac,'Gas Furnace');
    assert.equal(home.provenance.roof.source,'ATTOM'); assert.equal(home.provenance.hvac.source,'RentCast');
  }
  assert.deepEqual([primary,fallback],before);
});

test('unprovenanced fallback cannot inherit the primary fields evidence', () => {
  const home=mergeProviderFields({roof:'',provenance:{roof:{origin:'imported',source:'RentCast'}}},{roof:'Metal'});
  assert.deepEqual(home.provenance.roof,{origin:'unknown'});
  assert.equal(prepareAnalysisHome(home,'broad').roof,'');
});

test('zero values are retained and unknown fallback evidence does not replace known evidence', () => {
  const home=mergeProviderFields({bedrooms:0,provenance:{bedrooms:{origin:'imported',source:'RentCast'}}},{bedrooms:3,provenance:{bedrooms:{origin:'unknown'}}});
  assert.equal(home.bedrooms,0); assert.equal(home.provenance.bedrooms.source,'RentCast');
});

test('an admin-verified correction overrides an older provider value', () => {
  const primary={hvac:'Gas Furnace',provenance:{hvac:{origin:'imported',source:'RentCast'}}};
  const fallback={hvac:'Heat Pump (Electric) + Boiler',provenance:{hvac:{origin:'imported',source:'Public records: VPSF admin-verified property correction'}}};
  const home=mergeProviderFields(primary,fallback);
  assert.equal(home.hvac,'Heat Pump (Electric) + Boiler');
  assert.equal(home.provenance.hvac.origin,'imported');
  assert.equal(prepareAnalysisHome(home,'broad').hvac,'Heat Pump (Electric) + Boiler');
});

test('cached match is unusable immediately after changing the address', () => {
  const property={address:'12 First Street',roof:'Metal'};
  const cached={lookupAddress:'12 First Street',property};
  assert.equal(savedMatchForAddress(cached,'12 First Street'),property);
  assert.equal(savedMatchForAddress(cached,'99 Second Street'),null);
  assert.equal(savedMatchForAddress(null,'12 First Street'),null);
});

test('a late response for A cannot be used to autofill or scan B', async () => {
  let resolveA;
  const requestA=new Promise(resolve=>{resolveA=resolve;});
  const currentAddress='99 Second Street';
  const propertyB={address:currentAddress};
  let cached={lookupAddress:currentAddress,property:propertyB};
  assert.equal(savedMatchForAddress(cached,currentAddress),propertyB);
  resolveA({address:'12 First Street'});
  cached={lookupAddress:'12 First Street',property:await requestA};
  assert.equal(savedMatchForAddress(cached,currentAddress),null);
});
