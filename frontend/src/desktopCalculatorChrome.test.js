import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const desktopSource = () => readFileSync(new URL("./DesktopCalculatorChrome.jsx", import.meta.url), "utf8");
const appSource = () => readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("desktop chrome provides the approved workflow and return control", () => {
  const source = desktopSource();
  for (const label of ["Choose the home", "Document the home", "Review scores", "Explore recommendations"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Return to mobile view/);
  assert.match(source, /YOUR AUDIT/);
  assert.doesNotMatch(source, /Why we.re asking/);
  assert.doesNotMatch(source, /Best next action/);
  assert.match(source, /documentTools/);
});

test("desktop entry removes the redundant screen title and exposes the split-view regions", () => {
  const desktop = desktopSource();
  const app = appSource();
  assert.match(desktop, /screen !== 0 && <h1[^>]+desktopScreenTitle/);
  assert.match(app, /className="desktopEntryIntro"/);
  assert.match(app, /className="desktopInitialEvidence"/);
  assert.match(app, /Initial evidence ready/);
});

test("desktop scoring depth presents both complete analysis choices without changing mobile disclosure", () => {
  const app = readFileSync(new URL("./AddressPhoto.jsx", import.meta.url), "utf8");
  assert.match(app, /className="desktopAnalysisOptions"/);
  assert.match(app, /`Start \$\{label\.replace/);
  assert.match(app, /\} Analysis`/);
  assert.match(app, /className="mobileAnalysisOptions"/);
  assert.match(app, /analysisLevelDetails\[level\]\.pros/);
  assert.match(app, /analysisLevelDetails\[level\]\.cons/);
});

test("mobile chrome exposes the desktop switch above the measuring footer", () => {
  const source = appSource();
  const switchIndex = source.indexOf("Open Desktop Version");
  const measuringIndex = source.indexOf("MEASURING");
  assert.ok(switchIndex >= 0);
  assert.ok(switchIndex < measuringIndex);
});

test("application chooses one shell around one shared active screen tree", () => {
  const source = appSource();
  assert.match(source, /viewMode === "desktop"/);
  assert.match(source, /<DesktopCalculatorChrome/);
  assert.match(source, /<MobileCalculatorChrome/);
  assert.doesNotMatch(source, /desktopChildren|mobileChildren/);
});

test("desktop review and score overview move assessment completeness into the guidance rail", () => {
  const source = appSource();
  assert.match(source, /sidebarTools=\{viewMode === "desktop" && \[3, 4\]\.includes\(screen\)/);
  assert.match(source, /<ReviewScreen[\s\S]*showCompleteness=\{viewMode !== "desktop"\}/);
  assert.match(source, /<Dashboard[\s\S]*showCompleteness=\{viewMode !== "desktop"\}/);
});

test("score generation and desktop score overview omit the redundant analysis context", () => {
  const source = appSource();
  assert.match(source, /const showAnalysisBadge = screen !== 4 \|\| viewMode !== "desktop"/);
  assert.match(source, /const showAnalysisAddress = !\[12\]\.includes\(screen\) && \(screen !== 4 \|\| viewMode !== "desktop"\)/);
});

test("all pillar percentage arcs use the shared VPSF green", () => {
  const source = appSource();
  const miniScore = source.slice(source.indexOf("function MiniScore"), source.indexOf("const listingSources"));
  assert.match(miniScore, /conic-gradient\(#16834f/);
  assert.doesNotMatch(miniScore, /conic-gradient\(var\(--ring\)/);
});

