import { fixtureFields } from './certifications.js';

const fields = {
  energy: ['hvac', 'waterHeater', 'solar', 'evReady', 'hers', 'heatingDistribution', 'heatingControls', 'hydronicSource'],
  water: ['toilets', 'bathroomFaucets', 'showerheads', 'leak', 'reuse', 'landscape'],
  health: ['ventilation', 'materials', 'iaq', 'daylighting'],
  resilience: ['flood', 'moisture', 'backup', 'wildfireMitigation', 'temperatureProtection', 'windProtection'],
  carbon: ['carbonStrategy', 'carbonConcrete', 'structure'],
  financial: ['insurance', 'warranty', 'maintenance', 'leak']
};

export function recordedPillarFeatures(home, pillar) {
  const values = (fields[pillar] || []).filter(key =>
    typeof home[key] === 'string' && home[key].trim() &&
    !/^(none|unknown|standard|code-minimum|no accounting|electric resistance|tank |gas furnace|exhaust only|high-water|zero carbon certified)/i.test(home[key])
  ).map(key => {
    const label = fixtureFields.find(([field]) => field === key)?.[1];
    return label ? `${label} — ${home[key]}` : home[key];
  });
  return values.length ? [...new Set(values)].map(value => `Recorded: ${value}`) : ['No qualifying features recorded yet.'];
}
