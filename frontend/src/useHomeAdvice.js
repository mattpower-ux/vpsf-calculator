import {useEffect,useState} from 'react';
import {getHomeAdvice} from './api/client.js';
import {adviceKey} from './homeAdvice.js';
export function useHomeAdvice(home,modelVersion,enabled){
 const key=adviceKey(home,modelVersion);
 const [state,setState]=useState({key:null,data:null,status:'idle'});
 const [attempt,retry]=useState(0);
 useEffect(()=>{
  if(!enabled)return;
  let current=true;const controller=new AbortController();
  setState({key,data:null,status:'loading'});
  getHomeAdvice(home,modelVersion,controller.signal).then(data=>{if(current)setState({key,data,status:'ready'});}).catch(e=>{if(current&&e.name!=='AbortError')setState({key,data:null,status:'error'});});
  return()=>{current=false;controller.abort();};
 },[key,enabled,attempt]);
 return {...(enabled&&state.key===key?state:{data:null,status:enabled?'loading':'idle'}),retry:()=>retry(n=>n+1)};
}
