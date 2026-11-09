export const eligibleTips=(tips,climate)=>tips.filter(t=>!t.climateTags?.length||(climate&&t.climateTags.includes(climate.split(' ')[0])));
export function nextTip(tips,state={},revision='',random=Math.random){
 if(!tips.length)return {tip:null,state:{bag:[],last:state.last,revision}};
 const ids=tips.map(t=>t.id);
 let bag=state.revision===revision?(state.bag||[]).filter(id=>ids.includes(id)):[];
 if(!bag.length){
  bag=[...ids];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
  if(bag.length>1&&bag[0]===state.last)[bag[0],bag[1]]=[bag[1],bag[0]];
 }
 const id=bag.shift();
 return {tip:tips.find(t=>t.id===id),state:{bag,last:id,revision}};
}
