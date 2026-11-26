import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEvidenceSummary } from './evidenceSummary.js';

const permitEvidence={status:'matched',source:'PermitStack',address:'22 Dow Street',state:'ME',zip:'04102',
  fetchedAt:'2026-11-25T12:00:00Z',cacheHit:false,searchTruncated:false,searchedRecords:2,
  permits:[
    {id:'hp',permitNumber:'201700251',status:'FINAL',category:'HVAC',description:'Installation of 3 Mitsubishi heat pumps',jurisdiction:'Portland',address:'22 Dow Street',city:'Portland',state:'ME',zip:'04102',dateFiled:'2017-02-27',dateIssued:'2017-03-13',dateCompleted:'2017-04-12'},
    {id:'pv',permitNumber:'201700130',status:'FINAL',category:'SOLAR',description:'Installation of 26 solar panels',jurisdiction:'Portland',address:'22 Dow Street',city:'Portland',state:'ME',zip:'04102',dateFiled:'2017-01-30',dateIssued:'2017-02-23',dateCompleted:'2017-04-12'},
  ],coverage:{confidence:'high',covered:true,tierWindowClamped:false},sourceNote:'Reviewable records.'};

test('evidence summary separates records permits photos and precise remaining questions',()=>{
  const home={address:'22 Dow Street',city:'Portland',state:'ME',zip:'04102',homeType:'Multifamily',unitCount:'3',
    hvac:'Heat Pump (Electric)',solar:'Solar PV',roof:'Unknown',siding:'Unknown',waterHeater:'Unknown',windows:'',insulation:'',
    toilets:'Unknown',bathroomFaucets:'Unknown',showerheads:'Unknown',photoObservations:{paintCondition:'Peeling paint visible'},
    permitEvidence,provenance:{
      homeType:{origin:'imported',source:'Public listing metadata: Zillow'},unitCount:{origin:'imported',source:'Public records'},
      hvac:{origin:'imported',source:'Permit records: FINAL 201700251'},solar:{origin:'imported',source:'Permit records: FINAL 201700130'},
      photoObservations:{origin:'inferred',source:'Home Walk photos'},
    }};
  const summary=buildEvidenceSummary(home);
  assert.deepEqual(summary.publicRecords.map(item=>item.label),['Home type','Number of units']);
  assert.deepEqual(summary.completedPermits.map(item=>[item.label,item.detail]),[
    ['Heating / cooling','3 · Heat Pump (Electric) · 2017'],['Solar / battery','26 · Solar PV · 2017']]);
  assert.deepEqual(summary.photos.map(item=>item.label),['Exterior paint condition']);
  assert.deepEqual(summary.questions.map(item=>item.field),['roof','siding','waterHeater','windows']);
});

test('evidence summary never presents unknown defaults or issued permits as verified findings',()=>{
  const issued={...permitEvidence,permits:[{...permitEvidence.permits[0],status:'ISSUED',dateCompleted:null}]};
  const summary=buildEvidenceSummary({address:'22 Dow Street',city:'Portland',state:'ME',zip:'04102',hvac:'Unknown',solar:'None',permitEvidence:issued,
    provenance:{solar:{origin:'unknown',source:'Initial form default'}}});
  assert.equal(summary.publicRecords.length,0);
  assert.equal(summary.completedPermits.length,0);
  assert.equal(summary.photos.length,0);
  assert.ok(summary.questions.some(item=>item.field==='hvac'));
});

test('property review shows What we found before the detailed permit history',()=>{
  const source=fs.readFileSync(new URL('./App.jsx',import.meta.url),'utf8');
  assert.match(source,/<EvidenceSummary home=\{home\}\/>/);
  assert.ok(source.indexOf('<EvidenceSummary home={home}/>') < source.indexOf('<PermitHistory home={home}'));
});
