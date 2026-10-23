export const heatingResilienceDefaults = {
  heatingDistribution: "Unknown", heatingControls: "Unknown", hydronicSource: "Unknown",
  wildfireMitigation: "Unknown", temperatureProtection: "Unknown", windProtection: "Unknown"
};

export const heatingResilienceOptions = {
  heatingDistribution: ["Unknown", "Forced Air", "Hydronic Radiant", "Hydronic Radiators / Baseboards", "Electric Radiant", "Ductless"],
  heatingControls: ["Unknown", "Standard Thermostat", "Outdoor Reset", "Zoning + Outdoor Reset"],
  hydronicSource: ["Unknown", "Heating Oil", "Natural Gas", "Propane", "Electric Resistance", "Air-to-Water Heat Pump", "Ground-Source Heat Pump"],
  wildfireMitigation: ["Unknown", "None", "Defensible Space", "Ember-Resistant Vents", "Ember Hardening + Defensible Space"],
  temperatureProtection: ["Unknown", "None", "Air Sealing", "Insulation Upgrade", "Air Sealing + Insulation"],
  windProtection: ["Unknown", "None", "Rated Opening Protection", "Engineered Continuous Load Path", "FEMA / ICC Safe Room"]
};

export function assessmentImprovements(result) {
  return (result?.improvements || []).filter(item => Number.isFinite(item.gainPoints) && item.gainPoints > 0);
}

export function heatingSelectionPatch(home, key, value) {
  const heatPumpSources = ["Ground-Source Heat Pump", "Air-to-Water Heat Pump"];
  if (key === "hvac" && value !== "Hydronic Heating" &&
      (!/boiler/i.test(value) || heatPumpSources.includes(home.hydronicSource))) return { hydronicSource: "Unknown" };
  if (key === "hydronicSource" && heatPumpSources.includes(value)) return { hvac: "Hydronic Heating" };
  if (key === "heatingDistribution" && !["Hydronic Radiant", "Hydronic Radiators / Baseboards"].includes(value)) return { heatingControls: "Unknown" };
  return {};
}
