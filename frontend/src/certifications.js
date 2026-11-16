// Raw certification claims are kept separate from API-derived feature values.
export const fixtureOptions = ['Unknown', 'Standard', 'Low-flow', 'WaterSense'];
export const fixtureFields = [['toilets', 'Toilets'], ['bathroomFaucets', 'Bathroom faucets'], ['showerheads', 'Showerheads']];
export const boundedCertificationFields = ['toilets','bathroomFaucets','showerheads','roofFireRating'];
export const featureField = feature => feature.field || feature.target;

export function newCertification(home, programId) {
  return {programId, edition:'', level:'', propertyAddress:home.address || '', certificateId:'',
    ...Object.fromEntries([['propertyCity','city'],['propertyState','state'],['propertyZip','zip']].filter(([,key]) => home[key]).map(([target,key]) => [target,home[key]])),
    issuedDate:null, evidenceReference:'', status:'reported', replacedFields:[]};
}

export function recognitionNames(data, catalog) {
  return [...new Set((data?.recognitions || []).map(item => item.programName || item.name
    || catalog?.programs?.find(program => program.id === item.programId)?.name || item.programId).filter(Boolean))];
}

export function removeCertification(home, index) {
  return {...home, certifications:(home.certifications || []).filter((_, i) => i !== index)};
}

/** Presentation only: never pass the returned record to a raw-home setter. */
export function presentationInput(raw, response) {
  if (!response?.effectiveInput) return raw;
  const effective = {...raw, ...response.effectiveInput, provenance:{...raw?.provenance, ...response.effectiveInput.provenance}};
  for (const feature of response.certificationEvidence?.derivedFeatures || response.derivedFeatures || []) {
    const field = featureField(feature);
    if (field && effective.provenance[field]?.origin !== 'inferred') effective.provenance[field] = {origin:'inferred',source:'Certification requirement'};
  }
  return effective;
}

/** Keep draft claims bounded, textual and free of document contents. */
export function draftCertifications(value) {
  if (!Array.isArray(value)) return [];
  const safe = (value, max = 500) => typeof value === 'string' && value.length <= max && !/(?:data:|blob:)/i.test(value) ? value : '';
  return value.slice(0, 20).filter(item => item && typeof item === 'object' && safe(item.programId)).map(item => ({
    ...Object.fromEntries(['programId','edition','level','propertyAddress','certificateId','issuedDate','evidenceReference'].map(key => [key,safe(item[key])])),
    ...Object.fromEntries(['propertyCity','propertyState','propertyZip'].filter(key => typeof item[key] === 'string').map(key => [key,safe(item[key])])),
    evidenceReference:safe(item.evidenceReference,1000),
    issuedDate:safe(item.issuedDate) || null,
    status:item.status === 'document-supported' ? 'document-supported' : 'reported', replacedFields:Array.isArray(item.replacedFields) ? item.replacedFields.filter(key => typeof key === 'string' && /^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(key)).slice(0,64) : []
  }));
}
