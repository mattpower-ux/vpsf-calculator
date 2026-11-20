import { wildfireAssessment } from './wildfire.js';
const websites = {
 'James Hardie':'https://www.jameshardie.com/', 'Allura':'https://allurausa.com/', 'GAF':'https://www.gaf.com/', 'Nichiha':'https://www.nichiha.com/', 'Fiberon':'https://www.fiberoncladding.com/', 'Moen':'https://www.moen.com/', 'Kohler':'https://www.kohler.com/', 'Niagara':'https://niagaracorp.com/', 'Rheem':'https://www.rheem.com/', 'U.S. Boiler':'https://www.usboiler.net/', 'Navien':'https://www.navieninc.com/', 'Rainwater Management Solutions':'https://rainwatermanagement.com/', 'CertainTeed':'https://www.certainteed.com/', 'RenewAire':'https://renewaire.com/', 'Rachio':'https://rachio.com/', 'ATAS':'https://www.atas.com/', 'Euroshield':'https://www.euroshieldroofing.com/'
};
export function companyWebsite(product) {
 if (product.companyUrl) {
  try { const url = new URL(product.companyUrl); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
 }
 if (websites[product.brand]) return websites[product.brand];
 try { const url = new URL(product.companyWebsite || product.sourceUrl); return url.protocol === 'https:' && !url.hostname.endsWith('.gov') ? url.origin + '/' : null; } catch { return null; }
}
export function leadForHome(lead, home, result, product) {
 const assessmentContext = {};
 const recorded = key => {
  const value = home[key];
  if (value == null || /^(unknown|none \/ unknown)$/i.test(String(value).trim())) return undefined;
  if (home.demoScenario) return value;
  const origin = home.provenance?.[key]?.origin;
  if (!['user-confirmed','imported','inferred'].includes(origin)) return undefined;
  return `${origin === 'user-confirmed' ? 'Homeowner confirmed' : origin === 'inferred' ? 'Inferred; review needed' : 'Imported record'}: ${value}`;
 };
 const values = { sidingType: recorded('siding'), roofType: recorded('roof'), roofAge: recorded('roofAge'),
  wildfireRisk: wildfireAssessment(home)?.level, resilienceScore: result?.scores?.resilience,
  totalScore: result?.total, modelVersion: result?.modelVersion, reason: product?.match?.reasons?.join(' ') };
 for (const [key,value] of Object.entries(values)) {
  if (typeof value === 'string' && value.trim()) assessmentContext[key] = value.slice(0, 500);
  else if (typeof value === 'number' && Number.isFinite(value)) assessmentContext[key] = value;
 }
 return {...lead, isDemo: !!home.demoScenario, assessmentContext,
  ...(!home.demoScenario && home.address ? {propertyAddress:home.address} : {}),
  zip: lead.zip || (!home.demoScenario ? home.zip : undefined)};
}

export function inquiryHomeFor({resultMode, selectedProperty, hasAssessedHome, home}) {
 if (resultMode === 'demo') return {...selectedProperty, demoScenario:'catalog-demo'};
 return home.demoScenario || hasAssessedHome ? home : {};
}
