import { boundedCertificationFields } from './certifications.js';

export function confirmedEdit(home, key, value) {
  if (boundedCertificationFields.includes(key) && !value) value = 'Unknown';
  const locationChanged = ['address','city','state','zip','parcelId'].includes(key) && home[key] !== value;
  const certificationPatch = Array.isArray(home.certifications) && key !== 'certifications'
    ? {certifications: locationChanged ? [] : home.certifications.map(claim => ({...claim,
      replacedFields: typeof value === 'string' || typeof value === 'number'
        ? [...new Set([...(claim.replacedFields || []),key])].slice(-64) : claim.replacedFields || []}))} : {};
  return {...home,[key]:value,...certificationPatch,...(locationChanged ? {permitEvidence:null} : {}),provenance:{...home.provenance,[key]:{origin:'user-confirmed',source:'Home details',date:new Date().toISOString()}}};
}
export function importedHome(home) {
  const provenance={...home.provenance};
  for(const [key,value] of Object.entries(home)) {
    if(typeof value==='string' && value.trim() && !['unknown','none','none / unknown','code-minimum','standard landscaping','standard','no accounting'].includes(value.toLowerCase()) && !provenance[key])
      provenance[key]={origin:'imported',source:'Property record',date:new Date().toISOString()};
  }
  return {...home,provenance};
}
export function joinAdviceProducts(products, advice) {
  const catalog=new Map(products.map(p=>[p.id,p]));
  return (advice?.matches||[]).filter(m=>catalog.has(m.productId)).map(match=>({...catalog.get(match.productId),match}));
}
export const adviceKey=(home,version)=>JSON.stringify({home,version});
export function demoAdviceHome(property) {
  return {address:property?.address||'',roof:property?.roofType||'Unknown',roofAge:property?.roofAgeYears==null?'Unknown':String(property.roofAgeYears),provenance:{roof:{origin:'inferred',source:'Demonstration record'},roofAge:{origin:'inferred',source:'Demonstration record'}}};
}
