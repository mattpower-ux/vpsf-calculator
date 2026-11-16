import test from 'node:test';
import assert from 'node:assert/strict';
import * as certifications from './certifications.js';
import { confirmedEdit } from './homeAdvice.js';
import { prepareAnalysisHome } from './analysisLevels.js';
import { prepareDraftHome, saveAnalysisDraft, loadAnalysisDraft } from './analysisDraft.js';
import { applyAnalysisEvidence } from './captureFacts.js';

const home = () => ({address:'12 Main St, Unit 2',city:'Boston',state:'MA',zip:'02110',analysisLevel:'inclusive',toilets:'',provenance:{},certifications:[{programId:'watersense',edition:'2.0',level:'Certified',propertyAddress:'12 Main St, Unit 2',certificateId:'',issuedDate:null,evidenceReference:'',status:'reported',replacedFields:[]}]});

test('removing a claim removes assumptions without changing raw facts or other claims', () => {
  const raw = home();
  const preview = {effectiveInput:{...raw,toilets:'WaterSense'}};
  assert.equal(certifications.presentationInput(raw,preview).toilets,'WaterSense');
  const removed = certifications.removeCertification(raw,0);
  assert.equal(removed.toilets,'');
  assert.deepEqual(removed.certifications,[]);
  assert.equal(raw.certifications.length,1);
  assert.equal(certifications.presentationInput(removed,null).toilets,'');
});

test('explicit fixture overrides survive claim removal, including Unknown', () => {
  for (const value of ['Standard','Unknown']) {
    const edited = confirmedEdit(home(),'toilets',value);
    assert.equal(edited.provenance.toilets.origin,'user-confirmed');
    assert.ok(edited.certifications[0].replacedFields.includes('toilets'));
    assert.equal(certifications.removeCertification(edited,0).toilets,value);
  }
});

test('address edits clear claims rather than transfer evidence to another property', () => {
  for (const field of ['address','city','state','zip']) {
    assert.deepEqual(confirmedEdit(home(),field,'Different').certifications,[]);
  }
  assert.equal(confirmedEdit(home(),'address',home().address).certifications.length,1);
  assert.deepEqual(applyAnalysisEvidence(home(),{city:'Other city'}).certifications,[]);
  assert.deepEqual(applyAnalysisEvidence(home(),{address:'Another property'}).certifications,[]);
});

test('new claims bind the current address without requiring optional metadata', () => {
  const claim = certifications.newCertification(home(),'watersense');
  assert.equal(claim.propertyAddress,'12 Main St, Unit 2');
  assert.equal(claim.propertyCity,'Boston');
  assert.equal(claim.propertyState,'MA');
  assert.equal(claim.propertyZip,'02110');
  assert.equal(claim.edition,'');
  assert.equal(claim.level,'');
  assert.equal(claim.status,'reported');
  assert.equal(claim.issuedDate,null);
});

test('drafts retain optional property binding and recognitions use catalog program names', () => {
  const claim = {...home().certifications[0], propertyCity:'Boston',propertyState:'MA',propertyZip:'02110',evidenceReference:'x'.repeat(700)};
  assert.deepEqual(certifications.draftCertifications([claim])[0],claim);
  assert.deepEqual(certifications.recognitionNames({recognitions:[{programId:'watersense'},{programId:'watersense'},{programId:'unknown-program'}]},
    {programs:[{id:'watersense',name:'WaterSense labeled homes'}]}),['WaterSense labeled homes','unknown-program']);
});

test('blank fixture and fire-rating answers stay valid API Unknown values', () => {
  const prepared = prepareAnalysisHome({},'moderate');
  for (const key of ['toilets','bathroomFaucets','showerheads','roofFireRating']) {
    assert.equal(prepared[key],'Unknown');
    assert.equal(confirmedEdit(home(),key,'')[key],'Unknown');
  }
});

test('presentation labels derived target fields without promoting raw provenance', () => {
  const raw = home();
  const presented = certifications.presentationInput(raw,{
    effectiveInput:{...raw,toilets:'WaterSense'},
    certificationEvidence:{derivedFeatures:[{target:'toilets',value:'WaterSense'}]}
  });
  assert.equal(presented.provenance.toilets.origin,'inferred');
  assert.equal(raw.provenance.toilets,undefined);
  assert.equal(raw.toilets,'');
});

test('raw claims and fixture confirmations round trip through preparation and drafts', () => {
  const raw = confirmedEdit(home(),'toilets','Standard');
  for (const prepared of [prepareAnalysisHome(raw,'inclusive'),prepareDraftHome(raw)]) {
    assert.deepEqual(prepared.certifications,raw.certifications);
    assert.equal(prepared.toilets,'Standard');
    assert.equal(prepared.provenance.toilets.origin,'user-confirmed');
  }
  assert.equal(prepareAnalysisHome(raw,'broad').certifications,undefined);
});

test('every certification target retains explicit Unknown and provenance through draft restore', () => {
  // Includes non-enum targets: Indoor AirPlus ventilation and conditional siding.
  for (const field of ['toilets','bathroomFaucets','showerheads','roofFireRating','ventilation','siding']) {
    const raw = {...home(),[field]:'Unknown',provenance:{[field]:{origin:'user-confirmed',source:'Home details',date:'2026-11-15T12:00:00.000Z'}}};
    // Do not rely on replacedFields: the explicit answer itself must survive.
    let stored;
    const storage = {setItem:(_,value)=>{stored=value;},getItem:()=>stored};
    saveAnalysisDraft(raw,storage);
    for (const prepared of [prepareAnalysisHome(raw,'moderate'),prepareAnalysisHome(raw,'inclusive'),loadAnalysisDraft(storage).home]) {
      assert.equal(prepared[field],'Unknown',field);
      assert.deepEqual(prepared.provenance[field],raw.provenance[field],field);
    }
    assert.equal(prepareAnalysisHome(raw,'broad').provenance[field],undefined);
  }
});

