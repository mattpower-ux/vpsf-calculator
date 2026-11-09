import React from 'react';
import sprinkler from './assets/eco-tip-sprinkler.jpg';
import heater from './assets/products/rheem-proterra.jpg';
import roof from './assets/Certainteed-Solaris.jpg';
export default function EcoTipCard({tip}){
 if(!tip)return null;
 const legacy={sprinkler,'water-heater':heater,'cool-roof':roof};
 const image=legacy[tip.image]||(tip.image?.startsWith('https://')?tip.image:`/eco-tips/${tip.image||'water'}.svg`);
 return <aside className="ecoTip" aria-label="Eco tip"><img key={image} className="ecoTipImage" src={image} alt={tip.alt} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/eco-tips/water.svg';}}/>
 <div className="ecoTipCopy"><h3>ECO-TIP <span>Did you know?</span></h3><p>{tip.text}</p><a href={tip.source} target="_blank" rel="noopener noreferrer">Source: {tip.sourceLabel}</a>{tip.imageCredit&&<details><summary>Image credit</summary>{tip.imageCredit}</details>}</div></aside>;
}
