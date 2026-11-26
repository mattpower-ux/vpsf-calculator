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
  const source = readFileSync(new URL('./AddressPhoto.jsx', import.meta.url), 'utf8');
  assert.match(styles, /\.analysisDepthHeader\s*\{[^}]*padding-top:\s*8px/);
  assert.match(styles, /\.analysisDepthHeader\s*>\s*p\s*\{[^}]*margin:\s*-4px auto 10px/);
  assert.match(styles, /\.analysisLevelResult\s*\{[^}]*padding:\s*12px/);
  assert.match(styles, /\.analysisTradeoffs\s+ul\s*\{[^}]*margin:\s*6px 0 10px/);
  assert.match(styles, /\.analysisTradeoffs\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)[\s\S]*\.analysisChoiceImage\s*\{[^}]*aspect-ratio:\s*2\.1/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)[\s\S]*\.analysisTradeoffs\s+ul\s*\{[^}]*font-size:\s*13px/);
  assert.match(source, /<div><h4>Pros<\/h4><ul>/);
  assert.match(source, /<div><h4>Cons<\/h4><ul>/);
});
