import React, { useEffect, useRef, useState } from 'react';
import { STEPS, MAX_PHOTOS, MAX_IMAGE_BYTES, extractVideoFrames, analyzeWalkImages, imageBatches } from './guidedHomeWalk.js';
import './GuidedHomeWalk.css';
import { Camera, X, RotateCcw } from 'lucide-react';
import cognitionIcon from './assets/cognition-icon.png';
import {preparePhotoReview} from './photoReview.js';
import kitchenPhoto from './assets/demo-walk/kitchen.png';
import roofPhoto from './assets/demo-walk/roof.png';
import sidingPhoto from './assets/demo-walk/siding.png';
import landscapingPhoto from './assets/demo-walk/landscaping.png';
import bathPhoto from './assets/demo-walk/bath.png';
import hvacPhoto from './assets/demo-walk/hvac.png';
const SHORT_PROMPTS = {
  kitchen:'Photograph appliances and readable model labels.',
  roof:'Photograph roof covering and solar panels from the ground. Do not climb.',
  siding:'Take a wall view and a close-up of the siding.',
  landscaping:'Show planting beds, irrigation and areas beside the house.',
  bath:'Show faucets, toilets and readable brand or water-use labels.',
  hvac:'Show the equipment and nameplate. Leave covers closed.',
  flooring:'Show flooring and any installation records that establish its age.',
  windows:'Show windows and readable glazing or performance labels.',
};
const DEMO_IMAGES = [['kitchen',kitchenPhoto],['roof',roofPhoto],['siding',sidingPhoto],['landscaping',landscapingPhoto],['bath',bathPhoto],['hvac',hvacPhoto]];

