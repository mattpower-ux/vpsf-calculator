import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisContextText} from './analysisContextLine.js';

test('analysis context keeps level and address visible without requiring ZIP',()=>{
  assert.equal(analysisContextText({analysisLevel:'broad',address:'22 Dow St',city:'Portland',state:'ME'}),'1. Basic · 22 Dow St, Portland, ME');
  assert.equal(analysisContextText({analysisLevel:'inclusive',address:'18 Merrill Road',city:'Freeport',state:'ME',zip:'04032'}),'3. Superior · 18 Merrill Road, Freeport, ME, 04032');
});
