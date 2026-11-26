import React from 'react';
import {analysisContextText} from './analysisContextLine.js';

export default function AnalysisContextLine({home}){
  const text=analysisContextText(home);
  return text ? <p className="analysisContextLine" aria-label="Current analysis">{text}</p> : null;
}
