import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the photo-analysis action uses the homeowner-facing label', () => {
  const source = readFileSync(new URL('./AnalysisFlow.jsx', import.meta.url), 'utf8');
  assert.match(source, /> Analyze my Photos<\/button>/);
  assert.match(source, /mode === 'walk' \? 'Analyze my Photos'/);
  assert.doesNotMatch(source, /> Guided Home Walk<\/button>/);
});

test('the scoring-depth header stays compact so the action remains in the phone viewport', () => {
  const styles = readFileSync(new URL('./analysisFlow.css', import.meta.url), 'utf8');
  assert.match(styles, /\.analysisDepthHeader\s*\{[^}]*padding-top:\s*8px/);
  assert.match(styles, /\.analysisDepthHeader\s*>\s*p\s*\{[^}]*margin:\s*-4px auto 10px/);
  assert.match(styles, /\.analysisLevelResult\s*\{[^}]*padding:\s*12px/);
  assert.match(styles, /\.analysisTradeoffs\s+ul\s*\{[^}]*margin:\s*6px 0 10px/);
});
