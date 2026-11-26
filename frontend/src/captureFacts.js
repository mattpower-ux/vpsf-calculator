import { confirmedEdit } from './homeAdvice.js';
import { heatingSelectionPatch } from './heatingResilience.js';
import { normalizeAnalysisLevel, prepareAnalysisHome } from './analysisLevels.js';

const addressKey = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
const hasKnownValue = value => value != null && String(value).trim() !== '' && !/^(unknown|not sure|none \/ unknown)$/i.test(String(value).trim());
const protectedEvidence = (home, key) => {
  const evidence = home.provenance?.[key];
  if (!evidence) return false;
  if (['imported','user-confirmed','demo-assumption'].includes(evidence.origin)) return true;
  return evidence.origin === 'inferred' && /^(Certification(?: requirement|:)|Demonstration record)/i.test(evidence.source || '');
};
const protectsCurrentValue = (home,key) => home.provenance?.[key]?.origin === 'user-confirmed'
  || (hasKnownValue(home[key]) && protectedEvidence(home,key));

export function photoFindingConflictText(row, currentValue) {
  if (!row?.conflict) return '';
  if (row.conflictReason === 'existing') {
    if (currentValue === row.value) return '';
    return currentValue === row.existingValue
      ? `The photos suggest ${row.value}. Your existing detail was kept; change it above only if the photo is more accurate.`
      : `The photos suggest ${row.value}. Your reviewed value above will be used.`;
  }
  if (row.conflictReason === 'dependent') {
    if (currentValue === row.value) return '';
    return currentValue === row.existingValue
      ? 'This photo suggestion conflicts with a related documented heating detail. Review both systems before changing it.'
      : `The photos suggest ${row.value}. Your reviewed value above will be used.`;
  }
  return 'Photos suggest different values. Choose the correct detail above.';
}

export function applyReviewedPhotoValue(home,key,value) {
  const hvacEvidenceSource = home.provenance?.hvac?.source || '';
  if (key === 'hvac' && /boiler/i.test(home.hvac || '') && !/boiler/i.test(value || '') && /permit|admin-verified property correction/i.test(hvacEvidenceSource)) {
    return {...home,provenance:{...home.provenance}};
  }
  let reviewedValue = value;
  if (key === 'hvac' && value === 'Heat Pump (Electric)' && hasKnownValue(home.hydronicSource) && protectedEvidence(home,'hydronicSource')) {
    reviewedValue = 'Heat Pump (Electric) + Boiler';
  }
  const selectionPatch = heatingSelectionPatch(home,key,reviewedValue);
  for (const field of Object.keys(selectionPatch)) {
    if (hasKnownValue(home[field]) && protectedEvidence(home,field)) delete selectionPatch[field];
  }
  return {...confirmedEdit(home,key,reviewedValue),...selectionPatch};
}

/**
 * Apply reviewed evidence while preserving the selected analysis level. A new,
 * nonblank address (or explicit fresh flag) starts a clean, non-demo home.
 * Missing/blank parsed location parts are not edits. Same-home evidence keeps
 * the existing demo marker; imported metadata cannot change level or identity.
 */
export function applyAnalysisEvidence(current, facts, photoReview, {fresh = false} = {}) {
  const reviewed = {...facts};
  for (const key of ['address','city','state','zip']) {
    if (reviewed[key] == null || String(reviewed[key]).trim() === '') delete reviewed[key];
  }
  for (const key of ['analysisLevel','demoScenario','provenance','permitEvidence']) delete reviewed[key];
  const moved = Boolean(addressKey(reviewed.address)) && addressKey(reviewed.address) !== addressKey(current.address);
  if (!moved && reviewed.address !== undefined) reviewed.address = current.address;
  const reset = fresh || moved;
  const level = normalizeAnalysisLevel(current.analysisLevel);
  const next = {
    ...applyCapturedFacts(current, reviewed, reset, photoReview),
    analysisLevel: level,
    demoScenario: reset ? '' : current.demoScenario || ''
  };
  return reset ? prepareAnalysisHome(next, level) : next;
}

export function applyCapturedFacts(current, facts, fresh = false, photoReview) {
  let home = fresh ? Object.fromEntries(Object.entries(current).map(([key, value]) => [key, typeof value === 'string' ? 'Unknown' : null])) : { ...current };
  if (fresh) {
    for (const key of ['address', 'city', 'state', 'zip', 'squareFeet', 'yearBuilt', 'bedrooms', 'bathrooms', 'lotSize', 'climateZone']) home[key] = '';
    home.provenance = {}; home.extraInputs = {}; home.photoObservations = {};
    home.homeType = 'Single Family Detached'; home.occupancy = 'Owner Occupied'; home.stories = '1';
  }
  const moved = facts.address && facts.address !== current.address;
  if (moved || fresh) {
    home.certifications = [];
    home.latitude = null; home.longitude = null; home.wildfire = null; home.epaWalkability = null;
    home.city = ''; home.state = ''; home.zip = ''; home.climateZone = '';
    home.sourceNote = 'Review the address and home details before scoring.';
  }
  const reviewedPhotos = Array.isArray(photoReview) ? photoReview.map(row => ({...row})) : photoReview;
  for (const [key, value] of Object.entries(facts)) {
    if (Array.isArray(reviewedPhotos) && key === 'photoObservations') {
      const existing = home.photoObservations || {};
      const protectedNotes = protectedEvidence(home,'photoObservations');
      const merged = protectedNotes ? {...value,...existing} : {...existing,...value};
      if (protectedNotes) for (const [field,existingValue] of Object.entries(existing)) {
        const row = reviewedPhotos.find(item => item.field === field);
        if (row && value?.[field] !== undefined && value[field] !== existingValue) Object.assign(row,{conflict:true,conflictReason:'existing',existingValue});
      }
      home = protectedNotes ? {...home,photoObservations:merged} : confirmedEdit(home,key,merged);
      if (!protectedNotes) home.provenance[key] = {origin:'inferred',source:'Home Walk photos',date:new Date().toISOString()};
      continue;
    }
    if (Array.isArray(reviewedPhotos) && protectsCurrentValue(home,key)) {
      const row = reviewedPhotos.find(item => item.field === key);
      if (row && home[key] !== value) {
        row.conflict = true;
        row.conflictReason = 'existing';
        row.existingValue = home[key];
      }
      continue;
    }
    const selectionPatch = heatingSelectionPatch(home, key, value);
    const protectedDependent = Object.keys(selectionPatch).find(field => hasKnownValue(home[field]) && selectionPatch[field] !== home[field] && protectedEvidence(home,field));
    if (Array.isArray(reviewedPhotos) && protectedDependent) {
      const row = reviewedPhotos.find(item => item.field === key);
      if (row) {
        row.conflict = true;
        row.conflictReason = 'dependent';
        row.relatedField = protectedDependent;
        row.existingValue = home[key];
      }
      continue;
    }
    const merged = key === 'photoObservations' ? {...home.photoObservations,...value} : value;
    home = { ...confirmedEdit(home, key, merged), ...selectionPatch };
    if (Array.isArray(reviewedPhotos) && key !== 'address' && !['city','state','zip'].includes(key)) {
      home.provenance[key] = {origin:'inferred',source:'Home Walk photos',date:new Date().toISOString()};
    }
  }
  if (Array.isArray(reviewedPhotos)) home.photoReview = reviewedPhotos;
  else if (fresh || moved) delete home.photoReview;
  home.demoScenario = '';
  return home;
}
