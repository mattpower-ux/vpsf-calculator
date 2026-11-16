import React, { useEffect, useRef, useState } from 'react';
import './editor.css';
import './certificationLibrary.css';

const API_BASE = (import.meta.env?.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname.endsWith('.onrender.com')
    ? 'https://vpsf-api.onrender.com' : 'http://localhost:8000')).replace(/\/$/, '');

async function request(token, path = '', method = 'GET', body, signal) {
  const response = await fetch(`${API_BASE}/api/admin/certifications${path}`, {
    method, signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail || data?.message;
    const message = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `Request failed (${response.status})`;
    throw new Error([409, 412].includes(response.status)
      ? `Revision conflict. Your edits are still here. Copy them before reloading the latest draft. ${message}` : message);
  }
  return data;
}

const fieldLabels = { reportFacts: 'Report-only facts (no inferred features)', rules: 'Feature inference rules', target: 'Target feature (read-only)', value: 'Required value (read-only)', sourceUrl: 'Official source', clause: 'Source clause / page', reviewedAt: 'Last reviewed', precondition: 'Required evidence', requirement: 'Requirement type' };
const labelFor = key => fieldLabels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
const titleFor = (item, fallback) => item?.name || item?.label || item?.id || fallback;
function coverage(program) {
  const editions = program.editions || [];
  const rules = editions.flatMap(edition => edition.rules || []);
  return `${editions.length} editions · ${rules.filter(rule => rule.enabled !== false).length} enabled rules · ${rules.filter(rule => rule.requirement === 'mandatory').length} mandatory rules · ${rules.filter(rule => rule.requirement === 'conditional').length} conditional rules · ${editions.reduce((sum, edition) => sum + (edition.reportFacts?.length || 0), 0)} report-only facts`;
}
function isWebLink(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}

// Keep unknown schema fields intact; only edit the explicitly supported editorial fields.
function Fields({ value, path = [], onEdit, disabled }) {
  if (Array.isArray(value)) return <div>{value.length ? value.map((item, index) =>
    <fieldset key={index}><legend>{titleFor(item, `Item ${index + 1}`)}</legend>
      <Fields value={item} path={[...path, index]} onEdit={onEdit} disabled={disabled} />
    </fieldset>) : <p>None</p>}</div>;
  if (value && typeof value === 'object') return Object.entries(value).map(([key, entry]) => {
    const nextPath = [...path, key];
    if (key === 'description' && typeof entry === 'string') return <label key={key}>Description
      <textarea rows={3} maxLength={1000} value={entry} disabled={disabled} onChange={e => onEdit(nextPath, e.target.value)} /></label>;
    if (key === 'enabled' && typeof entry === 'boolean' && path.includes('rules')) return <label key={key} className="editorCheck">
      <input type="checkbox" checked={entry} disabled={disabled} onChange={e => onEdit(nextPath, e.target.checked)} />Enable this rule for feature inference</label>;
    if (entry && typeof entry === 'object') return <details key={key} open>
      <summary>{labelFor(key)}</summary><Fields value={entry} path={nextPath} onEdit={onEdit} disabled={disabled} /></details>;
    return <div className="certificationField" key={key}><strong>{labelFor(key)}</strong>
      <span>{typeof entry === 'string' && isWebLink(entry)
        ? <a href={entry} target="_blank" rel="noopener noreferrer">{entry}</a> : String(entry ?? 'Not specified')}</span></div>;
  });
  return <p>{String(value ?? 'Not specified')}</p>;
}

export default function CertificationLibrary({ token, onDirtyChange }) {
  const [library, setLibrary] = useState(null);
  const [revision, setRevision] = useState(null);
  const [selected, setSelected] = useState(0);
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const operation = useRef(false);

  function accept(data) {
    if (!Array.isArray(data?.library?.programs) || data.revision == null) {
      throw new Error('Unexpected library response. Local edits have been kept; reload before trying again.');
    }
    setLibrary(data.library); setRevision(data.revision); setDirty(false);
  }
  async function loadHistory(signal) {
    try {
      const data = await request(token, '/history', 'GET', undefined, signal);
      if (!Array.isArray(data)) throw new Error('Unexpected history response.');
      if (!signal?.aborted) { setHistory(data); setHistoryError(''); }
    } catch (e) { if (!signal?.aborted) setHistoryError(`History unavailable: ${e.message}`); }
  }
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    request(token, '', 'GET', undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) accept(data);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    loadHistory(controller.signal);
    return () => controller.abort();
  }, [token]);
  useEffect(() => { onDirtyChange?.(dirty || busy); return () => onDirtyChange?.(false); }, [dirty, busy, onDirtyChange]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  function edit(path, value) {
    setLibrary(current => {
      const next = structuredClone(current);
      let target = next.programs[selected];
      for (const key of path.slice(0, -1)) target = target[key];
      target[path.at(-1)] = value;
      return next;
    });
    setDirty(true); setStatus('');
  }
  async function perform(action) {
    if (operation.current || busy) return;
    if (action === 'reload' && dirty && !window.confirm('Discard unsaved certification edits and load the latest draft?')) return;
    operation.current = true; setBusy(true); setError(''); setStatus('');
    try {
      const result = action === 'reload' ? await request(token)
        : await request(token, action === 'publish' ? '/publish' : '', action === 'publish' ? 'POST' : 'PUT',
          action === 'publish' ? { revision } : { library, revision });
      accept(result);
      setStatus(action === 'publish' ? 'Draft published.' : action === 'save' ? 'Draft saved. Publish when ready.' : 'Latest draft loaded.');
      if (action !== 'save') await loadHistory();
    } catch (e) { setError(e.message); }
    finally { operation.current = false; setBusy(false); }
  }
  const programs = library?.programs || [];
  const visible = programs.map((program, index) => ({ program, index }))
    .filter(({ program }) => JSON.stringify(program).toLowerCase().includes(search.trim().toLowerCase()));
  const program = programs[selected];

  return <section className="contentEditor certificationLibrary" aria-busy={busy}>
    <h2>Certification reference library</h2>
    <p>Review program coverage, mandatory requirements, report-only facts and official sources. Edit descriptions and enable or disable feature rules. Field/value mappings remain read-only; the server validates changes.</p>
    {library && <p>Library {library.version} · Revision {revision} · {dirty ? 'Unsaved changes' : 'Saved draft'}</p>}
    <div className="editorActions">
      <button disabled={busy} onClick={() => perform('reload')}>Reload library</button>
      <button disabled={busy || !library || !dirty} onClick={() => perform('save')}>Save draft</button>
      <button disabled={busy || !library || dirty || revision == null} onClick={() => perform('publish')}>Publish draft</button>
    </div>
    {dirty && <p>Save your changes before publishing.</p>}
    {error && <p role="alert">{error}</p>}
    <p role="status">{busy ? 'Working…' : status}</p>
    <label>Search programs, rules and sources<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <div className="editorColumns"><nav aria-label="Certification programs">
      {visible.map(({ program: item, index }) => <button key={item.id || index} aria-current={selected === index ? 'true' : undefined}
        disabled={busy} onClick={() => setSelected(index)}><strong>{titleFor(item, `Program ${index + 1}`)}</strong>
        <small>{coverage(item)}</small></button>)}
      {!visible.length && <p>{library ? 'No matching programs.' : 'No library loaded.'}</p>}
    </nav><div>{program && <><h3>{titleFor(program, 'Program')}</h3>
      <p>{coverage(program)}</p>
      <Fields value={program} onEdit={edit} disabled={busy} />
      <details><summary>Program JSON (read-only; includes current edits)</summary><pre>{JSON.stringify(program, null, 2)}</pre></details>
    </>}</div></div>
    <details className="certificationHistory"><summary>Published history (read-only)</summary>
      {historyError && <p role="alert">{historyError}</p>}
      {!historyError && !history.length && <p>No published versions.</p>}
      {history.map((item, index) => <p key={`${item.version}-${index}`}><strong>{item.version}</strong> · {item.createdAt || 'Date unavailable'}</p>)}
    </details>
  </section>;
}
