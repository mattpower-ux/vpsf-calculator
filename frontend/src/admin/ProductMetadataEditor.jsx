import React,{useState} from 'react';
import {saveProductMetadata} from '../api/client';
import './editor.css';
const tags=['heating','water-heating','irrigation','leaks','fixtures','rainwater','ventilation','roofing','fire-resistant-siding'];
const requirements=['hydronic','gas','irrigation','space-and-electrical','ventilation-design','roof-design','reuse-code','fixture-fit','siding-assembly'];
const pillars=['energy','water','health','resilience','carbon','financial','community'];
export default function ProductMetadataEditor({products,setProducts,token}){
 const [id,setId]=useState(''),[draft,setDraft]=useState(null),[revision,setRevision]=useState(0),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
 function choose(id){if(dirty&&!window.confirm('Discard unsaved product edits?'))return;const p=products.find(x=>x.id===id);setId(id);setDraft(p?{needTags:p.needTags||[],requirements:p.requirements||[],pillars:p.pillars||[],verificationNotes:p.verificationNotes||'',sourceUrl:p.sourceUrl||'',reviewedAt:p.reviewedAt||'',isSponsored:!!p.isSponsored,sponsorName:p.sponsorName||''}:null);setRevision(p?.metadataRevision||0);setDirty(false);setStatus('');}
 const edit=(key,value)=>{setDraft(d=>({...d,[key]:value}));setDirty(true);};
 async function save(e){e.preventDefault();setBusy(true);setStatus('');try{const p=await saveProductMetadata(token,id,draft,revision);setProducts(current=>current.map(x=>x.id===p.id?{...x,...p}:x));setRevision(p.metadataRevision);setDirty(false);setStatus('Matching metadata saved. New advice requests use these settings.');}catch(e){setStatus(e.message);}finally{setBusy(false);}}
 return <section className="contentEditor"><h2>Matching and sponsorship</h2><p>Priority controls only break ties in relevance. Sponsored labels require an explicit designation and do not change a home's score. Review legacy sponsorship status before assigning a sponsor.</p>
 <label>Product<select value={id} onChange={e=>choose(e.target.value)} disabled={busy}><option value="">Choose a product</option>{products.map(p=><option key={p.id} value={p.id}>{p.brand} {p.product}</option>)}</select></label>
 {draft&&<form onSubmit={save}>
 {[['needTags','Relevant needs',tags],['requirements','Compatibility checks',requirements],['pillars','Pillars',pillars]].map(([key,label,options])=><fieldset key={key}><legend>{label}</legend><div className="editorChecks">{options.map(v=><label key={v}><input type="checkbox" checked={draft[key].includes(v)} onChange={e=>edit(key,e.target.checked?[...draft[key],v]:draft[key].filter(x=>x!==v))}/>{v.replaceAll('-',' ')}</label>)}</div></fieldset>)}
 <label>Verification notes<textarea rows={3} value={draft.verificationNotes} onChange={e=>edit('verificationNotes',e.target.value)}/></label>
 <label>Technical source URL<input type="url" value={draft.sourceUrl} onChange={e=>edit('sourceUrl',e.target.value)}/></label>
 <label>Specifications reviewed<input type="date" value={draft.reviewedAt} onChange={e=>edit('reviewedAt',e.target.value)}/></label>
 <label className="editorCheck"><input type="checkbox" checked={draft.isSponsored} onChange={e=>edit('isSponsored',e.target.checked)}/>Sponsored placement</label>
 <label>Sponsor name<input value={draft.sponsorName} required={draft.isSponsored} onChange={e=>edit('sponsorName',e.target.value)}/></label>
 <button disabled={busy||!dirty} type="submit">Save product metadata</button></form>}<p role="status">{status}</p></section>;
}
