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
  const protectionFields = {
    fortified:'Resilience certification', flood:'Flood protection', moisture:'Moisture management',
    backup:'Backup power', wildfireMitigation:'Wildfire protection',
    temperatureProtection:'Temperature protection', windProtection:'Wind protection'
  };
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
