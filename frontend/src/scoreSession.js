const assessedResultScreens = new Set([4, 5, 6, 9, 10, 17, 18, 19]);

export function resultForCurrentAssessment(resultMode, demoResult, apiResult) {
  return resultMode === "demo" ? demoResult : apiResult;
}

export function requiresAssessmentScore(screen) {
  return assessedResultScreens.has(screen);
}
