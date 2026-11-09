/**
 * Pure, synchronous planning model. Amounts are installed USD at source prices,
 * not future nominal dollars, bids, failure probabilities, or a property audit.
 *
 * buildFutureCosts(home) -> { currency, horizonYears, asOf, rows, total,
 *   location, assumptions, sources }
 * Row: { id, label, type, ageYears, low, high, lifespanYears: {low,high}|null,
 *   timing: {status,label,earliestYears,latestYears}, includedInTotal,
 *   assumptions: string[], missingData: string[], sources: Source[], sharedWith }
 * Timing status: unknown | within-horizon | possible-within-horizon |
 *   beyond-horizon | shared. Null amounts mean unestimated, NEVER zero cost.
 * Total: {label,low,high,includedIds,excluded:[{id,reason}],partial,coverageNote}.
 * Empty subtotal is null. Always partial: only three systems, no repairs or
 * other ownership costs. Sources describe inputs, not this model's formulas.
 * Source: {id,title,url,publishedAt: string|null,accessedAt,note}.
 */

const AS_OF = '2026-11-09';
const HORIZON = 10;
const SOURCE_DATA = {
  roof: ['HomeGuide: roof replacement', 'https://homeguide.com/costs/roof-replacement-cost', '2025-11-07', 'Installed material-specific ranges and service-life ranges.'],
  heatPump: ['HomeGuide: heat pumps', 'https://homeguide.com/costs/heat-pump-cost', '2025-10-30', 'Installed air-source size examples; typical life 10–15 years, maintained systems 15–20. Geothermal unit life 20–25, loops 40–60.'],
  boiler: ['HomeGuide: boiler replacement', 'https://homeguide.com/costs/boiler-replacement-cost', '2025-12-31', 'Conventional, high-efficiency and combination installed prices; typical life 10–20 years, some cast iron 30+.'],
  furnace: ['HomeGuide: furnace replacement', 'https://homeguide.com/costs/new-furnace-replacement-cost', '2025-12-31', 'Installed fuel-specific ranges; gas life 15–25 years, electric 20–30.'],
  water: ['HomeGuide: water heater replacement', 'https://homeguide.com/costs/water-heater-installation-cost', '2026-01-02', 'Installed tank, tankless, hybrid and solar ranges; tankless life 15–20 years.'],
  tankLife: ['DOE: transitioning to a tankless water heater', 'https://www1.eere.energy.gov/buildings/publications/pdfs/building_america/measure_guide_tanklesswh.pdf', null, 'Older technical guidance: tank life 10–15 years. Publication date not verified; not a current cost source.'],
  hybridLife: ['ENERGY STAR: heat pump water heater FAQ', 'https://www.energystar.gov/partner-resources/residential_new/educational_resources/sup_program_guidance/heat_pump_water_heater_guide/frequently_asked_questions', null, 'Heat pump water heater life is similar to electric storage; warranties are not service lives.'],
  solarLife: ['NV Energy: solar thermal heating', 'https://www.nvenergy.com/cleanenergy/other-private-generation/solar-thermal-heating', null, 'Solar thermal design life 20–25 years; date not supplied.'],
};
const sourcesFor = ids => [...new Set(ids)].map(id => {
  const [title, url, publishedAt, note] = SOURCE_DATA[id];
  return { id, title, url, publishedAt, accessedAt: AS_OF, note };
});
const text = value => typeof value === 'string' ? value.trim() : '';
const key = value => text(value).toLowerCase();

// Reject ambiguous free text, installation years, coercible objects and booleans.
function number(value, max, allowYears = false) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = typeof value === 'string' ? value.trim() : String(value);
  const pattern = allowYears ? /^(\d+(?:\.\d+)?)\s*(?:years?|yrs?)?$/i : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
  if (!pattern.test(raw)) return null;
  const n = Number(raw.replace(/\s*(?:years?|yrs?)$/i, '').replaceAll(',', ''));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
const age = value => number(value, 200, true);
const positive = (value, max) => { const n = number(value, max); return n > 0 ? n : null; };
const spec = (cost, life, sources, note = '') => ({ cost, life, sources, note });

