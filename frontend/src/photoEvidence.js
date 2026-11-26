const base = () => (import.meta.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname.endsWith('.onrender.com') ? 'https://vpsf-api.onrender.com' : 'http://localhost:8000')).replace(/\/$/, '');

export async function discoverPropertyPhotos(address, signal) {
  if (!String(address || '').trim()) return [];
  const response = await fetch(`${base()}/api/photo-evidence/discover`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({address: String(address).trim()}), signal,
  });
  if (!response.ok) throw new Error('Automatic property photos are temporarily unavailable.');
  const data = await response.json();
  return Array.isArray(data.candidates) ? data.candidates.slice(0, 12) : [];
}

export async function uploadHomeownerPhoto(file, propertyIdentity, category, signal) {
  const body = new FormData();
  body.append('property_identity', String(propertyIdentity || '').trim());
  body.append('category', category || '');
  body.append('photo', file);
  const response = await fetch(`${base()}/api/photo-evidence/assets`, {method:'POST', body, signal});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.detail || 'The photo could not be saved.');
  return data;
}

export function buildPhotoAnalysisManifest(publicCandidates, homeownerAssets) {
  const homeowner = (homeownerAssets || []).filter(item=>item?.asset?.id && item.asset.capability);
  const publicItems = (publicCandidates || []).filter(item=>item?.id);
  return [...homeowner, ...publicItems].slice(0, 12);
}
