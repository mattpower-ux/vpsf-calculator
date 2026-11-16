/** Browser-local completed evaluations. Never normalize or re-score raw facts. */
export const EVALUATION_ARCHIVE_KEY = 'vpsf.evaluationArchive.v1';
export const MAX_EVALUATIONS = 50;
export const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024;
const MAX_DEPTH = 16;
const MAX_NODES = 100000;
const PILLARS = ['energy','water','health','resilience','carbon','financial','community'];
const UNSAFE_KEYS = new Set(['__proto__','prototype','constructor','toJSON']);
const MEDIA_KEYS = new Set(['image','images','photo','photos','video','videos','audio','file','files',
  'blob','blobs','media','originalmedia','originalfile','originaldocument','imagedata','photodata',
  'filedata','filebytes','documentbytes','rawbytes','binary','base64','dataurl','attachments','uploadedfiles']);
const encoder = new TextEncoder();
const bytes = value => encoder.encode(value).length;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plain = value => object(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));

/** Detach safe JSON values. Media is omitted, but unsafe complexity/numbers fail
 * instead of silently altering potentially meaningful scoring facts. */
function snapshot(home, result) {
  let nodes = 0, size = 0;
  const ancestors = new WeakSet();
  const charge = text => {
    size += bytes(text);
    if (size > MAX_ARCHIVE_BYTES) throw Error('Evaluation snapshot is too large (2 MB maximum).');
  };
  function clone(value, depth = 0) {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw Error('Evaluation snapshot exceeds the nesting or size limit.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw Error('Evaluation snapshot contains a nonfinite number.');
      return value;
    }
    if (typeof value === 'string') {
      if (/(?:data:|blob:)/i.test(value)) return undefined;
      charge(value);
      return value;
    }
    if (!Array.isArray(value) && !plain(value)) return undefined;
    if (ancestors.has(value)) throw Error('Evaluation snapshot contains a cycle.');
    ancestors.add(value);
    let copied;
    if (Array.isArray(value)) {
      if (value.length > 10000) throw Error('Evaluation snapshot array exceeds the size limit.');
      copied = [];
      for (let index=0;index<value.length;index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value,String(index));
        if (descriptor && !('value' in descriptor)) throw Error('Evaluation snapshot cannot contain an accessor/getter.');
        copied.push(clone(descriptor?.value,depth+1) ?? null);
      }
    } else {
      copied = {};
      const keys = Object.keys(value);
      if (keys.length > 10000) throw Error('Evaluation snapshot object exceeds the size limit.');
      for (const key of keys) {
        if (UNSAFE_KEYS.has(key) || MEDIA_KEYS.has(key.replace(/[_-]/g,'').toLowerCase())) continue;
        if (key.length > 256) throw Error('Evaluation snapshot field name exceeds the size limit.');
        charge(key);
        const descriptor = Object.getOwnPropertyDescriptor(value,key);
        if (!('value' in descriptor)) throw Error('Evaluation snapshot cannot contain an accessor/getter.');
        const item = clone(descriptor.value,depth+1);
        if (item !== undefined) copied[key] = item;
      }
    }
    ancestors.delete(value);
    return copied;
  }
  const saved = clone({home,result});
  validateSnapshot(saved.home,saved.result);
  return saved;
}

