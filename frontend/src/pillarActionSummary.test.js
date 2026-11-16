import test from 'node:test';
import assert from 'node:assert/strict';
import {pillarActionSummary} from './pillarActionSummary.js';

test('each pillar uses supplied weak features to identify next actions',()=>{
 const cases=[
 ['energy',{hvac:'Oil Furnace',windows:'Single Pane'},/oil furnace.*heat|heat-pump.*oil furnace/i],
 ['water',{toilets:'Standard',irrigation:'Standard Irrigation',leak:'None'},/WaterSense.*irrigation.*leak/s],
 ['health',{ventilation:'Exhaust Only',materials:'Standard Materials',iaq:'None'},/exhaust-only.*low-emission.*monitoring/s],
 ['carbon',{carbonStrategy:'No Accounting',hvac:'Natural Gas Boiler'},/environmental declarations.*natural gas boiler/s],
 ['financial',{maintenance:'None',warranty:'Standard Warranties'},/maintenance and replacement budget.*warranties/s],
 ['community',{transit:'None',bike:'None'},/shared-ride.*cycling/s],
 ['resilience',{siding:'Wood clapboard',roof:'Asphalt shingles',roofAge:'20'},/noncombustible siding.*20-year-old/s]
 ];
 for(const [pillar,home,expected] of cases) assert.match(pillarActionSummary(pillar,home),expected,pillar);
});

test('effective efficient fixtures suppress replacements despite a legacy water standard', () => {
 const text = pillarActionSummary('water',{waterStandard:'Code-Minimum',toilets:'WaterSense',bathroomFaucets:'WaterSense',showerheads:'WaterSense',irrigation:'No Irrigation',leak:'Automatic Shutoff'});
 assert.doesNotMatch(text,/Upgrade|Replace|Confirm|Add leak/);
});

test('water actions name only standard fixture categories and request unknown ones', () => {
 const text = pillarActionSummary('water',{toilets:'WaterSense',bathroomFaucets:'Standard',showerheads:'Unknown'});
 assert.match(text,/WaterSense-labeled bathroom faucets/);
 assert.doesNotMatch(text,/WaterSense-labeled toilets/);
 assert.match(text,/Confirm.*showerhead efficiency/);
 assert.doesNotMatch(pillarActionSummary('water',{waterStandard:'Code-Minimum'}),/Upgrade/);
});
test('unknown data is requested and never presented as an absent feature',()=>{
 for(const pillar of ['energy','water','health','carbon','financial','community']) {
  const text=pillarActionSummary(pillar,{});
  assert.match(text,/Confirm this home's/);
  assert.doesNotMatch(text,/Replace|Upgrade|Add leak|fuel-burning/);
 }
});
test('existing efficient equipment does not get a contradictory replacement instruction',()=>{
 assert.doesNotMatch(pillarActionSummary('energy',{hvac:'Heat Pump (Electric)',waterHeater:'Heat Pump Water Heater',windows:'Double Pane, Low-E',insulation:'R-38'}),/replacement|Upgrade|Compare/);
 assert.doesNotMatch(pillarActionSummary('water',{waterStandard:'WaterSense Home v2',irrigation:'No Irrigation',leak:'Automatic Shutoff'}),/Upgrade|Replace|Add leak/);
});
