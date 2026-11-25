import React from 'react';
import { permitEvidenceForHome, permitCoverageSummary } from './permitEvidence.js';
import './permitHistory.css';

export default function PermitHistory({ home }) {
  const evidence=permitEvidenceForHome(home);
  if (!evidence) return null;
  return <details className="permitHistory summaryCard">
    <summary>Permit history <span>({evidence.permits.length})</span></summary>
    <p>Public permit records from PermitStack. A permit does not establish completed work, installed equipment, or equipment age.</p>
    {!evidence.permits.length && <p>No exact-address permit records were returned. That does not prove no work occurred.</p>}
    {evidence.permits.map((permit,index)=><article key={`${permit.id}-${index}`}>
      <h4>{permit.category || 'Permit'}{permit.permitNumber ? ` · ${permit.permitNumber}` : ''}</h4>
      <p><strong>Status:</strong> {permit.status.replaceAll('_',' ')}</p>
      <dl>{[['dateFiled','Filed'],['dateIssued','Issued'],['dateCompleted','Completed']].filter(([key])=>permit[key]).map(([key,label])=>
        <div key={key}><dt>{label}</dt><dd>{permit[key].slice(0,10)}</dd></div>)}</dl>
      {permit.description && <p>{permit.description}</p>}
      {permit.jurisdiction && <small>{permit.jurisdiction}</small>}
    </article>)}
    <p className="permitCoverage">{permitCoverageSummary(evidence)}</p>
  </details>;
}
