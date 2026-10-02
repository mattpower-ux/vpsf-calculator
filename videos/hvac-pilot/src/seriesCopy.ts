export type TopicCopy = {
  id: string;
  title: string;
  pillar: string;
  intro: string;
  beats: [string, string, string, string, string];
  detail: [string, string, string];
  steps: [string, string, string];
};

export const seriesCopy: TopicCopy[] = [
  {
    id: "energy-water-heating", title: "Heat Pump Water Heating", pillar: "ENERGY + WATER",
    intro: "Efficient hot water, every day of the year.",
    beats: ["Move heat, don't make it", "Heat from the surrounding air", "Give the system room to work", "Protect and schedule", "Specify. Install. Verify."],
    detail: ["HEAT PUMP", "HYBRID BACKUP", "SMART TIMING"],
    steps: ["01  SIZE FOR THE HOME", "02  PLAN AIR + DRAINAGE", "03  KEEP THE RECORDS"],
  },
  {
    id: "water-fixtures", title: "Water-Smart Fixtures", pillar: "WATER",
    intro: "Save water without giving up comfort.",
    beats: ["Every drop has a footprint", "Choose efficient fixtures", "Shorten the wait for hot water", "Water outdoors only when needed", "Measure. Manage. Document."],
    detail: ["WATERSENSE", "HOT-WATER ROUTES", "SMART IRRIGATION"],
    steps: ["01  CHECK FLOW RATES", "02  FIX LONG HOT-WATER RUNS", "03  SAVE THE SPECS"],
  },
  {
    id: "water-leak-detection", title: "Whole-Home Leak Detection", pillar: "WATER + RESILIENCE",
    intro: "Catch hidden leaks before damage spreads.",
    beats: ["A small leak can become a big loss", "Watch flow and moisture", "Put sensors where leaks hide", "Detection complements inspection", "Test it. Record it. Trust it."],
    detail: ["FLOW MONITORING", "MOISTURE SENSORS", "AUTO SHUTOFF"],
    steps: ["01  COVER HIGH-RISK SPOTS", "02  TEST THE SHUTOFF", "03  LOG THE INSTALLATION"],
  },
  {
    id: "health-ventilation", title: "Balanced Fresh-Air Ventilation", pillar: "HEALTH",
    intro: "Fresh air should be intentional.",
    beats: ["A tight home needs a fresh-air plan", "Supply and exhaust in balance", "Match the design to climate", "Ventilation is one part of IAQ", "Measure. Maintain. Document."],
    detail: ["BALANCED AIRFLOW", "HRV / ERV", "FILTER SERVICE"],
    steps: ["01  VERIFY AIRFLOW", "02  CONTROL MOISTURE", "03  KEEP SERVICE RECORDS"],
  },
  {
    id: "health-filtration", title: "Filtration + Moisture Control", pillar: "HEALTH",
    intro: "Clean air starts with sources and systems.",
    beats: ["Reduce pollutants at the source", "Capture particles as air moves", "Keep damp surfaces dry", "Choose low-emitting materials", "Healthy air is a maintained system."],
    detail: ["SOURCE CONTROL", "RIGHT-SIZED FILTER", "HUMIDITY"],
    steps: ["01  CHECK AIRFLOW", "02  FIX MOISTURE", "03  TRACK FILTER SERVICE"],
  },
  {
    id: "roof-risk", title: "Roof Durability + Risk", pillar: "RESILIENCE",
    intro: "A roof is a complete weather-protection system.",
    beats: ["Look beyond the shingles", "Age is only one clue", "Build for local hazards", "Keep water out for longer", "Know what was installed."],
    detail: ["FLASHING", "ATTACHMENT", "DRAINAGE"],
    steps: ["01  ASSESS LOCAL RISKS", "02  DETAIL THE WHOLE ROOF", "03  KEEP PERMITS + PHOTOS"],
  },
  {
    id: "resilience-backup-power", title: "Backup Power for Essentials", pillar: "RESILIENCE",
    intro: "Protect the circuits that matter most.",
    beats: ["Start with essential loads", "Separate critical circuits", "Match power to outage risks", "Reduce demand first", "Make readiness verifiable."],
    detail: ["CRITICAL LOADS", "BATTERY / GENERATOR", "SAFE TRANSFER"],
    steps: ["01  LIST ESSENTIALS", "02  SIZE THE BACKUP", "03  RECORD THE CIRCUITS"],
  },
  {
    id: "carbon-materials", title: "Lower-Carbon Materials", pillar: "CARBON",
    intro: "The climate story begins before move-in.",
    beats: ["Materials carry a history", "Judge the full useful life", "Use declarations as evidence", "Design for the local climate", "Make the impact traceable."],
    detail: ["LIFECYCLE", "EPDs", "DURABILITY"],
    steps: ["01  COMPARE LIKE WITH LIKE", "02  CHOOSE FOR LONG LIFE", "03  KEEP DECLARATIONS"],
  },
  {
    id: "tree-risk", title: "Shade Trees + Storm Risk", pillar: "RESILIENCE + COMMUNITY",
    intro: "Preserve useful shade while managing risk.",
    beats: ["Trees can cool a home", "Proximity can add storm risk", "Assess each tree, not just distance", "Maintain the right balance", "Keep a landscape record."],
    detail: ["USEFUL SHADE", "ROOF CLEARANCE", "TREE HEALTH"],
    steps: ["01  ASSESS CONDITION", "02  PRUNE FOR SAFETY", "03  RECORD MAINTENANCE"],
  },
  {
    id: "community-connectivity", title: "Community + Connectivity", pillar: "COMMUNITY",
    intro: "A home's value reaches beyond its walls.",
    beats: ["Location shapes daily life", "Test real travel choices", "Verify reliable broadband", "Value shade, manage risk", "Replace vague claims with facts."],
    detail: ["WALKABILITY", "TRANSIT CHOICES", "BROADBAND"],
    steps: ["01  CHECK REAL ROUTES", "02  CONFIRM SERVICE", "03  DOCUMENT LIMITS"],
  },
  {
    id: "ownership-insurance", title: "Ownership + Insurance Costs", pillar: "FINANCIAL",
    intro: "See beyond the purchase price.",
    beats: ["Major systems have a lifecycle", "Unknown age means unknown cost", "Condition shapes risk", "Maintain before replacing", "Turn records into clarity."],
    detail: ["SYSTEM AGE", "LOCAL HAZARDS", "MAINTENANCE"],
    steps: ["01  INVENTORY EQUIPMENT", "02  PRIORITIZE RISK", "03  SAVE EVERY RECORD"],
  },
];
