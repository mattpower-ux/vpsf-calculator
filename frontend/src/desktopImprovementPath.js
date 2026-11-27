function recommendationPillars(recommendation) {
  return [...new Set([
    recommendation?.pillar,
    ...Object.entries(recommendation?.pillarGains || {}).filter(([, gain]) => Number(gain) > 0).map(([pillar]) => pillar)
  ].filter(Boolean))];
}

function productSupportsPillar(product, pillar) {
  if (product?.pillar === pillar || product?.pillars?.includes?.(pillar)) return true;
  const searchable = `${product?.category || ""} ${product?.name || ""} ${product?.description || ""}`.toLowerCase();
  return searchable.includes(pillar.toLowerCase());
}

export function productsForRecommendation(recommendation, products, limit = 2) {
  const pillars = recommendationPillars(recommendation);
  if (!pillars.length || !Array.isArray(products)) return [];
  return products.filter(product => pillars.some(pillar => productSupportsPillar(product, pillar))).slice(0, limit);
}

