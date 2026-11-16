import { useEffect, useState } from 'react';
import { getCertificationCatalog, previewCertifications } from './api/client.js';

export function useCertificationCatalog() {
  const [data,setData] = useState(null);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getCertificationCatalog(controller.signal).then(catalog => {
      if (!controller.signal.aborted) {setData(catalog); setError('');}
    }).catch(() => { if (!controller.signal.aborted) setError('The certification list is unavailable. Your saved claims are still here.'); });
    return () => controller.abort();
  }, [attempt]);
  return {data,error,retry:() => setAttempt(value => value + 1)};
}

export function useCertificationPreview(home) {
  const [response, setResponse] = useState(null);
  const [retry, setRetry] = useState(0);
  const active = Array.isArray(home.certifications) && home.certifications.length > 0;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await previewCertifications(home, controller.signal);
        if (!controller.signal.aborted) setResponse({home, data});
      } catch (error) {
        if (!controller.signal.aborted) setResponse({home, error:'Certification details could not be checked. Try again.'});
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [home, active, retry]);
  // Hide a previous home's response immediately, even before effect cleanup.
  const current = active && response?.home === home ? response : null;
  return {data:current?.data, error:current?.error, loading:active && !current,
    retry:() => { setResponse(null); setRetry(value => value + 1); }};
}
