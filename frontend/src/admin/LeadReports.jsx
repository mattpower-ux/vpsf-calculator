import React, { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { exportLeadReport, getLeadReport, updateLead } from "../api/client";
import "./leadReports.css";

const statuses = {new: "New", reviewed: "Reviewed", qualified: "Qualified", approved: "Approved for sharing", contacted: "Contacted", quoted: "Quoted", won: "Won", lost: "Lost", archived: "Archived"};
const intents = {information: "Product information", planning: "Project planning", estimate: "Installation estimate"};
const timelines = {researching: "Just researching", within_3_months: "Within 3 months", within_12_months: "Within 12 months", later: "More than a year away"};
const contextLabels = {sidingType: "Siding", roofType: "Roof", roofAge: "Roof age", wildfireRisk: "Regional wildfire risk", resilienceScore: "Resilience score", totalScore: "VPSF score", modelVersion: "Scoring model", reason: "Recommendation reason"};
const displayDate = value => value ? new Date(value).toLocaleString() : "Not recorded";

function LeadReview({lead, token, onSaved, onClose}) {
  const [status, setStatus] = useState(lead.status || "new");
  const [notes, setNotes] = useState(lead.adminNotes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try { await updateLead(token, lead.id, {status, adminNotes: notes, revision: lead.revision}); onSaved(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <section className="leadReview" aria-label={`Review inquiry ${lead.id}`}>
    <div className="leadReportTitle"><div><h2>Inquiry #{lead.id}</h2><p>{lead.productName || lead.productId}</p></div><button type="button" onClick={onClose}>Close review</button></div>
    <dl className="leadFacts">
      <div><dt>Contact</dt><dd>{lead.name || "Not recorded"}<br/>{lead.email || "No email"}{lead.phone && <><br/>{lead.phone}</>}</dd></div>
      <div><dt>Role</dt><dd>{lead.role || "Not recorded"}</dd></div>
      <div><dt>Request</dt><dd>{intents[lead.intent] || lead.action || "Not recorded"}</dd></div>
      <div><dt>Timing</dt><dd>{timelines[lead.timeline] || "Not recorded"}</dd></div>
      <div><dt>Property / project ZIP</dt><dd>{lead.isDemo ? "Demo assessment" : lead.propertyAddress || "Address not recorded"}<br/>{lead.zip || "ZIP not recorded"}</dd></div>
      <div><dt>Received</dt><dd>{displayDate(lead.createdAt)}</dd></div>
      <div><dt>VPSF follow-up permission</dt><dd>{lead.contactConsent ? "Granted" : "Not recorded"}</dd></div>
      <div><dt>Sharing permission</dt><dd>{lead.shareConsent ? "Granted; admin review required" : "Not granted — keep with VPSF"}</dd></div>
    </dl>
    {lead.scope && <p><strong>Project notes:</strong> {lead.scope}</p>}
    <details className="leadAssessment"><summary>Home assessment context{lead.isDemo ? " · demonstration data" : ""}</summary>
      <p>Details captured when the request was submitted. Scores and home details are assessment context, not a quote or inspection.</p>
      {Object.keys(lead.assessmentContext || {}).length ? <dl className="leadFacts">{Object.entries(lead.assessmentContext).map(([key,value]) => <div key={key}><dt>{contextLabels[key] || key}</dt><dd>{String(value)}</dd></div>)}</dl> : <p>No assessment context was saved with this inquiry.</p>}
    </details>
    <form onSubmit={save}>
      <label>Status<select value={status} onChange={e => setStatus(e.target.value)} disabled={busy}>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key} disabled={(["approved", "quoted", "won"].includes(key) && (!lead.shareConsent || !lead.contactConsent || lead.isDemo)) || (key === "contacted" && !lead.contactConsent)}>{label}</option>)}</select></label>
      <label>Internal review notes<textarea rows={3} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} disabled={busy} placeholder="Record qualification, next steps, or the outcome of your follow-up."/></label>
      <p>Saving a status never sends an email or releases this inquiry to a manufacturer. Approval records your decision only.</p>
      {error && <p role="alert">{error} Close and reopen this inquiry to load its latest version if another admin changed it.</p>}
      <button className="leadPrimary" disabled={busy}>{busy ? "Saving…" : "Save review"}</button>
    </form>
  </section>;
}

