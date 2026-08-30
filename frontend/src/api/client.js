function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== "undefined" && window.location.hostname.endsWith(".onrender.com")) {
    return "https://vpsf-api.onrender.com";
  }

  return "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

function adminOptions(passcode, options = {}) {
  return {
    ...options,
    headers: {
      "X-Admin-Passcode": passcode,
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

export async function getAdminProducts(passcode) {
  return request("/api/admin/products", adminOptions(passcode));
}

export async function getAdminPropertyQueries(passcode) {
  return request("/api/admin/property-queries", adminOptions(passcode));
}

export async function getAdminProductClicks(passcode) {
  return request("/api/admin/product-clicks", adminOptions(passcode));
}

export async function updateProductWeighting(productId, weight, passcode) {
  return request(`/api/admin/products/${productId}/weighting?weight=${encodeURIComponent(weight)}`, adminOptions(passcode, {
    method: "PATCH"
  }));
}
