import React from 'react';
export function SponsoredLabel({product}){return product.isSponsored?<span className="sponsoredLabel">Premiere Partner{product.sponsorName?` · ${product.sponsorName}`:''}</span>:null;}
export function MatchExplanation({product, isDemo = false}){
 const m=product.match;if(!m)return null;
 return <div className="matchExplanation">{!isDemo && <strong>{m.group==='matched'?'Matched to recorded needs':'Needs verification'}</strong>}<p>{m.reasons.join(' ')}</p>{!isDemo&&m.verification.length>0&&<details><summary>Confirm before buying</summary><ul>{m.verification.map(v=><li key={v}>{v}</li>)}</ul></details>}</div>;
}
