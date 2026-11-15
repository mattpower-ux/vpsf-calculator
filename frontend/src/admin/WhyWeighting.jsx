import React, {useState} from 'react';
import {allocationShare,factorWeightSummary,rationaleFor} from './weightingRationale.js';
import './whyWeighting.css';

export default function WhyWeighting({model,published}) {
  const [factorId,setFactorId]=useState('noncombustible_siding');
  const factor=model.factors.find(item=>item.id===factorId) || model.factors[0];
  if (!factor) return null;
  const live=published.factors.find(item=>item.id===factor.id);
  const rationale=rationaleFor(factor);
  const share=allocationShare(factor,model.pillars[factor.pillar]);
  return <details className="whyWeighting" aria-label="Why this Weighting">
    <summary className="weightingTitle">Why this Weighting</summary>
    <p>Research can support the direction of a rule. The exact VPSF point allocation is a model-policy decision unless a calibration study establishes otherwise.</p>
    <label>Criterion<select value={factor.id} onChange={event=>setFactorId(event.target.value)}>{model.factors.map(item=><option key={item.id} value={item.id}>{item.label}{!item.active?' (retired)':''}</option>)}</select></label>
    <dl className="weightingFacts">
      <div><dt>Published rule</dt><dd>{factorWeightSummary(live)}</dd></div>
      <div><dt>Current draft rule</dt><dd>{factorWeightSummary(factor)}</dd></div>
      <div><dt>Condition</dt><dd>{factor.field} · {factor.mode}{factor.matches?.length ? ` · ${factor.matches.join(', ')}` : ''}{factor.lower!=null ? ` · minimum ${factor.lower}`:''}{factor.upper!=null ? ` · maximum ${factor.upper}`:''}</dd></div>
      <div><dt>Budget context</dt><dd>{model.pillars[factor.pillar]}-point pillar ceiling{share!=null ? `; this rule represents ${share}% of that budget before caps and overlapping credits.`:'.'} This is not a percentage reduction in physical risk.</dd></div>
    </dl>
    <h3>What this criterion represents</h3><p>{rationale.purpose}</p>
    <h3>Why this many points?</h3><p>{rationale.tradeoff}</p>
    {rationale.siding && <SidingEvidence model={model}/>}
    <details><summary>How to review a weight responsibly</summary><ul>
      <li>Distinguish tested material properties from whole-home survival and installation quality.</li>
      <li>Compare the allocation with other measures and check whether certification already credits them.</li>
      <li>Preview changes across representative homes and hazard regions, not only the demonstration home.</li>
      <li>Keep sponsor priority separate from scoring. A material rule must apply equally to qualifying products.</li>
    </ul><p>This panel explains rules; it does not change or publish their weights. Use the existing draft and publication controls after reviewing the evidence.</p></details>
  </details>;
}

function SidingEvidence({model}) {
  const mitigation=model.factors.filter(factor=>factor.field==='wildfireMitigation' && factor.active);
  return <div className="sidingEvidence"><h3>Can research tell us how many homes siding would save?</h3><p>A reliable siding-only percentage has not been established in the evidence reviewed here. Noncombustible cladding addresses one ignition pathway; a destroyed-home count cannot be converted into “homes saved” by simply multiplying it by the siding weight.</p>
    <ul className="weightingEvidenceList">
      <li><strong>41,717 structures; association, not a causal estimate.</strong> Syphard and Keeley’s 2019 study of California fires reported a statewide destruction relative risk of 1.05 for combustible versus resistant siding. Enclosed eaves, screened vents, and multipane windows were generally more consistent predictors. The siding categories were broad and the sample had limitations; this does not mean replacing siding would save 5% of destroyed homes. <a href="https://www.mdpi.com/2571-6255/2/3/49" target="_blank" rel="noopener noreferrer">Read the study and Table 2</a>.</li>
      <li><strong>54% versus 36% avoiding damage—for a package of features.</strong> IBHS’s 2025 Los Angeles fire findings compared homes with all four features (Class A roof, noncombustible siding, double-pane windows, and enclosed eaves) with homes having one feature. The 18-percentage-point difference concerns avoiding damage, not a siding-only survival benefit. These figures come from IBHS’s published findings announcement. <a href="https://ibhs.org/ibhs-news-releases/ibhs-findings-on-la-countys-palisades-and-eaton-fires/" target="_blank" rel="noopener noreferrer">Read the IBHS findings</a>.</li>
      <li><strong>Noncombustible siding does not make the wall behind it noncombustible.</strong> Gorham, Willi, and Horn’s 2025 full-scale experiments found ignition of combustible siding at tested separations of 3.0 and 4.3 meters, and ignition of combustible sheathing behind fiber cement at 1.8 meters. These are experimental conditions, not universal safe distances. <a href="https://onlinelibrary.wiley.com/doi/10.1002/fam.3278" target="_blank" rel="noopener noreferrer">Read the wall-assembly experiments</a>.</li>
    </ul>
    <h3>Calibration question for VPSF</h3>
    <p>The research does not establish that siding should receive three times the original 10-point allocation for combined ember hardening and defensible space. Review these weights together instead of using the research to justify a number chosen in advance.</p>
    {mitigation.map(factor=><p key={factor.id}><strong>Current draft — {factor.label}:</strong> {factorWeightSummary(factor)}</p>)}
    <p><small>Evidence review: November 15, 2026. Evidence supports the protection mechanism; the exact VPSF allocation has not been statistically calibrated. No scoring weights were changed by adding this explanation.</small></p>
  </div>;
}
