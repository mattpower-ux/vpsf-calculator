export const documentFields = {address:'Street address',squareFeet:'Square footage',yearBuilt:'Year built',bedrooms:'Bedrooms',bathrooms:'Bathrooms'};
export function parseDocumentUrls(text) {
  const entries = [...new Set(text.split(/[,\n]/).map(x=>x.trim()).filter(Boolean))];
  if (entries.length > 10) throw new Error('Please add at most 10 document links at a time.');
  for (const entry of entries) {
    let url;
    try { url = new URL(entry); } catch { throw new Error('Each document link must be a complete HTTPS URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
      throw new Error('Use public HTTPS document links without login details.');
  }
  return entries;
}
export function mergeDocumentFacts(results) {
  const facts = {}, selected = {}, alternatives = {};
  for (const key of Object.keys(documentFields)) {
    const values = [...new Set(results.map(x=>String(x[key] || '').trim()).filter(Boolean))];
    if (!values.length) continue;
    facts[key] = values[0]; selected[key] = values.length === 1;
    if (values.length > 1) alternatives[key] = values;
  }
  return {facts,selected,alternatives};
}
