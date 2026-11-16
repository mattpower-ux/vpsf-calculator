import React, { useState } from 'react';
import { loadEvaluations, removeEvaluation } from './evaluationArchive.js';

export default function EvaluationArchive({onOpen, onBack}) {
  const [state, setState] = useState(() => {
    try { return {items:loadEvaluations(), error:''}; }
    catch (error) { return {items:[], error:error.message}; }
  });
  const [confirmId, setConfirmId] = useState(null);
  const remove = id => {
    try { removeEvaluation(id); setState({items:loadEvaluations(),error:''}); setConfirmId(null); }
    catch(error) { setState(current => ({...current,error:error.message})); }
  };
  return <div className="screen withNav evaluationArchive">
    <header className="screenTop"><h2>Archive</h2></header>
    <p className="subhead">Your recent completed evaluations, saved in this browser. Open the original score or edit the saved home details. Product recommendations may update as the catalog changes.</p>
    <p className="archiveDeviceNote">Up to 50 evaluations. Clearing browser data removes this archive. Download a PDF report to keep or share a copy.</p>
    {state.error && <p role="alert">{state.error}</p>}
    {!state.error && !state.items.length && <section className="summaryCard"><h3>No saved evaluations yet</h3><p>Generate a score and it will appear here automatically. Earlier searches that were not saved in this browser cannot be recovered here.</p></section>}
    {state.items.map(item => <article className="summaryCard" key={item.id}>
      <h3>{item.home.address}</h3>
      <p>{[item.home.city,item.home.state,item.home.zip].filter(Boolean).join(', ')}</p>
      <p><strong>{item.result.total} / 1,000</strong> · <time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleString()}</time></p>
      <div className="archiveActions">
        <button className="primaryButton" onClick={()=>onOpen(item,false)}>View saved score</button>
        <button className="secondaryButton" onClick={()=>onOpen(item,true)}>Edit home details</button>
      </div>
      {confirmId === item.id ? <div className="archiveRemove"><p>Remove this evaluation from this browser?</p><button className="textLink" onClick={()=>remove(item.id)}>Yes, remove</button><button className="textLink" onClick={()=>setConfirmId(null)}>Keep it</button></div> : <button className="textLink" onClick={()=>setConfirmId(item.id)}>Remove from archive</button>}
    </article>)}
    <button className="secondaryButton" onClick={onBack}>Back to My Scores</button>
    <style>{`.evaluationArchive .summaryCard h3{overflow-wrap:anywhere;margin-bottom:6px}.evaluationArchive .summaryCard p{margin:6px 0 14px}.archiveDeviceNote{font-size:13px;color:var(--body-muted);line-height:1.5;margin:0 0 20px}.archiveActions{display:grid;gap:10px;margin:16px 0}.archiveRemove{display:flex;flex-wrap:wrap;gap:12px}.archiveRemove p{flex-basis:100%}.evaluationArchive time{font-size:13px}`}</style>
  </div>;
}

