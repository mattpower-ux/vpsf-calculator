import { permitDiscoveriesFromEvidence, permitEvidenceForHome } from './permitEvidence.js';

const labels={
  homeType:'Home type',unitCount:'Number of units',yearBuilt:'Year built',squareFeet:'Square footage',stories:'Stories',
  bedrooms:'Bedrooms',bathrooms:'Bathrooms',lotSize:'Lot size',hvac:'Heating / cooling',solar:'Solar / battery',
  roof:'Roof',siding:'Siding',waterHeater:'Water heating',windows:'Windows',insulation:'Insulation',
  toilets:'Toilets',bathroomFaucets:'Bathroom faucets',showerheads:'Showerheads',
  paintCondition:'Exterior paint condition',flooringType:'Flooring',thermostatType:'Thermostat',
};
const publicOrder=['homeType','unitCount','yearBuilt','squareFeet','stories','bedrooms','bathrooms','lotSize'];
const questionOrder=['hvac','roof','siding','waterHeater','windows','insulation','toilets','bathroomFaucets','showerheads'];
const unknown=value=>value == null || String(value).trim()==='' || /^(unknown|none \/ unknown|not sure)$/i.test(String(value).trim());
const importedRecord=(home,field)=>{
  const evidence=home?.provenance?.[field];
  return evidence?.origin === 'imported' && !/^Permit records:/i.test(evidence.source || '') && !unknown(home[field]);
};

export function buildEvidenceSummary(home={}) {
  const publicRecords=publicOrder.filter(field=>importedRecord(home,field))
    .map(field=>({field,label:labels[field] || field,detail:String(home[field])}));
  const evidence=permitEvidenceForHome(home);
  const completedPermits=permitDiscoveriesFromEvidence(evidence).filter(item=>item.evidenceStatus === 'verified')
    .map(item=>({field:item.field,label:item.label,detail:[item.quantity,item.value,item.year].filter(value=>value !== null && value !== '').join(' · '),permitNumber:item.permitNumber}));
  const observations=home.photoObservations && typeof home.photoObservations === 'object' ? home.photoObservations : {};
  const photoBacked=/Home Walk photos/i.test(home.provenance?.photoObservations?.source || '');
  const photos=photoBacked ? Object.entries(observations).filter(([,value])=>!unknown(value))
    .map(([field,value])=>({field,label:labels[field] || field,detail:String(value)})) : [];
  const questions=questionOrder.filter(field=>unknown(home[field])).slice(0,4)
    .map(field=>({field,label:labels[field] || field,detail:`Add ${String(labels[field] || field).toLowerCase()}`}));
  return {publicRecords,completedPermits,photos,questions};
}
