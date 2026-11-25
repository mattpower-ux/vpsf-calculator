import { isPresentationAddress } from './presentationHome.js';

const suffixes = {aly:'alley',ave:'avenue',av:'avenue',blvd:'boulevard',cir:'circle',ct:'court',dr:'drive',hwy:'highway',ln:'lane',pkwy:'parkway',pl:'place',rd:'road',sq:'square',st:'street',ter:'terrace',trl:'trail'};
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const statuses = new Set(['FILED','ISSUED','IN_PROGRESS','FINAL','EXPIRED','CANCELLED','REVOKED','UNKNOWN','INTERCONNECTED']);
const lookupModes = new Set(['search','address-history','parcel-history']);
const completenessValues = new Set(['complete','partial','unknown','unavailable','ambiguous']);
const stopReasons = new Set(['exhausted','page-budget','record-budget','provider-window','ambiguous','fallback','unknown']);
const text = (value, max = 300) => typeof value === 'string' && value.length <= max && !/(?:data:|blob:)/i.test(value) ? value.trim() : '';
const street = value => text(value,200).toLowerCase().replace(/[^\w\s#-]/g,' ').split(/\s+/).filter(Boolean).map(word=>suffixes[word] || word).join(' ');
const parcel = value => {
  const clean=text(value,100);
  return clean && /^[A-Za-z0-9 ./-]+$/.test(clean) ? clean : '';
};

export function permitRequest(home) {
  if (!object(home) || home.demoScenario || isPresentationAddress(home.address)) return null;
  const address=text(home.address,200), state=text(home.state,2).toUpperCase(), zip=text(home.zip,10);
  if (address.includes(',') || /[\x00-\x1f]/.test(address) || !/^\d+\S*\s+\S/.test(address)
      || !/^[A-Z]{2}$/.test(state) || !/^\d{5}(?:-\d{4})?$/.test(zip)) return null;
  const parcelId=parcel(home.parcelId);
  return {address,state,zip:zip.slice(0,5),city:text(home.city,100),...(parcelId ? {parcel:parcelId} : {})};
}

const sameProperty = (left,right) => street(left?.address) && street(left?.address) === street(right?.address)
  && text(left?.state,2).toUpperCase() === text(right?.state,2).toUpperCase()
  && text(left?.zip,10).slice(0,5) === text(right?.zip,10).slice(0,5)
  && (!parcel(right?.parcelId || right?.parcel) || parcel(left?.parcelId || left?.parcel) === parcel(right?.parcelId || right?.parcel));

/** Permit evidence is address-bound metadata, never installed-feature evidence. */
export function permitEvidenceForHome(home) {
  const request=permitRequest(home), evidence=home?.permitEvidence;
  if (!request || !object(evidence) || !sameProperty(request,evidence)
      || !['matched','no_exact_match'].includes(evidence.status)
      || !Array.isArray(evidence.permits) || evidence.permits.length > 500
      || !text(evidence.fetchedAt,40) || !/(Z|[+-]\d{2}:\d{2})$/.test(evidence.fetchedAt)
      || !Number.isFinite(Date.parse(evidence.fetchedAt))) return null;
  const permits=[];
  for (const row of evidence.permits) {
    if (!object(row) || !sameProperty(request,row) || !text(row.id,36) || !statuses.has(row.status)) return null;
    permits.push({...Object.fromEntries(Object.entries({id:36,permitNumber:300,status:40,category:300,description:2000,
      jurisdiction:300,address:200,city:100,dateFiled:10,dateIssued:10,dateCompleted:10})
      .map(([key,max])=>[key,text(row[key],max) || null])),state:request.state,zip:request.zip});
  }
  if ((evidence.status === 'matched') !== Boolean(permits.length)) return null;
  const coverage=object(evidence.coverage) ? evidence.coverage : {};
  const lookupMode=evidence.lookupMode ?? 'search';
  const matchedBy=evidence.matchedBy ?? 'address';
  const completeness=evidence.completeness ?? 'unknown';
  const pagesChecked=evidence.pagesChecked ?? 1;
  const recordsChecked=evidence.recordsChecked ?? evidence.searchedRecords ?? permits.length;
  const stopReason=evidence.stopReason ?? 'unknown';
  const searchedRecords=evidence.searchedRecords ?? permits.length;
  const captureRatio=coverage.captureRatio ?? null;
  if (!lookupModes.has(lookupMode) || !['address','parcel'].includes(matchedBy)
      || !completenessValues.has(completeness) || !stopReasons.has(stopReason)
      || !Number.isInteger(pagesChecked) || pagesChecked < 0 || pagesChecked > 10
      || !Number.isInteger(recordsChecked) || recordsChecked < 0 || recordsChecked > 500
      || !Number.isInteger(searchedRecords) || searchedRecords < 0 || searchedRecords > 500
      || (captureRatio !== null && (!Number.isFinite(captureRatio) || captureRatio < 0 || captureRatio > 1))) return null;
  return {status:evidence.status,source:'PermitStack',sourceUrl:'https://api.permit-stack.com/public-openapi.json',
    address:text(evidence.address,200),state:request.state,zip:request.zip,fetchedAt:evidence.fetchedAt,
    lookupMode,parcelId:parcel(evidence.parcelId),matchedBy,completeness,pagesChecked,recordsChecked,stopReason,
    cacheHit:evidence.cacheHit === true,searchTruncated:evidence.searchTruncated === true,
    searchedRecords,
    permits,coverage:{confidence:text(coverage.confidence,80) || null,covered:typeof coverage.covered === 'boolean' ? coverage.covered : null,
      dataThrough:text(coverage.dataThrough,40) || null,tierWindowClamped:coverage.tierWindowClamped === true,
      tierWindowFrom:text(coverage.tierWindowFrom,40) || null,jurisdiction:text(coverage.jurisdiction,300) || null,
      dataStatus:text(coverage.dataStatus,80) || null,freshness:text(coverage.freshness,80) || null,
      captureRatio,captureCheckedAt:text(coverage.captureCheckedAt,40) || null,
      captureNote:text(coverage.captureNote,500) || null},
    sourceNote:text(evidence.sourceNote,1000)};
}

export function permitCoverageSummary(evidence) {
  if (!object(evidence)) return '';
  const label={complete:'Complete available history',partial:'Partial available history',
    unknown:'Coverage unknown',unavailable:'Coverage unavailable',ambiguous:'Partial available history'}[evidence.completeness] || 'Coverage unknown';
  const parts=[label,`${evidence.permits?.length || 0} permit${evidence.permits?.length === 1 ? '' : 's'}`];
  if (evidence.pagesChecked) parts.push(`${evidence.pagesChecked} page${evidence.pagesChecked === 1 ? '' : 's'} checked`);
  if (evidence.coverage?.dataThrough) parts.push(`data through ${evidence.coverage.dataThrough.slice(0,10)}`);
  if (evidence.coverage?.jurisdiction) parts.push(evidence.coverage.jurisdiction);
  if (evidence.fetchedAt) parts.push(`retrieved ${evidence.fetchedAt.slice(0,10)}${evidence.cacheHit ? ' (cached)' : ''}`);
  return `${parts.join(' · ')}.`;
}

export function attachPermitEvidence(current, requestedHome, evidence) {
  if (!permitRequest(current) || !sameProperty(current,requestedHome)
      || text(current.city,100).toLowerCase() !== text(requestedHome.city,100).toLowerCase()) return current;
  const clean=permitEvidenceForHome({...current,permitEvidence:evidence});
  return clean ? {...current,permitEvidence:clean} : current;
}

export async function fetchPermitEvidence(home, lookup) {
  const query=permitRequest(home);
  if (!query) return null;
  try { return permitEvidenceForHome({...home,permitEvidence:await lookup(query)}); }
  catch { return null; } // Optional permit service must not block home analysis.
}

/** One debounced lookup; cleanup also invalidates an already-running response. */
export function schedulePermitLookup(home, lookup, setHome, {schedule=setTimeout,unschedule=clearTimeout,delay=600} = {}) {
  let active=true;
  if (!permitRequest(home)) return () => { active=false; };
  const timer=schedule(async () => {
    if (!active) return;
    const evidence=await fetchPermitEvidence(home,lookup);
    if (active && evidence) setHome(current => active ? attachPermitEvidence(current,home,evidence) : current);
  },delay);
  return () => { active=false; unschedule(timer); };
}

/** Archive I/O may finish after a cached permit response or an identity edit. */
export function mergeArchivedPermitEvidence(current, archived, requestedHome) {
  const identity = home => JSON.stringify(['address','city','state','zip','parcelId','demoScenario'].map(key=>
    key === 'address' ? street(home?.[key]) : text(home?.[key],100).toLowerCase()));
  if (identity(current) !== identity(requestedHome)) return current;
  const evidence=permitEvidenceForHome(current);
  if (!evidence) return archived;
  return {...archived,permitEvidence:permitEvidenceForHome({...archived,permitEvidence:evidence})};
}
