import React from 'react';
import { permitEvidenceForHome } from './permitEvidence.js';
import './permitHistory.css';

export default function PermitHistory({ home }) {
  const evidence=permitEvidenceForHome(home);
  if (!evidence?.permits.length) return null;
  return <details className="permitHistory summaryCard">
    <summary>Permit history <span>({evidence.permits.length})</span></summary>
    <p>Public permit records from PermitStack. A permit does not establish completed work, installed equipment, or equipment age.</p>
    {evidence.permits.map((permit,index)=><article key={`${permit.id}-${index}`}>
      <h4>{permit.category || 'Permit'}{permit.permitNumber ? ` · ${permit.permitNumber}` : ''}</h4>
      <p><strong>Status:</strong> {permit.status.replaceAll('_',' ')}</p>
      <dl>{[['dateFiled','Filed'],['dateIssued','Issued'],['dateCompleted','Completed']].filter(([key])=>permit[key]).map(([key,label])=>
        <div key={key}><dt>{label}</dt><dd>{permit[key].slice(0,10)}</dd></div>)}</dl>
      {permit.description && <p>{permit.description}</p>}
      {permit.jurisdiction && <small>{permit.jurisdiction}</small>}
    </article>)}
    <p className="permitCoverage">Coverage may be incomplete. {evidence.searchTruncated ? 'Only part of the matching history was returned. ' : ''}
      {evidence.coverage.tierWindowClamped ? 'Available history is limited by the provider’s subscription window. ' : ''}
      {evidence.coverage.dataThrough ? `Coverage through ${evidence.coverage.dataThrough.slice(0,10)}. ` : ''}
      Retrieved {evidence.fetchedAt.slice(0,10)}{evidence.cacheHit ? ' (cached)' : ''}.</p>
  </details>;
}
