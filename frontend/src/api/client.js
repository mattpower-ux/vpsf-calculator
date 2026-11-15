function resolveApiBaseUrl() {
  if (import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== "undefined" && window.location.hostname.endsWith(".onrender.com")) {
    return "https://vpsf-api.onrender.com";
  }

  return "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

export async function extractUpload(file) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/properties/ocr`, { method: "POST", body, signal: AbortSignal.timeout(120000) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The upload could not be processed.");
  return data;
}

export function getArticleReaderUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  const isReaderPage = url.protocol === "https:"
    && ["www.greenbuildermedia.com", "greenbuildermedia.com"].includes(url.hostname)
    && !url.port && !url.username && !url.password
    && (/^\/(blog|transcripts)\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/?$/.test(url.pathname)
      || /^\/blog\/topic\/[a-zA-Z0-9_-]+(?:\/page\/[1-9][0-9]*)?\/?$/.test(url.pathname));
  // PDFs and other non-article resources remain their original resource types.
  if (!isReaderPage) return sourceUrl;
  return `${API_BASE_URL}/api/articles/read?${new URLSearchParams({ url: sourceUrl })}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = typeof response.json === "function" ? await response.json().catch(() => ({})) : {};
    throw new Error(typeof body.detail === "string" ? body.detail : `API request failed: ${response.status}. Check the form fields or retry.`);
  }

  return response.json();
}

function adminOptions(token, options = {}) {
  return {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  };
}

async function optionalRequest(path, options = {}) {
  try {
    return await request(path, options);
  } catch (error) {
    console.warn(`Optional API request failed: ${path}`, error);
    return null;
  }
}

export async function scoreProperty(propertyInput) {
  return request(propertyInput.demoScenario === "hardie-wildfire" ? "/api/demos/hardie-wildfire/score" : "/api/score", {
    method: "POST",
    body: JSON.stringify(propertyInput)
  });
}

export async function getScoringFormFields() {
  return request("/api/scoring/form-fields");
}

export async function geocodeProperty(address) {
  return request("/api/properties/geocode", {
    method: "POST",
    body: JSON.stringify({ address })
  });
}

export async function enrichPropertyWithRentCast(address) {
  return request("/api/properties/rentcast", {
    method: "POST",
    body: JSON.stringify({ address })
  });
}

export async function enrichPropertyWithAttom(address) {
  return request("/api/properties/attom", {
    method: "POST",
    body: JSON.stringify({ address })
  });
}

export async function enrichPropertyRisk({ latitude, longitude, state, zip }) {
  return request("/api/properties/risk", {
    method: "POST",
    body: JSON.stringify({ latitude, longitude, state, zip })
  });
}

export async function findSavedProperty({ address, city = "", state = "", zip = "" }) {
  const params = new URLSearchParams({ address, city, state, zip });
  return optionalRequest(`/api/tracking/saved-property?${params.toString()}`);
}

export async function getEducationContent(key) {
  return optionalRequest(`/api/products/education/${encodeURIComponent(key)}`);
}

export async function cacheEducationContent(key, content) {
  return optionalRequest(`/api/products/education/${encodeURIComponent(key)}/cache`, {
    method: "POST",
    body: JSON.stringify(content)
  });
}

export async function getProductRecommendations() {
  const products = await request("/api/products/recommendations");
  return products.map((product) => ({
    ...product,
    id: product.id,
    name: `${product.brand} ${product.product}`,
    category: product.category,
    image: product.imageUrl,
    improvement: "Score impact depends on installed features",
    description: product.summary,
    technicalWriteup: product.summary,
    pillar: product.pillar,
    brand: product.brand,
    weight: product.weight
  }));
}

export function getHelpGuide() {
  return optionalRequest("/api/help/guide");
}

export function searchHelpGuide(query) {
  return optionalRequest(`/api/help/search?${new URLSearchParams({ q: query })}`);
}

export async function submitLead(lead) {
  return request("/api/leads", {
    method: "POST",
    body: JSON.stringify(lead)
  });
}

