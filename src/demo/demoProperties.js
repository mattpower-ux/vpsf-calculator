export const demoProperties = [
  {
    id: "existing-home",
    name: "1313 Cognition Drive",
    address: "1313 Cognition Drive, Orlando, FL 32101",
    mlsNumber: "ORL-32101-8847",
    listingUrl: "https://demo.vpsf.greenbuildermedia.com/listings/ORL-32101-8847",
    image: "/demo-images/existing-home.jpg",
    propertyType: "Older Existing Home",
    yearBuilt: 2012,
    squareFeet: 2450,
    beds: 4,
    baths: 3,
    lotSizeAcres: 0.32,
    treeCoverPercent: 42,
    roofType: "Asphalt shingle",
    roofAgeYears: 12,
    vpsfScore: 525,
    scores: {
      energy: 115,
      water: 40,
      health: 105,
      resilience: 85,
      carbon: 55,
      financial: 75,
      community: 50
    },
    description:
      "A typical older Florida home with some useful performance features, but aging roof risk, water-efficiency gaps, limited carbon documentation, and tree-maintenance exposure keep the VPSF score in the middle range.",
    backendAssumptions: {
      roofRisk:
        "Asphalt shingle roof is assumed to be 12 years old. Because many asphalt roofs require major repair or replacement around the 15-year mark in hot, humid climates, the model applies a near-term replacement-risk penalty.",
      treeCoverRisk:
        "Large-lot tree cover creates a mixed score effect: mature trees can reduce cooling loads through shading, but higher tree cover also increases likely maintenance, storm cleanup, limb removal, and insurance-risk exposure.",
      waterRisk:
        "No verified leak detection or smart irrigation is assumed. Outdoor water demand is treated as a cost-risk factor in a hot, humid Florida market with high irrigation exposure.",
      scoringIntent:
        "Most existing homes should fall in the 400–650 VPSF range unless they have verified high-performance systems, documented resilience features, modern water controls, and low ownership-risk indicators."
    }
  },

  {
    id: "vision-house",
    name: "VISION House Orlando",
    address: "100 Vision Way, Orlando, FL",
    mlsNumber: "VISION-2026",
    listingUrl: "https://demo.vpsf.greenbuildermedia.com/listings/vision-house",
    image: "/demo-images/vision-house.jpg",
    propertyType: "High Performance Home",
    yearBuilt: 2026,
    squareFeet: 2850,
    beds: 4,
    baths: 3.5,
    lotSizeAcres: 0.18,
    treeCoverPercent: 18,
    roofType: "High-reflectance architectural shingle",
    roofAgeYears: 0,
    vpsfScore: 790,
    scores: {
      energy: 170,
      water: 85,
      health: 175,
      resilience: 160,
      carbon: 120,
      financial: 50,
      community: 30
    },
    description:
      "A showcase high-performance residence with strong building science, resilience, indoor air quality, and operating-cost advantages."
  },

  {
    id: "net-zero",
    name: "Cognition Net-Zero Residence",
    address: "1 Net Zero Lane, Austin, TX",
    mlsNumber: "NZ-2040",
    listingUrl: "https://demo.vpsf.greenbuildermedia.com/listings/net-zero",
    image: "/demo-images/net-zero.jpg",
    propertyType: "Net-Zero Showcase",
    yearBuilt: 2026,
    squareFeet: 3100,
    beds: 4,
    baths: 4,
    lotSizeAcres: 0.21,
    treeCoverPercent: 24,
    roofType: "Solar-ready standing seam metal",
    roofAgeYears: 0,
    vpsfScore: 875,
    scores: {
      energy: 190,
      water: 95,
      health: 185,
      resilience: 175,
      carbon: 145,
      financial: 55,
      community: 30
    },
    description:
      "A demonstration property designed to show top-tier performance across the seven VPSF pillars."
  }
];
