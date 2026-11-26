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
    unknown:'Coverage unknown',unavailable:'Coverage unavailable',
    ambiguous:'Property-history match ambiguous; exact-address records shown'}[evidence.completeness] || 'Coverage unknown';
  const parts=[label,`${evidence.permits?.length || 0} permit${evidence.permits?.length === 1 ? '' : 's'}`];
  if (evidence.pagesChecked) parts.push(`${evidence.pagesChecked} page${evidence.pagesChecked === 1 ? '' : 's'} checked`);
  if (evidence.coverage?.dataThrough) parts.push(`data through ${evidence.coverage.dataThrough.slice(0,10)}`);
  if (evidence.coverage?.jurisdiction) parts.push(evidence.coverage.jurisdiction);
  if (evidence.fetchedAt) parts.push(`retrieved ${evidence.fetchedAt.slice(0,10)}${evidence.cacheHit ? ' (cached)' : ''}`);
  return `${parts.join(' · ')}.`;
}

const finalPermit = permit => permit?.status === 'FINAL' || permit?.status === 'INTERCONNECTED'
  || (Boolean(permit?.dateCompleted) && !['EXPIRED','CANCELLED','REVOKED'].includes(permit?.status));
const permitCopy = permit => `${permit?.category || ''} ${permit?.description || ''}`.toLowerCase();
const permitYear = permit => String(permit?.dateCompleted || permit?.dateIssued || permit?.dateFiled || '').slice(0,4);
const completionYear = permit => String(permit?.dateCompleted || '').slice(0,4);
const permitLabel = permit => permit?.permitNumber || permit?.id || 'permit';
const installVerb=/\b(?:install(?:ation|ed|ing)?|replac(?:e|ed|ement|ing)|upgrade(?:d|s|ing)?|new|add(?:ed|ing)?|interconnect(?:ed|ion)?)\b/;
const ambiguousVerb=/\b(?:remove|removal|relocat(?:e|ed|ion|ing)|mov(?:e|ed|ing)|repair(?:ed|s|ing)?|service(?:d|s|ing)?|maintenance|inspect(?:ed|ion)?|disconnect(?:ed|ion)?|tak(?:e|ing) down)\b/;
const permitClauses = permit => String(permit?.description || '').toLowerCase().split(/[.;\n]+/).map(value=>value.trim()).filter(Boolean);
const equipmentClause = (permit,equipment) => permitClauses(permit).find(clause=>equipment.test(clause)) || '';
const installationActionFor = item => Boolean(item.clause && installVerb.test(item.clause) && !ambiguousVerb.test(item.clause));

