export const DESKTOP_STAGES = [
  { id: 1, label: "Choose the home", shortLabel: "Property" },
  { id: 2, label: "Document the home", shortLabel: "Details" },
  { id: 3, label: "Review scores", shortLabel: "Scores" },
  { id: 4, label: "Explore recommendations", shortLabel: "Improve" }
];

const DOCUMENT_SCREENS = new Set([1, 2, 3, 11, 14, 29, 30]);
const SCORE_SCREENS = new Set([4, 5, 9, 10, 12, 24, 31]);
const IMPROVEMENT_SCREENS = new Set([6, 7, 8, 13, 15, 16, 17, 18, 19, 20, 21, 22, 28]);

const TITLES = {
  0: "Choose a home",
  1: "Property information",
  2: "Key features",
  3: "Full review",
  4: "Performance scores",
  5: "Pillar performance",
  6: "Recommended improvements",
  7: "Product solutions",
  12: "Analyzing the home",
  14: "Document your home",
  15: "Improvement detail",
  16: "Matched products",
  24: "My scores",
  29: "Superior analysis",
  30: "Analysis depth",
  31: "Score overview"
};

export function desktopContextForScreen(screen) {
  const numericScreen = Number.isInteger(screen) ? screen : 0;
  const stage = DOCUMENT_SCREENS.has(numericScreen)
    ? 2
    : SCORE_SCREENS.has(numericScreen)
      ? 3
      : IMPROVEMENT_SCREENS.has(numericScreen)
        ? 4
        : 1;
  return {
    stage,
    title: TITLES[numericScreen] || DESKTOP_STAGES[stage - 1].label,
    showPropertyRail: numericScreen !== 0,
    showGuidanceRail: stage !== 1,
    canSaveDraft: stage === 2
  };
}

