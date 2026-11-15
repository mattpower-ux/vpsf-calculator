import {resilienceActionSummary} from './resilienceFeatures.js';

const known = value => typeof value === 'string' && value.trim() && !/^(unknown|none \/ unknown|not available)$/i.test(value.trim());
const contains = (home,key,pattern) => known(home[key]) && pattern.test(home[key]);
const needs = {
 energy:[['hvac','heating and cooling type'],['hvacAge','equipment age'],['insulation','attic insulation level']],
 water:[['waterStandard','fixture efficiency'],['irrigation','irrigation type'],['leak','leak protection']],
 health:[['ventilation','ventilation type'],['materials','interior material finishes'],['iaq','air-quality monitoring']],
 carbon:[['carbonStrategy','material carbon documentation'],['hvac','heating fuel'],['waterHeater','water-heating type']],
 financial:[['pietim','monthly ownership costs relative to income'],['insurance','insurance coverage and discounts'],['maintenance','maintenance plan']],
 community:[['transit','nearby transit and services'],['bike','bike access'],['greenspace','nearby green space']]
};

export function pillarActionSummary(pillar,home={}) {
 if(pillar==='resilience') return resilienceActionSummary(home);
 const actions=[];
 const add=(key,pattern,text)=>{if(contains(home,key,pattern)) actions.push(text);};
 switch(pillar) {
 case 'energy':
  add('hvac',/gas|oil|propane|furnace|resistance/i,`Compare a heat-pump upgrade for the home's ${home.hvac?.toLowerCase()} system.`);
  if(Number.parseFloat(home.hvacAge)>=15 && !actions.length) actions.push(`Plan an efficient replacement for the ${Number.parseFloat(home.hvacAge)}-year-old heating and cooling equipment.`);
  add('waterHeater',/gas|oil|propane|electric resistance|standard electric/i,'Compare a heat-pump water heater when replacing the current unit.');
  add('windows',/single pane/i,'Upgrade the single-pane windows and address air leaks around their frames.');
  add('insulation',/^none$|uninsulated|poor/i,'Add insulation and air sealing where the home lacks thermal protection.');
  break;
 case 'water':
  add('waterStandard',/code.minimum|standard/i,'Upgrade the code-minimum fixtures to WaterSense-labeled toilets, faucets, and showerheads.');
  add('irrigation',/standard|conventional/i,'Replace conventional irrigation controls with weather-responsive scheduling and reduce unnecessary watering.');
  add('leak',/^none$/i,'Add leak detection and automatic shutoff to limit water loss.');
  break;
 case 'health':
  add('ventilation',/exhaust only/i,'Improve the exhaust-only ventilation with a planned supply of fresh air and effective kitchen and bath exhaust.');
  add('ventilation',/^none$/i,'Add a ventilation system that brings fresh air into occupied rooms.');
  add('materials',/standard/i,'Choose low-emission paints, adhesives, and finishes when updating the current interior materials.');
  add('iaq',/^none$|co2 monitoring only/i,'Add indoor air-quality monitoring to help identify ventilation and particle problems.');
  break;
 case 'carbon':
  add('carbonStrategy',/no accounting|partial/i,'Build a material record with product environmental declarations before choosing replacement materials.');
  add('hvac',/gas|oil|propane/i,`Compare electric heat pumps when replacing the home's ${home.hvac?.toLowerCase()} equipment.`);
  add('waterHeater',/gas|oil|propane/i,'Consider electric heat-pump water heating when the current fuel-burning unit needs replacement.');
  break;
 case 'financial':
  add('maintenance',/^none$|basic/i,'Create a maintenance and replacement budget for this home’s roof, HVAC, and water heater.');
  add('warranty',/standard/i,'Review the current equipment warranties and budget for repairs that are not covered.');
  add('insurance',/likely/i,'Ask the insurer to confirm which installed protections qualify for discounts.');
  break;
 case 'community':
  add('transit',/^none$/i,'Identify nearby essential services and practical shared-ride options before planning daily trips.');
  add('bike',/^none$/i,'Check safe local cycling routes and add secure bike storage if cycling is practical here.');
  add('greenspace',/^none$/i,'Look for accessible parks or shared outdoor spaces near this home.');
  break;
 }
 const missing=(needs[pillar]||[]).filter(([key])=>!known(home[key]));
 if(actions.length<3 && missing.length) actions.push(`Confirm this home's ${missing.slice(0,2).map(([,label])=>label).join(' and ')} to identify the next useful improvements.`);
 if(!actions.length) {
  const recorded=(needs[pillar]||[]).filter(([key])=>known(home[key])).slice(0,2);
  return recorded.length ? `The home records ${recorded.map(([key,label])=>`${label}: ${home[key]}`).join('; ')}. Review these existing features and their condition before selecting further upgrades.` : 'Add this home’s relevant details to identify specific improvements.';
 }
 return actions.slice(0,3).join(' ');
}
