import {confirmedFacts, validWalkValue} from './guidedHomeWalk.js';

// Repeated observations agree before pre-filling a scoring field.
export function preparePhotoReview(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!validWalkValue(row.field, row.value)) continue;
    grouped.set(row.field, [...(grouped.get(row.field) || []), row]);
  }
  const review = [...grouped].map(([field, entries]) => ({
    field, value: entries[0].value,
    conflict: new Set(entries.map(row => row.value)).size > 1,
    evidence: [...new Set(entries.map(row => row.evidence))].join(' '),
    uncertainty: [...new Set(entries.map(row => row.uncertainty))].join(' '),
  }));
  return {facts: confirmedFacts(review.filter(row => !row.conflict).map(row => ({...row, confirmed:true}))), review};
}
