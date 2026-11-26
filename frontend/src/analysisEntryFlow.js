const LEVELS = new Set(['broad', 'inclusive']);

export const analysisEntryInitialState = Object.freeze({page:'address', expanded:null, confirmed:null});

export const analysisLevelDetails = Object.freeze({
  broad: {
    summary: 'A fast baseline built from available public records, permits, and regional context.',
    pros: ['Seven-pillar VPSF score', 'Initial strengths and priority upgrades', 'Limited additional entry from you'],
    cons: ['Many home records lack substantial data.', 'Results likely to be incomplete, with weak accuracy.'],
    results: ['Seven-pillar VPSF score', 'Initial strengths and priority upgrades', 'Limited additional entry from you'],
  },
  inclusive: {
    summary: 'The most complete review, using documented features, photos, and detailed home information.',
    pros: ['Highest-confidence VPSF score', 'Detailed findings and improvement opportunities', 'Documents and photos can fill information gaps'],
    cons: ['More info from you', 'Takes longer to complete than Basic'],
    results: ['Highest-confidence VPSF score', 'Detailed findings and improvement opportunities', 'More info from you'],
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