function roofSpec(type) {
  switch (key(type)) {
    case 'asphalt shingle': return spec([3, 5], [15, 30], ['roof']);
    case 'architectural shingle': return spec([4, 6], [20, 30], ['roof']);
    case 'metal roof': return spec([5, 16], [30, 80], ['roof'], '80 years is a planning endpoint, not a maximum; some metal roofs last longer.');
    case 'tile roof': return spec([7, 25], [30, 100], ['roof'], '100 years is a planning endpoint, not a maximum. Tile underlayment may need earlier work, not estimated here.');
    default: return null;
  }
}

function boilerSpec(type) {
  if (key(type).includes('combination')) return spec([6000, 10000], [10, 20], ['boiler']);
  if (key(type).includes('condensing')) return spec([4000, 10000], [10, 20], ['boiler']);
  return spec([2200, 7000], [10, 20], ['boiler'], 'Assumes a conventional boiler; cast-iron equipment can last substantially longer.');
}

function hvacSpec(home, size) {
  const type = key(home.hvac);
  const hydronic = type.includes('boiler') || type === 'hydronic heating';
  const source = key(home.hydronicSource);
  if (type === 'geothermal' || (hydronic && source === 'ground-source heat pump')) {
    return spec(null, [20, 25], ['heatPump'], 'Geothermal indoor unit and ground loop have different lives. Full new-loop installation prices are not used as replacement-unit costs; quote the actual replacement scope.');
  }
  if (hydronic && source === 'air-to-water heat pump') {
    return spec(null, null, [], 'Air-to-water hydronic equipment is not priced as a ducted air-source heat pump or combustion boiler.');
  }
  if (type.includes('boiler')) return boilerSpec(home.hvac);
  if (type === 'hydronic heating') {
    if (['natural gas', 'propane', 'heating oil'].includes(source)) return boilerSpec('Boiler');
    return null;
  }
  if (type === 'gas furnace') return spec([3800, 12000], [15, 25], ['furnace'], 'Gas-furnace subsection range; excludes a separate air conditioner.');
  if (type === 'electric resistance' && key(home.heatingDistribution) === 'forced air') {
    return spec([2500, 7000], [20, 30], ['furnace'], 'Assumes one electric forced-air furnace, not resistance baseboards or radiant mats. Published upper range is open-ended.');
  }
  if (type === 'heat pump (electric)') {
    if (key(home.heatingDistribution) === 'ductless') return spec([2000, 17000], [10, 20], ['heatPump'], 'Ductless installed range; zone count unknown, upper range open-ended.');
    // Model assumption: bracket floor area between published examples, no
    // interpolation and no capacity sizing. Outside examples use generic range.
    const bands = [[1000, 6000, 8500], [1500, 8000, 10500], [2000, 10000, 20000],
      [2500, 12000, 22000], [3000, 18000, 25000], [3500, 20000, 28000], [4000, 22000, 32000]];
    let cost = [10000, 25000];
    let note = 'Generic national air-source range; floor area absent or outside the 1,000–4,000 sq ft size examples.';
    if (size >= 1000 && size <= 4000) {
      const lower = bands.filter(b => b[0] <= size).at(-1);
      const upper = bands.find(b => b[0] >= size);
      cost = [lower[1], upper[2]];
      note = `Model assumption: ${size} sq ft bracketed by published ${lower[0]}–${upper[0]} sq ft examples; not a load calculation.`;
    }
    return spec(cost, [10, 20], ['heatPump'], `${note} Assumes ducted air-source equipment including air handler; verify distribution. Upper prices are open-ended. Model uses a 10–20 year life envelope including maintained systems.`);
  }
  return null;
}

function waterSpec(type) {
  if (key(type).includes('combination boiler')) return boilerSpec(type);
  switch (key(type)) {
    case 'tank gas':
    case 'tank electric': return spec([600, 3100], [10, 15], ['water', 'tankLife'], 'Assumes one 40–50 gallon tank. Source pools gas/electric prices; no fabricated fuel premium.');
    case 'tankless gas': return spec([1400, 5600], [15, 20], ['water'], 'Pooled tankless installed range; gas-specific sizing and venting need a quote.');
    case 'heat pump water heater': return spec([2000, 4600], [10, 15], ['water', 'tankLife', 'hybridLife'], 'Model assumption: use storage-tank life range for a hybrid, consistent with ENERGY STAR comparison.');
    case 'solar thermal': return spec([3000, 9000], [20, 25], ['water', 'solarLife'], 'Whole solar thermal system planning range; backup tank and individual components may need earlier work.');
    default: return null;
  }
}

