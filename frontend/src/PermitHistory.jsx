import React from 'react';
import { permitEvidenceForHome, permitCoverageSummary, permitFactsFromEvidence, confirmedPermitNumbers, appliedPermitFacts } from './permitEvidence.js';
import './permitHistory.css';

export default function PermitHistory({ home, onConfirmPermit }) {
  const evidence=permitEvidenceForHome(home);
  if (!evidence) return null;
  const facts=permitFactsFromEvidence(evidence);
  const applied=appliedPermitFacts(home,evidence);
  const confirmed=confirmedPermitNumbers(home);
  const confirmations=facts.confirmations.filter(item=>{
    if (item.permitNumber && confirmed.has(item.permitNumber)) return false;
    const provenance=home.provenance?.[item.field];
    return !(item.value && provenance?.origin === 'user-confirmed'
      && String(home[item.field] || '').toLowerCase().includes(String(item.value).toLowerCase()));
  });
  const labels={hvac:'Heating / cooling',hvacAge:'HVAC age',solar:'Solar / battery',backup:'Backup power',
    waterHeater:'Water heating',waterHeaterAge:'Water-heater age',roof:'Roof material',roofAge:'Roof age'};
  return <details className="permitHistory summaryCard">
    <summary>Permit history <span>({evidence.permits.length})</span></summary>
    {Object.keys(applied).length > 0 && <section className="permitImports" aria-label="Details added from completed permits">
      <h4>Added to home details</h4>
      <p>Completed or final permit records prefilled these items. You can correct them in the form.</p>
      <dl>{Object.entries(applied).map(([field,value])=><div key={field}><dt>{labels[field] || field}</dt><dd>{value}</dd></div>)}</dl>
    </section>}
    {confirmations.length > 0 && <section className="permitConfirmations" aria-label="Permit details to confirm">
      <h4>Confirm these items</h4>
      <p>These records describe relevant work but do not establish a single current home feature.</p>
      <ul>{confirmations.map((item,index)=><li key={`${item.permitNumber || item.field}-${index}`}><strong>{item.summary}</strong><span>{item.reason}</span>{onConfirmPermit && item.permitNumber && <button type="button" onClick={()=>onConfirmPermit(item.permitNumber)}>Confirm installed</button>}</li>)}</ul>
    </section>}
    <p>Public permit records from PermitStack. Final or completed records can prefill a matching detail; other permits remain review prompts.</p>
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
