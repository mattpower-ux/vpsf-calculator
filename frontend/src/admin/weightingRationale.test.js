import test from 'node:test';
import assert from 'node:assert/strict';
import {rationaleFor,factorWeightSummary,allocationShare} from './weightingRationale.js';

test('rationale reports actual model points without treating budget share as risk reduction',()=>{
 const factor={field:'siding',mode:'equals',points:30,active:true};
 assert.equal(allocationShare(factor,200),15);
 assert.equal(allocationShare({...factor,points:20},200),10);
 assert.match(factorWeightSummary({...factor,points:20}),/\+20 points/);
 assert.match(rationaleFor(factor).tradeoff,/not a research-derived estimate/);
 assert.match(rationaleFor(factor).purpose,/regardless of manufacturer/);
});
test('lookup, retired and unknown factors never imply a fabricated calibration',()=>{
 assert.match(factorWeightSummary({active:true,mode:'lookup',options:{Gold:160,None:40},default:40}),/Gold: \+160/);
 assert.equal(allocationShare({active:true,mode:'lookup'},200),null);
 assert.match(factorWeightSummary({active:false,points:30}),/Retired/);
 assert.match(rationaleFor({field:'custom_unknown'}).tradeoff,/No factor-specific research/);
 assert.equal(factorWeightSummary(null),'Not in this model');
});
