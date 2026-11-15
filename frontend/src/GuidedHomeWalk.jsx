import React, { useEffect, useRef, useState } from 'react';
import { STEPS, OPTIONS, MAX_PHOTOS, MAX_IMAGE_BYTES, extractVideoFrames, analyzeWalkImages, confirmedFacts, imageBatches } from './guidedHomeWalk.js';
import './GuidedHomeWalk.css';

export default function GuidedHomeWalk({ onApply, onClose }) {
  const [step, setStep] = useState(0);
  const [images, setImages] = useState([]);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const photoInput = useRef(null);
  const retake = useRef(null);
  const operation = useRef(null);
  const imageRef = useRef([]);
  const mounted = useRef(true);
  const [topic, title, prompt] = STEPS[Math.min(step, 7)];
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
      imageRef.current.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, []);
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
    const controller = new AbortController();
    operation.current = controller;
    const timer = setTimeout(() => controller.abort(), 240000);
    try {
      const results = [];
      for (const [group, label] of STEPS) {
        const selected = images.filter(item => item.topic === group);
        for (const batch of imageBatches(selected)) {
          if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
          setBusy(`Analyzing ${label.toLowerCase()}…`);

          const suggestions = await analyzeWalkImages(batch, group, controller.signal);
          suggestions.forEach(row => results.push({ ...row, id: crypto.randomUUID(), confirmed: false, sources: row.image_indices.map(index => batch[index - 1].id) }));
        }
      }
      if (mounted.current) setRows(results);
    } catch (err) {
      if (mounted.current) setError(err.name === 'AbortError' ? 'Analysis stopped or timed out. Your photos remain available to retry.' : err.message);
    } finally { clearTimeout(timer); if (mounted.current) setBusy(''); }
  }
  const visible = step === 8 ? images : images.filter(item => item.topic === topic);
  const facts = confirmedFacts(rows || []);
  function changeRow(id, patch) {
    // A field can be confirmed only once, including conflicting batches.
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : patch.confirmed && row.field === current.find(item => item.id === id).field ? { ...row, confirmed: false } : row));
  }
  return <section className="guidedWalk formScreen" aria-label="Guided Home Walk">
    <header className="walkHeader"><div><span className="walkEyebrow">GUIDED HOME WALK</span><h2>{step === 8 ? 'Review your walk' : title}</h2></div><button type="button" className="secondaryButton" onClick={() => { operation.current?.abort(); imageRef.current.forEach(item => URL.revokeObjectURL(item.url)); updateImages([]); onClose?.(); }}>Close</button></header>
    <nav className="walkSteps" aria-label="Walk categories">{STEPS.map((item, index) => <button type="button" key={item[0]} disabled={!!busy} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} aria-label={`${item[1]}, ${images.filter(image => image.topic === item[0]).length} images`}>{index + 1}</button>)}</nav>
    <p className="subhead">{step === 8 ? 'Check every image before sending. You can remove images or return to a category.' : prompt}</p>
    {step < 8 && <div className="walkCapture">
      <span className="walkCameraIcon" aria-hidden="true">▣</span>
      <p>Step {step + 1} of 8 · {images.length}/{MAX_PHOTOS} images</p>
      <button type="button" className="primaryButton" disabled={!!busy || images.length >= MAX_PHOTOS} onClick={() => { retake.current = null; photoInput.current.click(); }}>Take photo</button>
      <label className="walkFile">Upload photos<input type="file" accept="image/jpeg,image/png" multiple disabled={!!busy || images.length >= MAX_PHOTOS} onChange={capture} /></label>
      <label className="walkFile">Record or upload video<input type="file" accept="video/*" capture="environment" disabled={!!busy || images.length >= MAX_PHOTOS} onChange={event => capture(event, true)} /></label>
      <small>On phones, Take photo opens the native camera when supported. If the camera is unavailable or blocked, use Upload photos. Videos: up to 60 seconds / 100 MB; up to 6 frames per clip.</small>
    </div>}
    <input ref={photoInput} className="walkHidden" type="file" accept="image/jpeg,image/png" capture="environment" onChange={capture} />
    <div className="walkThumbnails">{visible.map(item => <figure key={item.id}><img src={item.url} alt={`${STEPS.find(s => s[0] === item.topic)[1]}: ${item.file.name}`} /><figcaption>{STEPS.find(s => s[0] === item.topic)[1]}<small>{item.file.name}</small></figcaption><div><button type="button" disabled={!!busy} onClick={() => remove(item.id)}>Remove</button><button type="button" disabled={!!busy} onClick={() => { retake.current = item.id; photoInput.current.click(); }}>Retake</button></div></figure>)}</div>
    {error && <p role="alert" className="walkError">{error}</p>}
    {busy && <p role="status">{busy} <button type="button" onClick={() => operation.current?.abort()}>Cancel</button></p>}
    {step === 8 && <>
      <p className="walkDisclosure">Analyze sends only the selected photos and extracted video frames through VPSF to Mistral for assessment suggestions. The original video stays on your device. Avoid people and private documents. Nothing is sent until you choose Analyze.</p>
      <button type="button" className="primaryButton" disabled={!!busy || !images.length} onClick={analyze}>Analyze selected images</button>
      {rows !== null && <section className="walkReview" aria-label="Review suggestions"><h3>Confirm what is accurate</h3><p>AI may be wrong. Review the evidence, edit values, and check each fact you want to apply. No score is calculated here.</p>{!rows.length && <p>No supported facts could be established. Try readable equipment labels. Flooring, kitchen appliances, and hidden window or insulation specifications are not inferred.</p>}{rows.map(row => <div className="walkSuggestion" key={row.id}>
        <label>{row.field}<select value={row.value} onChange={event => changeRow(row.id, { value: event.target.value, confirmed: false })}>{OPTIONS[row.field].map(value => <option key={value}>{value}</option>)}</select></label>
        <p><strong>Evidence:</strong> {row.evidence}</p><p><strong>Uncertainty:</strong> {row.uncertainty}</p>
        <div className="walkEvidence">{row.sources.map(id => { const item = images.find(image => image.id === id); return item && <img key={id} src={item.url} alt={`Evidence for ${row.field}`} />; })}</div>
        <label className="walkConfirm"><input type="checkbox" checked={row.confirmed} onChange={event => changeRow(row.id, { confirmed: event.target.checked })} />I confirm this fact for my assessment</label>
      </div>)}{!!rows.length && <button type="button" className="primaryButton" disabled={!Object.keys(facts).length || !!busy} onClick={() => onApply(facts)}>Apply confirmed facts</button>}</section>}
    </>}
    <footer className="walkNavigation"><button type="button" className="secondaryButton" disabled={step === 0 || !!busy} onClick={() => setStep(step - 1)}>Back</button>{step < 8 && <button type="button" className="primaryButton" disabled={!!busy} onClick={() => setStep(step + 1)}>{step === 7 ? 'Review images' : 'Next category'}</button>}</footer>
  </section>;
}
