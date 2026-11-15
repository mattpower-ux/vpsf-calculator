import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePhotoReview} from './photoReview.js';
test('photo results omit conflicting scoring values but retain review evidence', () => {
  const result=preparePhotoReview([
    {field:'siding',value:'Wood clapboard',evidence:'A',uncertainty:'Could be composite'},
    {field:'siding',value:'Fiber cement',evidence:'B',uncertainty:'Could be wood'},
    {field:'roof',value:'Architectural Shingle',evidence:'C',uncertainty:'Age unknown'},
    {field:'paintCondition',value:'Peeling or flaking paint visible',evidence:'D',uncertainty:'Limited view'},
  ]);
  assert.equal(result.facts.siding,undefined);
  assert.equal(result.facts.roof,'Architectural Shingle');
  assert.equal(result.review[0].conflict,true);
  assert.equal(result.facts.photoObservations.paintCondition,'Peeling or flaking paint visible');
});
