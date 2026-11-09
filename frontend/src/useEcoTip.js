import {useEffect,useState} from 'react';
import {getEcoTips} from './api/client.js';
import {ecoTips} from './ecoTips.js';
import {eligibleTips,nextTip} from './ecoTipRotation.js';
let cache=null;let cachedAt=0;let memory={};
const storageKey='vpsf.ecoTipRotation.v1';
export function useEcoTip(visit,climate){
 const [tip,setTip]=useState(null);
 useEffect(()=>{
  if(visit<0)return;
  let current=true;
  (async()=>{
   if(!cache||Date.now()-cachedAt>300000){try{cache=await getEcoTips();cachedAt=Date.now();}catch{/* retain published feed, including intentional empty feed */}}
   if(!current)return;
   let saved=memory;try{saved=JSON.parse(sessionStorage.getItem(storageKey))||memory;}catch{}
   const feed=cache||{tips:ecoTips.map(t=>({...t,climateTags:[]})),revision:'fallback'};
   const eligible=eligibleTips(feed.tips,climate);
   const choice=nextTip(eligible,saved,feed.revision+':'+eligible.map(t=>t.id).join(','));
   memory=choice.state;try{sessionStorage.setItem(storageKey,JSON.stringify(memory));}catch{}
   setTip(choice.tip);
  })();return()=>{current=false;};
 // Only Menu entry advances the tip. Home edits are handled on the next entry.
 },[visit]);
 return tip;
}
