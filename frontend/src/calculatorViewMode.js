export const CALCULATOR_VIEW_MODE_KEY = "vpsf.calculator.viewMode";

export function normalizeCalculatorViewMode(value) {
  return value === "desktop" ? "desktop" : "mobile";
}

export function readCalculatorViewMode(storage = globalThis?.localStorage) {
  try {
    return normalizeCalculatorViewMode(storage?.getItem(CALCULATOR_VIEW_MODE_KEY));
  } catch {
    return "mobile";
  }
}

export function writeCalculatorViewMode(storage = globalThis?.localStorage, mode) {
  try {
    storage?.setItem(CALCULATOR_VIEW_MODE_KEY, normalizeCalculatorViewMode(mode));
  } catch {
    // Presentation preferences are optional when storage is unavailable.
  }
}

