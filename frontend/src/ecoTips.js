export const ecoTips = [
  {
    id: "irrigation",
    image: "sprinkler",
    alt: "A lawn sprinkler watering a residential yard",
    text: "Landscape irrigation uses nearly one-third of U.S. residential water. Leaks and inefficient watering can waste even more.",
    source: "https://www.epa.gov/sites/default/files/2017-03/documents/ws-factsheet-outdoor-water-use-in-the-us.pdf",
    sourceLabel: "EPA WaterSense"
  },
  {
    id: "water-heater",
    image: "water-heater",
    alt: "A heat pump water heater",
    text: "Heat pump water heaters can be two to three times as efficient as conventional electric-resistance models.",
    source: "https://www.energy.gov/node/4434667",
    sourceLabel: "U.S. Department of Energy"
  },
  {
    id: "cool-roof",
    image: "cool-roof",
    alt: "Solar-reflective roofing shingles",
    text: "Cool roofs reflect more sunlight and absorb less heat, helping reduce cooling demand in warm climates.",
    source: "https://www.energy.gov/sites/default/files/2021-08/ES-CoolRoofs_080921.pdf",
    sourceLabel: "U.S. Department of Energy"
  }
];

export const nextMenuVisit = (visit) => visit + 1;
export const ecoTipForVisit = (visit) => ecoTips[visit % ecoTips.length];
