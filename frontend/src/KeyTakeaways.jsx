import React from 'react';
import {ArrowRight,Zap,Droplets,HeartPulse,Shield} from 'lucide-react';
const pillars={energy:['Energy',Zap],water:['Water',Droplets],health:['Health',HeartPulse],resilience:['Resilience',Shield]};
export function AdviceStatus({advice}){
 if(advice.status==='error')return <div className="copyCard" role="alert"><p>Home-specific advice is unavailable right now. Your evaluation is still here.</p><button className="secondaryButton" onClick={advice.retry}>Retry advice</button></div>;
 if(advice.status==='loading')return <p role="status">Reviewing this home's recorded details…</p>;
 if(advice.status==='idle')return <p>Evaluate a home to see its specific next steps. You can browse the full catalog at any time.</p>;
 return null;
}
export default function KeyTakeaways({advice,result,onAction}){
 return <><AdviceStatus advice={advice}/>{advice.data?.takeaways.map(t=>{
  const [label,Icon]=pillars[t.pillar];
  return <section className="takeawaySection" key={t.pillar}>
   <header><h3><Icon size={22}/>{label}</h3><span>{result.scores[t.pillar]}/{t.max}</span></header>
   <small>{t.evidence}</small>
   <dl><dt>What was found</dt><dd>{t.finding}</dd><dt>Why it matters</dt><dd>{t.why}</dd><dt>Best next action</dt><dd>{t.action.text}</dd></dl>
   <button className="secondaryButton" onClick={()=>onAction(t)}>{t.action.destination==='details'?'Confirm home details':t.action.destination==='products'?`Explore ${label.toLowerCase()} options`:`Read ${label} Insights`}<ArrowRight size={18}/></button>
  </section>;
 })}</>;
}