function validateSnapshot(home, result) {
  if (!plain(home) || typeof home.address !== 'string' || home.address.trim().length < 8
      || home.address.length > 500 || /^(unknown|not available|not provided)$/i.test(home.address.trim())) {
    throw Error('A valid property address (8–500 characters) is required to save an evaluation.');
  }
  if (!plain(result) || !Number.isFinite(result.total) || result.total < 0 || result.total > 1000
      || !plain(result.scores) || PILLARS.some(key => !Number.isFinite(result.scores[key]) || result.scores[key] < 0 || result.scores[key] > 1000)
      || ['pending','loading','error','failed'].includes(result.status)) {
    throw Error('A completed evaluation with a valid total and all seven pillar scores is required.');
  }
  const run = result.scoreRunId;
  if (run != null && !(Number.isSafeInteger(run) && run > 0)
      && !(typeof run === 'string' && run.trim().length > 0 && run.length <= 160)) {
    throw Error('Evaluation scoreRunId is invalid.');
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Deterministic compact IDs, with exact snapshot comparison for deduplication.
// A hash collision never discards a distinct run; save adds a suffix if needed.
function snapshotId(text) {
  let a = 2166136261, b = 5381;
  for (let index=0;index<text.length;index++) {
    a = Math.imul(a ^ text.charCodeAt(index),16777619);
    b = Math.imul(b,33) ^ text.charCodeAt(index);
  }
  return `local:${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}

const serialize = evaluations => JSON.stringify({version:1,evaluations});

/** Newest-first detached records: [{id,savedAt,home,result}]. Corruption throws;
 * no read, failed save or failed removal ever clears the existing archive. */
export function loadEvaluations(storage) {
  let raw;
  try { raw = (storage ?? globalThis.localStorage).getItem(EVALUATION_ARCHIVE_KEY); }
  catch { throw Error('Evaluations could not be read. Browser storage may be blocked.'); }
  if (raw === null) return [];
  try {
    if (typeof raw !== 'string' || raw.length > MAX_ARCHIVE_BYTES || bytes(raw) > MAX_ARCHIVE_BYTES) throw Error();
    const archive = JSON.parse(raw);
    if (!plain(archive) || Object.keys(archive).sort().join(',') !== 'evaluations,version'
        || archive.version !== 1 || !Array.isArray(archive.evaluations)
        || archive.evaluations.length > MAX_EVALUATIONS) throw Error();
    const ids = new Set();
    return archive.evaluations.map(entry => {
      if (!plain(entry) || Object.keys(entry).sort().join(',') !== 'home,id,result,savedAt'
          || typeof entry.id !== 'string' || !entry.id || entry.id.length > 200 || ids.has(entry.id)
          || typeof entry.savedAt !== 'string' || !Number.isFinite(Date.parse(entry.savedAt))
          || new Date(entry.savedAt).toISOString() !== entry.savedAt) throw Error();
      const saved = snapshot(entry.home,entry.result);
      // Sanitizing persisted data would silently discard part of a corrupt run.
      if (JSON.stringify(saved) !== JSON.stringify({home:entry.home,result:entry.result})) throw Error();
      ids.add(entry.id);
      return {id:entry.id,savedAt:entry.savedAt,...saved};
    });
  } catch { throw Error('Saved evaluations are corrupt, invalid, oversized or unsupported. Existing data was not changed.'); }
}

function write(raw, storage) {
  try { (storage ?? globalThis.localStorage).setItem(EVALUATION_ARCHIVE_KEY,raw); }
  catch { throw Error('Evaluations could not be saved. Browser storage may be blocked or full; existing evaluations were not changed.'); }
}

/** Return the saved record (or its existing duplicate). localStorage.setItem is
 * atomic: build retention in memory and commit once; never remove before writing. */
export function saveEvaluation(home, result, storage) {
  const existing = loadEvaluations(storage);
  const saved = snapshot(home,result);
  const run = saved.result.scoreRunId;
  const identity = run == null ? canonical(saved) : null;
  const duplicate = existing.find(entry => run != null
    ? entry.result.scoreRunId != null && String(entry.result.scoreRunId) === String(run)
    : entry.result.scoreRunId == null && canonical({home:entry.home,result:entry.result}) === identity);
  if (duplicate) return duplicate;
  const baseId = run == null ? snapshotId(identity) : `run:${run}`;
  let id = baseId, suffix = 1;
  while (existing.some(entry=>entry.id === id)) id = `${baseId}:${suffix++}`;
  const record = {id,savedAt:new Date().toISOString(),...saved};
  let evaluations = [record,...existing].slice(0,MAX_EVALUATIONS);
  let raw = serialize(evaluations);
  while (bytes(raw) > MAX_ARCHIVE_BYTES && evaluations.length > 1) {
    evaluations = evaluations.slice(0,-1);
    raw = serialize(evaluations);
  }
  if (bytes(raw) > MAX_ARCHIVE_BYTES) throw Error('Evaluation snapshot is too large (2 MB maximum). Existing evaluations were not changed.');
  write(raw,storage);
  return record;
}

/** Return true if removed, false if absent. A failed write preserves all runs. */
export function removeEvaluation(id, storage) {
  const existing = loadEvaluations(storage);
  const remaining = existing.filter(entry=>entry.id !== id);
  if (remaining.length === existing.length) return false;
  write(serialize(remaining),storage);
  return true;
}
