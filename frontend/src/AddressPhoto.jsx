import React, { useEffect, useRef, useState, useId } from 'react';
import { isPresentationAddress } from './presentationHome.js';
import { getPropertyPhoto } from './api/client.js';
import demoExterior from './assets/demo-california-exterior.png';
import './addressPhoto.css';
import { analysisLevelLabel } from './analysisLevels.js';

export default function AddressPhoto({ address, onChooseLevel, busy = false }) {
  const filterId = useId().replace(/:/g, "");
  const picker = useRef(null);
  const [remote, setRemote] = useState(null), [local, setLocal] = useState(null);
  const [error, setError] = useState('');
  const demo = isPresentationAddress(address);
  useEffect(() => {
    setRemote(null); setError('');
    if (demo || address.trim().length < 10) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRemote({ address, status:'loading' });
      getPropertyPhoto(address, controller.signal).then(result => setRemote({ ...result, address }))
        .catch(err => { if (err.name !== 'AbortError') setRemote({ address, status:'unavailable' }); });
    }, 900);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [address, demo]);
  useEffect(() => () => { if (local?.image) URL.revokeObjectURL(local.image); }, [local]);
  const imported = local?.address === address ? local : null;
  const found = remote?.address === address ? remote : null;
  const image = imported?.image || (demo ? demoExterior : found?.image);
  const canSketch = Boolean(imported || demo || found?.derivativesAllowed);
  const options = [['broad',analysisLevelLabel('broad'),'Public records'],['moderate',analysisLevelLabel('moderate'),'Confirm key features'],['inclusive',analysisLevelLabel('inclusive'),'Document your home']];
  const imageFailed = () => { setRemote(null); setLocal(null); setError('This photo could not be displayed. Please choose another.'); };
  return <section className="addressPhoto analysisChoices" aria-label="Level of Analysis Desired" aria-busy={busy}>
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
    {image && <figure className="mainExteriorPhoto"><img src={image} alt={`Exterior of ${address}`} onError={imageFailed}/></figure>}
    <h2>Level of Analysis Desired</h2>
    <div className="analysisChoiceGrid">{options.map(([level,label,caption]) => <button key={level} className="analysisChoice" type="button" disabled={busy || address.trim().length < 5} onClick={() => onChooseLevel(level)} aria-label={`${label}: ${caption}`}>
      <span className="analysisChoiceImage">
        {image && (canSketch || level === 'inclusive') ? <img src={image} alt={`${level === 'broad' ? 'Line drawing' : level === 'moderate' ? 'Shaded view' : 'Exterior photo'} of ${address}`} style={{filter:level === 'broad' ? `url(#${filterId}-line)` : level === 'moderate' ? `url(#${filterId}-shade)` : undefined}} onError={imageFailed}/> : <span className="analysisPhotoMissing">{found?.status === 'loading' ? 'Finding photo…' : image ? 'Upload photo for sketch' : 'Exterior photo unavailable'}</span>}
      </span>
      <strong>{label}</strong><small>{caption}</small>
    </button>)}</div>
    {busy && <p role="status">Loading the available property information…</p>}
    {image && !demo && !imported && <p className="photoAttribution">{found?.attribution || 'Google Street View'}{found?.date ? ` · ${found.date}` : ''}</p>}
    <button type="button" className="addressPhotoUpload" disabled={busy} onClick={() => picker.current.click()}>{image ? 'Change exterior photo' : 'Upload exterior photo'}</button>
    {!image && !busy && <p className="photoAvailability">You can choose an analysis level without a photo.</p>}
    <input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) { setError('Choose a JPG, PNG, or WebP photo under 10 MB.'); return; }
      setError(''); setLocal({ address, image:URL.createObjectURL(file) });
    }}/>
    {error && <p role="alert">{error}</p>}
  </section>;
}
