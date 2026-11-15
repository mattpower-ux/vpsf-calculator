import React, { useEffect, useState } from 'react';
import { DRAFT_KEY, saveAnalysisDraft, loadAnalysisDraft, deleteAnalysisDraft } from './analysisDraft.js';

const CHANGE_EVENT = 'vpsf-analysis-draft-changed';
const notify = () => window.dispatchEvent(new Event(CHANGE_EVENT));

export function AnalysisDraft({ home }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return <section aria-label="Save analysis draft">
    <p>Save your address and entered details in this browser to return later. Photos and documents are not saved. Saving replaces this browser's previous draft. Anyone using this browser can resume it.</p>
    <button type="button" className="secondaryButton" onClick={() => {
      setMessage(''); setError('');
      try {
        saveAnalysisDraft(home);
        setMessage('Draft saved on this device. Saving again replaces the previous draft.');
        notify();
      } catch (failure) { setError(failure.message); }
    }}>Save draft on this device</button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export function ResumeAnalysisDraft({ onResume }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const refresh = event => {
      if (event?.type === 'storage' && event.key !== null && event.key !== DRAFT_KEY) return;
      try { setDraft(loadAnalysisDraft()); setError(''); }
      catch (failure) { setDraft(null); setError(failure.message); }
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(CHANGE_EVENT, refresh);
    };
  }, []);
  if (!draft && !error) return message ? <p role="status">{message}</p> : null;
  return <section aria-label="Saved analysis draft">
    {draft && <>
      <p><strong>{draft.home.address}</strong>{draft.home.demoScenario ? ' · Demo draft' : ''}<br />
        Saved <time dateTime={draft.savedAt}>{new Date(draft.savedAt).toLocaleString()}</time> on this device.</p>
      <button type="button" className="primaryButton" onClick={() => {
        try {
          const current = loadAnalysisDraft();
          if (!current) { setDraft(null); setMessage('The saved draft is no longer available.'); return; }
          onResume(current.home);
        } catch (failure) { setError(failure.message); }
      }}>Resume draft</button>
    </>}
    <button type="button" className="textLink" onClick={() => {
      try {
        deleteAnalysisDraft(); setDraft(null); setError(''); setMessage('Draft deleted from this device.'); notify();
      } catch (failure) { setError(failure.message); }
    }}>Delete draft</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

export default AnalysisDraft;
