// Evidence coverage only. Each PropertyInput field belongs to one checklist,
// even when a scoring model uses it in more than one pillar.
const group = (id, name, description, fields) => Object.freeze({
  id, name, description,
  fields: Object.freeze(fields.map(([key,label,help='']) => Object.freeze({key,label,help})))
});

export const evidenceGroups = Object.freeze([
  group('energy', 'Energy', 'Energy ratings, utility records, equipment labels, installation invoices, and insulation or window specifications help document energy features.', [
    ['hers','HERS rating'], ['hvac','Heating and cooling system'], ['hvacAge','HVAC age'],
    ['heatingDistribution','Heat distribution'], ['hydronicSource','Hydronic heat source'], ['heatingControls','Heating controls'],
    ['waterHeater','Water heater'], ['waterHeaterAge','Water heater age'], ['windows','Windows'], ['insulation','Insulation'],
    ['solar','Solar and battery systems'], ['evReady','EV readiness']
  ]),
  group('water', 'Water', 'Water certifications, plumbing invoices, irrigation plans, and reuse-system records help document water conservation and leak protection.', [
    ['toilets','Toilets'], ['bathroomFaucets','Bathroom faucets'], ['showerheads','Showerheads'], ['leak','Leak protection'], ['reuse','Water reuse'],
    ['irrigation','Irrigation'], ['landscape','Landscaping']
  ]),
  group('health', 'Health', 'Indoor-environment certificates, ventilation specifications, material declarations, and monitoring records help document health-related features.', [
    ['ventilation','Ventilation'], ['materials','Interior material specifications'],
    ['iaq','Air quality monitoring'], ['daylighting','Daylighting and comfort features']
  ]),
  group('resilience', 'Resilience', 'Inspection reports, roof and siding specifications, installation records, resilience certificates, and official hazard data help document protection and exposure separately.', [
    ['roof','Roof covering'], ['roofAge','Roof age'], ['roofFireRating','Roof fire rating'], ['siding','Siding'],
    ['flood','Flood design'], ['wildfireMitigation','Wildfire mitigation'], ['temperatureProtection','Extreme-temperature protection'],
    ['windProtection','Wind protection'], ['moisture','Moisture protection'], ['backup','Backup power'], ['wildfire','Regional wildfire evidence']
  ]),
  group('carbon', 'Lower-Carbon Building Materials', 'Building materials create emissions when they are manufactured and transported. Product declarations, specifications, or builder records may identify lower-carbon choices.', [
    ['carbonStrategy','Were lower-carbon building materials documented for this home?','This is about the materials used to build or renovate the home, not carbon offsets or credits.'],
    ['carbonConcrete','If concrete was used, was a lower-carbon concrete mix specified?','Check construction specifications, invoices, or builder records if available.'],
    ['structure','What is the home’s primary structural material?','Choose the material that makes up most of the home’s structural frame.']
  ]),
  group('financial', 'Financial Risk', 'Household costs, insurance documents, warranties, and maintenance plans help show how manageable and predictable this home may be to own.', [
    ['pietim','How much of your household income goes toward owning this home?','Include mortgage payments, energy bills, property taxes, home insurance, and maintenance. Estimate the percentage of your gross monthly household income.'],
    ['insurance','Insurance'], ['warranty','Warranty'], ['maintenance','Maintenance plan']
  ]),
  group('community', 'Community and Mobility', 'Official accessibility data, transit information, neighborhood records, and documented amenities help describe community access.', [
    ['epaWalkability','EPA walkability evidence'], ['walkscore','Walk Score'], ['transit','Transit and services'],
    ['greenspace','Green space'], ['amenities','Shared amenities'], ['bike','Bike access']
  ])
]);

const PUBLIC_RECORD = /^(?:property record|public records?|rentcast|attom|county assessor|assessor|permit records?)(?:$|[\s:;/()-])/i;
const DOCUMENT = /^(?:(?:uploaded |reviewed )?document|inspection report|(?:homeowner )?invoice|utility bill|energy audit|certification|certificate|equipment label|product datasheet|installation record|insurance document|warranty document|maintenance plan|environmental product declaration)(?:$|[\s:;/()-])/i;
const ASSUMED_SOURCE = /\b(?:ai|inferred|inference|demo|demonstration|assumption|assumed|default|mock|sample|generated)\b/i;

function documentedSource(key, source) {
  if (typeof source !== 'string' || ASSUMED_SOURCE.test(source)) return false;
  const name = source.trim();
  if (PUBLIC_RECORD.test(name) || DOCUMENT.test(name)) return true;
  return (key === 'wildfire' && name === 'USFS Wildfire Risk to Communities')
    || (key === 'epaWalkability' && name === 'EPA National Walkability Index');
}

function hasAnswer(key, value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return !/^(|unknown|none\s*\/\s*unknown|n\/a|null|undefined|not available)$/i.test(value.trim());
  if (!value || typeof value !== 'object' || value.status !== 'available') return false;
  if (key === 'wildfire') return Number.isFinite(value.nationalPercentile) && value.nationalPercentile >= 0 && value.nationalPercentile <= 100;
  if (key === 'epaWalkability') return Number.isFinite(value.value) && value.value >= 1 && value.value <= 20;
  return false;
}

function category(home, key) {
  if (!hasAnswer(key, home[key])) return 'unanswered';
  const evidence = home.provenance?.[key];
  switch (evidence?.origin) {
    case 'user-confirmed': return 'reported';
    case 'inferred':
    case 'demo-assumption': return 'review';
    case 'imported': return documentedSource(key, evidence.source) ? 'documented' : 'review';
    default: return 'unanswered';
  }
}

const blankCounts = () => ({total:0, documented:0, reported:0, review:0, unanswered:0});

/**
 * Count checklist evidence, never points or physical performance. Imported facts
 * need a recognized record/document source label to count as documented. This
 * cannot authenticate a source or confirm that the evidence supports the claim.
 * Unsupported imports need review; inferred/demo facts can never be documented.
 * No provenance means unanswered even when a default-looking value is present.
 * Explicit None and finite zero are valid answers when provenance exists.
 *
 * Returns counts plus groups [{id,name,description,fields:[{key,label,status}],
 * ...counts,missingFields:[{key,label}]}] and flattened missingFields
 * [{key,label,groupId}]. Missing means unanswered, not awaiting review.
 */
export function assessmentCompleteness(input) {
  const home = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = {...blankCounts(), groups:[], missingFields:[]};
  for (const definition of evidenceGroups) {
    const stats = {...blankCounts(), id:definition.id, name:definition.name, description:definition.description, fields:[], missingFields:[]};
    for (const field of definition.fields) {
      const status = category(home,field.key);
      stats.fields.push({...field,status});
      stats.total++; stats[status]++;
      result.total++; result[status]++;
      if (status === 'unanswered') {
        stats.missingFields.push({...field});
        result.missingFields.push({...field,groupId:definition.id});
      }
    }
    result.groups.push(stats);
  }
  return result;
}
