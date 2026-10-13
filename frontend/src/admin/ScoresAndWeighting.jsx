import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, GitBranch, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { getAdminScoredProperties, getScoringAvailableFields, getScoringCandidates, getScoringDraft, getScoringHistory, getScoringModel, previewScoringDraft, publishScoringDraft, saveScoringDraft, validateScoringDraft } from "../api/client";
import { addFactor, retireFactor, splitFactor, totalBudget } from "./scoringModel";

const NAMES = { energy: "Energy", water: "Water", health: "Health", resilience: "Resilience", carbon: "Carbon & Materials", financial: "Financial Risk", community: "Community & Mobility" };
const idFor = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);

export default function ScoresAndWeighting({ token }) {
  const [published, setPublished] = useState(null);
  const [model, setModel] = useState(null);
  const [revision, setRevision] = useState(null);
  const [fields, setFields] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [history, setHistory] = useState([]);
  const [pillar, setPillar] = useState("energy");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [newFactor, setNewFactor] = useState({ label: "", field: "", mode: "equals", points: 5, match: "" });
  const [newField, setNewField] = useState({ label: "", kind: "select", choices: "", minimum: 0, maximum: 100 });

  const load = useCallback(async () => {
    const [live, draft, inputFields, homes, versions, possible] = await Promise.all([
      getScoringModel(token), getScoringDraft(token), getScoringAvailableFields(token), getAdminScoredProperties(token), getScoringHistory(token), getScoringCandidates(token)
    ]);
    setPublished(live);
    setModel(draft.model);
    setRevision(draft.revision);
    setFields(inputFields);
    setProperties(homes.filter((home) => home.source === "score_request"));
    setPropertyId(String(homes.find((home) => home.source === "score_request")?.id || ""));
    setHistory(versions);
    setCandidates(possible);
    setDirty(false);
  }, [token]);

  useEffect(() => { load().catch(() => setError("Scoring model unavailable. Refresh to try again.")); }, [load]);
  const factors = useMemo(() => (model?.factors || []).filter((factor) => factor.pillar === pillar && `${factor.label} ${factor.field} ${factor.id}`.toLowerCase().includes(query.toLowerCase())), [model, pillar, query]);
  const total = model ? totalBudget(model) : 0;
  const updateModel = (next) => { setModel(next); setDirty(true); setNotice(""); setPreview(null); };
  const updateFactor = (id, patch) => updateModel({ ...model, factors: model.factors.map((factor) => factor.id === id ? { ...factor, ...patch } : factor) });
  const setBudget = (id, value) => updateModel({ ...model, pillars: { ...model.pillars, [id]: Number(value) } });

  async function save() {
    setBusy(true); setError("");
    try {
      const result = await saveScoringDraft(token, { model, revision });
      setRevision(result.revision); setDirty(false); setNotice("Draft saved. Published scores are unchanged.");
    } catch (cause) { setError(cause.message.includes("409") ? "Draft changed in another session. Reload before editing." : "Draft could not be saved. Check field IDs and conditions."); }
    finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setError("");
    try {
      const checked = await validateScoringDraft(token, model);
      if (!checked.valid) { setError(checked.issues.join(" ")); return; }
      const live = await publishScoringDraft(token, revision);
      setPublished(live); setConfirmPublish(false); setNotice(`${live.version} is now published.`);
      await load();
    } catch (cause) { setError(cause.message.includes("409") ? "Draft changed in another session. Reload before publishing." : "Publication failed; the previous model remains active."); }
    finally { setBusy(false); }
  }

  async function runPreview() {
    if (!propertyId) return;
    setError("");
    try { setPreview(await previewScoringDraft(token, Number(propertyId))); }
    catch { setError("Preview unavailable for this property. No score run was saved."); }
  }

  function createFactor(event) {
    event.preventDefault();
    const id = idFor(newFactor.label);
    if (!id || !newFactor.field) { setError("Name and input field are required."); return; }
    if (!newFactor.match || (newFactor.mode === "number_range" && !Number.isFinite(Number(newFactor.match)))) { setError("Enter a match value or numeric minimum."); return; }
    try {
      updateModel(addFactor(model, { id, label: newFactor.label, pillar, field: newFactor.field, mode: newFactor.mode, points: Number(newFactor.points), options: {}, default: 0, matches: newFactor.mode === "number_range" ? [] : [newFactor.match], lower: newFactor.mode === "number_range" ? Number(newFactor.match) : null, active: true, source: "property_input" }));
      setNewFactor({ label: "", field: "", mode: "equals", points: 5, match: "" });
    } catch (cause) { setError(cause.message); }
  }

  function createField(event) {
    event.preventDefault();
    const id = idFor(newField.label);
    if (!id || model.customFields.some((field) => field.id === id)) { setError("Give the new input a unique name."); return; }
    const choices = newField.choices.split(",").map((choice) => choice.trim()).filter(Boolean);
    if (newField.kind === "select" && !choices.length) { setError("List at least one choice."); return; }
    updateModel({ ...model, customFields: [...model.customFields, { id, label: newField.label, helper: "", pillar, kind: newField.kind, choices, minimum: newField.kind === "number" ? Number(newField.minimum) : null, maximum: newField.kind === "number" ? Number(newField.maximum) : null, active: true }] });
    setNewField({ label: "", kind: "select", choices: "", minimum: 0, maximum: 100 });
  }

  if (!model || !published) return <div className="scoreEditorLoad" role="status">{error || "Loading scoring rules..."}</div>;
  const availableFields = [...fields, ...model.customFields.filter((field) => field.active).map((field) => field.id)];
  return (
    <div className="scoreEditor">
      <div className="scoreEditorTop">
        <div><strong>Published {published.version}</strong><span>Draft revision {revision}{dirty ? " · Unsaved changes" : " · Saved"}</span></div>
        <div className="scoreEditorActions"><button onClick={() => load().catch(() => setError("Reload failed."))} disabled={busy}><RotateCcw size={16} /> Reload</button><button onClick={save} disabled={!dirty || busy}><Save size={16} /> Save draft</button><button className="primary" onClick={() => setConfirmPublish(true)} disabled={dirty || busy || total !== 1000}><Check size={16} /> Publish</button></div>
      </div>
      {error && <p className="scoreEditorMessage error" role="alert">{error}</p>}
      {notice && <p className="scoreEditorMessage" role="status">{notice}</p>}
      <div className="scoreBudgetHeader"><h2>Point budget</h2><strong className={total === 1000 ? "" : "invalid"}>{total} / 1,000</strong></div>
      {total !== 1000 && <div className="scoreBudgetWarning" role="alert"><AlertTriangle size={18} /> {total > 1000 ? `${total - 1000} points over budget` : `${1000 - total} points unallocated`}. Adjust pillar sliders before publishing.</div>}
      <div className="scoreBudgetGrid">{Object.entries(model.pillars).map(([id, cap]) => <label key={id}><span>{NAMES[id]}</span><input type="range" min="0" max="300" value={cap} onChange={(event) => setBudget(id, event.target.value)} /><input type="number" min="0" max="1000" value={cap} onChange={(event) => setBudget(id, event.target.value)} /></label>)}</div>
      <div className="scoreEditorBody">
        <nav className="scorePillars" aria-label="Scoring pillars">{Object.entries(NAMES).map(([id, label]) => <button key={id} className={pillar === id ? "active" : ""} onClick={() => setPillar(id)}>{label}<span>{model.factors.filter((factor) => factor.pillar === id && factor.active).length}</span></button>)}</nav>
        <div className="scoreFactorPanel">
          <div className="scoreFactorHead"><div><h2>{NAMES[pillar]}</h2><p>{model.pillars[pillar]}-point ceiling · {factors.length} rules shown</p></div><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a factor" /></label></div>
          <div className="scoreFactorTable" role="table" aria-label={`${NAMES[pillar]} scoring factors`}>
            <div className="scoreFactorRow scoreFactorColumn" role="row"><span>Factor / source</span><span>Condition</span><span>Points</span><span>Actions</span></div>
            {factors.map((factor) => <div className={`scoreFactorRow ${factor.active ? "" : "retired"}`} role="row" key={factor.id}>
              <div><strong>{factor.label}</strong><small>{factor.field} · {factor.source || "property_input"}{factor.parentId ? ` · split from ${factor.parentId}` : ""}</small></div>
              <div className="scoreCondition"><select value={factor.mode} onChange={(event) => updateFactor(factor.id, { mode: event.target.value })}><option value="lookup">Lookup</option><option value="contains">Contains</option><option value="contains_any">Contains any</option><option value="equals">Equals</option><option value="not_equals">Not equals</option><option value="number_range">Number range</option><option value="wildfire">Verified wildfire</option><option value="epa_range">EPA index</option></select>{factor.mode === "lookup" ? <div className="scoreOptions">{Object.entries(factor.options).map(([name, points]) => <label key={name}><span>{name}</span><input type="number" value={points} onChange={(event) => updateFactor(factor.id, { options: { ...factor.options, [name]: Number(event.target.value) } })} /></label>)}<label><span>Fallback</span><input type="number" value={factor.default} onChange={(event) => updateFactor(factor.id, { default: Number(event.target.value) })} /></label></div> : ["number_range", "epa_range"].includes(factor.mode) ? <div className="scoreOptions"><label><span>Min</span><input type="number" value={factor.lower ?? ""} onChange={(event) => updateFactor(factor.id, { lower: event.target.value === "" ? null : Number(event.target.value) })} /></label><label><span>Max</span><input type="number" value={factor.upper ?? ""} onChange={(event) => updateFactor(factor.id, { upper: event.target.value === "" ? null : Number(event.target.value) })} /></label></div> : factor.mode !== "wildfire" && <input aria-label={`${factor.label} matching text`} value={factor.matches.join(", ")} onChange={(event) => updateFactor(factor.id, { matches: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />}</div>
              <div>{factor.mode === "lookup" ? <span className="scoreLookupLabel">by choice</span> : factor.mode === "wildfire" ? <span className="scoreLookupLabel">-20 to +10</span> : <input className="scorePointsInput" type="number" min="-200" max="200" value={factor.points} aria-label={`${factor.label} points`} onChange={(event) => updateFactor(factor.id, { points: Number(event.target.value) })} />}</div>
              <div className="scoreRowActions"><button title="Split factor" aria-label={`Split ${factor.label}`} disabled={!factor.active || factor.mode === "wildfire"} onClick={() => { try { updateModel(splitFactor(model, factor.id)); } catch (cause) { setError(cause.message); } }}><GitBranch size={16} /></button><button title={factor.active ? "Retire factor" : "Restore factor"} aria-label={`${factor.active ? "Retire" : "Restore"} ${factor.label}`} onClick={() => updateModel(factor.active ? retireFactor(model, factor.id) : { ...model, factors: model.factors.map((item) => item.id === factor.id ? { ...item, active: true } : item) })}><Trash2 size={16} /></button></div>
            </div>)}
          </div>
          <section className="scoreCandidates"><h3>Not yet scored</h3><p>These details currently earn no VPSF points.</p><div>{candidates.filter((item) => item.pillar === pillar).map((item) => <div key={item.name}><span><strong>{item.name}</strong><small>{item.status}</small></span><button type="button" onClick={() => { if (item.field) setNewFactor({ ...newFactor, label: item.name, field: item.field }); else setNewField({ ...newField, label: item.name, kind: item.name.includes("capacity") ? "number" : "select" }); }}>{item.field ? "Set up factor" : "Create input"} <ChevronRight size={15} /></button></div>)}</div></section>
          <div className="scoreEditorForms"><form onSubmit={createFactor}><h3>Add scoring factor</h3><input aria-label="Factor name" placeholder="Factor name" value={newFactor.label} onChange={(event) => setNewFactor({ ...newFactor, label: event.target.value })} /><select aria-label="Input field" value={newFactor.field} onChange={(event) => setNewFactor({ ...newFactor, field: event.target.value })}><option value="">Select input field</option>{availableFields.map((field) => <option key={field}>{field}</option>)}</select><select aria-label="Condition" value={newFactor.mode} onChange={(event) => setNewFactor({ ...newFactor, mode: event.target.value })}><option value="equals">Equals</option><option value="contains">Contains</option><option value="not_equals">Not equals</option><option value="number_range">Number range</option></select><input aria-label="Match value" placeholder={newFactor.mode === "number_range" ? "Minimum value" : "Match value"} value={newFactor.match} onChange={(event) => setNewFactor({ ...newFactor, match: event.target.value })} /><input aria-label="Factor points" type="number" min="-200" max="200" value={newFactor.points} onChange={(event) => setNewFactor({ ...newFactor, points: event.target.value })} /><button><Plus size={16} /> Add factor</button></form>
            <form onSubmit={createField}><h3>Add homeowner input</h3><input aria-label="Input label" placeholder="Input label" value={newField.label} onChange={(event) => setNewField({ ...newField, label: event.target.value })} /><select aria-label="Input type" value={newField.kind} onChange={(event) => setNewField({ ...newField, kind: event.target.value })}><option value="select">Single choice</option><option value="checkbox">Yes / no</option><option value="number">Number</option></select>{newField.kind === "select" && <input aria-label="Choices" placeholder="Choices, comma separated" value={newField.choices} onChange={(event) => setNewField({ ...newField, choices: event.target.value })} />}{newField.kind === "number" && <><input type="number" aria-label="Minimum" value={newField.minimum} onChange={(event) => setNewField({ ...newField, minimum: event.target.value })} /><input type="number" aria-label="Maximum" value={newField.maximum} onChange={(event) => setNewField({ ...newField, maximum: event.target.value })} /></>}<button><Plus size={16} /> Add input</button></form></div>
          {model.customFields.filter((field) => field.pillar === pillar).length > 0 && <div className="scoreCustomList"><h3>Homeowner inputs</h3>{model.customFields.filter((field) => field.pillar === pillar).map((field) => <div key={field.id}><span>{field.label} <small>{field.kind} · {field.active ? "Active" : "Retired"}</small></span><button onClick={() => updateModel({ ...model, customFields: model.customFields.map((item) => item.id === field.id ? { ...item, active: !item.active } : item) })}>{field.active ? "Retire" : "Restore"}</button></div>)}</div>}
        </div>
      </div>
      <section className="scorePreview"><h2>Compare a saved property</h2><select aria-label="Saved property" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">Select a scored property</option>{properties.map((home) => <option key={home.id} value={home.id}>{home.address}, {home.city} {home.state}</option>)}</select><button onClick={runPreview} disabled={!propertyId || dirty}>Preview draft <ChevronRight size={16} /></button>{preview && <div><strong>Published: {Object.values(preview.published).reduce((a, b) => a + b, 0)}</strong><strong>Draft: {Object.values(preview.draft).reduce((a, b) => a + b, 0)}</strong><span>No score run saved.</span></div>}</section>
      <section className="scoreHistory"><h2>Published history</h2>{history.map((item) => <p key={item.version}>{item.version}{item.active ? " · Current" : ""} <time>{new Date(item.createdAt).toLocaleDateString()}</time></p>)}</section>
      {confirmPublish && <div className="scoreModalBackdrop" role="presentation"><div className="scoreModal" role="dialog" aria-modal="true" aria-labelledby="scorePublishTitle"><h2 id="scorePublishTitle">Publish scoring model?</h2><p>This will become the scoring model for new evaluations. Existing score runs stay unchanged.</p><strong>{total} / 1,000 points</strong><div><button onClick={() => setConfirmPublish(false)}>Cancel</button><button className="primary" onClick={publish} disabled={busy || total !== 1000}>Publish new version</button></div></div></div>}
      <style>{`
        .scoreEditor { color:#102842; display:grid; grid-template-columns:minmax(0,1fr); gap:24px; max-width:1400px; min-width:0; }
        .scoreEditor button { display:inline-flex; align-items:center; justify-content:center; gap:7px; cursor:pointer; border:1px solid #cbd8e4; background:#fff; color:#174770; border-radius:6px; padding:9px 12px; font-weight:700; }
        .scoreEditor button.primary { background:#126fd2; color:#fff; border-color:#126fd2; }
        .scoreEditor button:disabled { opacity:.5; cursor:not-allowed; }
        .scoreEditor input,.scoreEditor select { min-height:36px; padding:6px 9px; border:1px solid #cbd8e4; border-radius:5px; background:#fff; color:#102842; max-width:100%; }
        .scoreEditorTop,.scoreBudgetHeader,.scoreFactorHead { display:flex; justify-content:space-between; align-items:center; gap:18px; }
        .scoreEditorTop { padding:0 0 20px; border-bottom:1px solid #d8e1ea; }
        .scoreEditorTop>div:first-child { display:grid; gap:3px; }.scoreEditorTop span,.scoreFactorHead p { color:#5d6d80; font-size:13px; }
        .scoreEditorActions { display:flex; flex-wrap:wrap; gap:8px; }
        .scoreEditor h2 { font-size:19px; margin:0; }.scoreEditor h3 { font-size:15px; margin:0 0 10px; }
        .scoreBudgetHeader strong { font-size:25px; }.scoreBudgetHeader strong.invalid { color:#b45309; }
        .scoreBudgetWarning,.scoreEditorMessage { padding:12px 14px; background:#fff5e5; border-left:3px solid #d97706; display:flex; gap:10px; align-items:center; margin:0; }.scoreEditorMessage.error { background:#fff0ee; border-color:#be332b; }
        .scoreBudgetGrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:1px; background:#d8e1ea; border:1px solid #d8e1ea; min-width:0; }.scoreBudgetGrid label { background:#fff; display:grid; grid-template-columns:minmax(0,1fr) 95px 62px; gap:10px; align-items:center; padding:10px; font-size:13px; font-weight:650; min-width:0; }.scoreBudgetGrid input[type=range] { min-height:0; padding:0; }.scoreBudgetGrid input[type=number] { width:62px; }
        .scoreEditorBody { display:grid; grid-template-columns:200px minmax(0,1fr); border-top:1px solid #d8e1ea; }.scorePillars { border-right:1px solid #d8e1ea; padding:12px 0; display:grid; align-content:start; }.scorePillars button { border:0; border-radius:0; justify-content:space-between; text-align:left; padding:12px; }.scorePillars button.active { background:#e6f1fc; color:#075ba9; }.scorePillars span { font-size:12px; color:#657b90; }
        .scoreFactorPanel { min-width:0; padding:18px 0 0 20px; }.scoreFactorHead { margin-bottom:16px; }.scoreFactorHead p { margin:4px 0 0; }.scoreFactorHead label { display:flex; align-items:center; gap:6px; }.scoreFactorHead input { width:210px; }
        .scoreFactorRow { display:grid; grid-template-columns:minmax(160px,1.2fr) minmax(220px,1.4fr) 95px 85px; gap:14px; padding:13px 8px; border-top:1px solid #d8e1ea; align-items:start; font-size:13px; }.scoreFactorColumn { color:#5d6d80; font-weight:750; background:#f4f7fa; padding:9px 8px; }.scoreFactorRow.retired { opacity:.6; }.scoreFactorRow strong { display:block; }.scoreFactorRow small { display:block; color:#5d6d80; margin-top:4px; line-height:1.4; }.scoreCondition { display:grid; gap:6px; }.scoreCondition>input { width:100%; }.scoreOptions { display:grid; gap:3px; }.scoreOptions label { display:grid; grid-template-columns:minmax(0,1fr) 64px; align-items:center; gap:6px; }.scoreOptions input { width:64px; }.scoreLookupLabel { color:#5d6d80; }.scorePointsInput { width:80px; }.scoreRowActions { display:flex; gap:3px; }.scoreRowActions button { padding:6px; }
        .scoreEditorForms { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:22px; border-top:1px solid #d8e1ea; padding-top:20px; }.scoreEditorForms form { display:flex; flex-wrap:wrap; align-content:start; gap:8px; }.scoreEditorForms h3 { width:100%; }.scoreEditorForms input,.scoreEditorForms select { flex:1 1 130px; }.scoreCustomList { margin-top:22px; border-top:1px solid #d8e1ea; padding-top:18px; }.scoreCustomList>div { display:flex; justify-content:space-between; border-top:1px solid #e4ebf2; padding:8px 0; }.scoreCustomList small { color:#5d6d80; margin-left:8px; }
        .scoreCandidates { border-top:1px solid #d8e1ea; padding-top:18px; margin-top:20px; }.scoreCandidates p { margin:0 0 10px; color:#5d6d80; font-size:13px; }.scoreCandidates>div { display:grid; grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:0 18px; }.scoreCandidates>div>div { border-top:1px solid #e4ebf2; padding:9px 0; display:flex; justify-content:space-between; gap:8px; align-items:center; }.scoreCandidates strong,.scoreCandidates small { display:block; }.scoreCandidates small { color:#5d6d80; margin-top:3px; }.scoreCandidates button { white-space:nowrap; font-size:12px; }
        .scorePreview,.scoreHistory { border-top:1px solid #d8e1ea; padding-top:20px; display:flex; flex-wrap:wrap; align-items:center; gap:12px; }.scorePreview h2,.scoreHistory h2 { width:100%; }.scorePreview>div { display:flex; gap:18px; width:100%; }.scoreHistory { display:block; }.scoreHistory p { margin:0; padding:8px 0; border-bottom:1px solid #e4ebf2; }.scoreHistory time { float:right; color:#5d6d80; }
        .scoreModalBackdrop { position:fixed; inset:0; z-index:100; background:#071a2cb8; display:grid; place-items:center; padding:20px; }.scoreModal { width:min(440px,100%); background:#fff; padding:24px; border-radius:8px; box-shadow:0 20px 60px #0004; }.scoreModal p { line-height:1.5; }.scoreModal>div { display:flex; justify-content:flex-end; gap:8px; margin-top:24px; }
        @media(max-width:900px){.scoreEditorBody { grid-template-columns:1fr; }.scorePillars { display:flex; overflow:auto; border-right:0; border-bottom:1px solid #d8e1ea; }.scorePillars button { white-space:nowrap; }.scoreFactorPanel { padding:16px 0; }.scoreFactorRow { grid-template-columns:minmax(140px,1fr) minmax(160px,1fr) 70px 70px; gap:6px; }.scoreEditorForms { grid-template-columns:1fr; }}
        @media(max-width:600px){.scoreEditorTop,.scoreFactorHead { align-items:flex-start; flex-direction:column; }.scoreFactorTable { overflow-x:auto; }.scoreFactorRow { min-width:570px; }.scoreBudgetGrid { grid-template-columns:1fr; }}
      `}</style>
    </div>
  );
}
