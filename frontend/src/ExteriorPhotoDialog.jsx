import React, {useEffect, useRef, useState} from 'react';
import {Upload} from 'lucide-react';
import CaptureDialog from './CaptureDialog.jsx';

export default function ExteriorPhotoDialog({onClose,onUse}) {
  const picker=useRef(null);
  const [url,setUrl]=useState('');
  const [candidate,setCandidate]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const transferred=useRef(null);
  useEffect(()=>()=>{if(candidate?.image.startsWith('blob:') && transferred.current!==candidate.image) URL.revokeObjectURL(candidate.image);},[candidate]);
  useEffect(()=>{
    if(!candidate || loaded) return;
    const timer=setTimeout(()=>{setError('This photo is taking too long to load. Try another link or upload the photo.');setCandidate(null);},15000);
    return ()=>clearTimeout(timer);
  },[candidate,loaded]);
  const preview=image=>{setError('');setLoaded(false);setCandidate({image});};
  function choose(event) {
    const file=event.target.files?.[0]; event.target.value='';
    if(!file) return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size>10*1024*1024) {setError('Choose a JPG, PNG, or WebP photo up to 10 MB.');return;}
    preview(URL.createObjectURL(file));
  }
  function previewUrl(event) {
    event.preventDefault();
    try {
      const value=new URL(url.trim());
      if(value.protocol!=='https:' || value.username || value.password) throw new Error();
      preview(value.href);
    } catch {setError('Enter a complete HTTPS link to an image, such as https://example.com/home.jpg.');}
  }
  return <CaptureDialog title="Change exterior photo" onClose={onClose}>
    <div className="exteriorPhotoForm">
      <button type="button" className="secondaryButton" onClick={()=>picker.current.click()}><Upload size={20}/> Upload from phone or device</button>
      <input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={choose}/>
      <p className="photoHelp">Choose a photo from your library or files. JPG, PNG, or WebP, up to 10 MB.</p>
      <form onSubmit={previewUrl}>
        <label className="field"><span>Or enter an online photo URL</span><input type="url" inputMode="url" autoComplete="off" value={url} placeholder="https://example.com/home.jpg" onChange={e=>setUrl(e.target.value)} required/></label>
        <p className="photoHelp">Use a direct image link, not a listing or webpage link.</p>
        <button type="submit" className="secondaryButton">Preview photo</button>
      </form>
      {candidate && <figure className="exteriorPhotoPreview"><img key={candidate.image} src={candidate.image} referrerPolicy="no-referrer" alt="New exterior photo preview" onLoad={()=>setLoaded(true)} onError={()=>{setCandidate(null);setLoaded(false);setError('We could not load this photo. Check the direct image link or upload it from your device.');}}/>{!loaded && <figcaption role="status">Loading photo…</figcaption>}</figure>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="primaryButton" disabled={!candidate || !loaded} onClick={()=>{transferred.current=candidate.image;onUse(candidate.image);}}>Use this photo</button>
      <button type="button" className="secondaryButton" onClick={onClose}>Cancel</button>
    </div>
  </CaptureDialog>;
}