function candidatesForPermit(permit) {
  const copy=permitCopy(permit), year=completionYear(permit), candidates=[];
  const add=(field,value,label,equipment,clause)=>candidates.push({field,value,label,permit,equipment,clause});
  const solar=/\b(?:solar|photovoltaic|pv)\b/, heatPump=/\b(?:heat[ -]?pumps?|mini[ -]?splits?)\b/;
  const furnace=/\b(?:gas furnace|natural gas furnace)\b/, boiler=/\bboilers?\b/, waterHeater=/\bwater heater\b/;
  const battery=/\b(?:battery|energy storage)\b/, roof=/\broofs?|shingles?\b/;
  const solarClause=equipmentClause(permit,solar), heatPumpClause=equipmentClause(permit,heatPump);
  const furnaceClause=equipmentClause(permit,furnace), boilerClause=equipmentClause(permit,boiler);
  const waterHeaterClause=equipmentClause(permit,waterHeater), batteryClause=equipmentClause(permit,battery), roofClause=equipmentClause(permit,roof);
  if (solar.test(copy)) add('solar',/\bbatter(?:y|ies)\b|energy storage/.test(solarClause) ? 'Solar PV + Battery' : 'Solar PV','Solar / battery',solar,solarClause);
  if (/\b(?:heat[ -]?pumps?|mini[ -]?splits?)\b/.test(copy)) {
    add('hvac','Heat Pump (Electric)','Heating / cooling',heatPump,heatPumpClause);
    if (/^\d{4}$/.test(year)) add('hvacAge',`Installed ${year} (permit)`,'HVAC age',heatPump,heatPumpClause);
  }
  if (/\b(?:gas furnace|natural gas furnace)\b/.test(copy)) {
    add('hvac','Gas Furnace','Heating / cooling',furnace,furnaceClause);
    if (/^\d{4}$/.test(year)) add('hvacAge',`Installed ${year} (permit)`,'HVAC age',furnace,furnaceClause);
  }
  if (/\bboilers?\b/.test(copy)) {
    add('hvac',/\bcondensing\b/.test(boilerClause) ? 'Condensing Boiler (AFUE 90%+)' : 'Boiler','Heating / cooling',boiler,boilerClause);
    if (/^\d{4}$/.test(year)) add('hvacAge',`Installed ${year} (permit)`,'HVAC age',boiler,boilerClause);
  }
  if (/\bwater heater\b/.test(copy)) {
    const value=/heat[ -]?pump/.test(waterHeaterClause) ? 'Heat Pump Water Heater' : /tankless.*gas|gas.*tankless/.test(waterHeaterClause) ? 'Tankless Gas' : /electric/.test(waterHeaterClause) ? 'Tank Electric' : /gas/.test(waterHeaterClause) ? 'Tank Gas' : null;
    if (value) add('waterHeater',value,'Water heating',waterHeater,waterHeaterClause);
    if (value && /^\d{4}$/.test(year)) add('waterHeaterAge',`Installed ${year} (permit)`,'Water-heater age',waterHeater,waterHeaterClause);
  }
  if (battery.test(copy)) add('backup','Battery Backup','Backup power',battery,batteryClause);
  if (/\b(?:roof replacement|replace(?:ment|d)?[^.]{0,30}roof|new roof)\b/.test(copy)) {
    const material=/\bmetal\b/.test(roofClause) ? 'Metal' : /\b(?:asphalt|shingle)\b/.test(roofClause) ? 'Asphalt shingles' : /\b(?:clay|concrete) tile\b/.test(roofClause) ? 'Tile Roof' : null;
    if (material) add('roof',material,'Roof material',roof,roofClause);
    if (/^\d{4}$/.test(year)) add('roofAge',`Installed ${year} (permit)`,'Roof age',roof,roofClause);
  }
  return candidates;
}

const discoveryFields = new Set(['hvac','solar','waterHeater','backup','roof']);

function permitQuantity(candidate) {
  const clause=String(candidate.clause || '');
  if (!clause) return null;
  const patterns={
    hvac:/\b(\d{1,3})\s+(?:(?:[a-z0-9-]+)\s+){0,3}(?:heat[ -]?pumps?|mini[ -]?splits?|furnaces?|boilers?)\b/i,
    solar:/\b(\d{1,4})\s+(?:roof[ -]?mounted\s+)?(?:solar\s+)?panels?\b/i,
    waterHeater:/\b(\d{1,3})\s+(?:(?:[a-z0-9-]+)\s+){0,2}water heaters?\b/i,
    backup:/\b(\d{1,3})\s+(?:(?:[a-z0-9-]+)\s+){0,2}(?:batter(?:y|ies)|energy storage units?)\b/i,
  };
  const pattern=patterns[candidate.field];
  if (!pattern) return null;
  if (/\breplac(?:e|ed|ement|ing)\b/i.test(clause)) {
    const equipmentNames={
      hvac:'(?:heat[ -]?pumps?|mini[ -]?splits?|furnaces?|boilers?)',
      solar:'(?:solar\\s+)?panels?',
      waterHeater:'water heaters?',
      backup:'(?:batter(?:y|ies)|energy storage units?)',
    };
    const sameEquipmentResult=clause.match(new RegExp(`\\bwith\\s+(\\d{1,4})\\s+(?:(?:[a-z0-9-]+)\\s+){0,3}${equipmentNames[candidate.field]}\\b`,'i'));
    if (sameEquipmentResult) return Number(sameEquipmentResult[1]);
    const brandedResult=clause.match(/\bwith\s+(\d{1,4})\s+(?!amps?\b|circuits?\b|outlets?\b|switches?\b|panels?\b|service\b|new\b)[a-z][a-z0-9-]*\s*(?:[.;]|$)/i);
    if (brandedResult) return Number(brandedResult[1]);
    const counts=[...clause.matchAll(new RegExp(pattern.source,'gi'))];
    if (counts.length >= 1) return null;
  }
  const match=pattern.exec(clause);
  return match ? Number(match[1]) : null;
}

