import { wildfireAssessment } from './wildfire.js';

const protectionFields = {
  fortified:'Resilience certification', flood:'Flood protection', moisture:'Moisture management',
  backup:'Backup power', wildfireMitigation:'Wildfire protection',
  temperatureProtection:'Temperature protection', windProtection:'Wind protection'
};

export function resilienceRecordNotes(home) {
  const missing = [], unknown = [];
  const labels = {fortified:'resilience certification', wildfireMitigation:'wildfire protection', backup:'backup power', flood:'flood protection', moisture:'moisture control', temperatureProtection:'extreme-temperature protection', windProtection:'wind protection'};
  for (const [key, label] of Object.entries(labels)) {
    const value = (home[key] || '').trim().toLowerCase();
    if (value === 'none') missing.push(label);
    else if (['', 'unknown', 'none / unknown'].includes(value)) unknown.push(label);
  }
  const list = values => values.length < 2 ? values.join('') : values.slice(0, -1).join(', ') + ' and ' + values.at(-1);
  return [missing.length ? `Not recorded: ${list(missing)}.` : '', unknown.length ? `Still to confirm: ${list(unknown)}.` : ''].filter(Boolean).join(' ');
}

export function resilienceFeatures(home) {
  const pros = [], cons = [];
  const siding = home.siding || '', roof = home.roof || '';
  const age = Number.parseFloat(home.roofAge);
  if (/^(fiber cement|brick|stucco|metal|noncombustible)$/i.test(siding))
    pros.push(`Noncombustible ${siding.toLowerCase()} siding reduces fuel on the exterior walls.`);
  if (/wood|cedar/i.test(siding))
    cons.push(`${siding} siding is combustible and can contribute to flame spread.`);
  if (/vinyl/i.test(siding)) cons.push('Vinyl siding can melt in fire exposure, leaving underlying wall materials exposed.');
  if (/asphalt/i.test(roof) && age >= 20)
    cons.push(`Older asphalt roof (${home.roofAge}) — aging shingles can be more vulnerable to weather damage.`);
  if (/metal|concrete tile|clay tile/i.test(roof)) pros.push(`${roof} provides a noncombustible roof covering.`);
  let protections = 0, explicitNone = false;
  for (const [key, label] of Object.entries(protectionFields)) {
    const value = home[key] || '';
    if (/^none$/i.test(value)) explicitNone = true;
    if (!value || /^(none|unknown|standard)/i.test(value)) continue;
    protections++;
    pros.push(`${label}: ${value}.`);
  }
  if (!protections && explicitNone && !pros.length)
    cons.push('No notable risk-reduction measures recorded for this home.');
  return {
    pros: pros.length ? pros : ['No resilience-enhancing features recorded.'],
    cons: cons.length ? cons : ['No specific weaknesses identified from the supplied home details.']
  };
}

export function resilienceActionSummary(home = {}) {
  const actions = [];
  const exposed = ['High','Very High'].includes(wildfireAssessment(home)?.level);
  const siding = home.siding || '', roof = home.roof || '';
  const age = Number.parseFloat(home.roofAge);
  if (/wood|cedar|vinyl/i.test(siding)) actions.push(`Replace the ${siding.toLowerCase()} siding with noncombustible siding.`);
  if (/wood|cedar|shake/i.test(roof) && !/asphalt/i.test(roof)) actions.push('Replace the combustible wood roof with a fire-resistant roofing system.');
  else if (/asphalt/i.test(roof) && age >= 20) actions.push(`Plan to replace the ${age}-year-old asphalt roof${exposed ? ' with a fire-resistant roofing system' : ' to improve weather protection'}.`);
  if (exposed && !/defensible/i.test(home.wildfireMitigation || '')) actions.push('Prepare the landscaping for wildfire: clear dry vegetation and debris near the house and create defensible space.');
  else if (exposed && !/ember/i.test(home.wildfireMitigation || '')) actions.push('Add ember-resistant vents and protect openings where embers can enter.');
  if (/^none$/i.test(home.backup || '') && actions.length < 3) actions.push('Add backup power for essential equipment during outages.');
  if (!actions.length) {
    const strengths = resilienceFeatures(home).pros.filter(text=>!text.startsWith('No resilience'));
    return strengths.length ? `${strengths.slice(0,2).join(' ')} Keep these protections maintained and review the recommendations for remaining improvements.` : 'Add the roof age, siding material, and existing hazard protections so the calculator can identify this home’s most useful resilience improvements.';
  }
  return actions.slice(0,3).join(' ');
}
