import {analysisLabel} from './analysisLevels.js';

export function analysisContextText(home={}){
  const address=[home.address,home.city,home.state,home.zip].filter(value=>String(value||'').trim()).join(', ');
  return [home.analysisLevel ? analysisLabel(home.analysisLevel) : '', address].filter(Boolean).join(' · ');
}