export default function GuidedHomeWalk({ onApply, demo = false }) {
  const [step, setStep] = useState(0);
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const photoInput = useRef(null);
  const retake = useRef(null);
  const operation = useRef(null);
  const imageRef = useRef([]);
  const mounted = useRef(true);
  const [topic] = STEPS[Math.min(step, 7)];
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
      imageRef.current.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, []);
  useEffect(() => {
    if (!demo) return;
    let cancelled=false;
    const controller=new AbortController();
    setBusy('Loading home photos…');
    Promise.all(DEMO_IMAGES.map(async ([topic,url]) => {
      const response=await fetch(url,{signal:controller.signal});
      if (!response.ok) throw new Error('Could not load the home photos. You can upload your own.');
      const file=new File([await response.blob()],`${topic}.png`,{type:'image/png'});
      return {id:crypto.randomUUID(),topic,file};
    })).then(items=>{
      if (cancelled) return;
      updateImages(items.map(item=>({...item,url:URL.createObjectURL(item.file)})));
    }).catch(err=>{if (!cancelled) setError(err.message);}).finally(()=>{if (!cancelled) setBusy('');});
    return ()=>{cancelled=true;controller.abort();};
  },[demo]);
  function updateImages(next) {
    imageRef.current = next;
    setImages(next);
    setRows(null);
  }
  function remove(id) {
    const item = images.find(image => image.id === id);
    URL.revokeObjectURL(item.url);
    updateImages(images.filter(image => image.id !== id));
  }
  async function capture(event, video = false) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) { retake.current = null; return; }
    const replaceId = retake.current;
    retake.current = null;
    setError('');
    setBusy(video ? 'Extracting video frames locally…' : 'Preparing photos…');
    const controller = new AbortController();
    operation.current = controller;
    try {
      const capacity = MAX_PHOTOS - images.length + (replaceId ? 1 : 0);
      if (capacity <= 0) throw new Error('The walk holds up to 12 images. Remove an image to add another.');
      const selected = video ? await extractVideoFrames(files[0], Math.min(6, capacity), controller.signal) : files;
      if (selected.length > capacity) throw new Error(`Only ${capacity} more images fit in this walk.`);
      for (const file of selected) {
        if (!['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Choose JPEG or PNG photos, up to 5 MB each. Convert HEIC photos to JPEG first.');
      }
      if (!mounted.current || controller.signal.aborted) return;
      const previous = images.find(item => item.id === replaceId);
      const additions = selected.map(file => ({ id: crypto.randomUUID(), file, topic: previous?.topic || topic, url: URL.createObjectURL(file) }));
      if (previous) URL.revokeObjectURL(previous.url);
      updateImages([...images.filter(item => item.id !== replaceId), ...additions]);
    } catch (err) {
      if (mounted.current && err.name !== 'AbortError') setError(err.message);
    } finally { if (mounted.current) setBusy(''); }
  }
  async function analyze() {
    setError('');
    setRows(null);
    setProcessing(true);
    const started=Date.now();
    const controller = new AbortController();
    operation.current = controller;
    const timer = setTimeout(() => controller.abort(), 240000);
    try {
      const results = [];
      const batches=imageBatches(images);
      for (const [index,batch] of batches.entries()) {
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        setBusy(batches.length>1 ? `Reviewing photo group ${index+1} of ${batches.length}…` : 'Finding useful home details…');
        const suggestions=await analyzeWalkImages(batch,'all',controller.signal);
        suggestions.forEach(row=>results.push({...row,id:crypto.randomUUID(),confirmed:false,sources:row.image_indices.map(index=>batch[index-1].id)}));
      }
      const remaining=Math.max(0,2500-(Date.now()-started));
      if (remaining) await new Promise(resolve=>setTimeout(resolve,remaining));
      if (mounted.current && !controller.signal.aborted) {
        const {facts,review}=preparePhotoReview(results);
        onApply(facts,review);
      }
    } catch (err) {
      if (mounted.current) setError(err.name === 'AbortError' ? 'Analysis stopped or timed out. Your photos remain available to retry.' : err.message);
    } finally { clearTimeout(timer); if (mounted.current) {setBusy('');setProcessing(false);} }
  }
  const visible = images;
  if (processing) return <section className="walkProcessing" role="status" aria-live="polite">
    <div className="walkCognition"><img src={cognitionIcon} alt="Cognition"/><span/></div>
    <h3>Reviewing images for value data.</h3>
    <p>{busy || 'Preparing your home details…'}</p>
    <button type="button" className="secondaryButton" onClick={()=>operation.current?.abort()}>Cancel review</button>
  </section>;
  return <section className="guidedWalk formScreen" aria-label="Guided Home Walk">
    <div className="walkAreaRow"><label htmlFor="walk-area">Recommended photos for analysis</label><span>{images.length}/{MAX_PHOTOS} photos</span></div>
    <select id="walk-area" className="walkAreaSelect" value={Math.min(step,7)} disabled={!!busy} onChange={event=>setStep(Number(event.target.value))}>{STEPS.map((item,index)=><option value={index} key={item[0]}>{item[1]}</option>)}</select>
    <p className="walkPrompt">{SHORT_PROMPTS[topic]}</p>
    <details className="walkCaptureDetails"><summary>Take/Upload Photos</summary><div className="walkCapture">
      <Camera className="walkCameraIcon" size={40} aria-hidden="true"/>
      <p>Step {step + 1} of 8 · {images.length}/{MAX_PHOTOS} images</p>
      <button type="button" className="primaryButton" disabled={!!busy || images.length >= MAX_PHOTOS} onClick={() => { retake.current = null; photoInput.current.click(); }}>Take photo</button>
      <label className="walkFile">Upload photos<input type="file" accept="image/jpeg,image/png" multiple disabled={!!busy || images.length >= MAX_PHOTOS} onChange={capture} /></label>
      <label className="walkFile">Record or upload video<input type="file" accept="video/*" capture="environment" disabled={!!busy || images.length >= MAX_PHOTOS} onChange={event => capture(event, true)} /></label>
      <small>On phones, Take photo opens the native camera when supported. If the camera is unavailable or blocked, use Upload photos. Videos: up to 60 seconds / 100 MB; up to 6 frames per clip.</small>
    </div></details>
    <input ref={photoInput} className="walkHidden" type="file" accept="image/jpeg,image/png" capture="environment" onChange={capture} />
    <div className="walkThumbnails">{visible.map(item => <figure key={item.id}><img src={item.url} alt={`${STEPS.find(s => s[0] === item.topic)[1]}: ${item.file.name}`} /><figcaption>{STEPS.find(s => s[0] === item.topic)[1]}</figcaption><div><button type="button" aria-label={`Remove ${STEPS.find(s => s[0] === item.topic)[1]} photo`} title="Remove photo" disabled={!!busy} onClick={() => remove(item.id)}><X size={16}/></button><button type="button" aria-label={`Retake ${STEPS.find(s => s[0] === item.topic)[1]} photo`} title="Retake photo" disabled={!!busy} onClick={() => { retake.current = item.id; photoInput.current.click(); }}><RotateCcw size={16}/></button></div></figure>)}</div>
    {error && <p role="alert" className="walkError">{error}</p>}
    {busy && <p role="status">{busy} <button type="button" onClick={() => operation.current?.abort()}>Cancel</button></p>}
    <p className="walkDisclosure">PROCESS reviews your selected images with Mistral and opens your home details to check and correct the findings. The original video stays on your device.</p>
    <button type="button" className="primaryButton walkProcessButton" disabled={!!busy || !images.length} onClick={analyze}>PROCESS</button>

  </section>;
}
