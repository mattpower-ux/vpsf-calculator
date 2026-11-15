import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocumentUrls, mergeDocumentFacts } from './documentSources.js';
test('parses comma-separated URLs and removes duplicates', () => {
  assert.deepEqual(parseDocumentUrls(' https://example.com/a.pdf,\nhttps://example.com/b.txt, https://example.com/a.pdf '), ['https://example.com/a.pdf','https://example.com/b.txt']);
  assert.throws(()=>parseDocumentUrls('https://example.com/a.pdf, bad link'));
  assert.throws(()=>parseDocumentUrls('file:///private/home.pdf'));
});
test('conflicting document facts require explicit selection', () => {
  const merged = mergeDocumentFacts([{address:'12 Main St',yearBuilt:'2000'},{address:'12 Main St',yearBuilt:'2001',squareFeet:'1200'}]);
  assert.equal(merged.facts.address,'12 Main St');
  assert.equal(merged.selected.yearBuilt,false);
  assert.deepEqual(merged.alternatives.yearBuilt,['2000','2001']);
  assert.equal(merged.selected.squareFeet,true);
});
