import { confirmedEdit } from './homeAdvice.js';
import { heatingSelectionPatch } from './heatingResilience.js';
import { normalizeAnalysisLevel, prepareAnalysisHome } from './analysisLevels.js';

const addressKey = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';

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
  for (const [key, value] of Object.entries(facts)) {
    const merged = key === 'photoObservations' ? {...home.photoObservations,...value} : value;
    home = { ...confirmedEdit(home, key, merged), ...heatingSelectionPatch(home, key, merged) };
    if (Array.isArray(photoReview) && key !== 'address' && !['city','state','zip'].includes(key)) {
      home.provenance[key] = {origin:'inferred',source:'Home Walk photos',date:new Date().toISOString()};
    }
  }
  if (Array.isArray(photoReview)) home.photoReview = photoReview;
  else if (fresh || moved) delete home.photoReview;
  home.demoScenario = '';
  return home;
}
