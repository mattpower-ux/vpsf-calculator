import React, { useRef, useState } from "react";
import "./productLeads.css";

export default function ProductRequestForm({ product, home, onSubmitLead, onBack }) {
  const [fields, setFields] = useState({ name: "", email: "", phone: "", role: "homeowner", intent: "information", timeline: "researching", scope: "", zip: home?.demoScenario ? "" : home?.zip || "", contactConsent: false, shareConsent: false });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const update = (key, value) => setFields(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    if (busy.current || status === "success") return;
    busy.current = true;
    setStatus("sending"); setError("");
    try {
      await onSubmitLead({ ...fields, name: fields.name.trim(), email: fields.email.trim(), productId: product.id, action: "Requested specs and pricing" });
      setStatus("success");
    } catch (failure) { setStatus("error"); setError(failure.message || "Please try again. Your details are still here."); }
    finally { busy.current = false; }
  };
  return <form className="leadFormCard productLeadFormCard" onSubmit={submit}>
    <h3>Request Specifications/Pricing</h3>
    <p className="inquiryProduct"><strong>{product.name}</strong></p>
    {status === "success" ? <div role="status" className="inquirySuccess"><h4>Request received</h4><p>The VPSF team will review your request and follow up by email. Nothing has been sent to a manufacturer.</p></div> : <>
      <p>Tell the VPSF team what you need. We review every inquiry before arranging a next step.</p>
      {home?.address && !home.demoScenario && <p className="inquiryProperty">For <strong>{home.address}</strong></p>}
      <fieldset disabled={status === "sending"}>
        <legend>Your project</legend>
        <label className="field"><span>I’m looking for</span><select value={fields.intent} onChange={e => update("intent", e.target.value)}><option value="information">Product information</option><option value="planning">Help planning a project</option><option value="estimate">An installation estimate</option></select></label>
        <div className="inquiryGrid">
          <label className="field"><span>Your role</span><select value={fields.role} onChange={e => update("role", e.target.value)}><option value="homeowner">Homeowner</option><option value="buyer">Prospective buyer</option><option value="builder">Builder / contractor</option><option value="designer">Architect / designer</option><option value="agent">Real estate professional</option><option value="other">Other</option></select></label>
          <label className="field"><span>Project timing</span><select value={fields.timeline} onChange={e => update("timeline", e.target.value)}><option value="researching">Just researching</option><option value="within_3_months">Within 3 months</option><option value="within_12_months">Within 12 months</option><option value="later">More than a year away</option></select></label>
        </div>
        <label className="field"><span>Project ZIP code</span><input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10} value={fields.zip} onChange={e => update("zip", e.target.value)} /></label>
        <label className="field"><span>What work are you considering? <small>Optional</small></span><textarea rows={2} maxLength={500} placeholder="For example: replace an older system, upgrade one room, or improve the whole home." value={fields.scope} onChange={e => update("scope", e.target.value)} /></label>
      </fieldset>
      <fieldset disabled={status === "sending"}>
        <legend>How to reach you</legend>
        <label className="field"><span>Name</span><input required maxLength={120} autoComplete="name" value={fields.name} onChange={e => update("name", e.target.value)} /></label>
        <label className="field"><span>Email</span><input required type="email" maxLength={254} autoComplete="email" value={fields.email} onChange={e => update("email", e.target.value)} /></label>
        <label className="field"><span>Phone <small>Optional</small></span><input type="tel" maxLength={40} autoComplete="tel" value={fields.phone} onChange={e => update("phone", e.target.value)} /></label>
        <label className="inquiryConsent"><input type="checkbox" required checked={fields.contactConsent} onChange={e => update("contactConsent", e.target.checked)} /><span>VPSF may contact me about this request and save my contact details, project information, and relevant home assessment details for follow-up.</span></label>
        <label className="inquiryConsent"><input type="checkbox" checked={fields.shareConsent} onChange={e => update("shareConsent", e.target.checked)} /><span>VPSF may also share this request with the selected manufacturer or an installer after review. <small>Optional</small></span></label>
      </fieldset>
      {status === "error" && <p role="alert">Your request could not be saved. {error}</p>}
      <button className="primaryButton" type="submit" disabled={status === "sending"}>{status === "sending" ? "Submitting…" : "Send Request to VPSF"}</button>
    </>}
    <button className="secondaryButton" type="button" onClick={onBack} disabled={status === "sending"}>Back to Product</button>
  </form>;
}
