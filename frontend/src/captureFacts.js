import { confirmedEdit } from './homeAdvice.js';
import { heatingSelectionPatch } from './heatingResilience.js';

export function applyCapturedFacts(current, facts, fresh = false, photoReview) {
  let home = fresh ? Object.fromEntries(Object.entries(current).map(([key, value]) => [key, typeof value === 'string' ? 'Unknown' : null])) : { ...current };
  if (fresh) {
    for (const key of ['address', 'city', 'state', 'zip', 'squareFeet', 'yearBuilt', 'bedrooms', 'bathrooms', 'lotSize', 'climateZone']) home[key] = '';
    home.provenance = {}; home.extraInputs = {}; home.photoObservations = {};
    home.homeType = 'Single Family Detached'; home.occupancy = 'Owner Occupied'; home.stories = '1';
  }
  const moved = facts.address && facts.address !== current.address;
  if (moved || fresh) {
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
