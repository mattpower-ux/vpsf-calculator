import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPhotoAnalysisManifest} from './photoEvidence.js';

test('homeowner photo assets precede automatic candidates and stay bounded',()=>{
  const homeowner=[{asset:{id:'mine',capability:'secret'}}];
  const automatic=Array.from({length:20},(_,i)=>({id:`public-${i}`}));
  const result=buildPhotoAnalysisManifest(automatic,homeowner);
  assert.equal(result.length,12);
  assert.equal(result[0].asset.id,'mine');
});
