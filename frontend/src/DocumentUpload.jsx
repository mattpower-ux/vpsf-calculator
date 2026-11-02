import React, { useState } from "react";
import { Upload } from "lucide-react";
import { extractUpload } from "./api/client.js";

const fields = { address: "Street address", squareFeet: "Square footage", yearBuilt: "Year built", bedrooms: "Bedrooms", bathrooms: "Bathrooms" };

export default function DocumentUpload({ onApply }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState({});
  const [done, setDone] = useState(false);
  function choose(next) {
    setDraft(null); setDone(false); setError(""); setFile(null);
    if (!next) return;
    if (!/\.(pdf|jpe?g|png|txt)$/i.test(next.name)) return setError("Choose a PDF, JPG, PNG, or TXT file.");
    if (!next.size || next.size > 10 * 1024 * 1024) return setError("Choose a non-empty file smaller than 10 MB.");
    setFile(next);
  }
  async function scan() {
    setBusy(true); setError(""); setDraft(null);
    try {
      const result = await extractUpload(file);
      const facts = Object.fromEntries(Object.keys(fields).filter(key => result[key]?.trim()).map(key => [key, result[key]]));
      setDraft(facts); setSelected(Object.fromEntries(Object.keys(facts).map(key => [key, true])));
    } catch (e) { setError(e.name === "TimeoutError" ? "Reading timed out. Please retry." : e.message || "Upload failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <section className="documentUpload" aria-label="Upload documents or photos" style={{gridColumn:"1 / -1", width:"100%"}}>
    <label className="field fieldWide"><span><Upload size={18} /> Choose document or photo</span>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" disabled={busy} onChange={e => { choose(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
    <p>PDF, JPG, PNG, or TXT; up to 10 MB and 30 PDF pages. Photos need readable text, such as an equipment label. Images and scanned PDFs are sent to Mistral for text reading. Original files are not saved.</p>
    {file && <p>{file.name}</p>}
    <button type="button" className="secondaryButton" disabled={!file || busy} onClick={scan}>{busy ? "Reading file..." : "Read selected file"}</button>
    {busy && <p role="status">Processing your file. This may take a minute.</p>}
    {error && <p role="alert">{error}</p>}
    {draft && <div>
      <h3>Review extracted details</h3>
      <p>{Object.keys(draft).length ? "Only checked fields will replace the current home's details. Check the address before applying." : "No supported property details were found. Enter them manually; nothing has changed."}</p>
      {Object.entries(draft).map(([key,value]) => <div key={key}>
        <label><input type="checkbox" checked={!!selected[key]} onChange={e => setSelected({...selected,[key]:e.target.checked})} /> Apply {fields[key]}</label>
        <label className="field"><span>{fields[key]}</span><input value={value} onChange={e => setDraft({...draft,[key]:e.target.value})} /></label>
      </div>)}
      <button type="button" className="primaryButton" disabled={!Object.keys(draft).some(key=>selected[key] && draft[key].trim())} onClick={()=>{
        onApply(Object.fromEntries(Object.entries(draft).filter(([key,value])=>selected[key] && value.trim())));
        setDraft(null); setDone(true);
      }}>Apply reviewed details</button>
      <button type="button" className="secondaryButton" onClick={()=>setDraft(null)}>Discard extraction</button>
    </div>}
    {done && <p role="status">Reviewed details applied. Generate a new score when ready.</p>}
  </section>;
}
