import React, { useRef, useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { extractUpload, extractDocumentUrl } from './api/client.js';
import { documentFields as fields, parseDocumentUrls, mergeDocumentFacts } from './documentSources.js';

export default function DocumentUpload({onApply}) {
  const [files,setFiles] = useState([]), [urls,setUrls] = useState('');
  const [busy,setBusy] = useState(false), [errors,setErrors] = useState([]);
  const [draft,setDraft] = useState(null), [selected,setSelected] = useState({});
  const [alternatives,setAlternatives] = useState({}), [progress,setProgress] = useState('');
  const [done,setDone] = useState(false);
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  function resetResults() {setDraft(null);setDone(false);setErrors([]);}
  function choose(next) {
    resetResults();
    const list = Array.from(next || []);
    if (list.length > 10) return setErrors(['Choose at most 10 files at a time.']);
    const invalid = list.filter(file=>! /\.(pdf|jpe?g|png|txt)$/i.test(file.name) || !file.size || file.size > 10*1024*1024);
    if (invalid.length) {setFiles([]);return setErrors(['Choose non-empty PDF, JPG, PNG, or TXT files, up to 10 MB each.']);}
    setFiles(list);
  }
  async function scan() {
    let links;
    try {links=parseDocumentUrls(urls);} catch(e) {setErrors([e.message]);return;}
    if (files.length+links.length>10) return setErrors(['Read at most 10 files and links together.']);
    if (!files.length && !links.length) return;
    resetResults();setBusy(true);
    const results=[], failures=[];
    const sources=[...files.map(file=>({name:file.name,read:()=>extractUpload(file)})),...links.map((url,i)=>({name:`Document link ${i+1}`,read:()=>extractDocumentUrl(url)}))];
    for (let i=0;i<sources.length;i++) {
      if (!mounted.current) return;
      setProgress(`Reading ${i+1} of ${sources.length}: ${sources[i].name}`);
      try {results.push(await sources[i].read());}
      catch(e) {failures.push(`${sources[i].name}: ${e.name==='TimeoutError'?'Reading timed out. Please retry.':e.message || 'Could not read this document.'}`);}
    }
    if (!mounted.current) return;
    const merged=mergeDocumentFacts(results);
    setDraft(results.length ? merged.facts : null);setSelected(merged.selected);setAlternatives(merged.alternatives);
    setErrors(failures);setBusy(false);setProgress('');
  }
  return <section className="documentUpload" aria-label="Upload documents or photos" style={{gridColumn:'1 / -1',width:'100%'}}>
    <div className="documentSuggestions"><h3>Which documents should you upload?</h3><ul>
      <li>Home inspection reports</li><li>Recent utility bills</li>
      <li>Photos of equipment labels</li><li>Upgrade invoices or permits</li>
    </ul></div>
    <label className="field fieldWide"><span><Upload size={18}/> Choose files from your device</span>
      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" disabled={busy} onChange={e=>{choose(e.target.files);e.target.value='';}}/>
    </label>
    {files.length>0 && <ul className="documentFileList">{files.map((file,i)=><li key={`${file.name}-${i}`}>{file.name}</li>)}</ul>}
    <label className="field fieldWide"><span>Or paste document links</span>
      <textarea rows={3} value={urls} disabled={busy} placeholder="https://example.com/report.pdf, https://example.com/invoice.pdf" onChange={e=>{setUrls(e.target.value);resetResults();}}/>
    </label>
    <p>Separate links with commas. Use direct, public HTTPS links to files, not pages that require a login.</p>
    <p>Up to 10 files or links per batch. PDF, JPG, PNG, or TXT; 10 MB per file and 30 pages per PDF.</p>
    <p>Photos and scanned PDFs are sent to Mistral for text reading when you select Read documents. Original files are not saved.</p>
    <button type="button" className="primaryButton" disabled={busy || (!files.length && !urls.trim())} onClick={scan}>{busy?'Reading documents...':'Read documents'}</button>
    {busy && <p role="status">{progress}</p>}
    {errors.length>0 && <div role="alert">{errors.map((error,i)=><p key={i}>{error}</p>)}</div>}
    {draft && <div>
      <h3>Review extracted details</h3>
      <p>{Object.keys(draft).length?'Only checked fields will replace the current home details. Conflicting values are unchecked until you choose what to use.':'No supported property details were found. You can enter them manually; nothing has changed.'}</p>
      {Object.entries(draft).map(([key,value])=><div key={key}>
        <label><input type="checkbox" checked={!!selected[key]} onChange={e=>setSelected({...selected,[key]:e.target.checked})}/> Apply {fields[key]}</label>
        <label className="field"><span>{fields[key]}</span><input value={value} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>
        {alternatives[key] && <p>Different values found: {alternatives[key].join(' / ')}. Enter the correct value above.</p>}
      </div>)}
      <button type="button" className="primaryButton" disabled={!Object.keys(draft).some(key=>selected[key] && draft[key].trim())} onClick={()=>{onApply(Object.fromEntries(Object.entries(draft).filter(([key,value])=>selected[key] && value.trim())));setDraft(null);setDone(true);}}>Apply reviewed details</button>
      <button type="button" className="secondaryButton" onClick={()=>setDraft(null)}>Discard extraction</button>
    </div>}
    {done && <p role="status">Reviewed details applied. Generate a new score when ready.</p>}
  </section>;
}
