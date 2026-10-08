import assert from "node:assert/strict";
import test from "node:test";

import { createReportPdf } from "./reportPdf.js";

const model = {
  address: "1313 Cognition Drive, Orlando, FL 32825",
  facts: "Built 1988 | 1,510 sq ft",
  total: 360,
  rating: "High Risk",
  overview: "This home earned 360 of 1,000 available VPSF points (High Risk). Community is its strongest relative pillar; Energy has the lowest relative score.",
  highlights: ["Strongest: Community 40/50 (B+)", "Priority gap: Energy 40/200 (D)", "2 of 7 pillars earned a B grade or higher"],
  scores: [
    ["Energy", 40, 200, "D"], ["Water", 20, 100, "D"], ["Health", 80, 200, "D"],
    ["Resilience", 60, 200, "D"], ["Carbon", 50, 150, "D"],
    ["Financial", 70, 100, "B"], ["Community", 40, 50, "B+"]
  ].map(([label, value, max, grade]) => ({ label, value, max, grade, fraction: value / max })),
  products: [
    { name: "Rheem ProTerra Heat Pump Water Heater", company: "Rheem", pillar: "energy", url: "https://www.rheem.com/heatpumpwaterheaters/" },
    { name: "Rainwater Management Solutions Tank", company: "Rainwater Management Solutions", pillar: "water", url: "https://rainwatermanagement.com/" },
    { name: "CertainTeed Impact Resistant Shingles", company: "CertainTeed", pillar: "resilience", url: "https://www.certainteed.com/inspiration/how-tos/algae-impact-resistant-shingles" }
  ]
};

test("printable report is one 8 x 11 inch page with live manufacturer links", () => {
  const pdf = createReportPdf(model);
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.equal(pdf.internal.pageSize.getWidth(), 576);
  assert.equal(pdf.internal.pageSize.getHeight(), 792);
  const raw = pdf.output();
  assert.ok(raw.length > 4000);
  assert.ok(raw.includes("1313 Cognition Drive"));
  assert.ok(raw.includes("/URI"));
  for (const product of model.products) assert.ok(raw.includes(product.url));
});

test("printable report handles an unusually long address and no known products", () => {
  const pdf = createReportPdf({ ...model, address: "123456 A Very Long Rural Route Road Name Near the River, Some Big Municipality, FL 32825", products: [] });
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.ok(pdf.output().includes("No verified product links available"));
  assert.ok(pdf.output().includes("Some Big Municipality"));
});