function leadReportQuery(filters = {}) {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value != null)).toString();
}
export const getLeadReport = (token, filters) => request(`/api/admin/reports/leads?${leadReportQuery(filters)}`, adminOptions(token));
export const updateLead = (token, id, payload) => request(`/api/admin/leads/${id}`, adminOptions(token, {method: "PATCH", body: JSON.stringify(payload)}));
export async function exportLeadReport(token, filters) {
  const response = await fetch(`${API_BASE_URL}/api/admin/reports/leads/export?${leadReportQuery(filters)}`, adminOptions(token));
  if (!response.ok) throw new Error("The report could not be exported. Please retry or sign in again.");
  return response.blob();
}

export async function trackPropertyQuery(payload) {
  return optionalRequest("/api/tracking/property-query", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function trackProgress(payload) {
  return optionalRequest("/api/tracking/progress", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function trackProductClick(payload) {
  return optionalRequest("/api/tracking/product-click", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function loginAdmin(password) {
  return request("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) });
}

export async function getAdminProducts(token) {
  return request("/api/admin/products", adminOptions(token));
}

export async function getAdminPropertyQueries(token) {
  return request("/api/admin/property-queries", adminOptions(token));
}

export async function getAdminProductClicks(token) {
  return request("/api/admin/product-clicks", adminOptions(token));
}

export async function updateProductWeighting(productId, weight, token) {
  return request(`/api/admin/products/${productId}/weighting?weight=${encodeURIComponent(weight)}`, adminOptions(token, {
    method: "PATCH"
  }));
}

export const getScoringModel = (token) => request("/api/admin/scoring/model", adminOptions(token));
export const getScoringDraft = (token) => request("/api/admin/scoring/draft", adminOptions(token));
export const getScoringHistory = (token) => request("/api/admin/scoring/history", adminOptions(token));
export const getScoringAvailableFields = (token) => request("/api/admin/scoring/available-fields", adminOptions(token));
export const getScoringCandidates = (token) => request("/api/admin/scoring/candidates", adminOptions(token));
export const getAdminScoredProperties = (token) => request("/api/admin/properties", adminOptions(token));
export const saveScoringDraft = (token, payload) => request("/api/admin/scoring/draft", adminOptions(token, { method: "PUT", body: JSON.stringify(payload) }));
export const validateScoringDraft = (token, model) => request("/api/admin/scoring/validate", adminOptions(token, { method: "POST", body: JSON.stringify(model) }));
export const previewScoringDraft = (token, propertyId) => request("/api/admin/scoring/preview", adminOptions(token, { method: "POST", body: JSON.stringify({ propertyId }) }));
export const publishScoringDraft = (token, revision) => request("/api/admin/scoring/publish", adminOptions(token, { method: "POST", body: JSON.stringify({ revision }) }));


export const getHomeAdvice=(home,modelVersion,signal)=>request('/api/products/advice',{method:'POST',body:JSON.stringify({home,modelVersion}),signal});
export const getEcoTips=()=>request('/api/eco-tips',{signal:AbortSignal.timeout(10000)});
export const getAdminEcoTips=token=>request('/api/admin/eco-tips',adminOptions(token));
export const saveAdminEcoTip=(token,id,data,revision)=>request(`/api/admin/eco-tips/${encodeURIComponent(id)}`,adminOptions(token,{method:'PUT',body:JSON.stringify({data,revision})}));
export const publishAdminEcoTip=(token,id,action,revision,version)=>request(`/api/admin/eco-tips/${encodeURIComponent(id)}/${action}`,adminOptions(token,{method:'POST',body:JSON.stringify({revision,version})}));
export const saveProductMetadata=(token,id,data,revision)=>request(`/api/admin/products/${encodeURIComponent(id)}/metadata`,adminOptions(token,{method:'PUT',body:JSON.stringify({data,revision})}));

export const getHardieDemo = () => request("/api/demos/hardie-wildfire");


export async function extractDocumentUrl(url) {
  const response = await fetch(`${API_BASE_URL}/api/properties/ocr-url`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({url}), signal: AbortSignal.timeout(150000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The document link could not be processed.");
  return data;
}

export async function getPropertyPhoto(address, signal) {
  const response = await fetch(`${API_BASE_URL}/api/property-photo?${new URLSearchParams({address})}`, {signal});
  if (!response.ok) throw new Error('Photo unavailable');
  return response.json();
}

export async function importListing(payload) {
  const response = await fetch(`${API_BASE_URL}/api/listing-import`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(40000)});
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Listing unavailable. Use the address or a listing sheet instead.');
  return data;
}
