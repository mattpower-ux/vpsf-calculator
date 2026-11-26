export const MAX_PHOTOS = 12;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const STEPS = [
  ['kitchen', 'Kitchen appliances', 'Capture appliance fronts and readable model labels. Visible details are saved as review notes; efficiency requires readable labels.'],
  ['roof', 'Exterior roof', 'From the ground, capture roof covering and any solar panels. Never climb onto the roof.'],
  ['siding', 'Exterior siding', 'Capture a wall and a close-up of the siding. A product label helps distinguish lookalike materials.'],
  ['landscaping', 'Exterior landscaping', 'Capture planting beds and visible irrigation or rainwater equipment.'],
  ['bath', 'Bath fixtures', 'Capture fixtures and readable product labels. Include water-heating or leak equipment if safely accessible.'],
  ['hvac', 'HVAC equipment', 'Capture equipment and its readable nameplate. Do not remove covers or touch wiring.'],
  ['flooring', 'Flooring', 'Capture the floor surface. Include installation records for age. Appearance cannot verify age or VOCs.'],
  ['windows', 'Windows', 'Capture windows and readable labels. Glazing performance needs a readable product label or record, not appearance.'],
];
export const OPTIONS = {
  hvac: ['Heat Pump (Electric)', 'Heat Pump (Electric) + Boiler', 'Geothermal', 'Gas Furnace', 'Electric Resistance', 'Boiler', 'Combination Boiler', 'Hydronic Heating'],
  waterHeater: ['Heat Pump Water Heater', 'Tank Electric', 'Tank Gas', 'Tankless Gas', 'Solar Thermal', 'Combination Boiler'],
  roof: ['Architectural Shingle', 'Metal Roof', 'Tile Roof'],
  siding: ['Wood clapboard', 'Wood siding', 'Cedar shingles', 'Engineered wood', 'Vinyl', 'Fiber cement', 'Brick', 'Stucco', 'Metal', 'Other'],
  solar: ['Solar PV', 'Solar PV + Battery'],
  leak: ['Leak Detection + Auto Shutoff', 'Leak Detection Only'],
  reuse: ['Rainwater Harvesting', 'Greywater'],
  landscape: ['Drought-Tolerant Landscaping', 'Standard Landscaping', 'High-Water Landscaping'],
};
export const TEXT_FIELDS = new Set(["kitchenAppliances", "faucetBrandModel", "faucetRatedFlow", "toiletBrandModel", "toiletRatedFlush", "lightingRatedPower", "thermostatBrandModel", "windowGlazing", "soffitEmberResistance"]);
const CORE_FIELDS = new Set([...Object.keys(OPTIONS), 'hvacAge', 'roofAge']);
for (const field of ["hvacAge", "roofAge", "sidingAge", "flooringAge"]) OPTIONS[field] = Array.from({length: 151}, (_, age) => String(age));
for (const field of TEXT_FIELDS) OPTIONS[field] = [];
Object.assign(OPTIONS, {"paintCondition": ["Peeling or flaking paint visible", "Cracking or blistering paint visible", "Staining visible on painted surface", "Painted surface visible; condition unclear"], "landscapingFuelHazards": ["Vegetation touches siding", "Combustible debris visible near building", "Wood mulch visible against building", "Dense vegetation visible near building", "Landscaping visible; fuel hazards unclear"], "soffitCondition": ["Open gaps visible", "Screened vent visible; rating unverified", "Solid soffit visible; rating unverified"], "flooringType": ["Wood-like flooring visible", "Tile flooring visible", "Carpet visible", "Resilient flooring visible", "Floor surface visible; material unclear"], "lightingType": ["LED (label verified)", "Incandescent (label verified)", "Fluorescent tube visible", "Lighting fixture visible; lamp type unverified"], "thermostatControls": ["Programmable (documented)", "Smart (documented)"], "windowCondition": ["Condensation visible", "Cracked glass visible", "Window visible; glazing performance unverified"]});
export const FIELD_META = Object.fromEntries(Object.keys(OPTIONS).map(field => [field, {
  target: CORE_FIELDS.has(field) ? field : 'photoObservations',
  input: TEXT_FIELDS.has(field) ? 'text' : 'select', maxLength: 300,
}]));
export function validWalkValue(field, value) {
  if (!Object.hasOwn(OPTIONS, field) || typeof value !== 'string' || !value.trim() || value.length > 300 || /[\x00-\x1f\x7f]/.test(value) || ['unknown', 'n/a', 'none', 'not visible', 'unverified'].includes(value.trim().toLowerCase())) return false;
  if (!TEXT_FIELDS.has(field)) return OPTIONS[field].includes(value);
  if (field === 'faucetRatedFlow') return /\b\d+(?:\.\d+)?\s*(?:gpm|l\/min|lit(?:er|re)s? per minute)\b/i.test(value);
  if (field === 'toiletRatedFlush') return /\b\d+(?:\.\d+)?\s*(?:gpf|lpf|lit(?:er|re)s? per flush)\b/i.test(value);
  if (field === 'lightingRatedPower') return /\b\d+(?:\.\d+)?\s*(?:w|watts?)\b/i.test(value);
  return true;
}
export function confirmedFacts(rows) {
  const facts = {}, observations = {};
  for (const row of rows) {
    if (!row || row.confirmed !== true || !validWalkValue(row.field, row.value)) continue;
    if (CORE_FIELDS.has(row.field)) facts[row.field] = row.value;
    else observations[row.field] = row.value;
  }
  if (Object.keys(observations).length) facts.photoObservations = observations;
  return facts;
}
export function validateVideo(file) {
  if (!file.size || file.size > 100 * 1024 * 1024) throw new Error('Choose a video no larger than 100 MB.');
  if (!['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'].includes(file.type)) throw new Error('Unsupported video. Try MP4 or WebM, or upload photos.');
}
export function frameTimes(duration, count = 6) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60) throw new Error('Video must be 60 seconds or shorter.');
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('Choose space for 1–6 video frames.');
  return Array.from({ length: count }, (_, i) => count === 1 ? duration / 2 : (duration * 0.01) + (duration * 0.98 * i / (count - 1)));
}
function mediaEvent(media, event, start, signal) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      media.removeEventListener(event, done);
      media.removeEventListener('error', failed);
      signal?.removeEventListener('abort', aborted);
      error ? reject(error) : resolve();
    };
    const done = () => finish();
    const failed = () => finish(new Error('This browser cannot decode the video. Try MP4 or upload photos.'));
    const aborted = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Video decoding timed out. Try a shorter clip or photos.')), 15000);
    media.addEventListener(event, done, { once: true });
    media.addEventListener('error', failed, { once: true });
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) aborted(); else start();
  });
}
export async function extractVideoFrames(file, count = 6, signal) {
  validateVideo(file);
  const video = document.createElement('video');
  if (!video.canPlayType(file.type)) throw new Error('Video format is unsupported in this browser. Upload photos or an MP4 video.');
  const url = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    await mediaEvent(video, 'loadeddata', () => { video.src = url; video.load(); }, signal);
    const times = frameTimes(video.duration, count);
    if (!video.videoWidth || !video.videoHeight) throw new Error('Video has no readable image track.');
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Video frame extraction is unavailable. Upload photos instead.');
    const frames = [];
    for (const time of times) {
      await mediaEvent(video, 'seeked', () => { video.currentTime = time; }, signal);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('Could not create a bounded video frame. Upload photos instead.');
      frames.push(new File([blob], `frame-${time.toFixed(1)}s.jpg`, { type: 'image/jpeg' }));
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
export async function analyzeWalkImages(images, topic, signal) {
  const body = new FormData();
  body.append('topic', topic);
  const assets=[];
  images.forEach(item => {
    if (item.asset?.id && item.asset.capability) assets.push({id:item.asset.id, capability:item.asset.capability});
    else if (item.candidateId) body.append('candidate_ids', item.candidateId);
    else if (item.file) body.append('images', item.file);
  });
  if (assets.length) body.append('asset_capabilities', JSON.stringify(assets));
  const base = import.meta.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname.endsWith('.onrender.com') ? 'https://vpsf-api.onrender.com' : 'http://localhost:8000');
  const response = await fetch(`${base.replace(/\/$/, '')}/api/home-walk/analyze`, { method: 'POST', body, signal });
  let data;
  try { data = await response.json(); } catch { throw new Error('Home Walk service returned an unreadable response.'); }
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Home Walk analysis failed. Please try again.');
  if (!Array.isArray(data.suggestions)) throw new Error('Home Walk returned invalid suggestions.');
  return data.suggestions.filter(row => row && validWalkValue(row.field, row.value) && typeof row.evidence === 'string' && typeof row.uncertainty === 'string' && Array.isArray(row.image_indices) && row.image_indices.length && row.image_indices.every(i => Number.isInteger(i) && i >= 1 && i <= images.length));
}

export function imageBatches(images) {
  const batches = [];
  let batch = [], bytes = 0;
  for (const image of images) {
    const size=image.file?.size || 0;
    if (batch.length === 6 || bytes + size > 23 * 1024 * 1024) {
      batches.push(batch); batch = []; bytes = 0;
    }
    batch.push(image); bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export const FIELD_LABELS = {
  hvac: 'HVAC type', hvacAge: 'HVAC age (documented years)',
  waterHeater: 'Water heater type', roof: 'Roofing type', roofAge: 'Roof age (documented years)',
  siding: 'Siding type', sidingAge: 'Siding age (documented years)', solar: 'Solar equipment',
  leak: 'Leak detection', reuse: 'Water reuse', landscape: 'Landscaping',
  kitchenAppliances: 'Kitchen appliance observations', paintCondition: 'Visible paint condition',
  landscapingFuelHazards: 'Visible landscaping fuel hazards', soffitCondition: 'Visible soffit condition',
  soffitEmberResistance: 'Documented soffit ember resistance', flooringType: 'Visible flooring type',
  flooringAge: 'Flooring age (documented years)', faucetBrandModel: 'Faucet brand / model',
  faucetRatedFlow: 'Faucet label flow rating', toiletBrandModel: 'Toilet brand / model',
  toiletRatedFlush: 'Toilet label flush rating', lightingType: 'Lighting type',
  lightingRatedPower: 'Lighting label power rating', thermostatBrandModel: 'Thermostat brand / model',
  thermostatControls: 'Documented thermostat controls', windowGlazing: 'Documented window glazing',
  windowCondition: 'Visible window condition',
};
