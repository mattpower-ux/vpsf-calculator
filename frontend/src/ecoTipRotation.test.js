import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTip, eligibleTips } from './ecoTipRotation.js';
const tips=[{id:'a'},{id:'b'},{id:'c'}];
test('all tips appear before repetition and no repeat at cycle boundary',()=>{
 let state={}; const ids=[];
 for(let i=0;i<7;i++){const r=nextTip(tips,state,'v1',()=>0.3); state=r.state;ids.push(r.tip.id);}
 assert.equal(new Set(ids.slice(0,3)).size,3);assert.equal(new Set(ids.slice(3,6)).size,3); assert.notEqual(ids[2],ids[3]);
});
test('zero, one, retired tips and changed feeds are safe',()=>{
 assert.equal(nextTip([],{},'v').tip,null);
 assert.equal(nextTip([tips[0]],{last:'a'},'v').tip.id,'a');
 assert.equal(nextTip([tips[1]],{bag:['a'],revision:'old'},'new').tip.id,'b');
});
test('unknown climate only shows general tips',()=>{
 const list=[{id:'a',climateTags:[]},{id:'b',climateTags:['2A']}];
 assert.equal(eligibleTips(list,'').length,1);assert.equal(eligibleTips(list,'2A').length,2);assert.equal(eligibleTips(list,'6A').length,1);
});
