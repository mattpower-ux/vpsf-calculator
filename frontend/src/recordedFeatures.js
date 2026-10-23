const fields = {
  energy: ['hvac', 'waterHeater', 'solar', 'evReady', 'hers', 'heatingDistribution', 'heatingControls', 'hydronicSource'],
  water: ['waterStandard', 'leak', 'reuse', 'landscape'],
  health: ['healthCert', 'ventilation', 'materials', 'iaq', 'daylighting'],
  resilience: ['fortified', 'flood', 'roof', 'moisture', 'backup', 'wildfireMitigation', 'temperatureProtection', 'windProtection'],
  carbon: ['carbonStrategy', 'carbonConcrete', 'structure'],
  financial: ['insurance', 'warranty', 'maintenance', 'leak']
};

export function recordedPillarFeatures(home, pillar) {
  const values = (fields[pillar] || []).map(key => home[key]).filter(value =>
    typeof value === 'string' && value.trim() &&
    !/^(none|unknown|standard|code-minimum|no accounting|electric resistance|tank |gas furnace|exhaust only|high-water)/i.test(value)
  );
  return values.length ? [...new Set(values)].map(value => `Recorded: ${value}`) : ['No qualifying features recorded yet.'];
}
