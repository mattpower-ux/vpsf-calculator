import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedEdit, importedHome, joinAdviceProducts, adviceKey } from './homeAdvice.js';
test('confirmed edits preserve other field origins',()=>{
 const next=confirmedEdit({hvac:'Unknown',provenance:{roof:{origin:'imported'}}},'hvac','Heat Pump (Electric)');
 assert.equal(next.provenance.hvac.origin,'user-confirmed'); assert.equal(next.provenance.roof.origin,'imported');
});
test('import never confirms defaults or supersedes known provenance',()=>{
 const home=importedHome({hvac:'Unknown',leak:'None',roof:'Metal'});
 assert.equal(home.provenance.leak,undefined); assert.equal(home.provenance.roof.origin,'imported');
});
test('join retains canonical IDs and sponsorship; never creates demo matches',()=>{
 const joined=joinAdviceProducts([{id:'a',name:'A',isSponsored:true}],{matches:[{productId:'missing',group:'matched'},{productId:'a',group:'verification',reasons:['Reason']} ]});
 assert.equal(joined.length,1); assert.equal(joined[0].isSponsored,true); assert.equal(joined[0].match.group,'verification');
});
test('advice key changes with home facts and model version',()=>{
 assert.notEqual(adviceKey({hvac:'Oil'},'v1'),adviceKey({hvac:'Heat Pump'},'v1'));
 assert.notEqual(adviceKey({},'v1'),adviceKey({},'v2'));
});
