import React from 'react';
import { buildEvidenceSummary } from './evidenceSummary.js';
import './evidenceSummary.css';

const Group=({title,items,empty})=><div className="evidenceGroup">
  <h4>{title} <span>{items.length}</span></h4>
  {items.length ? <ul>{items.slice(0,4).map(item=><li key={`${item.field}-${item.permitNumber || item.detail}`}><strong>{item.label}</strong><span>{item.detail}</span></li>)}</ul> : <p>{empty}</p>}
</div>;

export default function EvidenceSummary({home}) {
  const summary=buildEvidenceSummary(home);
  return <section className="summaryCard evidenceSummary" aria-labelledby="evidence-summary-title">
    <h3 id="evidence-summary-title">What we found</h3>
    <p className="evidenceIntro">Review the useful evidence collected so far. Only completed permit work is listed as a finding.</p>
    <div className="evidenceGrid">
      <Group title="Public records" items={summary.publicRecords} empty="No verified property facts yet."/>
      <Group title="Completed permits" items={summary.completedPermits} empty="No completed equipment work identified."/>
      <Group title="Photos" items={summary.photos} empty="No photo findings yet."/>
      <Group title="Best questions to answer" items={summary.questions} empty="No high-priority gaps remain."/>
    </div>
  </section>;
}
