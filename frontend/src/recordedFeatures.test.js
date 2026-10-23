import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedPillarFeatures } from './recordedFeatures.js';

test('absent solar and EV equipment never appear as property strengths', () => {
  const features = recordedPillarFeatures({ solar: 'None', evReady: 'None', hvac: 'Heat Pump (Electric)' }, 'energy');
  assert.deepEqual(features, ['Recorded: Heat Pump (Electric)']);
});
test('recorded equipment remains visible and unknown homes have an honest empty state', () => {
  assert.deepEqual(recordedPillarFeatures({ solar: '5.2 kW Solar PV + Battery' }, 'energy'), ['Recorded: 5.2 kW Solar PV + Battery']);
  assert.deepEqual(recordedPillarFeatures({ materials: 'Unknown', healthCert: 'None' }, 'health'), ['No qualifying features recorded yet.']);
});
