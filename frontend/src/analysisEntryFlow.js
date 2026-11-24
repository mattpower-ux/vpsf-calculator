const LEVELS = new Set(['broad', 'moderate', 'inclusive']);

export const analysisEntryInitialState = Object.freeze({page:'address', expanded:null, confirmed:null});

export const analysisLevelDetails = Object.freeze({
  broad: {
    summary: 'A fast baseline built from available public records, permits, and regional context.',
    results: ['Seven-pillar VPSF score', 'Initial strengths and priority upgrades'],
  },
  moderate: {
    summary: 'A more informed score that asks you to confirm the home’s most important systems and features.',
    results: ['Critical roof, HVAC, water-heating, and resilience details', 'More targeted recommendations'],
  },
  inclusive: {
    summary: 'The most complete review, using documented features, photos, and detailed home information.',
    results: ['Highest-confidence VPSF score', 'Detailed findings and improvement opportunities'],
  },
});

export function analysisEntryReducer(state, action) {
  if (action?.type === 'open-depth') return {page:'depth', expanded:null, confirmed:null};
  if (action?.type === 'back') return analysisEntryInitialState;
  if (action?.type === 'toggle-level' && LEVELS.has(action.level)) {
    return {page:'depth', expanded:state.expanded === action.level ? null : action.level, confirmed:null};
  }
  if (action?.type === 'confirm-level' && LEVELS.has(action.level) && state.page === 'depth' && state.expanded === action.level) {
    return {...state, confirmed:action.level};
  }
  return state;
}
