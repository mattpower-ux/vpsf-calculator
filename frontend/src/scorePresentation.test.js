import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classification, gradeFor, pillarTone, reportAddress, reportText } from "./scorePresentation.js";

const pillars = [
  ["energy", "Energy", 200], ["water", "Water", 100], ["health", "Health", 200],
  ["resilience", "Resilience", 200], ["carbon", "Carbon", 150],
  ["financial", "Financial", 100], ["community", "Community", 50]
].map(([key, short, max]) => ({ key, short, max }));
const result = { total: 360, scores: { energy: 40, water: 20, health: 80, resilience: 60, carbon: 50, financial: 70, community: 40 } };

test("screenshot's 360 points are High Risk, not a high market percentile", () => {
  assert.equal(Object.values(result.scores).reduce((sum, value) => sum + value, 0), 360);
  assert.equal(classification(result.total).label, "High Risk");
  assert.equal(classification(result.total).tone, "poor");
  for (const pillar of pillars.slice(0, 5)) {
    assert.equal(gradeFor(result.scores[pillar.key], pillar.max), "D");
    assert.equal(pillarTone(result.scores[pillar.key], pillar.max), "poor");
  }
  assert.equal(gradeFor(70, 100), "B");
  assert.equal(gradeFor(40, 50), "B+");
});

test("existing classification and pillar thresholds are unchanged", () => {
  for (const [score, label] of [[399, "High Risk"], [400, "Code Plus"], [549, "Code Plus"], [550, "Good / Efficient"], [699, "Good / Efficient"], [700, "High Performance"], [849, "High Performance"], [850, "Exceptional"], [1000, "Exceptional"]]) {
    assert.equal(classification(score).label, label);
  }
  for (const [score, grade] of [[44, "D"], [45, "C"], [59, "C"], [60, "B"], [71, "B"], [72, "B+"], [84, "B+"], [85, "A"]]) assert.equal(gradeFor(score, 100), grade);
});

test("report export contains current address and real pillar results, not sample claims", () => {
  const property = { address: "22 Dow St", city: "Portland", state: "ME", zip: "04102" };
  const text = reportText(result, property, pillars);
  assert.match(text, /^VPSF REPORT CARD\n22 Dow St, Portland, ME 04102/);
  assert.match(text, /360 out of 1,000 \| High Risk/);
  assert.match(text, /36% of available VPSF points \(not a market percentile\)/);
  assert.match(text, /Energy: 40\/200 \(D\)/);
  assert.match(text, /have not been calculated/);
  assert.doesNotMatch(text, /outperforms|78%|1,820|1,150|2\.1 tons|CERTIFIED HOME/);
  assert.equal(reportAddress({ address: "22 Dow St, Portland, ME" }), "22 Dow St, Portland, ME");
  assert.equal(reportAddress(), "Property address not provided");
});

test("report UI cannot regress to fixed savings, certification, or sample photo", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const report = source.slice(source.indexOf("function LabelScreen("), source.indexOf("export default function App("));
  assert.match(report, /VPSF REPORT CARD/);
  assert.match(report, /out of 1,000/);
  assert.match(report, /data-tone=\{info\.tone\}/);
  assert.match(report, /pillarTone\(value, pillar\.max\)/);
  assert.doesNotMatch(report, /outperforms|78%|1,820|1,150|2\.1 tons|CERTIFIED HOME|demoOrlandoHome|QrCode/);
});