function timingFor(ageYears, life) {
  if (ageYears === null || !life) return { status: 'unknown', label: 'Timing unknown — verify age and equipment details', earliestYears: null, latestYears: null };
  const earliestYears = Math.max(0, life[0] - ageYears);
  const latestYears = Math.max(0, life[1] - ageYears);
  const status = latestYears <= HORIZON ? 'within-horizon' : earliestYears <= HORIZON ? 'possible-within-horizon' : 'beyond-horizon';
  const label = latestYears === 0 ? 'At or beyond planning life — inspect now; failure is not established'
    : `Planning window: ${earliestYears}–${latestYears} years from now`;
  return { status, label, earliestYears, latestYears };
}

/** Accepts the existing PropertyInput shape; ignores yearBuilt deliberately. */
export function buildFutureCosts(input) {
  const home = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const size = positive(home.squareFeet, 100000);
  const stories = positive(home.stories, 100);
  const zipInput = text(home.zip);
  const zip = /^\d{5}(?:-\d{4})?$/.test(zipInput) ? zipInput : null;
  const location = {
    zip,
    note: `ZIP ${zip || 'not provided or invalid'}: national ranges; local quote needed. No verified regional pricing dataset is applied.`,
  };
  const assumptions = [
    'Planning assumptions, not source formulas: remaining-life window = service-life range minus recorded equipment age, floored at zero. Age alone does not establish condition or replacement need.',
    'Subtotal includes one replacement per priced system only when its entire planning window falls within the next 10 years, inclusive. Windows overlapping year 10 remain excluded and visible.',
    'Source-date installed USD, without inflation or discounting. No utility rates, operating savings, incentives, or rebates are modeled. Upper ranges are not caps.',
    'Only roof, primary HVAC and water heating are assessed. Repairs, maintenance, separate cooling, additional systems, structural damage and major distribution/electrical changes are not separately budgeted.',
  ];
  const definitions = [
    ['roof', 'Roof replacement', home.roof ?? home.roofType, home.roofAge ?? home.roofAgeYears, roofSpec(home.roof ?? home.roofType)],
    ['hvac', 'HVAC replacement', home.hvac, home.hvacAge, hvacSpec(home, size)],
    ['waterHeater', 'Water heater replacement', home.waterHeater, home.waterHeaterAge, waterSpec(home.waterHeater)],
  ];
  const rows = definitions.map(([id, label, type, rawAge, model]) => {
    const ageYears = age(rawAge);
    const missingData = [];
    const notes = ['Assumes replacement with the recorded equipment type; installed national planning range, local quote needed.'];
    if (ageYears === null) missingData.push(`${label}: valid equipment age in years (not installation year).`);
    if (!model) missingData.push(`${label}: supported, specific equipment type needed; recorded as ${text(type) || 'Unknown'}.`);
    if (model?.note) notes.push(model.note);
    let cost = model?.cost || null;
    if (id === 'roof') {
      missingData.push('Measured roof area, pitch, complexity, tear-off scope and condition.');
      if (key(type) === 'impact-rated roof') missingData.push('Impact rating does not identify roof material; confirm shingle, metal, tile or other material.');
      if (!size) missingData.push('Valid home squareFeet in square feet.');
      if (!stories) missingData.push('Exact number of stories; 3+ is not an exact footprint.');
      if (cost && size && stories) {
        cost = [Math.floor(size / stories * 1.1 * cost[0] / 100) * 100,
          Math.ceil(size / stories * 1.5 * cost[1] / 100) * 100];
        // Rounding down a very small, valid proxy must not imply free replacement.
        cost[0] = Math.max(100, cost[0]);
        cost[1] = Math.max(cost[0], cost[1]);
        notes.push(`Model assumption, not measured area: ${size} sq ft / ${stories} stories × 1.1–1.5 for roof slope/overhang; assumes equal floor footprints. Apply material-specific installed $/sq ft, round outward to $100. Garages and additions may be missed.`);
      } else cost = null;
    } else if (id === 'hvac') {
      missingData.push('Equipment capacity, unit count, condition and installer load calculation.');
      if (!size) missingData.push('Valid home squareFeet for size context.');
      if (!cost) missingData.push('Confirm heat source, distribution and replacement scope for a local installed quote.');
      notes.push(`Home size context: ${size ? `${size} sq ft` : 'unknown'}; floor area alone cannot size HVAC. Existing distribution is assumed reusable.`);
    } else {
      missingData.push('Tank capacity or flow demand, unit count, installation access and condition.');
    }
    const life = model?.life || null;
    const timing = timingFor(ageYears, life);
    return { id, label, type: text(type) || 'Unknown', ageYears,
      low: cost?.[0] ?? null, high: cost?.[1] ?? null,
      lifespanYears: life ? { low: life[0], high: life[1] } : null,
      timing, includedInTotal: Boolean(cost && timing.status === 'within-horizon'),
      assumptions: notes, missingData, sources: sourcesFor(model?.sources || []), sharedWith: null };
  });

  const heating = rows[1];
  const water = rows[2];
  // Boiler domestic-hot-water selections can refer to the same physical unit.
  // Count once under an explicit shared-unit assumption, and never resolve
  // contradictory age records by picking whichever age makes a cost due.
  if (key(home.waterHeater).includes('combination boiler') &&
      (key(home.hvac).includes('boiler') || key(home.hvac) === 'hydronic heating') &&
      !key(home.hydronicSource).includes('heat pump')) {
    const shared = boilerSpec(home.waterHeater);
    heating.label = 'Shared boiler — heating and hot water';
    heating.low = shared.cost[0]; heating.high = shared.cost[1];
    heating.lifespanYears = { low: shared.life[0], high: shared.life[1] };
    heating.sources = sourcesFor(['boiler']);
    if (heating.ageYears !== null && water.ageYears !== null && heating.ageYears !== water.ageYears) {
      heating.ageYears = null;
      heating.missingData.push('Conflicting HVAC and water-heater ages: verify shared boiler age.');
    } else heating.ageYears = heating.ageYears ?? water.ageYears;
    heating.timing = timingFor(heating.ageYears, shared.life);
    heating.includedInTotal = heating.timing.status === 'within-horizon';
    heating.assumptions.push('Model assumption: the boiler and combination water heater are one shared unit, counted once. Verify equipment identity; separate units are not budgeted.');
    heating.missingData.push('Confirm that heating and hot water share one combination boiler.');
    water.sharedWith = 'hvac';
    water.low = null; water.high = null; water.includedInTotal = false;
    water.timing = { status: 'shared', label: 'Shared system — see HVAC row', earliestYears: null, latestYears: null };
    water.assumptions.push('No separate water-heater cost added; shared combination boiler is represented in the HVAC row.');
  }
  const included = rows.filter(r => r.includedInTotal);
  const excluded = rows.filter(r => !r.includedInTotal).map(r => ({ id: r.id,
    reason: r.sharedWith ? 'Counted with shared HVAC system' : r.low === null ? 'Cost unestimated; equipment details or quote needed'
      : r.timing.status === 'unknown' ? 'Unknown replacement timing'
        : r.timing.status === 'possible-within-horizon' ? 'Window overlaps year 10; excluded from subtotal, not zero exposure' : 'Planning window beyond 10 years' }));
  return { currency: 'USD', horizonYears: HORIZON, asOf: AS_OF, rows,
    total: { label: 'Partial 10-year replacement subtotal',
      low: included.length ? included.reduce((n, r) => n + r.low, 0) : null,
      high: included.length ? included.reduce((n, r) => n + r.high, 0) : null,
      includedIds: included.map(r => r.id), excluded, partial: true,
      coverageNote: `${included.length} of ${rows.length} displayed rows contribute. ${included.length ? 'Only priced windows wholly within 10 years are included.' : 'No priced replacement window wholly within 10 years is established; this does not mean zero future costs.'} Shared rows are not counted twice. Unknown and overlapping windows, repairs and other systems remain outside this partial subtotal.` },
    location, assumptions, sources: sourcesFor(rows.flatMap(r => r.sources.map(s => s.id))) };
}
