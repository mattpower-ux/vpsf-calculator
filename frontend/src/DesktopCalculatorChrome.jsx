import React, { useEffect, useRef } from "react";
import { Check, ChevronLeft, ClipboardList, Home, Save, Sparkles } from "lucide-react";
import { DESKTOP_STAGES, desktopContextForScreen } from "./desktopWorkflow.js";
import brandLogo from "./assets/brand-preview/VPSF_Logo_Primary_Color.svg";
import "./desktopCalculatorChrome.css";
import "./desktopEntry.css";

const PILLAR_LABELS = ["Energy", "Water", "Health", "Resilience", "Materials & Carbon", "Financial Risk", "Community & Mobility"];

function propertyAddress(home) {
  return [home?.address, home?.city, home?.state, home?.zip].filter(Boolean).join(", ") || "Property address not yet entered";
}

export default function DesktopCalculatorChrome({
  children,
  screen,
  setScreen,
  onBack,
  onViewMode,
  home,
  propertyImage,
  result,
  onSaveDraft,
  saveStatus
}) {
  const context = desktopContextForScreen(screen);
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [screen]);
  const stageTargets = [0, home?.analysisLevel === "inclusive" ? 14 : 1, 4, 6];
  return (
    <div className="desktopCalculator" data-stage={context.stage}>
      <header className="desktopHeader">
        <div className="desktopBrand"><img src={brandLogo} alt="Value Per Square Foot" /><span>POWERED BY GREEN BUILDER MEDIA</span></div>
        <nav className="desktopStageNav" aria-label="Choose the home, Document the home, Review scores, Explore recommendations">
          {DESKTOP_STAGES.map((stage, index) => (
            <button key={stage.id} type="button" className={context.stage === stage.id ? "active" : context.stage > stage.id ? "complete" : ""}
              aria-current={context.stage === stage.id ? "step" : undefined}
              disabled={(stage.id === 3 || stage.id === 4) && !result}
              onClick={() => setScreen(stageTargets[index])}>
              <span>{context.stage > stage.id ? <Check size={14} /> : stage.id}</span>{stage.label}
            </button>
          ))}
        </nav>
        <button type="button" className="desktopReturnMobile" onClick={() => onViewMode("mobile")}>Return to mobile view</button>
      </header>

      <div className={`desktopWorkspace${context.showPropertyRail ? " hasProperty" : ""}${context.showGuidanceRail ? " hasGuidance" : ""}`}>
        {context.showPropertyRail && <aside className="desktopPropertyRail" aria-label="Current audit">
          <p className="desktopEyebrow">YOUR AUDIT</p>
          <div className="desktopPropertyCard">
            {propertyImage ? <img src={propertyImage} alt={`Exterior of ${propertyAddress(home)}`} /> : <div className="desktopPropertyFallback"><Home size={38}/><span>Exterior photo unavailable</span></div>}
            <strong>{home?.address || "Current property"}</strong>
            <small>{[home?.city, home?.state].filter(Boolean).join(", ")} · {home?.analysisLevel === "inclusive" ? "Superior analysis" : "Basic analysis"}</small>
          </div>
          <ol className="desktopAuditSteps">
            {DESKTOP_STAGES.map(stage => <li key={stage.id} className={context.stage === stage.id ? "active" : context.stage > stage.id ? "complete" : ""}>
              <span>{context.stage > stage.id ? <Check size={14}/> : stage.id}</span>{stage.label}
            </li>)}
          </ol>
          {context.stage === 2 && <div className="desktopPillars"><p className="desktopEyebrow">SEVEN PILLARS</p>{PILLAR_LABELS.map(label => <span key={label}>{label}</span>)}</div>}
        </aside>}

        <main className="desktopMain" aria-labelledby={screen !== 0 ? "desktop-screen-heading" : undefined} aria-label={screen === 0 ? "Analyze an existing home" : undefined}>
          {screen > 0 && <button type="button" className="desktopBack" onClick={onBack} aria-label="Go back"><ChevronLeft size={20}/></button>}
          {screen !== 0 && <h1 id="desktop-screen-heading" ref={headingRef} tabIndex="-1" className="desktopScreenTitle">{context.title}</h1>}
          <div className="desktopScreenSlot">{children}</div>
        </main>

        {context.showGuidanceRail && <aside className="desktopGuidance" aria-label="Assessment guidance">
          {context.canSaveDraft && <div className="desktopSavePanel">
            <button type="button" onClick={onSaveDraft}><Save size={17}/>Save draft</button>
            {saveStatus && <p role="status">{saveStatus}</p>}
          </div>}
          <section><h2>Why we’re asking</h2><p>These details improve the accuracy of your score and make each recommendation more specific to this home.</p></section>
          <section className="desktopGuidanceHighlight"><h2>Best next action</h2><p>{context.stage === 2 ? "Answer what you know. Unanswered items never prevent you from continuing." : context.stage === 3 ? "Review low-scoring pillars, then open the improvement path." : "Compare relevant solutions for the home’s highest-priority needs."}</p></section>
          <section><h2>Assessment status</h2><dl><div><dt>Current stage</dt><dd>{context.stage} of 4</dd></div><div><dt>Score</dt><dd>{result?.total ?? "Not generated"}</dd></div></dl></section>
          <section><h2>Evidence sources</h2><div className="desktopEvidenceTags"><span>Property record</span><span>Permit history</span><span>Regional risk</span></div></section>
        </aside>}
      </div>
      <footer className="desktopFooter"><Sparkles size={15}/> A FREE REPORT CARD FOR YOUR HOME <span>·</span> Performance <span>·</span> Durability <span>·</span> Efficiency <span>·</span> Resilience</footer>
    </div>
  );
}

