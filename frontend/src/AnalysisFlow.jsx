import React, { useState } from 'react';
import { ArrowRight, Upload, Camera } from 'lucide-react';
import CaptureDialog from './CaptureDialog.jsx';
import DocumentUpload from './DocumentUpload.jsx';
import GuidedHomeWalk from './GuidedHomeWalk.jsx';
import { LISTING_SOURCES, ListingLogo } from './ListingImport.jsx';
import './analysisFlow.css';

export function AnalysisEvidence({ home, onApply, onListingSelect }) {
  const [mode, setMode] = useState(null);
  const apply = (facts, review) => { onApply(facts, review); setMode(null); };
  return <section className="analysisEvidence" aria-label="Add supporting information">
    <h3>Add supporting information</h3>
    <p>Fill in what you know, or let documents and photos help.</p>
    <div>
      <button type="button" onClick={() => setMode('documents')}><Upload size={19}/> Upload Documents / Photos</button>
      <button type="button" onClick={() => setMode('walk')}><Camera size={19}/> Guided Home Walk</button>
    </div>
    <details className="supportingListingImport">
      <summary>Import a listing</summary>
      <div className="listingImportGrid">{Object.entries(LISTING_SOURCES).map(([source,brand]) => <button type="button" key={source} aria-label={`Import ${brand.name} Listing`} onClick={() => onListingSelect(source)}><ListingLogo source={source}/><span>Import listing <ArrowRight size={15} aria-hidden="true"/></span></button>)}</div>
    </details>
    {mode && <CaptureDialog title={mode === 'walk' ? 'Guided Home Walk' : 'Upload Documents / Photos'} onClose={() => setMode(null)}>
      {mode === 'walk' ? <GuidedHomeWalk demo={!!home.demoScenario} onApply={apply} onClose={() => setMode(null)}/> : <DocumentUpload onApply={apply}/>}
    </CaptureDialog>}
  </section>;
}

export function InclusiveIntroduction({ onContinue }) {
  return <div className="screen inclusiveIntroduction">
    <h2>Inclusive Analysis</h2>
    <p className="inclusiveLead">This method will give you the most accurate VPSF score for your home.</p>
    <p>We’ll ask you to fill in some details. The more, the better.</p>
    <ul><li>Start with the property information we found.</li><li>Add details about your home’s systems and features.</li><li>Use documents or a guided photo walk to fill in gaps.</li><li>Review your information, then generate your score.</li></ul>
    <button className="primaryButton" onClick={onContinue}>Start Full Review <ArrowRight size={18}/></button>
  </div>;
}

const GROUPS = [
  ['Property', [['address','Street address'],['city','City'],['state','State'],['zip','ZIP'],['homeType','Home type'],['yearBuilt','Year built'],['squareFeet','Square feet'],['stories','Stories'],['bedrooms','Bedrooms'],['bathrooms','Bathrooms'],['lotSize','Lot size'],['garage','Garage'],['occupancy','Occupancy'],['climateZone','Climate zone']]],
  ['Known home features', [['hvac','Heating / cooling'],['hvacAge','HVAC age'],['waterHeater','Water heating'],['waterHeaterAge','Water heater age'],['roof','Roof material'],['roofAge','Roof age'],['siding','Siding'],['windows','Windows'],['insulation','Insulation'],['solar','Solar / battery'],['ventilation','Ventilation'],['wildfireMitigation','Wildfire protection'],['flood','Flood protection'],['backup','Backup power'],['hers','HERS rating'],['evReady','EV readiness'],['fortified','Resilience certification'],['heatingDistribution','Heat distribution'],['hydronicSource','Hydronic heat source'],['heatingControls','Heating controls'],['moisture','Moisture protection'],['temperatureProtection','Temperature protection'],['windProtection','Wind protection'],['healthCert','Health certification'],['materials','Interior materials'],['iaq','Air quality monitoring'],['daylighting','Daylighting'],['carbonStrategy','Carbon strategy'],['carbonConcrete','Concrete'],['structure','Structure'],['waterStandard','Water standard'],['leak','Leak protection'],['reuse','Water reuse'],['irrigation','Irrigation'],['landscape','Landscaping'],['pietim','Ownership-cost ratio'],['insurance','Insurance'],['warranty','Warranty'],['maintenance','Maintenance'],['walkscore','Walk score'],['transit','Transit'],['greenspace','Green space'],['amenities','Shared amenities'],['bike','Bike access']]],
];
export function BroadReview({ home, onSubmit, onBack, busy, error }) {
  return <div className="screen broadReview">
    <h2>Review Available Information</h2>
    <p className="subhead">A broad view based on the available property record. Missing details stay unanswered.</p>
    {GROUPS.map(([title,fields]) => {
      const known = fields.filter(([key]) => home[key] !== null && home[key] !== undefined && String(home[key]).trim() && !/^(unknown|none \/ unknown)$/i.test(String(home[key]).trim()));
      return known.length ? <section className="summaryCard" key={title}><h3>{title}</h3><dl className="knownFacts">{known.map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{home[key]}</dd></div>)}</dl></section> : null;
    })}
    {(home.wildfire?.status === 'available' || home.epaWalkability?.status === 'available') && <section className="summaryCard"><h3>Regional context</h3><dl className="knownFacts">
      {home.wildfire?.status === 'available' && <div><dt>USFS area wildfire risk</dt><dd>{home.wildfire.level}<small>{home.wildfire.areaName}</small></dd></div>}
      {home.epaWalkability?.status === 'available' && <div><dt>EPA walkability index</dt><dd>{home.epaWalkability.value} / 20</dd></div>}
    </dl></section>}
    <button className="primaryButton" onClick={onSubmit} disabled={busy}>{busy ? 'Analyzing…' : 'Generate Broad Analysis'} <ArrowRight size={18}/></button>
    <button className="textLink" onClick={onBack}>Choose another analysis level</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
