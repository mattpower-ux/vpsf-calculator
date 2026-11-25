import React, { useEffect, useState, useId } from 'react';
import { isPresentationAddress } from './presentationHome.js';
import { getPropertyPhoto } from './api/client.js';
import demoExterior from './assets/demo-california-exterior.png';
import './addressPhoto.css';
import ExteriorPhotoDialog from './ExteriorPhotoDialog.jsx';
import { analysisLevelLabel } from './analysisLevels.js';
import { analysisEntryReducer, analysisLevelDetails } from './analysisEntryFlow.js';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function AddressPhoto({ address, searchRequest, flow, onFlowAction, onChooseLevel, busy = false }) {
  const filterId = useId().replace(/:/g, "");
  const [editing,setEditing] = useState(false);
  const [remote, setRemote] = useState(null), [local, setLocal] = useState(null);
  const [error, setError] = useState('');
  const demo = isPresentationAddress(address);
  useEffect(() => {
    setRemote(null); setError(''); setEditing(false);
  }, [address, demo]);
  useEffect(() => {
    if (demo || !searchRequest?.id || searchRequest.address.trim().length < 5) return;
    const controller = new AbortController();
    const target = searchRequest.address.trim();
    setRemote({ address: target, status:'loading' });
    getPropertyPhoto(searchRequest.address.trim(), controller.signal).then(result => setRemote({ ...result, address: target }))
      .catch(err => { if (err.name !== 'AbortError') setRemote({ address: target, status:'unavailable' }); });
    return () => controller.abort();
  }, [searchRequest, demo]);
  useEffect(() => () => { if (local?.image) URL.revokeObjectURL(local.image); }, [local]);
  const imported = local?.address === address ? local : null;
  const found = remote?.address === address.trim() ? remote : null;
  const image = imported?.image || (demo ? demoExterior : found?.image);
  const canSketch = Boolean(imported || demo || found?.derivativesAllowed);
  const options = [['broad',analysisLevelLabel('broad'),'Quick Score from Public Records'],['moderate',analysisLevelLabel('moderate'),'Critical Systems Confirmed'],['inclusive',analysisLevelLabel('inclusive'),'Fully Documented Features']];
  const selected = options.find(([level]) => level === flow.expanded);
  const imageFailed = () => { setRemote(null); setLocal(null); setError('This photo could not be displayed. Please choose another.'); };
  const confirmLevel = level => {
    const next = analysisEntryReducer(flow, {type:'confirm-level', level});
    if (next.confirmed === level) onChooseLevel(level);
  };
  return <section className="addressPhoto analysisChoices" aria-label={flow.page === 'depth' ? 'Depth of Scoring Desired' : 'Start the Calculation'} aria-busy={busy}>
    <svg width="0" height="0" aria-hidden="true" className="sketchFilters"><defs>
      <filter id={`${filterId}-line`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0"/>
        <feGaussianBlur stdDeviation="0.6"/>
        <feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true"/>
        <feComponentTransfer><feFuncR type="linear" slope="-3" intercept="1"/><feFuncG type="linear" slope="-3" intercept="1"/><feFuncB type="linear" slope="-3" intercept="1"/></feComponentTransfer>
      </filter>
      <filter id={`${filterId}-shade`} colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="0.45"/><feColorMatrix type="saturate" values="0.12"/>
        <feComponentTransfer><feFuncR type="discrete" tableValues=".15 .3 .5 .7 .85 .98"/><feFuncG type="discrete" tableValues=".2 .38 .56 .74 .89 .99"/><feFuncB type="discrete" tableValues=".22 .4 .58 .76 .9 1"/></feComponentTransfer>
      </filter>
    </defs></svg>
    {flow.page === 'address' ? <>
      {image && <figure className="mainExteriorPhoto"><img referrerPolicy="no-referrer" src={image} alt={`Exterior of ${address}`} onError={imageFailed}/></figure>}
      {image && !demo && !imported && <p className="photoAttribution">
        {found?.sourceUrl
          ? <a href={found.sourceUrl} target="_blank" rel="noopener noreferrer">{found?.attribution || 'Property photo source'}</a>
          : (found?.attribution || 'Google Street View')}
        {found?.date ? ` · ${found.date}` : ''}
      </p>}
      {found?.status === 'loading' && <p className="photoSearchStatus" role="status">Searching for an exterior photo…</p>}
      {found && ['unavailable','not_configured'].includes(found.status) && <p className="photoSearchStatus">No exterior photo was found. You can upload one below or continue without it.</p>}
      <button type="button" className="addressPhotoUpload" disabled={busy} onClick={() => setEditing(true)}>{image ? 'Change exterior photo' : 'Upload exterior photo'}</button>
      {!image && !busy && <p className="photoAvailability">You can continue without an exterior photo.</p>}
      <button type="button" className="primaryButton addressPhotoStart" disabled={busy || address.trim().length < 5} onClick={() => onFlowAction({type:'open-depth'})}>Start the Calculation! <ArrowRight size={18}/></button>
    </> : <>
      <header className="analysisDepthHeader">
        <button type="button" className="analysisDepthBack" onClick={() => onFlowAction({type:'back'})}><ArrowLeft size={18}/> Back</button>
        <h2>Depth of Scoring Desired</h2>
        <p>Choose a level to see what your calculation will include.</p>
      </header>
      <div className="analysisChoiceGrid">{options.map(([level,label,caption],index) => <button key={level} className={`analysisChoice ${flow.expanded === level ? 'selected' : ''}`} type="button" disabled={busy} onClick={() => onFlowAction({type:'toggle-level', level})} aria-expanded={flow.expanded === level} aria-controls={`analysis-${level}-details`} aria-label={`${label}: ${caption}`}>
        <span className="analysisChoiceImage">
          <span className="analysisChoiceNumber" aria-hidden="true">{index + 1}</span>
          {image && (canSketch || level === 'inclusive') ? <img referrerPolicy="no-referrer" src={image} alt={`${level === 'broad' ? 'Line drawing' : level === 'moderate' ? 'Shaded view' : 'Exterior photo'} of ${address}`} style={{filter:level === 'broad' ? `url(#${filterId}-line)` : level === 'moderate' ? `url(#${filterId}-shade)` : undefined}} onError={imageFailed}/> : <span className="analysisPhotoMissing">{found?.status === 'loading' ? 'Finding photo…' : image ? 'Upload photo for sketch' : 'Exterior photo unavailable'}</span>}
        </span>
        <strong>{label.replace(/^\d+\.\s*/, "")}</strong><small>{caption}</small>
      </button>)}</div>
      {selected && <section className="analysisLevelResult" id={`analysis-${selected[0]}-details`} aria-live="polite">
        <h3>{selected[1]}</h3>
        <p>{analysisLevelDetails[selected[0]].summary}</p>
        <ul>{analysisLevelDetails[selected[0]].results.map(result => <li key={result}>{result}</li>)}</ul>
        <button type="button" className="primaryButton" disabled={busy} onClick={() => confirmLevel(selected[0])}>{busy ? 'Loading…' : 'DO IT!'} <ArrowRight size={18}/></button>
      </section>}
      {busy && <p role="status">Loading the available property information…</p>}
    </>}
    {editing && <ExteriorPhotoDialog onClose={()=>setEditing(false)} onUse={image=>{setError('');setLocal({address,image});setEditing(false);}}/>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
