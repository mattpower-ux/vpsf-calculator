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
    throw new Error(`API request failed: ${response.status}`);
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
  return request("/api/score", {
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
    id: product.id,
    name: `${product.brand} ${product.product}`,
    category: product.category,
    image: product.imageUrl,
    improvement: product.weight === "Priority" ? "+10 VPSF Points" : "+5 VPSF Points",
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
