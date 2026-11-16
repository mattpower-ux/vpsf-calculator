import React, { useState } from 'react';
import { featureField, fixtureFields, newCertification, recognitionNames, removeCertification } from './certifications.js';
import './certifications.css';

const labelFor = field => fixtureFields.find(([key]) => key === field)?.[1]
  || String(field || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, value => value.toUpperCase());

function FeatureCorrection({feature, update, Field, options}) {
  const [value, setValue] = useState('');
  return <details><summary>Edit {labelFor(feature.field).toLowerCase()}</summary>
    <Field label={`Your ${labelFor(feature.field).toLowerCase()}`} value={value} emptyLabel="Choose your answer"
      options={options[feature.field]} onChange={setValue}/>
    <button type="button" className="secondaryButton" disabled={!value.trim()} onClick={() => update(feature.field,value)}>Use my answer</button>
    <button type="button" className="secondaryButton" onClick={() => update(feature.field,'Unknown')}>Mark unknown</button>
    <small>Your answer replaces this assumption, even if you remove the certification.</small>
  </details>;
}

export function CertificationFindings({data, catalog, update, Field, options = {}}) {
  if (!data) return null;
  const features = (data.derivedFeatures || []).map(feature => ({...feature,field:featureField(feature)}));
  const recognitions = data.recognitions || [];
  const conflicts = (data.conflicts || []).map(feature => ({...feature,field:featureField(feature)}));
  return <div className="certificationFindings">
    {features.length > 0 && <><p><strong>Filled from certification</strong></p>
      {features.map((feature, index) => <div key={`${feature.field}-${index}`} className="certificationFeature">
        <p>{labelFor(feature.field)}: <strong>{String(feature.value ?? '')}</strong></p>
        {update && Field && <FeatureCorrection feature={feature} update={update} Field={Field} options={options}/>}
      </div>)}
    </>}
    {recognitions.length > 0 && <p>Recognition: {recognitionNames(data,catalog).join('; ')}. {features.length ? 'Only supported feature requirements fill missing details.' : 'No additional feature assumptions were applied.'}</p>}
    {conflicts.map((conflict,index) => <div key={index}><p role="status">{conflict.message || `${labelFor(conflict.field)} needs review. Your recorded answer is kept; check it against the certificate.`}</p>
      {conflict.field && update && Field && <FeatureCorrection feature={conflict} update={update} Field={Field} options={options}/>}
    </div>)}
  </div>;
}

export default function Certifications({home, update, preview, catalogState = {}, Field, options}) {
  const {data:catalog,error,retry} = catalogState;
  const claims = Array.isArray(home.certifications) ? home.certifications : [];
  const programs = catalog?.programs || [];
  const change = (index, patch) => update('certifications',claims.map((claim,i) => i === index ? {...claim,...patch} : claim));
  return <details className="certificationsPanel formSection">
    <summary>Certifications <span>Optional{claims.length ? ` · ${claims.length} reported` : ''}</span></summary>
    <div className="certificationsBody">
      <p>Add a certification for this home to fill supported missing details. Select the exact edition and level when known.</p>
      <p className="certificationAddress">Property: {home.address || 'Enter your property address first'}</p>
      {error && <p role="status">{error} <button type="button" className="secondaryButton" onClick={retry}>Retry list</button></p>}
      {!catalog && !error && <p role="status">Loading certifications…</p>}
      {claims.map((claim,index) => {
        const program = programs.find(item => item.id === claim.programId);
        const editions = program?.editions || [];
        const edition = editions.find(item => item.id === claim.edition);
        return <fieldset key={index} className="certificationClaim">
          <legend>{program?.name || claim.programId || 'Certification'}</legend>
          <div className="certificationGrid">
            <label className="field"><span>Program / recognition</span><select value={claim.programId} onChange={event => change(index,{programId:event.target.value,edition:'',level:''})}>
              {!program && <option value={claim.programId}>{claim.programId}</option>}
              {programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label className="field"><span>Edition</span><select value={claim.edition || ''} onChange={event => change(index,{edition:event.target.value,level:''})}>
              <option value="">Unknown — recognition only</option>
              {claim.edition && !edition && <option value={claim.edition}>{claim.edition} (unlisted)</option>}
              {editions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select></label>
            <Field label="Level" value={claim.level || ''} emptyLabel="Unknown — recognition only" options={edition?.levels || []} onChange={level => change(index,{level})}/>
          </div>
          <details className="certificationMetadata"><summary>Certificate details (optional)</summary>
            <div className="certificationGrid">
              <Field label="Certificate identifier" maxLength={160} value={claim.certificateId || ''} onChange={certificateId => change(index,{certificateId})}/>
              <label className="field"><span>Issue date</span><input type="date" value={claim.issuedDate || ''} onChange={event => change(index,{issuedDate:event.target.value || null})}/></label>
              <Field label="Evidence reference" maxLength={1000} value={claim.evidenceReference || ''} onChange={evidenceReference => change(index,{evidenceReference})}/>
            </div>
          </details>
          <button type="button" className="secondaryButton" onClick={() => update('certifications',removeCertification(home,index).certifications)}>Remove {program?.name || 'certification'}</button>
        </fieldset>;
      })}
      <label className="field"><span>Add certification</span><select value="" disabled={!home.address || !programs.length || claims.length >= 20} onChange={event => {
        if (event.target.value) update('certifications',[...claims,newCertification(home,event.target.value)]);
      }}><option value="">Select a program</option>{programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
      {claims.length > 0 && <p><small>Changing the property address clears these claims. Certificate identifiers and dates are optional.</small></p>}
      {preview?.loading && <p role="status">Checking certification requirements…</p>}
      {preview?.error && <p role="status">{preview.error} <button type="button" className="secondaryButton" onClick={preview.retry}>Retry preview</button></p>}
      <CertificationFindings data={preview?.data} catalog={catalog} update={update} Field={Field} options={options}/>
    </div>
  </details>;
}
