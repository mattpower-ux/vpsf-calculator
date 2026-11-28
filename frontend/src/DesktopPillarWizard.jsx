import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { assessmentCompleteness, evidenceGroups } from "./analysisCompleteness.js";

const REGIONAL_FIELDS = new Set(["epaWalkability"]);

function regionalValue(value) {
  if (!value || typeof value !== "object" || value.status !== "available") return "Unavailable";
  return value.level || (value.value != null ? `${value.value} / 20` : "Available");
}

export default function DesktopPillarWizard({ home, update, Field, options, activePillar, completed, onNext }) {
  const group = evidenceGroups.find(item => item.id === activePillar) || evidenceGroups[0];
  const stats = assessmentCompleteness(home).groups.find(item => item.id === group.id);
  const isLast = group.id === evidenceGroups[evidenceGroups.length - 1].id;

  return <section className="desktopPillarWizard" aria-labelledby="desktop-pillar-heading">
    <header className="desktopPillarHeader">
      <div>
        <h2 id="desktop-pillar-heading">{group.name}</h2>
        <p>{group.description}</p>
      </div>
      <div className="desktopPillarStatus" aria-label={`${stats.unanswered} unanswered and ${stats.review} needing review`}>
        {completed.includes(group.id) && <span><Check size={15}/> Reviewed</span>}
        <small>{stats.unanswered} unanswered · {stats.review} to review</small>
      </div>
    </header>

    <div className="desktopPillarFields">
      {group.fields.filter(field => field.key !== "wildfire").map(field => REGIONAL_FIELDS.has(field.key)
        ? <div className="desktopRegionalField" key={field.key}><strong>{field.label}</strong><span>{regionalValue(home[field.key])}</span><small>Location data</small></div>
        : <Field key={field.key} label={field.label} help={field.help} value={home[field.key] ?? ""} onChange={value => update(field.key, value)} options={options[field.key]}/>
      )}
    </div>

    {group.id === "carbon" && <details className="desktopDocumentationNote">
      <summary>What documentation counts?</summary>
      <p>Environmental Product Declarations (EPDs), material specifications, invoices, and builder records can document lower-carbon choices. A whole-building carbon comparison may also use a recognized benchmark, such as one from the Carbon Leadership Forum (CLF).</p>
    </details>}

    <footer className="desktopPillarActions">
      <p>Answer what you know. Unanswered items will remain visible and never prevent you from continuing.</p>
      <button type="button" className="primaryButton" onClick={onNext}>
        {isLast ? "Continue to Full Review" : `Next: ${evidenceGroups[evidenceGroups.indexOf(group) + 1].name}`} <ArrowRight size={18}/>
      </button>
    </footer>
  </section>;
}
