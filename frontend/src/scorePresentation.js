export function classification(score) {
  if (score >= 850) return { label: "Exceptional", meaning: "Future-proof asset", grade: "A+", tone: "good" };
  if (score >= 700) return { label: "High Performance", meaning: "Low-risk, low-cost home", grade: "A", tone: "good" };
  if (score >= 550) return { label: "Good / Efficient", meaning: "Above-market quality", grade: "B", tone: "positive" };
  if (score >= 400) return { label: "Code Plus", meaning: "Typical new home", grade: "C", tone: "caution" };
  return { label: "High Risk", meaning: "High operating + insurance cost", grade: "D", tone: "poor" };
}

export function gradeFor(value, max) {
  const pct = value / max;
  if (pct >= 0.85) return "A";
  if (pct >= 0.72) return "B+";
  if (pct >= 0.6) return "B";
  if (pct >= 0.45) return "C";
  return "D";
}

export function pillarTone(value, max) {
  return { A: "good", "B+": "positive", B: "positive", C: "caution", D: "poor" }[gradeFor(value, max)];
}

export function reportAddress(property) {
  return [property?.address, property?.city, [property?.state, property?.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Property address not provided";
}

export const REPORT_LIMITATIONS = "Based on available property details, not a certification. Market percentile, savings, and CO2 reductions have not been calculated.";

export function reportText(result, property, pillars) {
  return [
    "VPSF REPORT CARD", reportAddress(property), "",
    `${result.total} out of 1,000 | ${classification(result.total).label}`,
    `${Math.round(result.total / 10)}% of available VPSF points (not a market percentile).`, "",
    ...pillars.map((pillar) => `${pillar.short}: ${result.scores[pillar.key]}/${pillar.max} (${gradeFor(result.scores[pillar.key], pillar.max)})`),
    "", REPORT_LIMITATIONS
  ].join("\n");
}
