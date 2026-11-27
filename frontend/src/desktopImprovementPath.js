function recommendationPillars(recommendation) {
  return [...new Set([
    recommendation?.pillar,
    ...Object.entries(recommendation?.pillarGains || {}).filter(([, gain]) => Number(gain) > 0).map(([pillar]) => pillar)
  ].filter(Boolean))];
}

function productSupportsPillar(product, pillar) {
  const normalizedPillar = String(pillar || "").toLowerCase();
  if (String(product?.pillar || "").toLowerCase() === normalizedPillar) return true;
  if (product?.pillars?.some?.(item => String(item).toLowerCase() === normalizedPillar)) return true;
  return productSearchText(product).includes(normalizedPillar);
}

const TOPIC_RULES = [
  { recommendation: /water heater|hot water/i, tags: ["water-heating"], product: /water heat|hot water/i },
  { recommendation: /heat pump|space heating|heating and cooling|hvac/i, tags: ["heating"], product: /heat pump|air handler|mini.?split|heating and cooling/i },
  { recommendation: /siding|cladding|noncombustible/i, tags: ["fire-resistant-siding"], product: /siding|cladding|fiber cement/i },
  { recommendation: /roof/i, tags: ["roofing"], product: /roof|shingle|underlayment/i },
  { recommendation: /insulation/i, tags: ["insulation"], product: /insulat/i },
  { recommendation: /air seal/i, tags: ["air-sealing"], product: /air seal/i },
  { recommendation: /window/i, tags: ["windows"], product: /window|glazing/i },
  { recommendation: /solar/i, tags: ["solar"], product: /solar|photovoltaic|\bpv\b/i },
  { recommendation: /battery|backup power/i, tags: ["battery"], product: /battery|energy storage/i },
  { recommendation: /thermostat|heating control/i, tags: ["smart-thermostat", "energy-management"], product: /thermostat|energy management|control/i },
  { recommendation: /toilet/i, tags: ["toilets"], product: /toilet/i },
  { recommendation: /faucet/i, tags: ["faucets"], product: /faucet/i },
  { recommendation: /shower/i, tags: ["showerheads"], product: /shower/i },
  { recommendation: /fixture|reduce water|water use/i, tags: ["fixtures", "toilets", "faucets", "showerheads"], product: /fixture|toilet|faucet|shower/i },
  { recommendation: /leak/i, tags: ["leaks"], product: /leak|shut.?off|water monitor/i },
  { recommendation: /rainwater/i, tags: ["rainwater"], product: /rainwater|rain barrel|cistern/i },
  { recommendation: /graywater|greywater|water reuse/i, tags: ["graywater"], product: /gr[ae]ywater|water reuse/i },
  { recommendation: /irrigation|landscap/i, tags: ["irrigation"], product: /irrigation|sprinkler|drip/i },
  { recommendation: /ventilation|indoor air|iaq/i, tags: ["ventilation"], product: /ventilation|\berv\b|\bhrv\b|indoor air/i },
  { recommendation: /ember/i, tags: ["ember-protection"], product: /ember|soffit|vent/i },
  { recommendation: /storm|wind|impact/i, tags: ["storm-protection"], product: /storm|wind|impact/i },
  { recommendation: /moisture/i, tags: ["moisture-control"], product: /moisture|drainage|flashing/i },
  { recommendation: /ev|electric vehicle|charger/i, tags: ["ev-charging"], product: /ev|electric vehicle|charger/i },
  { recommendation: /appliance/i, tags: ["appliances", "dishwasher"], product: /appliance|dishwasher|washer|dryer|refrigerator/i },
  { recommendation: /lighting/i, tags: ["lighting"], product: /lighting|\bled\b/i },
  { recommendation: /low.?carbon|embodied carbon/i, tags: ["low-carbon-materials"], product: /low.?carbon|embodied carbon|epd/i }
];

function recommendationSearchText(recommendation) {
  return [recommendation?.id, recommendation?.title, recommendation?.copy, recommendation?.reason, ...(recommendation?.needTags || [])]
    .filter(Boolean).join(" ");
}

function productSearchText(product) {
  return [product?.id, product?.brand, product?.name, product?.product, product?.productType, product?.category, product?.description, product?.summary, ...(product?.needTags || [])]
    .filter(Boolean).join(" ").toLowerCase();
}

function productMatchesTopic(product, rule) {
  const tags = (product?.needTags || []).map(tag => String(tag).toLowerCase());
  return rule.tags.some(tag => tags.includes(tag)) || rule.product.test(productSearchText(product));
}

function partnerFirst(products) {
  return products.map((product, index) => ({ product, index }))
    .sort((a, b) => Number(Boolean(b.product?.isSponsored)) - Number(Boolean(a.product?.isSponsored)) || a.index - b.index)
    .map(({ product }) => product);
}

export function productsForRecommendation(recommendation, products, limit = 2) {
  const pillars = recommendationPillars(recommendation);
  if (!pillars.length || !Array.isArray(products)) return [];
  const pillarProducts = products.filter(product => pillars.some(pillar => productSupportsPillar(product, pillar)));
  const topicRule = TOPIC_RULES.find(rule => rule.recommendation.test(recommendationSearchText(recommendation)));
  const topicProducts = topicRule ? pillarProducts.filter(product => productMatchesTopic(product, topicRule)) : [];
  return partnerFirst(topicProducts.length ? topicProducts : (topicRule ? [] : pillarProducts)).slice(0, limit);
}

