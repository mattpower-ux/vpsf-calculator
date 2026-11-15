import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCapturedFacts } from './captureFacts.js';
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
