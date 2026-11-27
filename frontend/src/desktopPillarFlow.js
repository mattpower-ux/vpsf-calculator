export const DESKTOP_PILLAR_IDS = Object.freeze([
  "energy",
  "water",
  "health",
  "resilience",
  "carbon",
  "financial",
  "community"
]);

export function createDesktopPillarProgress() {
  return { active: DESKTOP_PILLAR_IDS[0], completed: [], finished: false };
}

export function selectDesktopPillar(progress, pillar) {
  if (!DESKTOP_PILLAR_IDS.includes(pillar)) return progress;
  return { ...progress, active: pillar, finished: false };
}

export function advanceDesktopPillar(progress) {
  const index = DESKTOP_PILLAR_IDS.indexOf(progress.active);
  if (index < 0) return createDesktopPillarProgress();
  const completed = progress.completed.includes(progress.active)
    ? progress.completed
    : [...progress.completed, progress.active];
  const finished = index === DESKTOP_PILLAR_IDS.length - 1;
  return {
    active: finished ? progress.active : DESKTOP_PILLAR_IDS[index + 1],
    completed,
    finished
  };
}
