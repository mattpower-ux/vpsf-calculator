import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the photo-analysis action uses the homeowner-facing label', () => {
  const source = readFileSync(new URL('./AnalysisFlow.jsx', import.meta.url), 'utf8');
  assert.match(source, /> Analyze my Photos<\/button>/);
  assert.match(source, /mode === 'walk' \? 'Analyze my Photos'/);
  assert.doesNotMatch(source, /> Guided Home Walk<\/button>/);
});
