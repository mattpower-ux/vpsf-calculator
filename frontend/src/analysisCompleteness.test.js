import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceGroups, assessmentCompleteness } from './analysisCompleteness.js';

const provenance = (origin,source='') => ({origin,source});
test('UI contract exposes labels, descriptions and numeric completeness counts', () => {
  for (const {name, description, fields} of evidenceGroups) {
    assert.equal(typeof name, 'string');
    assert.equal(typeof description, 'string');
    for (const field of fields) {
      assert.deepEqual(Object.keys(field).sort(), ['key','label']);
      assert.equal(typeof field.key, 'string');
      assert.equal(typeof field.label, 'string');
    }
  }
  const result = assessmentCompleteness({});
  for (const stats of [result, ...result.groups]) {
    for (const key of ['total','documented','reported','review','unanswered']) {
      assert.ok(Number.isInteger(stats[key]) && stats[key] >= 0, key);
    }
  }
});

test('advanced Health, Carbon and Community fields remain in their checklists', () => {
  const expected = {
    health:['ventilation','materials','iaq','daylighting'],
    carbon:['carbonStrategy','carbonConcrete','structure'],
    community:['epaWalkability','walkscore','transit','greenspace','amenities','bike']
  };
  for (const [id, keys] of Object.entries(expected)) {
    assert.deepEqual(evidenceGroups.find(group=>group.id===id).fields.map(field=>field.key), keys);
  }
});

test('reviewed document imports, user edits and photo inference stay separate', () => {
  for (const [origin, source, category] of [
    ['imported','Reviewed document extraction','documented'],
    ['user-confirmed','Reviewed document extraction','reported'],
    ['inferred','Reviewed document extraction','review'],
    ['inferred','Photo analysis','review'],
    ['demo-assumption','Reviewed document extraction','review'],
    ['unknown','Reviewed document extraction','unanswered']
  ]) {
    const result = assessmentCompleteness({ventilation:'ERV', provenance:{ventilation:provenance(origin,source)}});
    assert.equal(result.groups.find(group=>group.id==='health').fields.find(field=>field.key==='ventilation').status, category);
    assert.equal(result.documented, category==='documented' ? 1 : 0);
    assert.equal(result.reported, category==='reported' ? 1 : 0);
    assert.equal(result.review, category==='review' ? 1 : 0);
    assert.equal(result.unanswered, result.total-(category==='unanswered' ? 0 : 1));
  }
});

test('registry has seven distinct pillars and no double-counted or metadata fields', () => {
  assert.deepEqual(evidenceGroups.map(group=>group.id),['energy','water','health','resilience','carbon','financial','community']);
  const keys=evidenceGroups.flatMap(group=>group.fields.map(field=>field.key));
  assert.equal(new Set(keys).size,keys.length);
  for(const group of evidenceGroups) {
    assert.ok(group.name && group.description && group.fields.length);
    assert.ok(group.fields.every(field=>field.key && field.label));
  }
  for(const key of ['analysisLevel','demoScenario','provenance','extraInputs','sourceNote']) assert.equal(keys.includes(key),false);
});

test('empty assessment is wholly unanswered with usable missing-field labels', () => {
  const result=assessmentCompleteness();
  assert.equal(result.total,evidenceGroups.reduce((sum,group)=>sum+group.fields.length,0));
  assert.equal(result.unanswered,result.total);
  assert.equal(result.documented+result.reported+result.review,0);
  assert.equal(result.missingFields.length,result.total);
  assert.ok(result.missingFields.every(field=>field.key && field.label && field.groupId));
});

test('counts categories separately and reconciles group totals without changing input', () => {
  const home={hvac:'Gas Furnace',roof:'Metal',solar:'None',siding:'Wood',waterHeater:'Tank',hers:'20',
    provenance:{hvac:provenance('imported','RentCast'),roof:provenance('imported','Inspection report: roof.pdf'),solar:provenance('user-confirmed','Home details'),siding:provenance('inferred','Document extraction'),waterHeater:provenance('demo-assumption','Property record'),hers:provenance('unknown','Initial form default')}};
  const before=structuredClone(home);
  const result=assessmentCompleteness(home);
  assert.equal(result.documented,2); assert.equal(result.reported,1); assert.equal(result.review,2); assert.equal(result.unanswered,result.total-5);
  for(const category of ['total','documented','reported','review','unanswered']) assert.equal(result[category],result.groups.reduce((sum,group)=>sum+group[category],0));
  assert.equal(result.total,result.documented+result.reported+result.review+result.unanswered);
  assert.equal(result.missingFields.some(field=>field.key==='siding'),false);
  assert.deepEqual(home,before);
});

test('inferences, demo assumptions and unsupported imports are never documentation', () => {
  for(const origin of ['inferred','demo-assumption']) {
    const result=assessmentCompleteness({roof:'Metal',provenance:{roof:provenance(origin,'ATTOM public record')}});
    assert.equal(result.documented,0); assert.equal(result.review,1);
  }
  for(const source of ['', 'AI photo analysis', 'Demo document', 'Property record: initial default', 'Document: inferred estimate', 'MLS listing']) {
    const result=assessmentCompleteness({roof:'Metal',provenance:{roof:provenance('imported',source)}});
    assert.equal(result.documented,0,source); assert.equal(result.review,1,source);
  }
});

test('recognized record and document sources count only with imported provenance', () => {
  for(const source of ['Property record','Public records','ATTOM permits','County assessor','Uploaded document: invoice.pdf','Document upload','Homeowner invoice','Utility bill','Energy audit','Certification: certificate.pdf']) {
    const home={hvac:'Gas Furnace',provenance:{hvac:provenance('imported',source)}};
    assert.equal(assessmentCompleteness(home).documented,1,source);
    home.provenance.hvac.origin='user-confirmed';
    const result=assessmentCompleteness(home);
    assert.equal(result.documented,0); assert.equal(result.reported,1);
  }
});

test('zero and explicit None are known while empty and nonfinite values are unanswered', () => {
  for(const value of [0,'0','None','Code-Minimum']) {
    assert.equal(assessmentCompleteness({hers:value,provenance:{hers:provenance('user-confirmed')}}).reported,1);
  }
  for(const value of [undefined,null,'','  ','Unknown',' none / unknown ',NaN,Infinity,{},[],false]) {
    const result=assessmentCompleteness({hers:value,provenance:{hers:provenance('imported','Energy audit')}});
    assert.equal(result.documented,0); assert.equal(result.unanswered,result.total);
  }
  assert.equal(assessmentCompleteness({hers:0}).unanswered,assessmentCompleteness().total);
});

test('regional evidence requires available values and explicit provenance', () => {
  const home={epaWalkability:{status:'available',value:12},provenance:{epaWalkability:provenance('imported','EPA National Walkability Index')}};
  assert.equal(assessmentCompleteness(home).documented,1);
  home.epaWalkability.status='unverified';
  assert.equal(assessmentCompleteness(home).documented,0);
  assert.equal(assessmentCompleteness({epaWalkability:{status:'available',value:12}}).documented,0);
});

test('result fields have categories and mutating a result does not alter the registry', () => {
  const result=assessmentCompleteness({roof:'Metal',provenance:{roof:provenance('user-confirmed')}});
  assert.equal(result.groups.find(group=>group.id==='resilience').fields.find(field=>field.key==='roof').status,'reported');
  result.groups[0].fields[0].label='changed';
  assert.notEqual(assessmentCompleteness().groups[0].fields[0].label,'changed');
});
