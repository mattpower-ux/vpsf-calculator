import React from 'react';
export function SponsoredLabel({product}){return product.isSponsored?<span className="sponsoredLabel">Sponsored{product.sponsorName?` · ${product.sponsorName}`:''}</span>:null;}
export function MatchExplanation({product}){
 const m=product.match;if(!m)return null;
 return <div className="matchExplanation"><strong>{m.group==='matched'?'Matched to recorded needs':'Needs verification'}</strong><p>{m.reasons.join(' ')}</p>{m.verification.length>0&&<details><summary>Confirm before buying</summary><ul>{m.verification.map(v=><li key={v}>{v}</li>)}</ul></details>}</div>;
}
