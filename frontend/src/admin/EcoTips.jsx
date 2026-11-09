import React,{useEffect,useState} from 'react';
import {getAdminEcoTips,saveAdminEcoTip,publishAdminEcoTip} from '../api/client';
import EcoTipCard from '../EcoTipCard';
import './editor.css';
const pillars=['energy','water','health','resilience','carbon','financial','community'];
const blank=()=>({id:'tip-'+Date.now(),pillar:'energy',text:'',image:'energy',alt:'',source:'',sourceLabel:'',reviewedAt:new Date().toISOString().slice(0,10),imageCredit:'Original VPSF vector illustration',climateTags:[],order:100});
export default function EcoTips({token}){
 const [climateText,setClimateText]=useState('');
 const [records,setRecords]=useState([]),[selected,setSelected]=useState(null),[draft,setDraft]=useState(blank),[revision,setRevision]=useState(0),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[phone,setPhone]=useState(true),[dirty,setDirty]=useState(false);
 const load=()=>getAdminEcoTips(token).then(setRecords).catch(e=>setStatus(e.message));
 useEffect(()=>{load();},[token]);
 function choose(r){if(dirty&&!window.confirm('Discard unsaved tip edits?'))return;setSelected(r);setClimateText((r?.draft.climateTags||[]).join(","));setDraft(r?r.draft:blank());setRevision(r?.revision||0);setDirty(false);setStatus('');}
 const edit=(key,value)=>{setDraft(d=>({...d,[key]:value}));setDirty(true);};
 async function save(){setBusy(true);setStatus('');try{const r=await saveAdminEcoTip(token,draft.id,draft,revision);setSelected(r);setRevision(r.revision);setDirty(false);await load();setStatus('Draft saved. Publish when ready.');}catch(e){setStatus(e.message);}finally{setBusy(false);}}
 async function action(name,version){setBusy(true);setStatus('');try{const r=await publishAdminEcoTip(token,draft.id,name,revision,version);setSelected(r);setRevision(r.revision);setDraft(r.draft);setClimateText(r.draft.climateTags.join(","));setDirty(false);await load();setStatus(name==='retire'?'Tip retired. The public feed refreshes within five minutes.':'Published. The public feed refreshes within five minutes.');}catch(e){setStatus(e.message);}finally{setBusy(false);}}
 return <section className="contentEditor"><header><h2>Eco-Tip library</h2><p>Draft, preview and publish short, sourced guidance. {records.filter(r=>r.published).length} tips currently published.</p><button onClick={()=>choose(null)} disabled={busy}>Create tip</button><button onClick={load} disabled={busy}>Reload library</button></header>
 <div className="editorColumns"><nav aria-label="Eco-Tip library">{records.map(r=><button key={r.id} aria-current={selected?.id===r.id?'true':undefined} onClick={()=>choose(r)} disabled={busy}><strong>{r.draft.id.replaceAll('-',' ')}</strong><small>{r.draft.pillar} · {r.published?'Published':'Draft / retired'}</small></button>)}</nav>
 <div><form onSubmit={e=>{e.preventDefault();save();}}>
 <label>Tip ID<input value={draft.id} disabled={revision>0} onChange={e=>edit('id',e.target.value)} pattern="[a-z0-9][a-z0-9-]+" required/></label>
 <label>Pillar<select value={draft.pillar} onChange={e=>edit('pillar',e.target.value)}>{pillars.map(p=><option key={p}>{p}</option>)}</select></label>
 <label>Tip text (25–55 words when published)<textarea rows={5} value={draft.text} maxLength={650} onChange={e=>edit('text',e.target.value)}/></label><small>{draft.text.trim().split(/\s+/).filter(Boolean).length} words</small>
 <label>Illustration<select value={pillars.includes(draft.image)?draft.image:'custom'} onChange={e=>edit('image',e.target.value==='custom'?'https://':e.target.value)}>{pillars.map(p=><option key={p}>{p}</option>)}<option value="custom">Custom HTTPS image</option></select></label>
 {!pillars.includes(draft.image)&&<label>Image URL<input value={draft.image} onChange={e=>edit('image',e.target.value)}/></label>}
 {[['alt','Image alternative text'],['imageCredit','Image credit / permission'],['sourceLabel','Source title'],['source','Source HTTPS URL']].map(([key,label])=><label key={key}>{label}<input value={draft[key]} onChange={e=>edit(key,e.target.value)}/></label>)}
 <label>Source reviewed<input type="date" value={draft.reviewedAt} onChange={e=>edit('reviewedAt',e.target.value)}/></label>
 <label>Climate zones (optional, comma-separated)<input value={climateText} onChange={e=>{setClimateText(e.target.value);edit('climateTags',e.target.value.split(',').map(v=>v.trim()).filter(Boolean));}}/></label>
 <label>Editorial order<input type="number" min="0" max="10000" value={draft.order} onChange={e=>edit('order',Number(e.target.value))}/></label>
 <div className="editorActions"><button disabled={busy} type="submit">Save draft</button><button disabled={busy||dirty||!revision} type="button" onClick={()=>action('publish')}>Publish draft</button><button disabled={busy||dirty||!selected?.published} type="button" onClick={()=>action('retire')}>Retire</button></div>
 </form><p role="status">{status}</p>
 {selected?.history?.length>0&&<details><summary>Published versions</summary>{[...selected.history].reverse().map(v=><p key={v.version}>Version {v.version} · {new Date(v.at).toLocaleDateString()} <button disabled={busy||dirty} onClick={()=>action('restore',v.version)}>Restore version {v.version}</button></p>)}</details>}
 <div className="editorPreview"><h3>Preview</h3><div className="editorActions"><button onClick={()=>setPhone(true)} aria-pressed={phone}>Phone</button><button onClick={()=>setPhone(false)} aria-pressed={!phone}>Laptop</button></div><div className="tipPreview" style={{maxWidth:phone?350:540}}><EcoTipCard tip={draft}/></div></div>
 </div></div></section>;
}
