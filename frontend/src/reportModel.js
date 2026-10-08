import { classification, gradeFor, reportAddress } from "./scorePresentation.js";

const productSources = {
  "rheem-proterra": { company: "Rheem", pillar: "energy", url: "https://www.rheem.com/heatpumpwaterheaters/" },
  "rainwater-management": { company: "Rainwater Management Solutions", pillar: "water", url: "https://rainwatermanagement.com/" },
  "rainwater-management-tank": { company: "Rainwater Management Solutions", pillar: "water", url: "https://rainwatermanagement.com/" },
  "certainteed-impact-shingles": { company: "CertainTeed", pillar: "resilience", url: "https://www.certainteed.com/inspiration/how-tos/algae-impact-resistant-shingles" },
  "renewaire-erv": { company: "RenewAire", pillar: "health", url: "https://renewaire.com/products/" },
  "moen-eco-performance-showerhead": { company: "Moen", pillar: "water", url: "https://www.moen.com/professional/tools-and-resources/articles/green-energy/eco-performance-shower-systems/" },
  "niagara-high-efficiency-toilet": { company: "Niagara", pillar: "water", url: "https://niagaracorp.com/our-products/toilets/" },
  "rachio-smart-irrigation": { company: "Rachio", pillar: "water", url: "https://rachio.com/products/rachio-3" },
  "atas-solar-ready-metal-roofing": { company: "ATAS", pillar: "resilience", url: "https://www.atas.com/did-you-know-series/solar-ready-roof-systems-attachment-methods" },
  "certainteed-solaris-cool-roof": { company: "CertainTeed", pillar: "resilience", url: "https://www.certainteed.com/roofing-shingles" },
  "euroshield-recycled-rubber-roofing": { company: "Euroshield", pillar: "carbon", url: "https://www.euroshieldroofing.com/" }
};

export function buildReportModel(result, property, pillars, availableProducts) {
  const scores = pillars.map((pillar) => {
    const value = Number(result.scores?.[pillar.key]) || 0;
    return {
      key: pillar.key,
      label: pillar.short || pillar.label,
      max: pillar.max,
      value,
      fraction: Math.max(0, Math.min(1, value / pillar.max)),
      grade: gradeFor(value, pillar.max)
    };
  });
  const ascending = [...scores].sort((a, b) => a.fraction - b.fraction);
  const weakest = ascending[0];
  const strongest = ascending.at(-1);
  const rating = classification(result.total).label;
  const productByPillar = new Map();

  for (const product of availableProducts) {
    const source = productSources[product.id];
    if (!source || productByPillar.has(source.pillar)) continue;
    productByPillar.set(source.pillar, {
      id: product.id,
      name: product.name,
      company: source.company,
      pillar: source.pillar,
      url: source.url
    });
  }

  const products = ascending.map(({ key }) => productByPillar.get(key)).filter(Boolean).slice(0, 3);
  const aboveB = scores.filter(({ grade }) => ["A", "B+", "B"].includes(grade)).length;
  const facts = [
    property?.yearBuilt ? `Built ${property.yearBuilt}` : null,
    property?.squareFeet ? `${Number(property.squareFeet).toLocaleString("en-US")} sq ft` : null
  ].filter(Boolean);

  return {
    address: reportAddress(property),
    facts: facts.join(" | "),
    total: result.total,
    rating,
    scores,
    weakest,
    strongest,
    overview: `This home earned ${result.total} of 1,000 available VPSF points (${rating}). ${strongest.label} is its strongest relative pillar; ${weakest.label} has the lowest relative score.`,
    highlights: [
      `Strongest: ${strongest.label} ${strongest.value}/${strongest.max} (${strongest.grade})`,
      `Priority gap: ${weakest.label} ${weakest.value}/${weakest.max} (${weakest.grade})`,
      `${aboveB} of 7 pillars earned a B grade or higher`
    ],
    products
  };
}
