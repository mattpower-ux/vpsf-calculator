const adjustments = { Low: 10, Medium: 0, High: -10, "Very High": -20 };

export function wildfireAssessment(home) {
  const risk = home.wildfire;
  if (!risk || risk.status !== "available"
    || risk.source !== "USFS Wildfire Risk to Communities" || risk.datasetVersion !== "wrc-2024"
    || !["community", "county"].includes(risk.areaType)
    || !Number.isFinite(risk.nationalPercentile) || risk.nationalPercentile < 0 || risk.nationalPercentile > 100) return null;
  for (const key of ["latitude", "longitude"]) {
    if (!Number.isFinite(home[key]) || !Number.isFinite(risk[key])
      || Math.abs(home[key] - risk[key]) > 0.000001) return null;
  }
  const rank = risk.nationalPercentile;
  const level = rank < 40 ? "Low" : rank < 70 ? "Medium" : rank < 90 ? "High" : "Very High";
  return { level, adjustment: adjustments[level] };
}

export function wildfireAdjustment(home) {
  return wildfireAssessment(home)?.adjustment ?? 0;
}

export function wildfireExplanation(home) {
  const assessment = wildfireAssessment(home);
  if (!assessment) return "USFS area wildfire risk is unknown or not matched to this location; no wildfire score adjustment was applied.";
  const { level, adjustment } = assessment;
  const risk = home.wildfire;
  return `USFS area wildfire risk: ${level} (${risk.areaName}; ${risk.areaType} scale). `
    + `VPSF wildfire adjustment: ${adjustment >= 0 ? "+" : ""}${adjustment} Resilience points, subject to the 0-200 pillar limit. `
    + "This is regional exposure, not a home fire-resistance assessment or current fire warning.";
}
