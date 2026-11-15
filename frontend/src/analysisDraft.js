import { prepareAnalysisHome } from './analysisLevels.js';

export const DRAFT_KEY = 'vpsf.analysisDraft.v1';
export const MAX_DRAFT_BYTES = 64 * 1024;
const ORIGINS = new Set(['user-confirmed', 'imported', 'inferred', 'unknown', 'demo-assumption']);
const BASE_FIELDS = Object.keys(prepareAnalysisHome({}, 'moderate'));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 500) => typeof value === 'string' && value.length <= max
  && !/(?:data:|blob:)/i.test(value) ? value : '';
const scalar = value => typeof value === 'number' && Number.isFinite(value) ? value : text(value);
const size = value => new TextEncoder().encode(value).byteLength;

function geographicEvidence(value, fields) {
  if (!object(value)) return null;
  return Object.fromEntries(fields.map(key => [key, scalar(value[key])]));
}

function customInputs(value) {
  if (!object(value)) return {};
  const entries = Object.entries(value);
  if (entries.length > 64) throw new Error('A draft can contain at most 64 custom inputs.');
  return Object.fromEntries(entries.filter(([key, item]) =>
    /^[a-zA-Z0-9_-]{1,80}$/.test(key)
    && !['__proto__', 'prototype', 'constructor'].includes(key)
    && (typeof item === 'boolean'
      || (typeof item === 'number' && Number.isFinite(item))
      || (typeof item === 'string' && item.length <= 500 && !/(?:data:|blob:)/i.test(item)))
  ));
}

/** Allowlist before preparation: never clone or serialize arbitrary input objects. */
export function prepareDraftHome(input) {
  if (!object(input) || !['moderate', 'inclusive'].includes(input.analysisLevel)
      || !text(input.address).trim()) {
    throw new Error('Choose Informed or Superior and enter an address before saving a draft.');
  }
  const home = Object.fromEntries(BASE_FIELDS.map(key => [key, scalar(input[key])]));
  home.provenance = {};
  for (const key of BASE_FIELDS) {
    const item = input.provenance?.[key];
    if (object(item) && ORIGINS.has(item.origin)) {
      home.provenance[key] = { origin: item.origin, source: text(item.source, 300), date: text(item.date, 40) };
    }
  }
  home.wildfire = geographicEvidence(input.wildfire, ['source', 'sourceUrl', 'datasetVersion', 'status', 'level',
    'nationalPercentile', 'areaName', 'areaId', 'areaType', 'boundaryVintage', 'latitude', 'longitude', 'retrievedAt']);
  home.epaWalkability = geographicEvidence(input.epaWalkability, ['source', 'sourceUrl', 'status', 'value',
    'blockGroup', 'latitude', 'longitude', 'retrievedAt']);
  home.sourceNote = text(input.sourceNote, 2000);
  home.extraInputs = customInputs(input.extraInputs);
  home.photoObservations = {};
  if (object(input.photoObservations)) {
    for (const [key, value] of Object.entries(input.photoObservations).slice(0, 32)) {
      if (/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(key) && text(value, 300)) {
        Object.defineProperty(home.photoObservations, key, { value, enumerable: true });
      }
    }
  }
  const prepared = prepareAnalysisHome(home, home.analysisLevel);
  if (!prepared.address.trim()) throw new Error('A known property address is required to save this draft.');
  return prepared;
}

export function saveAnalysisDraft(home, storage) {
  const draft = { version: 1, savedAt: new Date().toISOString(), home: prepareDraftHome(home) };
  const raw = JSON.stringify(draft);
  if (size(raw) > MAX_DRAFT_BYTES) throw new Error('This draft is too large to save on this device.');
  try { (storage ?? globalThis.localStorage).setItem(DRAFT_KEY, raw); }
  catch { throw new Error('Draft could not be saved. Device storage may be blocked or full.'); }
  return draft;
}

export function loadAnalysisDraft(storage) {
  let raw;
  try { raw = (storage ?? globalThis.localStorage).getItem(DRAFT_KEY); }
  catch { throw new Error('Draft could not be read. Device storage may be blocked.'); }
  if (raw === null) return null;
  try {
    if (typeof raw !== 'string' || raw.length > MAX_DRAFT_BYTES || size(raw) > MAX_DRAFT_BYTES) throw Error();
    const draft = JSON.parse(raw);
    if (!object(draft) || draft.version !== 1 || typeof draft.savedAt !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(draft.savedAt)
        || !Number.isFinite(Date.parse(draft.savedAt))) throw Error();
    return { version: 1, savedAt: draft.savedAt, home: prepareDraftHome(draft.home) };
  } catch { throw new Error('Saved draft is invalid or unsupported. Delete it and save a new draft.'); }
}

export function deleteAnalysisDraft(storage) {
  try { (storage ?? globalThis.localStorage).removeItem(DRAFT_KEY); }
  catch { throw new Error('Draft could not be deleted. Device storage may be blocked.'); }
}