export default function LeadReports({products, token}) {
  const [filters, setFilters] = useState({manufacturer: "", productId: "", status: "", dateFrom: "", dateTo: "", includeDemo: false});
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const reviewRef = useRef(null);
  const pageSize = 25;
  useEffect(() => {
    let current = true;
    setLoading(true); setError(""); setData(null); setSelected(null);
    getLeadReport(token, {...filters, page, pageSize}).then(result => { if (current) setData(result); })
      .catch(failure => { if (current) setError(failure.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, filters, page, refresh]);
  useEffect(() => { if (selected) { reviewRef.current?.scrollIntoView({block: "start", behavior: "smooth"}); reviewRef.current?.focus({preventScroll: true}); } }, [selected]);
  const filter = (key,value) => { setPage(1); setFilters(current => ({...current,[key]:value,...(key === "manufacturer" ? {productId: ""} : {})})); };
  const download = async () => {
    setExporting(true); setError("");
    try {
      const blob = await exportLeadReport(token, filters);
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `vpsf-inquiries-${new Date().toISOString().slice(0,10)}.csv`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(failure) { setError(failure.message); }
    finally { setExporting(false); }
  };
  const manufacturers = [...new Set([...products.map(p => p.manufacturer?.trim() || p.brand), ...Object.keys(data?.byManufacturer || {})])].filter(Boolean).sort();
  const matchingProducts = products.filter(p => !filters.manufacturer || (p.manufacturer?.trim() || p.brand) === filters.manufacturer);
  return <div className="leadReports">
    <div className="leadReportTitle"><div><h2>Manufacturer inquiries</h2><p>Saved requests, reviewed by VPSF. No automatic manufacturer delivery.</p></div><button onClick={() => setRefresh(v => v+1)} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
    <section className="leadFilters" aria-label="Filter inquiries">
      <label>Manufacturer<select value={filters.manufacturer} onChange={e => filter("manufacturer", e.target.value)}><option value="">All manufacturers</option>{manufacturers.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Product<select value={filters.productId} onChange={e => filter("productId",e.target.value)}><option value="">All products</option>{matchingProducts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.product}</option>)}</select></label>
      <label>Status<select value={filters.status} onChange={e => filter("status",e.target.value)}><option value="">All statuses</option>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>From date<input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={e => filter("dateFrom",e.target.value)} /></label>
      <label>Through date<input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={e => filter("dateTo",e.target.value)} /></label>
      <label className="leadCheckbox"><input type="checkbox" checked={filters.includeDemo} onChange={e => filter("includeDemo",e.target.checked)}/> Include demo inquiries</label>
    </section>
    {error && <p role="alert" className="leadError">{error}</p>}
    {loading && <p role="status">Loading saved inquiries…</p>}
    {!loading && data && <>
      <div className="leadReportSummary"><p><strong>{data.total}</strong> {data.total === 1 ? "inquiry" : "inquiries"} matching these filters · {filters.includeDemo ? "Includes demo inquiries" : "Demo inquiries excluded"}</p><button onClick={download} disabled={exporting || !data.total}><Download size={16}/>{exporting ? "Preparing…" : "Export filtered CSV"}</button></div>
      <p className="leadReportHint">Export is for internal review. Only share records with permission after your approval. Date filters use UTC. Older inquiries may have no recorded intent or permissions.</p>
      <div className="leadStatusCounts" aria-label="Recorded inquiry statuses">{Object.entries(data.byStatus || {}).map(([key,count]) => <span key={key}>{statuses[key] || key}: <strong>{count}</strong></span>)}</div>
      {data.rows.length ? <div className="leadRows">{data.rows.map(lead => <article className="leadRow" key={lead.id}>
        <div><h3>{lead.name || "Name not recorded"}</h3><span>{lead.email || "Email not recorded"}</span><small>{displayDate(lead.createdAt)}</small></div>
        <div><strong>{lead.productName || lead.productId || "Product not recorded"}</strong><span>{intents[lead.intent] || lead.action || "Intent not recorded"}</span><small>{timelines[lead.timeline] || "Timing not recorded"} · ZIP {lead.zip || "unknown"}</small></div>
        <div><strong>{statuses[lead.status] || "New"}</strong><small>{lead.isDemo ? "Demo inquiry" : lead.shareConsent ? "Sharing permission granted" : "VPSF only"}</small><button onClick={() => setSelected(lead)}>Review inquiry #{lead.id}</button></div>
      </article>)}</div> : <div className="leadEmpty"><h3>No inquiries match these filters</h3><p>Requests submitted through a product’s Specifications/Pricing form appear here. Try another filter or include demo inquiries to inspect test activity.</p></div>}
      <div className="leadPagination"><button disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous page</button><span>Page {page} of {Math.max(1,Math.ceil(data.total/pageSize))}</span><button disabled={page*pageSize >= data.total} onClick={() => setPage(p => p+1)}>Next page</button></div>
    </>}
    {selected && <div ref={reviewRef} tabIndex={-1}><LeadReview key={`${selected.id}-${selected.revision}`} lead={selected} token={token} onClose={() => setSelected(null)} onSaved={() => {setSelected(null);setRefresh(v=>v+1);}}/></div>}
  </div>;
}
