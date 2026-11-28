import React from 'react';
import { ArrowRight } from 'lucide-react';
import { AnalysisEvidence } from './AnalysisFlow.jsx';
import { AnalysisDraft } from './AnalysisDraft.jsx';
import { assessmentCompleteness, evidenceGroups } from './analysisCompleteness.js';

const factText = value => value && typeof value === 'object' ? (value.level || (value.value != null ? `${value.value} / 20` : 'Not available')) : value;
const isRegional = key => ['wildfire','epaWalkability'].includes(key);
export function CompletenessSummary({home,expanded=false}) {
  const data=assessmentCompleteness(home);
  return <section className="completenessSummary" aria-label="Assessment completeness"><h3>Assessment completeness</h3>
    <p>{data.documented + data.reported} of {data.total} key details supported by records or homeowner answers.</p>
    <dl className="completenessCounts"><div><dt>Documented</dt><dd>{data.documented}</dd></div><div><dt>Homeowner-reported</dt><dd>{data.reported}</dd></div><div><dt>Needs review</dt><dd>{data.review}</dd></div><div><dt>Unanswered</dt><dd>{data.unanswered}</dd></div></dl>
    <p className="completenessNote">Completeness is separate from your VPSF score. More detail can raise or lower the score; choosing Superior adds no points.</p>
    {expanded && <details><summary>Supporting findings and next steps</summary>{data.groups.map(group=><section className="evidenceFinding" key={group.name}><h4>{group.name}</h4><ul>{group.fields.filter(f=>f.status !== 'unanswered').map(f=><li key={f.key}><strong>{f.label}:</strong> {factText(home[f.key])} <small>({{reported:'homeowner-reported',documented:'recorded evidence',review:'needs review'}[f.status]})</small></li>)}</ul><p>Useful evidence: {group.description}</p></section>)}</details>}
  </section>;
}
export function RegionalWildfireEvidence({home}) {
  const value=factText(home?.wildfire) || 'Unavailable';
  return <section className="regionalWildfireSummary" aria-label="Regional wildfire evidence">
    <h3>Regional wildfire evidence</h3><p>{value}</p><small>Location data</small>
  </section>;
}
export function InclusiveEvidence({home,update,Field,options,onEvidence,onListingSelect,onContinue}) {
  const completeness=assessmentCompleteness(home);
  return <div className="screen formScreen depthReview"><h2>Document Your Home</h2>
    <p className="subhead">Build a fuller picture across all seven pillars. Add records, review photo findings, and fill the remaining gaps. You can save a draft and return later.</p>
    <CompletenessSummary home={home}/>
    <AnalysisEvidence home={home} onApply={onEvidence} onListingSelect={onListingSelect}/>
    <div className="evidenceChecklist">{evidenceGroups.map(group=>{
      const stats=completeness.groups.find(item=>item.id===group.id);
      const unanswered=stats.fields.filter(f=>f.status==='unanswered');
      const review=stats.fields.filter(f=>f.status==='review');
      return <details key={group.name}><summary>{group.name}<span>{unanswered.length} unanswered · {review.length} to review</span></summary>
        <p><strong>Helpful evidence:</strong> {group.description}</p>
        {unanswered.length>0 && <p><strong>Next:</strong> Find or confirm {unanswered.slice(0,3).map(f=>f.label.toLowerCase()).join(', ')}.</p>}
        {review.length>0 && <p>Check {review.map(f=>f.label.toLowerCase()).join(', ')} against labels, records, or your knowledge of the home.</p>}
        <div className="evidenceFieldGrid">{group.fields.map(f=><React.Fragment key={f.key}>{isRegional(f.key) ? <p><strong>{f.label}:</strong> {factText(home[f.key]) || "Unavailable"} (location data)</p> : <Field label={f.label} help={f.help} value={home[f.key] ?? ''} onChange={value=>update(f.key,value)} options={options[f.key]}/>}</React.Fragment>)}</div>
        {group.id==='carbon' && <details className="documentationNote"><summary>What documentation counts?</summary><p>Environmental Product Declarations (EPDs), material specifications, invoices, and builder records can document lower-carbon choices. A whole-building carbon comparison may also use a recognized benchmark, such as one from the Carbon Leadership Forum (CLF).</p></details>}
      </details>;
    })}</div>
    <AnalysisDraft home={home}/>
    <button className="primaryButton" onClick={onContinue}>Continue to Full Review <ArrowRight size={18}/></button>
    <p className="completenessNote">You can continue with unanswered items. Resolve conflicting document readings before applying them; photo estimates still need your review.</p>
  </div>;
}