/** Reviewable equipment facts interpreted from permit descriptions. */
export function permitDiscoveriesFromEvidence(evidence) {
  if (!object(evidence) || !Array.isArray(evidence.permits)) return [];
  const discoveries=[];
  for (const permit of evidence.permits) {
    const seen=new Set();
    for (const candidate of candidatesForPermit(permit)) {
      if (!discoveryFields.has(candidate.field)) continue;
      const key=`${candidate.field}|${candidate.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const verified=finalPermit(permit) && installationActionFor(candidate);
      discoveries.push({
        field:candidate.field,value:candidate.value,label:candidate.label,
        quantity:permitQuantity(candidate),year:/^\d{4}$/.test(completionYear(permit)) ? completionYear(permit) : null,
        evidenceStatus:verified ? 'verified' : 'review',completed:verified,
        permitStatus:permit.status || 'UNKNOWN',permitNumber:permitLabel(permit),
      });
    }
  }
  return discoveries;
}

/**
 * Convert narrowly stated, completed permit work into source-labelled form facts.
 * Issued-only work and conflicting completed records remain confirmation prompts.
 */
export function permitFactsFromEvidence(evidence) {
  if (!object(evidence) || !Array.isArray(evidence.permits)) return {patch:{},provenance:{},confirmations:[]};
  const completed=[], pending=[];
  for (const permit of evidence.permits) {
    const candidates=candidatesForPermit(permit);
    const installed=[], review=[];
    for (const candidate of candidates) (finalPermit(permit) && installationActionFor(candidate) ? installed : review).push(candidate);
    const installedHvac=installed.filter(item=>item.field === 'hvac');
    if (installedHvac.some(item=>item.value === 'Heat Pump (Electric)') && installedHvac.some(item=>/Boiler/.test(item.value))) {
      const first=installedHvac[0];
      completed.push(...installed.filter(item=>item.field !== 'hvac'),{...first,value:'Heat Pump (Electric) + Boiler'});
    } else completed.push(...installed);
    pending.push(...review);
  }
  const patch={}, provenance={}, confirmations=[];
  const fields=new Set(completed.map(item=>item.field));
  for (const field of fields) {
    const rows=completed.filter(item=>item.field === field);
    const values=[...new Set(rows.map(item=>item.value))];
    if (values.length !== 1) {
      for (const item of rows) confirmations.push({field:item.field,value:item.value,
        summary:item.permit.description || `${item.label}: ${item.value}`,
        reason:'Conflicting completed permits need homeowner confirmation.',permitNumber:permitLabel(item.permit)});
      continue;
    }
    const selected=[...rows].sort((a,b)=>String(b.permit.dateCompleted || b.permit.dateIssued || '').localeCompare(String(a.permit.dateCompleted || a.permit.dateIssued || '')))[0];
    patch[field]=selected.value;
    provenance[field]={origin:'imported',source:`Permit records: ${selected.permit.status} ${permitLabel(selected.permit)}`,date:selected.permit.dateCompleted || selected.permit.dateIssued || evidence.fetchedAt};
  }
  const pendingPermits=new Map();
  for (const item of pending) {
    if (patch[item.field] === item.value) continue;
    const key=permitLabel(item.permit);
    if (!pendingPermits.has(key)) pendingPermits.set(key,item);
  }
  for (const item of pendingPermits.values()) {
    confirmations.push({field:item.field,value:item.value,summary:item.permit.description || `${item.label}: ${item.value}`,
      reason:`${String(item.permit.status || 'Permit').replaceAll('_',' ')} permit; confirm the work was completed and remains installed.`,permitNumber:permitLabel(item.permit)});
  }
  return {patch,provenance,confirmations};
}

function applyPermitFacts(home, evidence) {
  const facts=permitFactsFromEvidence(evidence), next={...home,permitEvidence:evidence,provenance:{...home.provenance}};
  const rejected=new Set(), dependencies={hvacAge:'hvac',waterHeaterAge:'waterHeater'};
  for (const [field,value] of Object.entries(facts.patch)) {
    if (dependencies[field] && rejected.has(dependencies[field])) continue;
    const origin=next.provenance?.[field]?.origin;
    if (origin && origin !== 'unknown' && !String(next.provenance[field].source || '').startsWith('Permit records:')) {
      rejected.add(field);
      continue;
    }
    next[field]=value;
    next.provenance[field]=facts.provenance[field];
  }
  return next;
}

export function appliedPermitFacts(home, evidence) {
  const facts=permitFactsFromEvidence(evidence), applied={};
  for (const [field,value] of Object.entries(facts.patch)) {
    const provenance=home?.provenance?.[field];
    if (home?.[field] === value && provenance?.origin === 'imported'
        && String(provenance.source || '').startsWith('Permit records:')) applied[field]=value;
  }
  return applied;
}

export function confirmedPermitNumbers(home) {
  const raw=home?.extraInputs?.permitConfirmations;
  if (Array.isArray(raw)) return new Set(raw.filter(value=>typeof value === 'string').slice(-100));
  if (typeof raw !== 'string' || raw.length > 500) return new Set();
  try {
    const values=JSON.parse(raw);
    return new Set(Array.isArray(values) ? values.filter(value=>typeof value === 'string').slice(-100) : []);
  } catch { return new Set(); }
}

export function confirmPermitWork(home, permitNumber) {
  const evidence=permitEvidenceForHome(home);
  const permit=evidence?.permits.find(row=>permitLabel(row) === permitNumber);
  if (!permit) return home;
  const candidates=candidatesForPermit(permit);
  if (!candidates.length) return home;
  const next={...home,provenance:{...home.provenance},extraInputs:{...home.extraInputs}};
  const copy=permitCopy(permit), year=completionYear(permit);
  const rejected=new Set(), dependencies={hvacAge:'hvac',waterHeaterAge:'waterHeater'};
  for (const candidate of candidates) {
    if (dependencies[candidate.field] && rejected.has(dependencies[candidate.field])) continue;
    let value=candidate.value;
    const current=String(next[candidate.field] || '');
    const origin=next.provenance?.[candidate.field]?.origin;
    const stronger=origin && origin !== 'unknown' && !String(next.provenance[candidate.field]?.source || '').startsWith('Permit records:');
    if (candidate.field === 'hvac') {
      const currentHeatPump=/heat pump/i.test(current), currentBoiler=/boiler/i.test(current);
      const permitHeatPump=/heat[ -]?pumps?/i.test(copy), permitBoiler=/boilers?/i.test(copy);
      if ((currentHeatPump && permitBoiler) || (currentBoiler && permitHeatPump)) value='Heat Pump (Electric) + Boiler';
      else if (stronger && current && current.toLowerCase() !== value.toLowerCase()) {
        rejected.add(candidate.field);
        continue;
      }
    }
    if (candidate.field === 'hvacAge' && /heat pump/i.test(String(next.hvac || '')) && /boilers?/i.test(copy) && /^\d{4}$/.test(year)) {
      const existingYear=String(next.hvacAge || '').match(/(?:19|20)\d{2}/)?.[0];
      value=`Heat pumps: ${existingYear || 'year unknown'}; boiler: ${year} (permit + homeowner confirmation)`;
    }
    if (candidate.field === 'solar' && /solar pv \+ battery/i.test(current) && value === 'Solar PV') continue;
    if (!['hvac','hvacAge','solar'].includes(candidate.field) && stronger && current && current.toLowerCase() !== value.toLowerCase()) {
      rejected.add(candidate.field);
      continue;
    }
    if (stronger && current.toLowerCase() === value.toLowerCase()) continue;
    next[candidate.field]=value;
    next.provenance[candidate.field]={origin:'user-confirmed',source:`Homeowner confirmation of permit ${permitLabel(permit)}`,date:new Date().toISOString()};
  }
  if (/boilers?/i.test(copy) && /heat pump/i.test(String(next.hvac || '')) && !/^\d{4}$/.test(year)) {
    const existingYear=String(next.hvacAge || '').match(/(?:19|20)\d{2}/)?.[0];
    next.hvacAge=`Heat pumps: ${existingYear || 'year unknown'}; boiler: year unknown (completion date unavailable)`;
    next.provenance.hvacAge={origin:'user-confirmed',source:`Homeowner confirmation of permit ${permitLabel(permit)}`,date:new Date().toISOString()};
  }
  const confirmed=confirmedPermitNumbers(next);
  confirmed.add(permitLabel(permit));
  next.extraInputs.permitConfirmations=JSON.stringify([...confirmed].slice(-100));
  return next;
}

export function attachPermitEvidence(current, requestedHome, evidence) {
  if (!permitRequest(current) || !sameProperty(current,requestedHome)
      || text(current.city,100).toLowerCase() !== text(requestedHome.city,100).toLowerCase()) return current;
  const clean=permitEvidenceForHome({...current,permitEvidence:evidence});
  return clean ? applyPermitFacts(current,clean) : current;
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
  const clean=permitEvidenceForHome({...archived,permitEvidence:evidence});
  return clean ? applyPermitFacts(archived,clean) : archived;
}
