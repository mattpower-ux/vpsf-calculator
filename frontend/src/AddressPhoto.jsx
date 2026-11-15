import React, { useEffect, useRef, useState } from 'react';
import { isPresentationAddress } from './presentationHome.js';
import { getPropertyPhoto } from './api/client.js';
import demoExterior from './assets/demo-california-exterior.png';
import './addressPhoto.css';

export default function AddressPhoto({ address }) {
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
  if (!address.trim()) return null;
  return <section className="addressPhoto" aria-label="Home exterior photo">
    {image ? <figure><img src={image} alt={demo && !imported ? 'Illustrative California home with weathered wood lap siding and an older asphalt roof' : `Exterior image for ${address}`} onError={() => { setRemote(null); setLocal(null); setError('This photo could not be displayed. Please choose another.'); }}/>
      {(!demo || imported) && <figcaption>{imported ? 'Your exterior photo' : `${found?.attribution || 'Google Street View'}${found?.date ? ` · ${found.date}` : ''}`}</figcaption>}
    </figure> : <p role="status">{found?.status === 'loading' ? 'Looking for an exterior photo…' : 'Add an exterior photo of this home.'}</p>}
    <button type="button" className="addressPhotoUpload" onClick={() => picker.current.click()}>{image ? 'Change exterior photo' : 'Upload exterior photo'}</button>
    <input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) { setError('Choose a JPG, PNG, or WebP photo under 10 MB.'); return; }
      setError(''); setLocal({ address, image:URL.createObjectURL(file) });
    }}/>
    {error && <p role="alert">{error}</p>}
  </section>;
}
