import { wildfireAssessment } from './wildfire.js';

const LEVELS = {
  broad: {label: '1. Essentials', route: 3},
  moderate: {label: '2. Systems', route: 1},
  inclusive: {label: '3. Full Audit', route: 29}
};

/** Unknown/non-string input preserves the legacy full-form flow, Moderate. */
export function normalizeAnalysisLevel(value) {
  const level = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return Object.hasOwn(LEVELS, level) ? level : 'moderate';
}

export const analysisLevelLabel = value => LEVELS[normalizeAnalysisLevel(value)].label;
export const routeAfterLookup = value => LEVELS[normalizeAnalysisLevel(value)].route;
export const analysisLabel = value => analysisLevelLabel(value);
export const analysisRoute = routeAfterLookup;

const LOCATION_FIELDS = ['address', 'city', 'state', 'zip'];
const FACT_FIELDS = `squareFeet yearBuilt homeType stories bedrooms bathrooms garage lotSize climateZone occupancy
  hvac hvacAge heatingDistribution heatingControls hydronicSource waterHeater waterHeaterAge roof roofAge siding
  windows insulation solar hers evReady fortified flood wildfireMitigation temperatureProtection windProtection
  moisture backup healthCert ventilation materials iaq daylighting carbonStrategy carbonConcrete structure
  waterStandard leak reuse irrigation landscape pietim insurance warranty maintenance walkscore transit
  greenspace amenities bike`.split(/\s+/);
const ADDITIONAL_FIELDS = ['extraInputs', 'photoObservations', 'photoReview', 'sourceNote'];
const PUBLIC_SOURCES = /^(?:property record|public records?|rentcast|attom|county assessor|assessor|permit records?)(?:$|[\s:;/()-])/i;
// Geographic evidence is field-specific: it must not qualify private equipment.
const GEOGRAPHIC_SOURCES = /^(?:geographic risk|location risk|public geographic risk)(?:$|[\s:;/()-])/i;
const CLIMATE_SOURCES = /^(?:PNNL|IECC)(?:$|[\s:;/()-])/i;
const FLOOD_SOURCES = /^FEMA(?:$|[\s:;/()-])/i;

function usable(value) {
  return (typeof value === 'string' && value.trim() !== '' && !/^(unknown|none \/ unknown)$/i.test(value.trim()))
    || (typeof value === 'number' && Number.isFinite(value));
}

function allowed(provenance, level, isDemo, key) {
  if (!provenance) return false;
  const {origin, source} = provenance;
  if (origin === 'demo-assumption') return isDemo;
  if (level === 'broad') {
    if (origin !== 'imported' || typeof source !== 'string') return false;
    const name = source.trim();
    return PUBLIC_SOURCES.test(name)
      || (key === 'climateZone' && (CLIMATE_SOURCES.test(name) || GEOGRAPHIC_SOURCES.test(name)))
      || (key === 'flood' && (FLOOD_SOURCES.test(name) || GEOGRAPHIC_SOURCES.test(name)));
  }
  return ['imported', 'user-confirmed', 'inferred'].includes(origin);
}

function matchedWalkability(home) {
  const risk = home.epaWalkability;
  return risk?.status === 'available' && risk.source === 'EPA National Walkability Index'
    && Number.isFinite(risk.value) && risk.value >= 1 && risk.value <= 20
    && ['latitude', 'longitude'].every(key => Number.isFinite(home[key]) && Number.isFinite(risk[key]) && Math.abs(home[key] - risk[key]) <= 0.000001);
}

/**
 * Return a detached, form-ready home for the explicit level (never the saved
 * home's level). Unanswered fact fields are ''. Only retained facts keep their
 * provenance. Broad requires imported public-record provenance; Moderate and
 * Inclusive also retain homeowner-confirmed/inferred facts. Climate additionally
 * accepts imported PNNL/IECC sources; flood accepts FEMA. Both accept Geographic
 * risk, Location risk, or Public geographic risk sources. These source labels
 * are provenance supplied by the caller, not independent verification.
 * An explicit demo
 * marker permits demo-assumption facts at every level, not untagged defaults.
 *
 * Address identity may be supplied without provenance by the address entry flow;
 * explicitly unknown identity is discarded. Matched official geographic evidence
 * is retained separately. Broad omits all additional/private containers. Other
 * levels clone those containers unchanged; their contents are not reclassified.
 * Unknown top-level keys are omitted. Input must be structured-cloneable data.
 * This is a preparation boundary, not a score calculator or source verifier.
 */
export function prepareHomeForLevel(input, value) {
  const home = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const level = normalizeAnalysisLevel(value);
  const demoScenario = typeof home.demoScenario === 'string' ? home.demoScenario.trim() : '';
  const result = {analysisLevel: level, demoScenario, provenance: {}};
  for (const key of LOCATION_FIELDS) {
    const provenance = home.provenance?.[key];
    const known = !provenance || ['user-confirmed', 'imported'].includes(provenance.origin)
      || (demoScenario && provenance.origin === 'demo-assumption');
    result[key] = known && usable(home[key]) ? home[key] : '';
    if (result[key] !== '' && provenance) result.provenance[key] = structuredClone(provenance);
  }
  for (const key of FACT_FIELDS) {
    const provenance = home.provenance?.[key];
    const keep = usable(home[key]) && allowed(provenance, level, Boolean(demoScenario), key);
    result[key] = keep ? home[key] : '';
    if (keep) result.provenance[key] = structuredClone(provenance);
  }
  for (const [key, max] of [['latitude', 90], ['longitude', 180]]) {
    result[key] = Number.isFinite(home[key]) && Math.abs(home[key]) <= max ? home[key] : null;
  }
  const located = {...home, latitude: result.latitude, longitude: result.longitude};
  result.wildfire = wildfireAssessment(located) ? structuredClone(home.wildfire) : null;
  result.epaWalkability = matchedWalkability(located) ? structuredClone(home.epaWalkability) : null;
  if (level !== 'broad') {
    for (const key of ADDITIONAL_FIELDS) {
      if (home[key] !== undefined) result[key] = structuredClone(home[key]);
    }
  }
  return result;
}

export const prepareAnalysisHome = prepareHomeForLevel;
