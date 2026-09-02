import React, { useEffect, useMemo, useState } from "react";
import AdminDemo from "./admin/AdminDemo";
import { enrichPropertyRisk, enrichPropertyWithAttom, enrichPropertyWithRentCast, geocodeProperty, getProductRecommendations, scoreProperty, submitLead, trackProductClick, trackProgress, trackPropertyQuery } from "./api/client";
import vpsfBanner from "./assets/vpsf-banner.jpg";
import demoOrlandoHome from "./assets/demo-orlando-home.jpg";
import cognitionIcon from "./assets/cognition-icon.png";
import atasRoofingThumb from "./assets/Atas-roofing.jpg";
import certainteedSolarisThumb from "./assets/Certainteed-Solaris.jpg";
import euroshieldThumb from "./assets/euroshield.jpg";
import kohlerFaucetThumb from "./assets/kohler-faucet.jpg";
import moenShowerThumb from "./assets/moen-shower.jpg";
import niagaraToiletThumb from "./assets/Niagara-toilet.jpg";
import arboristThumb from "./assets/ARBORIST1.jpg";
import rachioThumb from "./assets/rachio.jpg";
import { demoProperties } from "./demo/demoProperties";
import { demoProducts } from "./demo/demoProducts";
import {
  ArrowRight,
  Award,
  BatteryCharging,
  Bike,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Droplets,
  FileSearch,
  Filter,
  Flame,
  HeartPulse,
  Home,
  Leaf,
  MapPin,
  Package,
  PlugZap,
  QrCode,
  Shield,
  Share2,
  Sparkles,
  Sun,
  Upload,
  Wallet,
  Wind,
  Zap
} from "lucide-react";

const VPSF_BANNER = vpsfBanner;

const SCREEN_LABELS = {
  0: "Existing Home Intake",
  1: "Property Details",
  2: "Home Specs",
  3: "Review & Confirm",
  4: "Score Dashboard",
  5: "Pillar Breakdown",
  6: "Recommendations",
  7: "Products",
  8: "Marketing Studio",
  9: "Score Card",
  10: "Pillar Detail",
  11: "Listing Import",
  12: "Analyzing",
  13: "Product Detail",
  14: "All Home Specs",
  15: "Recommendation Detail",
  16: "Matching Products",
  17: "Path to 700",
  18: "Future Cost",
  19: "Comparison",
  20: "Matching Product Detail"
};

function getOrCreateSessionId() {
  const key = "vpsf_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = window.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, value);
  return value;
}

function demoMlsFromProperty(property) {
  return {
    mlsNumber: property.mlsNumber,
    address: property.address,
    url: property.listingUrl,
    scanName: `mls-listing-${property.id}.pdf`
  };
}

const PILLARS = [
  { key: "energy", label: "Energy", short: "Energy", max: 200, icon: Zap, accent: "green" },
  { key: "water", label: "Water", short: "Water", max: 100, icon: Droplets, accent: "blue" },
  { key: "health", label: "Health", short: "Health", max: 200, icon: HeartPulse, accent: "green" },
  { key: "resilience", label: "Resilience", short: "Resilience", max: 200, icon: Shield, accent: "green" },
  { key: "carbon", label: "Carbon & Materials", short: "Carbon", max: 150, icon: Leaf, accent: "gold" },
  { key: "financial", label: "Financial Risk", short: "Financial", max: 100, icon: Wallet, accent: "blue" },
  { key: "community", label: "Community & Mobility", short: "Community", max: 50, icon: Bike, accent: "green" }
];


const PILLAR_DETAILS = {
  energy: {
    title: "Energy Performance",
    summary: "This score reflects verified efficiency, electrification, solar readiness, and the home's ability to reduce monthly energy exposure.",
    pros: [
      "Heat pump HVAC system",
      "Heat pump water heater",
      "Solar PV plus battery storage",
      "EV charger installed",
      "HERS range places the home above code-minimum performance"
    ],
    cons: [
      "Demand-response readiness is not yet documented",
      "Exact modeled annual kWh use is not included",
      "Utility-rate comparison is not yet connected to SmartData"
    ]
  },
  water: {
    title: "Water Performance",
    summary: "This score reflects fixture efficiency, water reuse, leak protection, landscaping, and local water-risk context.",
    pros: [
      "Low-flow showerheads",
      "Low-flow toilets",
      "Xeriscaped yard",
      "WaterSense Home v2 performance",
      "Rainwater harvesting strategy documented"
    ],
    cons: [
      "No installed leak detection",
      "High local water usage rates",
      "Dry climate zone",
      "No greywater reuse documentation"
    ]
  },
  health: {
    title: "Health & Indoor Environment",
    summary: "This score reflects indoor air quality, ventilation, material emissions, daylighting, acoustics, and third-party health-related documentation.",
    pros: [
      "EPA Indoor airPLUS documentation",
      "ERV / HRV ventilation",
      "Low / no-VOC material selections",
      "IAQ monitoring included",
      "Daylighting and acoustic comfort features documented"
    ],
    cons: [
      "Filtration level is not yet verified",
      "CO2, PM2.5, and VOC sensor specifications are not attached",
      "No post-occupancy IAQ test results included"
    ]
  },
  resilience: {
    title: "Resilience & Durability",
    summary: "This score reflects storm, flood, fire, moisture, backup-power, and durability features that reduce ownership and insurance risk.",
    pros: [
      "FORTIFIED Silver certification",
      "Elevated / flood-resistant design",
      "Enhanced moisture management",
      "Battery backup",
      "Impact-rated roof or roof system documentation"
    ],
    cons: [
      "FORTIFIED Gold documentation is not present",
      "No verified insurance-discount letter attached",
      "Wildfire defensible-space features are not documented"
    ]
  },
  carbon: {
    title: "Carbon & Materials",
    summary: "This score reflects embodied carbon, operational carbon, material disclosure, EPD documentation, and lower-carbon construction strategies.",
    pros: [
      "Documented EPDs + CLF benchmark approach",
      "Low-carbon concrete selected",
      "Wood-heavy structural strategy",
      "Electrified systems reduce operational emissions"
    ],
    cons: [
      "Full whole-home embodied carbon model is not attached",
      "Zero Carbon certification is not documented",
      "Manufacturer-specific EPD links are incomplete"
    ]
  },
  financial: {
    title: "Financial / Ownership Risk",
    summary: "This score reflects monthly cost exposure, insurance risk, warranty protection, maintenance planning, and risk-adjusted ownership cost.",
    pros: [
      "Verified insurance discount",
      "Long-term warranties",
      "Maintenance cost model provided",
      "Leak protection contributes to lower ownership risk"
    ],
    cons: [
      "Full PIETIM calculation is not yet connected to buyer income",
      "Local insurance quote data is not attached",
      "Maintenance assumptions need third-party verification"
    ]
  },
  community: {
    title: "Community & Mobility",
    summary: "This score reflects access to services, transportation options, open space, shared amenities, and low-car lifestyle potential.",
    pros: [
      "WalkScore above 70",
      "Nearby transit and services",
      "Community green space",
      "Shared amenities",
      "Bike infrastructure"
    ],
    cons: [
      "Transit frequency is not yet verified",
      "School, food, and medical access scores are not connected",
      "Long-term neighborhood climate-risk data is not yet included"
    ]
  }
};

const defaultHome = {
  address: "123 Harbor View Dr.",
  city: "Jacksonville",
  state: "FL",
  zip: "32202",
  squareFeet: "2450",
  yearBuilt: "2021",
  homeType: "Single Family Detached",
  stories: "2",
  bedrooms: "4",
  bathrooms: "3.5",
  garage: "2 Car Garage",
  lotSize: "0.18 acres",
  climateZone: "2A – Hot Humid",
  occupancy: "Owner Occupied",
  hvac: "Heat Pump (Electric)",
  hvacAge: "Unknown",
  waterHeater: "Heat Pump Water Heater",
  waterHeaterAge: "Unknown",
  roof: "Architectural Shingle",
  roofAge: "Unknown",
  windows: "Double Pane, Low-E",
  insulation: "R-19 Walls / R-38 Attic",
  solar: "5.2 kW Solar PV + Battery",
  hers: "21–30",
  evReady: "EV Charger Installed",
  fortified: "FORTIFIED Silver",
  flood: "Elevated / Flood-Resistant",
  moisture: "Enhanced Moisture Management",
  backup: "Battery Backup",
  healthCert: "EPA Indoor airPLUS",
  ventilation: "ERV / HRV",
  materials: "Low / No-VOC",
  iaq: "IAQ Monitoring",
  daylighting: "Daylighting + Acoustic Comfort",
  carbonStrategy: "Documented EPDs + CLF Benchmark",
  carbonConcrete: "Low-Carbon Concrete",
  structure: "Wood-Heavy Structure",
  waterStandard: "WaterSense Home v2",
  leak: "Leak Detection + Auto Shutoff",
  reuse: "Rainwater Harvesting",
  landscape: "Drought-Tolerant Landscaping",
  pietim: "25–30%",
  insurance: "Verified Insurance Discount",
  warranty: "Long-Term Warranties",
  maintenance: "Maintenance Cost Model Provided",
  walkscore: "70+",
  transit: "Nearby Transit / Services",
  greenspace: "Community Green Space",
  amenities: "Shared Amenities",
  bike: "Bike Infrastructure"
};

const selectOptions = {
  homeType: ["Single Family Detached", "Townhome", "Condo", "Multifamily", "Manufactured Home"],
  stories: ["1", "1.5", "2", "3+"],
  climateZone: ["1A – Very Hot Humid", "2A – Hot Humid", "3A – Warm Humid", "3C – Marine", "4A – Mixed Humid", "5A – Cool Humid"],
  occupancy: ["Owner Occupied", "Rental", "Builder Spec", "For Sale"],
  hvac: ["Heat Pump (Electric)", "Geothermal", "Gas Furnace", "Electric Resistance", "Unknown"],
  waterHeater: ["Heat Pump Water Heater", "Tank Electric", "Tank Gas", "Tankless Gas", "Solar Thermal", "Unknown"],
  solar: ["None", "Solar PV", "5.2 kW Solar PV", "5.2 kW Solar PV + Battery", "Solar PV + Battery"],
  evReady: ["None", "EV Ready", "EV Charger Installed"],
  hers: ["≤ 0", "1–10", "11–20", "21–30", "31–40", "41–50", "51–60", "61–70", "71–80", "81–90", "Code-Minimum"],
  fortified: ["FORTIFIED Gold", "FORTIFIED Silver", "FORTIFIED Bronze", "Wildfire Prepared Home", "None"],
  flood: ["Elevated / Flood-Resistant", "Flood-Resistant Materials", "Standard Construction", "Unknown"],
  roof: ["Impact-Rated Roof", "Architectural Shingle", "Metal Roof", "Tile Roof", "Unknown"],
  moisture: ["Enhanced Moisture Management", "Standard Moisture Details", "Unknown"],
  backup: ["Battery Backup", "Generator Ready", "None"],
  healthCert: ["WELL or Fitwel Residential", "EPA Indoor airPLUS", "RESET Air or Equivalent", "None"],
  ventilation: ["ERV / HRV", "Balanced Ventilation", "Exhaust Only", "None / Unknown"],
  materials: ["Low / No-VOC", "Standard Materials", "Unknown"],
  iaq: ["IAQ Monitoring", "CO2 Monitoring Only", "None"],
  daylighting: ["Daylighting + Acoustic Comfort", "Daylighting Only", "Standard"],
  carbonStrategy: ["Zero Carbon Certified", "Documented EPDs + CLF Benchmark", "Partial Material Disclosure", "No Accounting"],
  carbonConcrete: ["Low-Carbon Concrete", "Standard Concrete", "Unknown"],
  structure: ["Wood-Heavy Structure", "Mixed Structure", "Steel / Concrete Heavy", "Unknown"],
  waterStandard: ["WaterSense Home v2", "HERS H2O", "WERS Rated", "Code-Minimum"],
  leak: ["Leak Detection + Auto Shutoff", "Leak Detection Only", "None"],
  reuse: ["Rainwater Harvesting", "Greywater", "None"],
  landscape: ["Drought-Tolerant Landscaping", "Standard Landscaping", "High-Water Landscaping"],
  pietim: ["< 25%", "25–30%", "30–35%", "35–40%", "> 40%"],
  insurance: ["Verified Insurance Discount", "Likely Discount", "None / Unknown"],
  warranty: ["Long-Term Warranties", "Standard Warranties", "Unknown"],
  maintenance: ["Maintenance Cost Model Provided", "Basic Maintenance Guidance", "None"],
  walkscore: ["70+", "50–69", "Below 50", "Unknown"],
  transit: ["Nearby Transit / Services", "Limited Access", "None / Unknown"],
  greenspace: ["Community Green Space", "Nearby Park", "None / Unknown"],
  amenities: ["Shared Amenities", "Limited Amenities", "None"],
  bike: ["Bike Infrastructure", "Bikeable Streets", "None / Unknown"]
};

function scoreHome(home) {
  const energyBase = {
    "≤ 0": 160,
    "1–10": 150,
    "11–20": 140,
    "21–30": 130,
    "31–40": 120,
    "41–50": 110,
    "51–60": 100,
    "61–70": 85,
    "71–80": 70,
    "81–90": 55,
    "Code-Minimum": 40
  }[home.hers] || 40;

  let energy = energyBase;
  if (home.solar.includes("Solar PV")) energy += 10;
  if (home.solar.includes("Battery")) energy += 10;
  if (home.hvac.includes("Heat Pump") || home.hvac.includes("Geothermal")) energy += 10;
  if (home.evReady !== "None") energy += 5;
  energy = Math.min(200, energy);

  let resilience = {
    "FORTIFIED Gold": 160,
    "FORTIFIED Silver": 140,
    "FORTIFIED Bronze": 120,
    "Wildfire Prepared Home": 100,
    "None": 40
  }[home.fortified] || 40;
  if (home.flood.includes("Elevated") || home.flood.includes("Flood")) resilience += 10;
  if (home.roof.includes("Impact") || home.roof.includes("Metal")) resilience += 10;
  if (home.moisture.includes("Enhanced")) resilience += 10;
  if (home.backup !== "None") resilience += 10;
  resilience = Math.min(200, resilience);

  let health = {
    "WELL or Fitwel Residential": 120,
    "EPA Indoor airPLUS": 90,
    "RESET Air or Equivalent": 80,
    "None": 40
  }[home.healthCert] || 40;
  if (home.ventilation.includes("ERV") || home.ventilation.includes("Balanced")) health += 20;
  if (home.materials.includes("VOC")) health += 20;
  if (home.iaq.includes("Monitoring")) health += 20;
  if (home.daylighting.includes("Daylighting")) health += 20;
  health = Math.min(200, health);

  let carbon = {
    "Zero Carbon Certified": 120,
    "Documented EPDs + CLF Benchmark": 90,
    "Partial Material Disclosure": 60,
    "No Accounting": 30
  }[home.carbonStrategy] || 30;
  if (home.carbonConcrete.includes("Low-Carbon")) carbon += 10;
  if (home.structure.includes("Wood")) carbon += 10;
  if (home.hvac.includes("Heat Pump") || home.hvac.includes("Geothermal")) carbon += 10;
  carbon = Math.min(150, carbon);

  let water = {
    "WaterSense Home v2": 60,
    "HERS H2O": 50,
    "WERS Rated": 40,
    "Code-Minimum": 20
  }[home.waterStandard] || 20;
  if (home.leak.includes("Auto")) water += 15;
  if (home.reuse !== "None") water += 15;
  if (home.landscape.includes("Drought")) water += 10;
  water = Math.min(100, water);

  let financial = {
    "< 25%": 60,
    "25–30%": 50,
    "30–35%": 40,
    "35–40%": 25,
    "> 40%": 10
  }[home.pietim] || 40;
  if (home.insurance.includes("Verified")) financial += 15;
  if (home.warranty.includes("Long")) financial += 15;
  if (home.maintenance.includes("Model")) financial += 10;
  if (home.leak.includes("Auto")) financial += 10;
  financial = Math.min(100, financial);

  let community = 0;
  if (home.walkscore === "70+") community += 15;
  if (home.transit.includes("Nearby")) community += 10;
  if (home.greenspace.includes("Green") || home.greenspace.includes("Park")) community += 10;
  if (home.amenities.includes("Shared")) community += 10;
  if (home.bike.includes("Bike")) community += 5;
  community = Math.min(50, community);

  const scores = { energy, water, health, resilience, carbon, financial, community };
  return { scores, total: Object.values(scores).reduce((a, b) => a + b, 0) };
}


function resultFromDemoProperty(property) {
  return {
    scores: property.scores,
    total: Object.values(property.scores).reduce((sum, value) => sum + value, 0),
    property
  };
}

function classification(score) {
  if (score >= 850) return { label: "Exceptional", meaning: "Future-proof asset", grade: "A+" };
  if (score >= 700) return { label: "High Performance", meaning: "Low-risk, low-cost home", grade: "A" };
  if (score >= 550) return { label: "Good / Efficient", meaning: "Above-market quality", grade: "B" };
  if (score >= 400) return { label: "Code Plus", meaning: "Typical new home", grade: "C" };
  return { label: "High Risk", meaning: "High operating + insurance cost", grade: "D" };
}

function gradeFor(value, max) {
  const pct = value / max;
  if (pct >= 0.85) return "A";
  if (pct >= 0.72) return "B+";
  if (pct >= 0.6) return "B";
  if (pct >= 0.45) return "C";
  return "D";
}

function Field({ label, value, onChange, options, wide = false }) {
  return (
    <label className={wide ? "field fieldWide" : "field"}>
      <span>{label}</span>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function ProgressDots({ step }) {
  return (
    <div className="progressDots" aria-label={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map((dot) => (
        <span key={dot} className={dot <= step ? "active" : ""} />
      ))}
    </div>
  );
}

function AppChrome({ children, screen, setScreen }) {
  return (
    <div className="phoneShell">
      <div className="bannerWrap">
        <img src={VPSF_BANNER} alt="VPSF Value Per Square Foot" />
      </div>
      {screen > 0 && screen !== 11 && (
        <button className="backButton" onClick={() => setScreen(Math.max(0, screen - 1))} aria-label="Go back">
          <ChevronLeft size={24} strokeWidth={4} />
        </button>
      )}
      {children}
    </div>
  );
}

function BottomNav({ active, setScreen }) {
  const items = [
    ["Restart", Home, 0],
    ["Pillars", Zap, 5],
    ["Recommendations", HeartPulse, 6],
    ["More", Sparkles, 8]
  ];
  return (
    <nav className="bottomNav">
      {items.map(([label, Icon, target]) => (
        <button key={label} className={active === label ? "active" : ""} onClick={() => setScreen(target)}>
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function MiniScore({ pillar, value }) {
  const Icon = pillar.icon;
  const pct = Math.round((value / pillar.max) * 100);
  return (
    <div className={`miniScore ${pillar.accent}`}>
      <div className="miniRing" style={{ background: `conic-gradient(var(--ring) ${pct * 3.6}deg, #e6edf3 0)` }}>
        <div className="miniRingInner">
          <Icon size={17} />
          <strong>{value}</strong>
          <em>/{pillar.max}</em>
        </div>
      </div>
      <span>{pillar.short}</span>
    </div>
  );
}

const listingSources = [
  ["MLS", Home, "Import MLS Listing", "Use a listing number, address, URL, or listing sheet."],
  ["Zillow", FileSearch, "Import Zillow Listing", "Connect through a licensed API when available."],
  ["Realtor.com", FileSearch, "Import Realtor.com Listing", "Connect through a licensed API when available."],
  ["Redfin", FileSearch, "Import Redfin Listing", "Connect through a licensed API when available."]
];

const quickScanSources = [
  ["Public records", "Year built, size, parcel, tax, and sales signals"],
  ["Permits", "Roof, HVAC, solar, window, water heater, and remodel history"],
  ["Risk layers", "Flood, wind, climate, utility, and location context"]
];

const uploadCaptureOptions = [
  ["Inspection report", "PDF"],
  ["Utility bill", "PDF"],
  ["Equipment label", "Photo"],
  ["Upgrade invoice", "Photo"]
];

const stateNameToCode = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY"
};

function normalizeState(value) {
  const trimmed = (value || "").trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return stateNameToCode[trimmed.toLowerCase()] || trimmed;
}

function parseAddressParts(rawAddress) {
  const value = (rawAddress || "").replace(/\s+/g, " ").trim();
  const commaParts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    const stateZip = commaParts[2].replace(/United States/i, "").trim().split(/\s+/);
    return {
      address: commaParts[0],
      city: commaParts[1],
      state: normalizeState(stateZip[0] || ""),
      zip: stateZip.find((part) => /^\d{5}/.test(part)) || ""
    };
  }

  const looseMatch = value.match(/^(.*?)([A-Za-z][A-Za-z .'-]+?)\s+([A-Z]{2}|[A-Za-z ]+)\s+(\d{5}(?:-\d{4})?)$/);
  if (looseMatch) {
    return {
      address: looseMatch[1].trim().replace(/[,\s]+$/, ""),
      city: looseMatch[2].trim().replace(/[,\s]+$/, ""),
      state: normalizeState(looseMatch[3]),
      zip: looseMatch[4]
    };
  }

  return { address: value, city: "", state: "", zip: "" };
}

function hasUsableValue(value) {
  return value !== undefined && value !== null && value !== "" && value !== "Unknown" && value !== "None / Unknown";
}

function mergePropertyFacts(primary, fallback) {
  if (!primary) return fallback;
  if (!fallback) return primary;

  const merged = { ...primary };
  Object.entries(fallback).forEach(([key, value]) => {
    if (!hasUsableValue(merged[key]) && hasUsableValue(value)) {
      merged[key] = value;
    }
  });
  merged.sourceNote = [primary.sourceNote, fallback.sourceNote].filter(Boolean).join(" ");
  return merged;
}

function homeFromExistingScan(enteredAddress, geocode, rentcastProperty, attomProperty, riskEnrichment) {
  const publicRecordProperty = mergePropertyFacts(rentcastProperty, attomProperty);

  if (publicRecordProperty) {
    return {
      ...defaultHome,
      ...publicRecordProperty,
      address: publicRecordProperty.address || geocode?.address || enteredAddress,
      city: publicRecordProperty.city || geocode?.city || "",
      state: normalizeState(publicRecordProperty.state || geocode?.state || ""),
      zip: publicRecordProperty.zip || geocode?.zip || "",
      climateZone: riskEnrichment?.climateZone || publicRecordProperty.climateZone || "Unknown",
      flood: riskEnrichment?.flood || publicRecordProperty.flood || "Unknown",
      sourceNote: `${publicRecordProperty.sourceNote || "Public property facts returned."} ${riskEnrichment?.sourceNote || ""}`.trim(),
    };
  }

  const resolvedAddress = geocode?.normalizedAddress || enteredAddress;
  const parsedAddress = parseAddressParts(resolvedAddress);

  return {
    ...defaultHome,
    address: geocode?.address || parsedAddress.address || enteredAddress,
    city: geocode?.city || parsedAddress.city,
    state: normalizeState(geocode?.state || parsedAddress.state),
    zip: geocode?.zip || parsedAddress.zip,
    squareFeet: "Unknown",
    yearBuilt: "Unknown",
    homeType: "Unknown",
    stories: "Unknown",
    bedrooms: "Unknown",
    bathrooms: "Unknown",
    garage: "Unknown",
    lotSize: "Unknown",
    climateZone: riskEnrichment?.climateZone || "Unknown",
    occupancy: "Owner Occupied",
    hvac: "Unknown",
    hvacAge: "Unknown",
    waterHeater: "Unknown",
    waterHeaterAge: "Unknown",
    roof: "Unknown",
    roofAge: "Unknown",
    windows: "Unknown",
    insulation: "Unknown",
    solar: "None",
    hers: "Code-Minimum",
    evReady: "None",
    fortified: "None",
    flood: riskEnrichment?.flood || "Unknown",
    ventilation: "Exhaust Only",
    healthCert: "None",
    carbonStrategy: "No Accounting",
    waterStandard: "Code-Minimum",
    leak: "None",
    insurance: "None / Unknown",
    maintenance: "None",
    sourceNote: geocode
      ? `Mapbox verified the address only. ${riskEnrichment?.sourceNote || "Property facts still need RentCast, documents, photos, or manual confirmation."}`
      : "Address lookup was unavailable. Property facts still need documents, photos, or manual confirmation."
  };
}

function StartScreen({ setScreen, setSelectedProperty, setResultMode, setHome, onQueryStarted }) {
  const [address, setAddress] = useState("1313 Cognition Drive, Orlando, FL");
  const [isScanningAddress, setIsScanningAddress] = useState(false);
  const [scanNote, setScanNote] = useState("");

  const startExistingHomeScan = async () => {
    if (isScanningAddress) return;

    const existingHome = demoProperties[0];
    setIsScanningAddress(true);
    setScanNote("");
    setSelectedProperty(existingHome);
    try {
      const geocode = await geocodeProperty(address);
      const normalizedAddress = geocode.normalizedAddress || address;
      let rentcastProperty = null;
      let attomProperty = null;
      let attomNote = "";
      let riskEnrichment = null;
      try {
        rentcastProperty = await enrichPropertyWithRentCast(normalizedAddress);
      } catch (rentcastError) {
        console.warn("RentCast enrichment unavailable.", rentcastError);
      }
      try {
        attomProperty = await enrichPropertyWithAttom(normalizedAddress);
      } catch (attomError) {
        console.warn("ATTOM enrichment unavailable.", attomError);
        attomNote = " ATTOM did not return a usable property record for this address.";
      }
      try {
        riskEnrichment = await enrichPropertyRisk({
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          state: rentcastProperty?.state || attomProperty?.state || geocode.state,
          zip: rentcastProperty?.zip || attomProperty?.zip || geocode.zip,
        });
      } catch (riskError) {
        console.warn("Risk enrichment unavailable.", riskError);
      }
      const scannedHome = homeFromExistingScan(address, geocode, rentcastProperty, attomProperty, riskEnrichment);
      setHome(scannedHome);
      setScanNote(`${rentcastProperty || attomProperty ? "Address, public facts, and risk context loaded." : "Address normalized with Mapbox. Property facts still need confirmation."}${attomNote}`);
      await onQueryStarted(scannedHome, rentcastProperty && attomProperty ? "rentcast_attom" : rentcastProperty ? "rentcast" : attomProperty ? "attom" : "mapbox");
    } catch (error) {
      const fallbackHome = homeFromExistingScan(address);
      setHome(fallbackHome);
      setScanNote("Address lookup is unavailable. Continue with manual confirmation.");
      await onQueryStarted(fallbackHome, "manual_fallback");
    } finally {
      setResultMode("manual");
      setIsScanningAddress(false);
      setScreen(3);
    }
  };

  return (
    <div className="screen startScreen">

      <h1>Analyze an existing home</h1>
      <p className="centerCopy">Start with an address. VPSF will prefill public records, permits, risk layers, and likely missing specs.</p>

      <section className="existingHomeCard">
        <div className="addressLookup">
          <MapPin size={18} />
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                startExistingHomeScan();
              }
            }}
            aria-label="Property address"
            placeholder="Enter home address"
          />
        </div>
        <button className="primaryButton quickScanButton" onClick={startExistingHomeScan} disabled={isScanningAddress}>
          {isScanningAddress ? "Checking Address..." : "Start Existing Home Scan"} <ArrowRight size={18} />
        </button>
        {scanNote && <p className="addressScanNote">{scanNote}</p>}
        <div className="quickScanGrid">
          {quickScanSources.map(([title, description]) => (
            <div key={title}>
              <CheckCircle2 size={15} />
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="startActions modernStartActions">
        <button onClick={() => setScreen(1)}>
          <span className="actionIcon"><Upload size={26} /></span>
          <div><strong>Upload Documents / Photos</strong><em>Inspection report, invoices, energy bills, permits, or equipment labels.</em></div>
        </button>
        <button onClick={() => setScreen(1)}>
          <span className="actionIcon"><ClipboardList size={26} /></span>
          <div><strong>Guided Home Walk</strong><em>Capture roof, HVAC, panel, water heater, windows, solar, and water fixtures.</em></div>
        </button>
      </div>

      <section className="captureStrip">
        {uploadCaptureOptions.map(([label, type]) => (
          <span key={label}><strong>{type}</strong>{label}</span>
        ))}
      </section>

      <details className="listingImportPanel">
        <summary>Import an active listing instead</summary>
        <div className="listingImportGrid">
          {listingSources.map(([source, Icon, title]) => (
            <button key={source} onClick={() => setScreen(11)}>
              <Icon size={17} />
              <span>{title}</span>
            </button>
          ))}
        </div>
      </details>

      <aside className="smartParse existingSmartParse">
        <Sparkles size={16} />
        <strong>Ask only for the gaps</strong>
        <p>Each field is tracked as public-record, document-extracted, photo-inferred, or homeowner-confirmed before scoring.</p>
        <div className="confidenceLegend">
          <span><i className="sourcePublic" /> Found</span>
          <span><i className="sourceInferred" /> Inferred</span>
          <span><i className="sourceMissing" /> Missing</span>
        </div>
      </aside>

      <p className="privacy">Your data is secure and private.</p>
    </div>
  );
}


function DemoHelpButton({ title, body }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="demoHelpButton" onClick={() => setOpen(true)} aria-label={`Help: ${title}`}>
        ?
      </button>
      {open && (
        <div className="demoOverlay" onClick={() => setOpen(false)}>
          <div className="demoModal" onClick={(event) => event.stopPropagation()}>
            <strong>{title}</strong>
            <p>{body}</p>
            <button className="primaryButton" onClick={() => setOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}

function DemoMlsImportScreen({ selectedProperty, setSelectedProperty, setResultMode, setScreen }) {
  const selectedListing = demoProperties[0];
  const demoMls = demoMlsFromProperty(selectedListing);

  useEffect(() => {
    setSelectedProperty(selectedListing);
  }, [setSelectedProperty, selectedListing]);

  return (
    <div className="screen formScreen demoMlsScreen withNav">
      <h2>Import MLS Listing</h2>
      <p className="subhead tightSubhead">
        Enter a listing number, address, or documents to create a VPSF report.
      </p>

      <section className="mlsPropertyPreview">
        <div className="mlsPhotoWrap">
          <img src={demoOrlandoHome} alt="1313 Cognition Drive exterior" />
          <span>DEMO LISTING</span>
        </div>
        <div>
          <strong>{selectedListing.name}</strong>
          <p>{selectedListing.address}</p>
          
        </div>
      </section>

      <section className="formSection demoFormSection">
        <h3 className="importOptionsTitle">Import Options</h3>
        <p className="importOptionsHelp">Entering a new MLS number, address, or uploaded document would update the property preview above.</p>

        <label className="field fieldWide demoField">
          <span>Enter MLS Number</span>
          <div className="fieldWithHelp">
            <input value={demoMls.mlsNumber} readOnly />
            <DemoHelpButton
              title="MLS Number"
              body="In the finished version, this field can query an MLS connector or licensed listing-data API to retrieve property facts and listing text."
            />
          </div>
        </label>

        <label className="field fieldWide demoField">
          <span>Enter Property Address</span>
          <div className="fieldWithHelp">
            <input value={demoMls.address} readOnly />
            <DemoHelpButton
              title="Address Lookup"
              body="This can trigger geocoding, climate-zone lookup, flood-risk checks, utility-rate lookup, and local market comparison."
            />
          </div>
        </label>

        <label className="field fieldWide demoField">
          <span>Upload and Scan Documents</span>
          <div className="fakeUpload uploadDropZone">
            <Upload size={22} />
            <div>
              <strong>Drag and drop MLS sheet, appraisal, or product specs</strong>
              <em>{demoMls.scanName} selected · PDF / JPG / PNG</em>
            </div>
            <DemoHelpButton
              title="Document Scan"
              body="The live backend can use OCR and document parsing to identify home systems, certifications, square footage, and green-building attributes."
            />
          </div>
        </label>
      </section>

      

      <button className="primaryButton stickyButton scanReportButton" onClick={() => {
        setSelectedProperty(selectedListing);
        setResultMode("demo");
        setScreen(12);
      }}>
        Scan and Report <ArrowRight size={18} />
      </button>
      <button className="secondaryButton" onClick={() => setScreen(0)}>
        Back to Start
      </button>
      <BottomNav active="More" setScreen={setScreen} />
    </div>
  );
}

function DemoAnalyzingScreen({ setScreen }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setScreen(4);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [setScreen]);

  return (
    <div className="screen analyzingScreen">
      <div className="analyzingStage">
        <div className="brainOrb cognitionBrainOrb">
          <img src={cognitionIcon} alt="COGNITION analyzing" className="brainPulseIcon cognitionBrainIcon" />
          <div className="brainRing one" />
          <div className="brainRing two" />
          <div className="brainRing three" />
        </div>

        <h2>ANALYZING ...</h2>
        <p>
          COGNITION Smart Parse is checking available inputs, identifying confirmed and missing specs,
          and preparing the seven VPSF pillars.
        </p>

        <div className="analysisSteps">
          <span>Reviewing address data</span>
          <span>Checking confirmed home features</span>
          <span>Generating VPSF report</span>
        </div>
      </div>
    </div>
  );
}

function PropertyDetails({ home, update, setScreen }) {
  return (
    <div className="screen formScreen">
      <ProgressDots step={1} />
      <h2>Add Property Details</h2>
      <p className="subhead">Enter key property information and home characteristics.</p>

      <section className="formSection">
        <h3>Property Information</h3>
        <Field wide label="Property Address" value={home.address} onChange={(v) => update("address", v)} />
        <Field label="Home Type" value={home.homeType} onChange={(v) => update("homeType", v)} options={selectOptions.homeType} />
        <Field label="Year Built" value={home.yearBuilt} onChange={(v) => update("yearBuilt", v)} />
        <Field label="Square Footage" value={home.squareFeet} onChange={(v) => update("squareFeet", v)} />
        <Field label="Stories" value={home.stories} onChange={(v) => update("stories", v)} options={selectOptions.stories} />
        <Field label="Climate Zone" value={home.climateZone} onChange={(v) => update("climateZone", v)} options={selectOptions.climateZone} />
        <Field label="Zip Code" value={home.zip} onChange={(v) => update("zip", v)} />
        <Field label="Lot Size" value={home.lotSize} onChange={(v) => update("lotSize", v)} />
      </section>

      <section className="formSection">
        <h3>Home Characteristics</h3>
        <Field wide label="Occupancy Type" value={home.occupancy} onChange={(v) => update("occupancy", v)} options={selectOptions.occupancy} />
        <Field label="Bedrooms" value={home.bedrooms} onChange={(v) => update("bedrooms", v)} />
        <Field label="Bathrooms" value={home.bathrooms} onChange={(v) => update("bathrooms", v)} />
        <Field wide label="Garage / Parking" value={home.garage} onChange={(v) => update("garage", v)} />
      </section>

      <section className="formSection photoUploadSection">
        <h3>Home Photos</h3>
        <div className="fakeUpload homePhotoUpload">
          <Upload size={22} />
          <div>
            <strong>Upload exterior, roof, mechanical room, or water-fixture photos</strong>
            <em>Photos help verify roof age, HVAC, water systems, tree cover, and visible resilience features.</em>
          </div>
        </div>
      </section>

      <button className="primaryButton stickyButton" onClick={() => setScreen(2)}>
        Next: Home Specs <ArrowRight size={18} />
      </button>
    </div>
  );
}

function HomeSpecs({ home, update, setScreen }) {
  return (
    <div className="screen formScreen compactFormScreen">
      <ProgressDots step={2} />
      <h2>Add Home Specs</h2>
      <p className="subhead">Start with energy, resilience, and health details.</p>

      <section className="formSection compactSpecsSection">
        <h3>Energy</h3>
        <Field label="HERS Score" value={home.hers} onChange={(v) => update("hers", v)} options={selectOptions.hers} />
        <Field label="HVAC System" value={home.hvac} onChange={(v) => update("hvac", v)} options={selectOptions.hvac} />
        <Field label="HVAC Age" value={home.hvacAge} onChange={(v) => update("hvacAge", v)} />
        <Field label="Water Heating" value={home.waterHeater} onChange={(v) => update("waterHeater", v)} options={selectOptions.waterHeater} />
        <Field label="Water Heater Age" value={home.waterHeaterAge} onChange={(v) => update("waterHeaterAge", v)} />
        <Field label="Solar / Battery" value={home.solar} onChange={(v) => update("solar", v)} options={selectOptions.solar} />
        <Field wide label="EV Readiness" value={home.evReady} onChange={(v) => update("evReady", v)} options={selectOptions.evReady} />
      </section>

      <section className="formSection compactSpecsSection">
        <h3>Resilience + Health</h3>
        <Field label="Resilience Certification" value={home.fortified} onChange={(v) => update("fortified", v)} options={selectOptions.fortified} />
        <Field label="Flood Design" value={home.flood} onChange={(v) => update("flood", v)} options={selectOptions.flood} />
        <Field label="Roof Age" value={home.roofAge} onChange={(v) => update("roofAge", v)} />
        <Field label="Ventilation" value={home.ventilation} onChange={(v) => update("ventilation", v)} options={selectOptions.ventilation} />
        <Field label="Health Standard" value={home.healthCert} onChange={(v) => update("healthCert", v)} options={selectOptions.healthCert} />
      </section>

      <button className="primaryButton" onClick={() => setScreen(14)}>
        Next: Water, Carbon + Financial <ArrowRight size={18} />
      </button>
    </div>
  );
}

function HomeSpecsMore({ home, update, setScreen }) {
  return (
    <div className="screen formScreen compactFormScreen">
      <ProgressDots step={3} />
      <h2>More Home Specs</h2>
      <p className="subhead">Finish the water, carbon, and ownership-risk inputs.</p>

      <section className="formSection compactSpecsSection">
        <h3>Carbon, Water + Financial</h3>
        <Field label="Carbon Strategy" value={home.carbonStrategy} onChange={(v) => update("carbonStrategy", v)} options={selectOptions.carbonStrategy} />
        <Field label="Water Standard" value={home.waterStandard} onChange={(v) => update("waterStandard", v)} options={selectOptions.waterStandard} />
        <Field label="Leak Protection" value={home.leak} onChange={(v) => update("leak", v)} options={selectOptions.leak} />
        <Field label="PIETIM" value={home.pietim} onChange={(v) => update("pietim", v)} options={selectOptions.pietim} />
      </section>

      <section className="formSection compactSpecsSection">
        <h3>Community + Mobility</h3>
        <Field label="WalkScore" value={home.walkscore} onChange={(v) => update("walkscore", v)} options={selectOptions.walkscore} />
        <Field label="Transit / Services" value={home.transit} onChange={(v) => update("transit", v)} options={selectOptions.transit} />
        <Field label="Green Space" value={home.greenspace} onChange={(v) => update("greenspace", v)} options={selectOptions.greenspace} />
        <Field label="Bike Access" value={home.bike} onChange={(v) => update("bike", v)} options={selectOptions.bike} />
      </section>

      <button className="primaryButton" onClick={() => setScreen(3)}>
        Review & Confirm <ArrowRight size={18} />
      </button>
    </div>
  );
}

function ReviewScreen({ home, setScreen, onGenerateScore, isScoring }) {
  const propertyRows = [
    [MapPin, `${home.address}`, `${home.city}, ${home.state} ${home.zip}`],
    [Home, home.homeType, `${home.squareFeet} sq ft • ${home.stories} stories`],
    [ClipboardList, `Year Built: ${home.yearBuilt}`, `${home.bedrooms} Bed • ${home.bathrooms} Bath • ${home.garage}`],
    [Sun, `Climate Zone: ${home.climateZone}`, `Lot Size: ${home.lotSize}`]
  ];
  const specRows = [
    [Zap, "HVAC System", home.hvacAge && home.hvacAge !== "Unknown" ? `${home.hvac} • ${home.hvacAge}` : home.hvac],
    [Droplets, "Water Heating", home.waterHeaterAge && home.waterHeaterAge !== "Unknown" ? `${home.waterHeater} • ${home.waterHeaterAge}` : home.waterHeater],
    [Home, "Roofing", home.roofAge && home.roofAge !== "Unknown" ? `${home.roof} • ${home.roofAge}` : home.roof],
    [Wind, "Ventilation", home.ventilation],
    [Sun, "Solar", home.solar]
  ];

  return (
    <div className="screen reviewScreen">
      <ProgressDots step={3} />
      <h2>Review & Confirm</h2>
      <p className="subhead">Review your information before generating your score.</p>
      {home.sourceNote && <p className="sourceNote">{home.sourceNote}</p>}

      <section className="summaryCard">
        <div className="summaryHeader"><h3>Property Summary</h3><button onClick={() => setScreen(1)}>Edit/Add Details</button></div>
        {propertyRows.map(([Icon, a, b]) => (
          <div className="summaryRow" key={a}>
            <Icon size={18} />
            <div><strong>{a}</strong><span>{b}</span></div>
          </div>
        ))}
      </section>

      <section className="summaryCard">
        <div className="summaryHeader"><h3>Home Specs Summary</h3><button onClick={() => setScreen(2)}>Edit/Add Details</button></div>
        {specRows.map(([Icon, a, b]) => (
          <div className="summaryRow compact" key={a}>
            <Icon size={17} />
            <strong>{a}</strong>
            <span>{b}</span>
          </div>
        ))}
        <button className="textLink" onClick={() => setScreen(2)}>View all specs (18)</button>
      </section>

      <button className="primaryButton stickyButton" onClick={onGenerateScore} disabled={isScoring}>
        {isScoring ? "Generating VPSF Score..." : "Generate VPSF Score"} <ArrowRight size={18} />
      </button>
      <p className="privacy small">Your data is secure and private.</p>
    </div>
  );
}

function Dashboard({ result, setScreen, setSelectedPillar }) {
  const scoreInfo = classification(result.total);
  const pct = Math.min(100, Math.round((result.total / 1000) * 100));
  return (
    <div className="screen dashboardScreen withNav">
      <header className="screenTop"><h2>VPSF Score Overview</h2><Share2 size={18} /></header>
      <div className="scoreGauge" style={{ background: `conic-gradient(#54b96b ${pct * 3.6}deg, #dfe7ed 0)` }}>
        <div>
          <strong>{result.total}</strong>
          <span>VPSF SCORE</span>
          <em>out of 1000</em>
        </div>
      </div>
      <h3 className="scoreTitle rankingTitle">RANKING = {scoreInfo.label}</h3>
      <section className="pillarPanel">
        <h3>Pillar Performance</h3>
        <p>Tap a pillar to see details & recommendations.</p>
        <div className="pillarGrid">
          {PILLARS.map((pillar) => (
            <button className="pillarTap" key={pillar.key} onClick={() => { setSelectedPillar(pillar.key); setScreen(10); }}>
              <MiniScore pillar={pillar} value={result.scores[pillar.key]} />
            </button>
          ))}
        </div>
      </section>

      <button className="primaryButton diveButton" onClick={() => setScreen(5)}>
        Next — Dive Deeper <ArrowRight size={18} />
      </button>
    </div>
  );
}


function pillarPerformanceLabel(value, max) {
  const pct = value / max;
  if (pct >= 0.85) return "Excellent";
  if (pct >= 0.72) return "Strong";
  if (pct >= 0.6) return "Good";
  if (pct >= 0.45) return "Needs Attention";
  return "Priority Upgrade";
}

function takeawaySentence(key, isBest) {
  const best = {
    energy: "Your heat pump systems, solar readiness, and efficient envelope put this home ahead of most homes in energy performance.",
    water: "WaterSense performance, leak protection, and drought-tolerant landscaping reduce waste and help lower monthly utility exposure.",
    health: "Ventilation, low/no-VOC materials, and IAQ monitoring support a healthier indoor environment for buyers.",
    resilience: "FORTIFIED-level details, flood-resistant design, and backup power reduce risk from storms and outages.",
    carbon: "Documented materials, efficient electrification, and lower-carbon selections improve the home’s long-term carbon profile.",
    financial: "Lower operating risk, documented warranties, and insurance-related features improve ownership cost stability.",
    community: "Nearby services, bike access, shared amenities, and green space improve daily livability and market appeal."
  };
  const weak = {
    energy: "Missing demand-response readiness or additional efficiency documentation is keeping the energy score from reaching the top tier.",
    water: "Low-flow fixtures, smart irrigation, and leak detection are the clearest near-term path to reducing operating costs and lifting the VPSF score.",
    health: "Limited ventilation, low-emission material documentation, or IAQ monitoring can reduce buyer confidence in indoor health.",
    resilience: "Missing roof, flood, fire, or backup-power documentation can raise insurance and ownership-risk concerns.",
    carbon: "Weak material disclosure or lack of EPD-backed products makes the carbon story harder to prove.",
    financial: "Limited insurance, warranty, or maintenance-cost evidence can make ownership risk harder to quantify.",
    community: "Limited transit, bike access, or nearby services can weaken the home’s location-value story."
  };
  return (isBest ? best : weak)[key] || "This pillar has a clear impact on the home’s value per square foot story.";
}

function TakeawayCard({ title, pillar, value, isBest }) {
  const Icon = pillar.icon;
  const pct = Math.round((value / pillar.max) * 100);
  return (
    <section className={`takeawayCard ${isBest ? "best" : "weak"}`}>
      <div className="takeawayGauge" style={{ background: `conic-gradient(var(--takeaway-ring) ${pct * 3.6}deg, #dfe7ed 0)` }}>
        <div><Icon size={20} /><strong>{value}</strong><span>/{pillar.max}</span></div>
      </div>
      <div className="takeawayText">
        <em>{title}</em>
        <h3>{pillar.label}</h3>
        <strong>{pillarPerformanceLabel(value, pillar.max)}</strong>
        <p>{takeawaySentence(pillar.key, isBest)}</p>
      </div>
    </section>
  );
}


function PillarDetailScreen({ result, selectedPillar, setScreen, setActivePillar }) {
  const pillar = PILLARS.find((item) => item.key === selectedPillar) || PILLARS[0];
  const details = PILLAR_DETAILS[pillar.key];
  const Icon = pillar.icon;
  const value = result.scores[pillar.key];
  const pct = Math.round((value / pillar.max) * 100);

  return (
    <div className="screen pillarDetailScreen withNav">
      <header className="screenTop"><h2>{details.title}</h2></header>

      <section className={`pillarDetailHero ${pillar.accent}`}>
        <div className="takeawayGauge" style={{ background: `conic-gradient(var(--takeaway-ring) ${pct * 3.6}deg, #dfe7ed 0)` }}>
          <div><Icon size={20} /><strong>{value}</strong><span>/{pillar.max}</span></div>
        </div>
        <div>
          <em>{pillarPerformanceLabel(value, pillar.max)}</em>
          <p>{details.summary}</p>
        </div>
      </section>

      <section className="prosConsGrid">
        <article className="prosCard">
          <h3>Pros</h3>
          <ul>
            {details.pros.map((item) => (
              <li key={item}><Check size={15} /> {item}</li>
            ))}
          </ul>
        </article>

        <article className="consCard">
          <h3>Cons</h3>
          <ul>
            {details.cons.map((item) => (
              <li key={item}><Flame size={15} /> {item}</li>
            ))}
          </ul>
        </article>
      </section>

      <button className="primaryButton" onClick={() => {
        setActivePillar(selectedPillar);
        setScreen(6);
      }}>
        View {pillar.label} Recommendations <ArrowRight size={18} />
      </button>

      <button className="secondaryButton" onClick={() => setScreen(5)}>
        Skip to Key Insights <Sparkles size={18} />
      </button>

      <BottomNav active="Pillars" setScreen={setScreen} />
    </div>
  );
}

function PillarBreakdown({ result, selectedPillar, setScreen }) {
  const pillarPriority = {
    health: 1,
    resilience: 2,
    energy: 3,
    carbon: 4,
    water: 5,
    financial: 6,
    community: 7
  };

  const bestPillar = [...PILLARS].sort((a, b) => {
    const rawDifference = result.scores[b.key] - result.scores[a.key];
    if (rawDifference !== 0) return rawDifference;
    return pillarPriority[a.key] - pillarPriority[b.key];
  })[0];

  const waterPillar = PILLARS.find((item) => item.key === "water");
  const opportunityPillar =
    waterPillar && result.scores.water <= 50
      ? waterPillar
      : [...PILLARS].sort((a, b) => {
          const aGap = a.max - result.scores[a.key];
          const bGap = b.max - result.scores[b.key];
          if (bGap !== aGap) return bGap - aGap;
          return pillarPriority[a.key] - pillarPriority[b.key];
        })[0];

  const focusPillar = PILLARS.find((item) => item.key === selectedPillar) || bestPillar;
  const focusValue = result.scores[focusPillar.key];

  return (
    <div className="screen pillarBreakdown keyTakeawayScreen withNav">
      <header className="screenTop keyHeader"><h2>Key Takeaway</h2></header>

      <TakeawayCard
        title="Key Strength"
        pillar={bestPillar}
        value={result.scores[bestPillar.key]}
        isBest
      />

      <TakeawayCard
        title="Biggest Opportunity"
        pillar={opportunityPillar}
        value={result.scores[opportunityPillar.key]}
      />

      <section className="detailCard compactDetail affordableUpgradeCard">
        <h3>Affordable Upgrade</h3>
        <div className="detailRow"><span>Smart Leak Detection</span><strong>+8 VPSF</strong></div>
        <div className="detailRow"><span>Estimated Installed Cost</span><strong>&lt; $2,000</strong></div>
        <p>Whole-home leak detection with automatic shutoff can reduce water loss, limit damage risk, and may qualify for insurance rebates.</p>
      </section>

      <button className="primaryButton keyInsightsAction" onClick={() => setScreen(17)}>View Path to 700 VPSF <ArrowRight size={18} /></button>
      <BottomNav active="Pillars" setScreen={setScreen} />
    </div>
  );
}

const demoRecommendationDetails = [
  {
    id: "energy-hvac",
    pillar: "energy",
    icon: Zap,
    eyebrow: "Energy Performance",
    title: "Upgrade HVAC + Smart Controls",
    gain: "+16 pts",
    copy: "Improve heating and cooling efficiency with high-performance heat pumps, smart controls, and better load management.",
    bullets: [
      "Replace aging equipment with high-efficiency heat pump technology.",
      "Use smart controls to reduce peak demand and operating costs.",
      "Document equipment efficiency ratings for resale and appraisal support.",
      "Pair HVAC upgrades with envelope improvements for stronger energy gains."
    ]
  },
  {
    id: "energy-water-heating",
    pillar: "energy",
    icon: Zap,
    eyebrow: "Energy + Water",
    title: "Install Heat Pump Water Heating",
    gain: "+15 pts",
    copy: "Heat pump water heaters can reduce water-heating energy demand and strengthen the home's operating-cost story.",
    bullets: [
      "Reduce electric resistance water-heating demand.",
      "Improve annual utility-cost performance.",
      "Support demand flexibility where utility programs are available.",
      "Strengthen both Energy and Financial Risk scoring."
    ]
  },
  {
    id: "water-fixtures",
    pillar: "water",
    icon: Droplets,
    eyebrow: "Water Performance",
    title: "Install Low-Flow Fixtures + Smart Irrigation",
    gain: "+18 pts",
    copy: "The demo home’s weakest score is water. Start with efficient faucets, showerheads, toilets, smart irrigation, and leak detection.",
    bullets: [
      "Replace older faucets and showerheads with WaterSense-labeled low-flow fixtures.",
      "Install high-efficiency toilets to reduce indoor water demand.",
      "Add smart irrigation controls to reduce outdoor water waste.",
      "Pair fixture upgrades with whole-home leak detection for a stronger water-risk story."
    ]
  },
  {
    id: "water-leak-detection",
    pillar: "water",
    icon: Droplets,
    eyebrow: "Water Risk",
    title: "Add Whole-Home Leak Detection",
    gain: "+8 pts",
    copy: "Leak detection can reduce water losses, limit property damage risk, and support insurance conversations.",
    bullets: [
      "Install an automatic shutoff valve.",
      "Monitor unusual water flow patterns.",
      "Protect against hidden plumbing leaks.",
      "Create a low-cost path to better water-risk performance."
    ]
  },
  {
    id: "health-ventilation",
    pillar: "health",
    icon: HeartPulse,
    eyebrow: "Health + Air Quality",
    title: "Add Balanced Fresh-Air Ventilation",
    gain: "+14 pts",
    copy: "A balanced ERV or HRV can improve fresh-air delivery, humidity control, and indoor environmental quality.",
    bullets: [
      "Improve controlled ventilation instead of relying on leakage.",
      "Reduce humidity and stale-air complaints.",
      "Support healthy-home marketing language.",
      "Pair with filtration and low-emitting materials."
    ]
  },
  {
    id: "health-filtration",
    pillar: "health",
    icon: HeartPulse,
    eyebrow: "Health Protection",
    title: "Upgrade Filtration + Moisture Controls",
    gain: "+10 pts",
    copy: "Better filtration and moisture control improve health resilience in humid and high-allergen markets.",
    bullets: [
      "Upgrade HVAC filtration.",
      "Reduce indoor particulate exposure.",
      "Control moisture at bathrooms, kitchens, and mechanical rooms.",
      "Improve documentation for health-oriented buyers."
    ]
  },
  {
    id: "roof-risk",
    pillar: "resilience",
    icon: Shield,
    eyebrow: "Resilience & Financial Risk",
    title: "Plan for Asphalt Roof Replacement",
    gain: "+14 pts",
    copy: "A 12-year-old asphalt roof creates near-term ownership risk in a hot, humid climate.",
    bullets: [
      "Document roof age, remaining useful life, and replacement budget.",
      "Consider impact-resistant shingles or reflective roofing.",
      "Use roof upgrades to support insurance and resilience messaging.",
      "Pair replacement with roof-deck and moisture-management documentation."
    ]
  },
  {
    id: "resilience-backup-power",
    pillar: "resilience",
    icon: Shield,
    eyebrow: "Resilience",
    title: "Add Backup Power Readiness",
    gain: "+12 pts",
    copy: "Battery, generator, or critical-load panel readiness can improve resilience where power failures are frequent.",
    bullets: [
      "Protect key circuits during outages.",
      "Support medical, refrigeration, and communications needs.",
      "Improve disaster readiness in storm-prone regions.",
      "Pair with solar-ready infrastructure when possible."
    ]
  },
  {
    id: "carbon-materials",
    pillar: "carbon",
    icon: Leaf,
    eyebrow: "Carbon & Materials",
    title: "Document Lower-Carbon Materials",
    gain: "+10 pts",
    copy: "EPD-backed products and material disclosures make the carbon story easier to prove.",
    bullets: [
      "Collect EPDs for concrete, insulation, roofing, and finishes.",
      "Prioritize lower-carbon materials during replacement cycles.",
      "Document durable materials that reduce replacement frequency.",
      "Create a credible carbon-performance narrative."
    ]
  },
  {
    id: "tree-risk",
    pillar: "community",
    icon: Leaf,
    eyebrow: "Site + Ownership Risk",
    title: "Manage Tree Cover and Storm Exposure",
    gain: "+8 pts",
    copy: "Tree canopy can reduce cooling loads, but large trees also increase maintenance, storm cleanup, and removal exposure.",
    bullets: [
      "Document tree cover and distance from rooflines.",
      "Budget for pruning, limb removal, and storm-season maintenance.",
      "Preserve strategic shade while reducing branch-over-roof risk.",
      "Use tree management to balance HVAC savings with ownership-risk reduction."
    ]
  },
  {
    id: "community-connectivity",
    pillar: "community",
    icon: Home,
    eyebrow: "Community Access",
    title: "Improve Broadband + Service Access Documentation",
    gain: "+6 pts",
    copy: "Documenting broadband, transit, and nearby services strengthens the community value story.",
    bullets: [
      "Verify available internet speeds and providers.",
      "Show proximity to health services, schools, and daily needs.",
      "Document walkability, bike access, and transit options.",
      "Flag access gaps that reduce marketability."
    ]
  },
  {
    id: "ownership-insurance",
    pillar: "financial",
    icon: Wallet,
    eyebrow: "Financial Risk",
    title: "Reduce Insurance and Maintenance Exposure",
    gain: "+12 pts",
    copy: "Roof condition, leak protection, storm readiness, and equipment age shape ownership risk and buyer confidence.",
    bullets: [
      "Document insurance-relevant upgrades.",
      "Estimate major replacement timelines.",
      "Identify near-term maintenance costs.",
      "Prioritize upgrades that reduce surprise expenses."
    ]
  }
];

const demoMatchingProducts = {
  "water-fixtures": [
    {
      id: "kohler-watersense-faucet",
      name: "Kohler WaterSense Bathroom Faucet",
      category: "Low-Flow Faucet",
      impact: "+3 VPSF",
      image: kohlerFaucetThumb,
      note: "Reduces lavatory water use while preserving everyday performance."
    },
    {
      id: "moen-eco-showerhead",
      name: "Moen Eco-Performance Showerhead",
      category: "Low-Flow Showerhead",
      impact: "+4 VPSF",
      image: moenShowerThumb,
      note: "Cuts shower water demand, one of the highest-use fixture categories."
    },
    {
      id: "niagara-low-flow-toilet",
      name: "Niagara Low-Flow Toilet",
      category: "High-Efficiency Toilet",
      impact: "+5 VPSF",
      image: niagaraToiletThumb,
      note: "High-efficiency flushing can materially reduce indoor water demand."
    },
    {
      id: "rachio-smart-irrigation",
      name: "Rachio Smart Irrigation Controller",
      category: "Smart Irrigation",
      impact: "+6 VPSF",
      image: rachioThumb,
      note: "Weather-based scheduling reduces outdoor irrigation waste."
    }
  ],
  "roof-risk": [
    {
      id: "atas-solar-ready",
      name: "ATAS Solar-Ready Metal Roofing",
      category: "Solar-Ready Roofing",
      impact: "+8 VPSF",
      image: atasRoofingThumb,
      note: "Standing-seam metal roofing designed for future solar integration and long-term durability."
    },
    {
      id: "certainteed-solaris",
      name: "CertainTeed Solaris Cool Roof Shingles",
      category: "Reflective Roofing",
      impact: "+6 VPSF",
      image: certainteedSolarisThumb,
      note: "Solar-reflective shingles that reduce roof heat gain and cooling demand."
    },
    {
      id: "euroshield-roofing",
      name: "Euroshield Recycled Rubber Roofing",
      category: "Impact-Resistant Roofing",
      impact: "+9 VPSF",
      image: euroshieldThumb,
      note: "Class 4 impact-resistant roofing made from recycled rubber with exceptional durability."
    }
  ],
  "tree-risk": [
    {
      id: "arborist-plan",
      name: "Certified Arborist Tree Plan",
      category: "Site Risk",
      impact: "+4 VPSF",
      image: arboristThumb,
      note: "Balances shade benefits with storm and maintenance risk."
    },
    {
      id: "storm-pruning",
      name: "Storm-Season Tree Pruning",
      category: "Maintenance",
      impact: "+4 VPSF",
      image: arboristThumb,
      note: "Reduces limb-over-roof exposure before severe weather."
    }
  ],
  "energy-hvac": [
    {
      id: "smart-thermostat",
      name: "Smart Thermostat + Load Controls",
      category: "Energy Controls",
      impact: "+5 VPSF",
      note: "Smart controls reduce energy waste and improve peak-load management."
    },
    {
      id: "high-efficiency-heat-pump",
      name: "High-Efficiency Heat Pump System",
      category: "HVAC",
      impact: "+11 VPSF",
      note: "Modern heat pump systems can reduce heating and cooling energy demand."
    }
  ],
  "energy-water-heating": [
    {
      id: "rheem-proterra-match",
      name: "Rheem ProTerra Heat Pump Water Heater",
      category: "Water Heating",
      impact: "+15 VPSF",
      note: "Heat-pump water heating reduces energy use and operating cost exposure."
    }
  ],
  "water-leak-detection": [
    {
      id: "smart-leak-detection",
      name: "Whole-Home Leak Detection + Auto Shutoff",
      category: "Leak Protection",
      impact: "+8 VPSF",
      note: "Automatic shutoff reduces damage risk and improves water resilience."
    },
    {
      id: "rachio-smart-irrigation-leak",
      name: "Rachio Smart Irrigation Controller",
      category: "Smart Irrigation",
      impact: "+6 VPSF",
      image: rachioThumb,
      note: "Weather-based scheduling reduces outdoor irrigation waste."
    }
  ],
  "health-ventilation": [
    {
      id: "renewaire-erv-match",
      name: "RenewAire Energy Recovery Ventilator",
      category: "Ventilation",
      impact: "+10 VPSF",
      note: "Energy recovery ventilation improves fresh-air delivery and humidity control."
    }
  ],
  "health-filtration": [
    {
      id: "high-merv-filtration",
      name: "High-MERV Filtration Upgrade",
      category: "Filtration",
      impact: "+6 VPSF",
      note: "Better filtration can reduce indoor particulate exposure."
    }
  ],
  "resilience-backup-power": [
    {
      id: "critical-load-panel",
      name: "Critical-Load Backup Power Panel",
      category: "Backup Power",
      impact: "+7 VPSF",
      note: "Critical-load readiness improves function during outages."
    },
    {
      id: "home-battery",
      name: "Home Battery Backup System",
      category: "Energy Storage",
      impact: "+12 VPSF",
      note: "Battery backup improves resilience where power failures are frequent."
    }
  ],
  "carbon-materials": [
    {
      id: "epd-material-package",
      name: "EPD-Backed Product Package",
      category: "Materials Documentation",
      impact: "+8 VPSF",
      note: "EPDs make lower-carbon material choices easier to verify."
    }
  ],
  "community-connectivity": [
    {
      id: "broadband-verification",
      name: "Broadband + Services Verification",
      category: "Community Access",
      impact: "+4 VPSF",
      note: "Documenting broadband and nearby services strengthens community scoring."
    }
  ],
  "ownership-insurance": [
    {
      id: "insurance-risk-package",
      name: "Insurance Risk Reduction Package",
      category: "Ownership Risk",
      impact: "+10 VPSF",
      note: "Roof, leak, and storm upgrades can improve ownership-risk confidence."
    }
  ]
};

const pillarLabelMap = {
  energy: "Energy",
  water: "Water",
  health: "Health",
  resilience: "Resilience",
  carbon: "Carbon & Materials",
  community: "Community",
  financial: "Financial Risk"
};

function productMatchesPillar(product, pillarKey) {
  if (!pillarKey) return true;
  const haystack = `${product.pillar || ""} ${product.category || ""} ${product.name || ""} ${product.description || ""} ${product.improvement || ""}`.toLowerCase();

  const tests = {
    energy: ["energy", "hvac", "heat pump", "water heater", "solar", "battery", "thermostat"],
    water: ["water", "fixture", "faucet", "shower", "toilet", "irrigation", "rainwater", "leak"],
    health: ["health", "air", "ventilation", "erv", "filtration", "iaq", "humidity"],
    resilience: ["resilience", "roof", "shingle", "storm", "impact", "generator", "battery", "window", "hurricane"],
    carbon: ["carbon", "material", "epd", "low-carbon", "concrete", "insulation"],
    community: ["community", "mobility", "transit", "broadband", "walk", "bike", "tree"],
    financial: ["financial", "insurance", "maintenance", "ownership", "cost", "risk"]
  };

  return (tests[pillarKey] || [pillarKey]).some((term) => haystack.includes(term));
}

function recommendationMatchesPillar(recommendation, pillarKey) {
  if (!pillarKey) return true;
  return recommendation.pillar === pillarKey;
}



function Recommendations({ setScreen, setSelectedRecommendation, activePillar, setActivePillar }) {
  const filteredRecommendations = demoRecommendationDetails.filter((rec) =>
    recommendationMatchesPillar(rec, activePillar)
  );
  const activeLabel = activePillar ? pillarLabelMap[activePillar] || "Selected" : null;
  const totalGain = filteredRecommendations.reduce((sum, rec) => {
    const numeric = Number(String(rec.gain).replace(/[^0-9]/g, ""));
    return sum + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);

  return (
    <div className="screen recommendations withNav">
      <header className="screenTop"><h2>{activeLabel ? `${activeLabel} Recommendations` : "Recommendations"}</h2></header>

      {activeLabel && (
        <section className="contextBanner">
          <strong>{activeLabel} Improvement Path</strong>
          <span>Showing {filteredRecommendations.length} targeted recommendations · Potential gain +{totalGain} VPSF</span>
          <button onClick={() => setActivePillar(null)}>Show All Recommendations</button>
        </section>
      )}

      {filteredRecommendations.map((rec) => {
        const Icon = rec.icon;
        return (
          <article className="recommendationCard" key={rec.id}>
            <div className="recHead"><Icon size={22} /><span>{rec.eyebrow}</span><strong>{rec.gain}</strong></div>
            <h3>{rec.title}</h3>
            <p>{rec.copy}</p>
            <button onClick={() => {
              setSelectedRecommendation(rec);
              setScreen(15);
            }}>View Details</button>
          </article>
        );
      })}
      <button className="primaryButton" onClick={() => setScreen(18)}>View Future Cost Exposure <ArrowRight size={18} /></button>
      <button className="secondaryButton" onClick={() => setScreen(7)}>
        {activeLabel ? `View ${activeLabel} Products` : "View Recommended Products"}
      </button>
      <BottomNav active="Recommendations" setScreen={setScreen} />
    </div>
  );
}

function RecommendationDetail({ recommendation, setScreen }) {
  const Icon = recommendation.icon;
  return (
    <div className="screen recommendationDetailScreen withNav">
      <header className="screenTop"><h2>Smart Summary</h2><Icon size={20} /></header>

      <section className="recommendationSummaryHero">
        <div className="recHead"><Icon size={24} /><span>{recommendation.eyebrow}</span><strong>{recommendation.gain}</strong></div>
        <h3>{recommendation.title}</h3>
        <p>{recommendation.copy}</p>
      </section>

      <section className="copyCard">
        <h3>Details</h3>
        <ul className="smartSummaryList">
          {recommendation.bullets.map((item) => (
            <li key={item}><Check size={15} /> {item}</li>
          ))}
        </ul>
      </section>

      <button className="primaryButton" onClick={() => setScreen(16)}>See Matching Products <ArrowRight size={18} /></button>
      <button className="secondaryButton" onClick={() => setScreen(6)}>Return to Recommendations</button>

      <BottomNav active="Recommendations" setScreen={setScreen} />
    </div>
  );
}


function MatchingProducts({ recommendation, setScreen, setSelectedMatchingProduct, onProductClick }) {
  const products = demoMatchingProducts[recommendation.id] || demoMatchingProducts["water-fixtures"];
  const Icon = recommendation.icon;

  return (
    <div className="screen matchingProductsScreen withNav">
      <header className="screenTop"><h2>Matching Products</h2><Package size={18} /></header>

      <div className="matchProductList">
        {products.map((product) => (
          <article className="matchProductCard" key={product.id}>
            <div className={product.image ? "matchImage" : "matchIcon"}>
              {product.image ? <img src={product.image} alt={product.name} /> : <Icon size={24} />}
            </div>
            <div>
              <span>{product.category}</span>
              <h3>{product.name}</h3>
              <p>{product.note}</p>
              <em>{product.impact}</em>
              <button className="inlineDetailsButton" onClick={() => {
                onProductClick(product, "matching_products");
                setSelectedMatchingProduct(product);
                setScreen(20);
              }}>
                More Details <ArrowRight size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>

      <button className="primaryButton" onClick={() => setScreen(7)}>View General Product Recommendations</button>
      <button className="secondaryButton" onClick={() => setScreen(15)}>Return to Smart Summary</button>

      <BottomNav active="Recommendations" setScreen={setScreen} />
    </div>
  );
}

function MatchingProductDetail({ product, setScreen, onSubmitLead }) {
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  return (
    <div className="screen productDetailScreen withNav">
      <header className="screenTop"><h2>Product Details</h2><Package size={18} /></header>

      <section className="productHeroCard">
        {product.image && <img src={product.image} alt={product.name} />}
        <div>
          <span>{product.category}</span>
          <h3>{product.name}</h3>
          <em>{product.impact}</em>
        </div>
      </section>

      {!showLeadForm && (
        <>
          <section className="copyCard">
            <h3>Technical Overview</h3>
            <p>{product.note}</p>
          </section>

          <button className="primaryButton" onClick={() => setShowLeadForm(true)}>
            Request Specs and Pricing <ArrowRight size={18} />
          </button>

          <button className="secondaryButton" onClick={() => setScreen(16)}>
            Return to Matching Products
          </button>
        </>
      )}

      {showLeadForm && (
        <section className="leadFormCard productLeadFormCard">
          <h3>Request Specs and Pricing</h3>
          <p className="leadFormIntro">
            Send this request to the manufacturer or local supplier.
          </p>
          <label className="field fieldWide">
            <span>Name</span>
            <input placeholder="Your name" value={leadName} onChange={(event) => setLeadName(event.target.value)} />
          </label>
          <label className="field fieldWide">
            <span>Email</span>
            <input placeholder="name@example.com" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} />
          </label>

          <div className="leadFormActions">
            <button className="secondaryButton" onClick={() => setScreen(16)}>
              Return to Matching Products
            </button>
            <button className="primaryButton" onClick={() => {
              onSubmitLead({ name: leadName, email: leadEmail, productId: product.id, action: "Requested specs and pricing" });
              setScreen(9);
            }}>
              Create Score Card
            </button>
          </div>
        </section>
      )}

      <BottomNav active="Recommendations" setScreen={setScreen} />
    </div>
  );
}

function Products({ products, setScreen, setSelectedProduct, activePillar, setActivePillar, onProductClick }) {
  const filteredProducts = products.filter((product) => productMatchesPillar(product, activePillar));
  const activeLabel = activePillar ? pillarLabelMap[activePillar] || "Selected" : null;

  return (
    <div className="screen products withNav">
      <header className="screenTop"><h2>{activeLabel ? `${activeLabel} Products` : "Recommended Products"}</h2><Filter size={18} /></header>

      {activeLabel && (
        <section className="contextBanner">
          <strong>{activeLabel} Product Match</strong>
          <span>Showing products matched to the selected pillar path.</span>
          <button onClick={() => setActivePillar(null)}>Show All Products</button>
        </section>
      )}

      <div className="productList">
        {filteredProducts.map((product) => (
          <article className="productCard" key={product.id}>
            <div className="productImage realProductImage">
              <img src={product.image} alt={product.name} />
            </div>
            <div>
              <span>{product.category}</span>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <em>{product.improvement}</em>
              <button onClick={() => {
                onProductClick(product, "product_listing");
                setSelectedProduct(product);
                setScreen(13);
              }}>
                More Details <ArrowRight size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <button className="primaryButton" onClick={() => setScreen(8)}>Open Marketing Studio</button>
      <BottomNav active="More" setScreen={setScreen} />
    </div>
  );
}

function ProductDetail({ product, setScreen, onSubmitLead }) {
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  return (
    <div className="screen productDetailScreen withNav">
      <header className="screenTop"><h2>Product Details</h2><Package size={18} /></header>

      <section className="productHeroCard">
        <img src={product.image} alt={product.name} />
        <div>
          <span>{product.category}</span>
          <h3>{product.name}</h3>
          <em>{product.improvement}</em>
        </div>
      </section>

      {!showLeadForm && (
        <>
          <section className="copyCard">
            <h3>Technical Overview</h3>
            <p>{product.technicalWriteup}</p>
          </section>

          <button className="primaryButton" onClick={() => setShowLeadForm(true)}>
            Request Specs and Pricing <ArrowRight size={18} />
          </button>

          <button className="secondaryButton" onClick={() => setScreen(7)}>
            Return to Products
          </button>
        </>
      )}

      {showLeadForm && (
        <section className="leadFormCard productLeadFormCard">
          <h3>Request Specs and Pricing</h3>
          <p className="leadFormIntro">
            Send this product request to the manufacturer or local supplier.
          </p>
          <label className="field fieldWide">
            <span>Name</span>
            <input placeholder="Your name" value={leadName} onChange={(event) => setLeadName(event.target.value)} />
          </label>
          <label className="field fieldWide">
            <span>Email</span>
            <input placeholder="name@example.com" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} />
          </label>

          <div className="leadFormActions">
            <button className="secondaryButton" onClick={() => setScreen(7)}>
              Return to Products
            </button>
            <button className="primaryButton" onClick={() => {
              onSubmitLead({ name: leadName, email: leadEmail, productId: product.id, action: "Requested specs and pricing" });
              setScreen(9);
            }}>
              Create Score Card
            </button>
          </div>
        </section>
      )}

      <BottomNav active="More" setScreen={setScreen} />
    </div>
  );
}


function PathTo700Screen({ result, setScreen }) {
  const current = result.total;
  const goal = 700;
  const steps = [
    ["Leak Detection", 8],
    ["Low-Flow Fixtures", 12],
    ["Smart Irrigation", 15],
    ["Cool Roof Upgrade", 20],
    ["Energy Recovery Ventilation", 15]
  ];
  const totalGain = steps.reduce((sum, [, gain]) => sum + gain, 0);
  const projected = Math.min(goal, current + totalGain);
  const progressPct = Math.min(100, Math.round((current / goal) * 100));
  const projectedPct = Math.min(100, Math.round((projected / goal) * 100));

  return (
    <div className="screen path700Screen withNav">
      <header className="screenTop"><h2>Path to 700 VPSF</h2><Sparkles size={18} /></header>

      <section className="pathHeroCard">
        <p>A practical upgrade path that moves this home toward a stronger VPSF ranking without rebuilding the whole property.</p>
        <div className="pathScoreRow">
          <div><strong>{current}</strong><span>Current</span></div>
          <ArrowRight size={22} />
          <div><strong>{goal}</strong><span>Goal</span></div>
        </div>
        <div className="pathBar">
          <i style={{ width: `${progressPct}%` }} />
          <b style={{ left: `${projectedPct}%` }} />
        </div>
        <div className="pathLabels"><span>{current}</span><span>{projected}</span><span>{goal}</span></div>
      </section>

      <section className="upgradePlanCard">
        <h3>Recommended Path</h3>
        {steps.map(([name, gain]) => (
          <div className="upgradeStep" key={name}>
            <span>{name}</span>
            <strong>+{gain} VPSF</strong>
          </div>
        ))}
        <div className="upgradeStep total">
          <span>Total Potential Gain</span>
          <strong>+{totalGain}</strong>
        </div>
      </section>

      <button className="primaryButton" onClick={() => setScreen(6)}>View Recommendations <ArrowRight size={18} /></button>
      <BottomNav active="Recommendations" setScreen={setScreen} />
    </div>
  );
}

function FutureCostExposureScreen({ setScreen }) {
  const costs = [
    { item: "Roof Replacement", timing: "3 years", cost: "$12,000", icon: Home },
    { item: "HVAC Replacement", timing: "7 years", cost: "$6,800", icon: Wind },
    { item: "Water Heater", timing: "2 years", cost: "$1,600", icon: Droplets }
  ];

  return (
    <div className="screen futureCostScreen withNav">
      <header className="screenTop"><h2>Future Cost Exposure</h2><Wallet size={18} /></header>

      <section className="costIntroCard">
        <h3>Potential Major Expenses</h3>
        <p>This older home carries near-term maintenance risk. VPSF uses these cost signals to show buyers and owners where risk may affect value.</p>
      </section>

      <section className="costListCard">
        {costs.map(({ item, timing, cost, icon: Icon }) => (
          <article className="costItem" key={item}>
            <div><Icon size={20} /></div>
            <div><strong>{item}</strong><span>Estimated Cost: {cost}</span></div>
            <em>{timing}</em>
          </article>
        ))}
        <div className="costTotal">
          <span>Estimated Total / Next 10 Years</span>
          <strong>$20,400</strong>
        </div>
      </section>

      <button className="primaryButton" onClick={() => setScreen(19)}>Compare This Home <ArrowRight size={18} /></button>
      <button className="secondaryButton" onClick={() => setScreen(7)}>View Product Solutions</button>
      <BottomNav active="Recommendations" setScreen={setScreen} />
    </div>
  );
}

function CompetingHomeComparisonScreen({ result, setScreen }) {
  const comparisons = [
    { label: "This Home", value: result.total },
    { label: "Typical Existing", value: 480 },
    { label: "Typical New", value: 720 },
    { label: "Net-Zero", value: 920 }
  ];
  const max = 1000;

  return (
    <div className="screen comparisonScreen withNav">
      <header className="screenTop"><h2>Competing Home Comparison</h2><BarChartIcon /></header>

      <section className="comparisonCard">
        <h3>VPSF Score Context</h3>
        <p>See how this home compares with common market alternatives.</p>
        <div className="comparisonBars">
          {comparisons.map((item) => (
            <div className="comparisonBar" key={item.label}>
              <strong>{item.value}</strong>
              <div><i style={{ height: `${Math.round((item.value / max) * 100)}%` }} /></div>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="copyCard comparisonNote">
        <h3>What this means</h3>
        <p>Higher VPSF scores signal better performance, lower operating costs, stronger documentation, and a clearer value story for buyers.</p>
      </section>

      <button className="primaryButton" onClick={() => setScreen(8)}>Open Marketing Studio <ArrowRight size={18} /></button>
      <button className="secondaryButton" onClick={() => setScreen(9)}>Create VPSF Score Card</button>
      <BottomNav active="More" setScreen={setScreen} />
    </div>
  );
}

function BarChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 16V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 16V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}


function marketingOverviewForProperty(property) {
  if (property?.id === "vision-house") {
    return "This high-performance Orlando showcase home already sits near the top of the VPSF scale, with strong energy, health, resilience, and water systems. Its market story should emphasize lower operating costs, verified performance, and long-term value protection.";
  }

  if (property?.id === "net-zero") {
    return "This net-zero showcase residence is positioned as a future-ready asset with exceptional energy, carbon, resilience, and water performance. The strongest message is not just sustainability—it is reduced risk, lower lifetime costs, and premium resale positioning.";
  }

  return "This well-maintained Orlando-area home is located in a hot, humid, high-utility-rate market and has several good performance features, but it needs greater attention to water conservation to stay ahead of operating costs. Adding smart irrigation, leak detection, and reflective roofing would dramatically improve its VPSF status.";
}

function MarketingStudio({ selectedProperty, setScreen }) {
  return (
    <div className="screen marketing withNav">
      <header className="screenTop"><h2>COGNITION Marketing Studio</h2></header>

      <section className="marketingHero realHomeHero">
        <img
          src={demoOrlandoHome}
          alt={`${selectedProperty.name} exterior`}
          className="marketingHeroPhoto"
        />
        <div className="marketingHeroContent">
          <strong>{selectedProperty.name}</strong>
          <p>{selectedProperty.address}</p>
          
        </div>
      </section>

      <section className="copyCard overviewCard">
        <h3>Home Evaluation Overview</h3>
        <p>{marketingOverviewForProperty(selectedProperty)}</p>
      </section>

      <section className="copyCard highlightCard">
        <h3>Performance Highlights</h3>
        <ul className="checkList">
          <li><Check size={15} /> Strong performance story around efficiency, resilience, and ownership risk</li>
          <li><Check size={15} /> Clear improvement path tied to VPSF score gains</li>
          <li><Check size={15} /> Technical features translated into buyer-friendly value</li>
        </ul>
      </section>

      <button className="primaryButton" onClick={() => setScreen(9)}>Generate VPSF Label <Award size={18} /></button>
      <BottomNav active="More" setScreen={setScreen} />
    </div>
  );
}

function LabelScreen({ result, setScreen }) {
  const info = classification(result.total);
  return (
    <div className="screen labelScreen withNav">
      <header className="screenTop"><h2>VPSF Home Label</h2><Share2 size={18} /></header>
      <section className="homeLabel">
        <div className="labelTop"><Award size={22} /><strong>VPSF CERTIFIED HOME</strong></div>
        <img
          src={demoOrlandoHome}
          alt="VPSF certified home exterior"
          className="labelHomePhoto"
        />
        <div className="labelScore"><strong>{result.total}</strong><div><span>{info.label}</span><em>{info.meaning}</em></div></div>
        <p>This home outperforms 78% of homes in its market.</p>
        <h3>Pillar Scores</h3>
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          const value = result.scores[pillar.key];
          const pct = Math.round((value / pillar.max) * 100);
          return (
            <div className="labelPillar" key={pillar.key}>
              <Icon size={14} />
              <span>{pillar.short}</span>
              <div><i style={{ width: `${pct}%` }} /></div>
              <b>{gradeFor(value, pillar.max)}</b>
              <em>{value}/{pillar.max}</em>
            </div>
          );
        })}
        <div className="benefits">
          <div><strong>$1,820</strong><span>Utility Savings</span></div>
          <div><strong>$1,150</strong><span>Insurance Savings</span></div>
          <div><strong>2.1 tons</strong><span>CO₂ Avoided</span></div>
        </div>
        <div className="labelActions"><button>Download Label</button><button>Share Label</button></div>
        <QrCode className="qrIcon" size={46} />
      </section>
      <button className="secondaryButton" onClick={() => setScreen(0)}>Start New Evaluation</button>
      <BottomNav active="More" setScreen={setScreen} />
    </div>
  );
}

export default function App() {
  if (window.location.search.includes("admin=true")) {
    return <AdminDemo />;
  }

  const [screen, setScreen] = useState(0);
  const [selectedPillar, setSelectedPillar] = useState("energy");
  const [activePillar, setActivePillar] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(demoProducts[0]);
  const [selectedRecommendation, setSelectedRecommendation] = useState(demoRecommendationDetails[0]);
  const [selectedMatchingProduct, setSelectedMatchingProduct] = useState(demoMatchingProducts["water-fixtures"][0]);
  const [selectedProperty, setSelectedProperty] = useState(demoProperties[0]);
  const [resultMode, setResultMode] = useState("manual");
  const [home, setHome] = useState(defaultHome);
  const [apiResult, setApiResult] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [products, setProducts] = useState(demoProducts);
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [queryId, setQueryId] = useState(null);
  const manualResult = useMemo(() => scoreHome(home), [home]);
  const demoResult = useMemo(() => resultFromDemoProperty(selectedProperty), [selectedProperty]);
  const result = resultMode === "demo" ? demoResult : apiResult || manualResult;
  const update = (key, value) => setHome((current) => ({ ...current, [key]: value }));

  const handleQueryStarted = async (property, source) => {
    const record = await trackPropertyQuery({
      sessionId,
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      source,
      snapshot: property
    });
    if (record?.id) {
      setQueryId(record.id);
    }
  };

  const handleGenerateScore = async () => {
    setResultMode("manual");
    setIsScoring(true);
    let finalScore = manualResult;
    try {
      const score = await scoreProperty(home);
      finalScore = score;
      setApiResult(score);
    } catch (error) {
      setApiResult(manualResult);
    } finally {
      if (queryId) {
        await trackProgress({
          sessionId,
          queryId,
          screen: 4,
          screenLabel: SCREEN_LABELS[4],
          snapshot: home,
          vpsfScore: finalScore.total,
          scoreLabel: finalScore.label,
          scoreRunId: finalScore.scoreRunId
        });
      }
      setIsScoring(false);
      setScreen(4);
    }
  };

  const handleSubmitLead = async (lead) => {
    try {
      await submitLead({ ...lead, propertyAddress: home.address, zip: home.zip });
    } catch (error) {
      console.warn("Lead submission fell back to local-only flow.", error);
    }
    if (queryId) {
      await trackProgress({
        sessionId,
        queryId,
        screen,
        screenLabel: SCREEN_LABELS[screen] || "Product Lead",
        snapshot: home,
        leadName: lead.name,
        leadEmail: lead.email,
        leadProductId: lead.productId,
        leadAction: lead.action
      });
    }
  };

  const handleProductClick = async (product, context) => {
    if (!queryId) return;
    await trackProductClick({
      sessionId,
      queryId,
      productId: product.id,
      productName: product.name || `${product.brand || ""} ${product.product || ""}`.trim(),
      pillar: product.pillar || "",
      context
    });
  };

  useEffect(() => {
    if (!queryId) return;
    trackProgress({
      sessionId,
      queryId,
      screen,
      screenLabel: SCREEN_LABELS[screen] || "Unknown",
      snapshot: home
    });
  }, [home, queryId, screen, sessionId]);

  useEffect(() => {
    let isMounted = true;
    getProductRecommendations()
      .then((apiProducts) => {
        if (!isMounted || !apiProducts.length) return;
        setProducts(apiProducts.map((product, index) => ({
          ...product,
          image: product.image || demoProducts[index % demoProducts.length].image
        })));
      })
      .catch(() => {
        if (isMounted) setProducts(demoProducts);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="app">
      <AppChrome screen={screen} setScreen={setScreen}>
        {screen === 0 && <StartScreen setScreen={setScreen} setSelectedProperty={setSelectedProperty} setResultMode={setResultMode} setHome={setHome} onQueryStarted={handleQueryStarted} />}
        {screen === 1 && <PropertyDetails home={home} update={update} setScreen={setScreen} />}
        {screen === 2 && <HomeSpecs home={home} update={update} setScreen={setScreen} />}
        {screen === 3 && (
          <ReviewScreen
            home={home}
            setScreen={setScreen}
            onGenerateScore={resultMode === "demo" ? () => setScreen(12) : handleGenerateScore}
            isScoring={isScoring}
          />
        )}
        {screen === 4 && <Dashboard result={result} setScreen={setScreen} setSelectedPillar={setSelectedPillar} />}
        {screen === 5 && <PillarBreakdown result={result} selectedPillar={selectedPillar} setScreen={setScreen} />}
        {screen === 6 && <Recommendations setScreen={setScreen} setSelectedRecommendation={setSelectedRecommendation} activePillar={activePillar} setActivePillar={setActivePillar} />}
        {screen === 7 && <Products products={products} setScreen={setScreen} setSelectedProduct={setSelectedProduct} activePillar={activePillar} setActivePillar={setActivePillar} onProductClick={handleProductClick} />}
        {screen === 8 && <MarketingStudio selectedProperty={selectedProperty} setScreen={setScreen} />}
        {screen === 9 && <LabelScreen result={result} setScreen={setScreen} />}
        {screen === 10 && <PillarDetailScreen result={result} selectedPillar={selectedPillar} setScreen={setScreen} setActivePillar={setActivePillar} />}
        {screen === 11 && <DemoMlsImportScreen selectedProperty={selectedProperty} setSelectedProperty={setSelectedProperty} setResultMode={setResultMode} setScreen={setScreen} />}
        {screen === 12 && <DemoAnalyzingScreen setScreen={setScreen} />}
        {screen === 13 && <ProductDetail product={selectedProduct} setScreen={setScreen} onSubmitLead={handleSubmitLead} />}
        {screen === 14 && <HomeSpecsMore home={home} update={update} setScreen={setScreen} />}
        {screen === 15 && <RecommendationDetail recommendation={selectedRecommendation} setScreen={setScreen} />}
        {screen === 16 && <MatchingProducts recommendation={selectedRecommendation} setScreen={setScreen} setSelectedMatchingProduct={setSelectedMatchingProduct} onProductClick={handleProductClick} />}
        {screen === 17 && <PathTo700Screen result={result} setScreen={setScreen} />}
        {screen === 18 && <FutureCostExposureScreen setScreen={setScreen} />}
        {screen === 19 && <CompetingHomeComparisonScreen result={result} setScreen={setScreen} />}
        {screen === 20 && <MatchingProductDetail product={selectedMatchingProduct} setScreen={setScreen} onSubmitLead={handleSubmitLead} />}
      </AppChrome>

      <style>{`
        :root {
          --navy: #071a2c;
          --navy-2: #0d2943;
          --blue: #126fd2;
          --bright-blue: #29aef5;
          --green: #2f9b4d;
          --green-2: #5fc16f;
          --gold: #f2a51a;
          --red: #e44f46;
          --ink: #0a2340;
          --muted: #65758a;
          --line: #dfe6ee;
          --soft: #f6f8fb;
          --card: #ffffff;
        }

        * { box-sizing: border-box; }
        body { margin: 0; background: var(--navy); }
        button, input, select { font: inherit; }
        button { cursor: pointer; }

        .app {
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 28px;
          background:
            radial-gradient(circle at top, rgba(41, 174, 245, 0.16), transparent 34%),
            linear-gradient(180deg, #071a2c 0%, #0b2d4c 100%);
          color: var(--ink);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        }

        .phoneShell {
          width: 390px;
          min-height: 820px;
          max-height: calc(100vh - 56px);
          overflow-y: auto;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 28px;
          box-shadow: 0 24px 72px rgba(11, 37, 65, 0.14);
          position: relative;
          scrollbar-width: thin;
        }

        .bannerWrap {
          width: 100%;
          height: 72px;
          background: var(--navy);
          overflow: hidden;
          border-radius: 28px 28px 0 0;
        }
        .bannerWrap img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
        }

        .screen {
          padding: 26px 22px 88px;
        }
        .phoneShell:has(.backButton) .screen {
          padding-top: 34px;
        }

        .withNav { padding-bottom: 82px; }

        .backButton {
          position: absolute;
          top: 86px;
          left: 18px;
          z-index: 20;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #0a7faa;
          border-radius: 999px;
          background: #0a7faa;
          color: #ffffff;
          box-shadow: 0 6px 16px rgba(10, 127, 170, 0.22);
        }
        .backButton svg {
          width: 17px;
          height: 17px;
          stroke-width: 5;
        }

        .brandRow {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 9px;
          margin-bottom: 38px;
          color: var(--ink);
        }
        .logoMark {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          color: var(--green);
          font-weight: 950;
          border: 2px solid var(--green);
          border-radius: 8px;
        }
        .brandRow strong { display: block; font-size: 28px; letter-spacing: -0.04em; line-height: 1; }
        .brandRow span { display: block; font-size: 9px; font-weight: 900; letter-spacing: .08em; max-width: 90px; }

        h1, h2, h3, p { margin-top: 0; }
        h1 { font-size: 25px; letter-spacing: -0.04em; margin-bottom: 8px; }
        h2 { font-size: 18px; letter-spacing: -0.03em; text-align: center; margin-bottom: 8px; }
        h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink); }
        .centerCopy, .subhead { color: #40556c; line-height: 1.45; font-size: 14px; text-align: center; }
        .sourceNote {
          border: 1px solid #d9e7f3;
          background: #f7fbff;
          border-radius: 10px;
          color: #40556c;
          font-size: 12px;
          line-height: 1.4;
          padding: 10px 12px;
          margin: 12px 0 0;
        }

        .startScreen { padding-top: 28px; }
        .startScreen h1 { text-align: center; font-size: 24px; }
        .existingHomeCard {
          border: 1px solid #cfe0f1;
          background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          border-radius: 14px;
          padding: 14px;
          margin-top: 18px;
          box-shadow: 0 14px 30px rgba(9, 33, 59, 0.08);
        }
        .addressLookup {
          height: 48px;
          display: grid;
          grid-template-columns: 22px 1fr;
          gap: 9px;
          align-items: center;
          border: 1px solid #cfe0f1;
          background: #fff;
          border-radius: 10px;
          padding: 0 12px;
          color: var(--blue);
        }
        .addressLookup input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: var(--ink);
          font-size: 13px;
          font-weight: 750;
          background: transparent;
        }
        .quickScanButton { margin-top: 12px; }
        .quickScanButton:disabled {
          opacity: .78;
          cursor: wait;
        }
        .addressScanNote {
          margin: 8px 0 0;
          color: #52657a;
          font-size: 11px;
          line-height: 1.35;
          text-align: center;
        }
        .quickScanGrid {
          display: grid;
          gap: 8px;
          margin-top: 12px;
        }
        .quickScanGrid div {
          display: grid;
          grid-template-columns: 18px 82px 1fr;
          gap: 7px;
          align-items: center;
          color: #37506a;
          font-size: 11px;
          line-height: 1.25;
        }
        .quickScanGrid svg { color: var(--green); }
        .quickScanGrid strong {
          color: var(--ink);
          font-size: 11px;
        }
        .startActions { display: grid; gap: 12px; margin: 22px 0; }
        .modernStartActions { margin-bottom: 12px; }
        .startActions button {
          display: grid;
          grid-template-columns: 50px 1fr;
          gap: 12px;
          align-items: center;
          width: 100%;
          text-align: left;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 13px;
          padding: 14px;
          color: var(--ink);
          box-shadow: 0 8px 22px rgba(9, 33, 59, 0.05);
        }
        .actionIcon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #e9f4fe;
          color: var(--blue);
        }
        .startActions strong { display: block; font-size: 14px; }
        .startActions em { display: block; margin-top: 4px; color: #52657a; font-style: normal; font-size: 12px; line-height: 1.35; }
        .captureStrip {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 0 0 13px;
        }
        .captureStrip span {
          min-height: 42px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border: 1px solid #d9e7f3;
          background: #fbfdff;
          border-radius: 10px;
          padding: 8px 10px;
          color: #52657a;
          font-size: 11px;
          line-height: 1.15;
        }
        .captureStrip strong {
          color: var(--blue);
          font-size: 9px;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        .listingImportPanel {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 12px;
          padding: 12px 14px;
          margin-top: 12px;
        }
        .listingImportPanel summary {
          color: var(--ink);
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }
        .listingImportGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }
        .listingImportGrid button {
          min-height: 38px;
          display: grid;
          grid-template-columns: 20px 1fr;
          gap: 6px;
          align-items: center;
          border: 1px solid #d9e7f3;
          background: #f7fbff;
          border-radius: 9px;
          padding: 8px;
          color: var(--ink);
          text-align: left;
          font-size: 10px;
          font-weight: 800;
        }
        .listingImportGrid svg { color: var(--blue); }

        .smartParse {
          border: 1px solid #cfe6c9;
          background: #f1f8ee;
          border-radius: 13px;
          padding: 16px;
          margin-top: 16px;
        }
        .smartParse > svg { color: var(--green); margin-right: 5px; vertical-align: middle; }
        .smartParse strong { color: #164d2b; }
        .smartParse p { margin: 8px 0 10px; color: #3f5b48; line-height: 1.4; font-size: 13px; }
        .smartParse ul, .checkList { margin: 0; padding: 0; list-style: none; display: grid; gap: 0; }
        .smartParse li, .checkList li { display: flex; align-items: center; gap: 8px; color: #244633; font-size: 12px; padding: 2px 0; line-height: 1.1; }
        .existingSmartParse { margin-top: 13px; }
        .confidenceLegend {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .confidenceLegend span {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          height: 28px;
          border-radius: 8px;
          background: rgba(255,255,255,.72);
          color: #244633;
          font-size: 10px;
          font-weight: 850;
        }
        .confidenceLegend i {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          display: block;
        }
        .sourcePublic { background: var(--green); }
        .sourceInferred { background: var(--gold); }
        .sourceMissing { background: #9ba8b9; }
        .privacy { margin: 28px 0 0; text-align: center; color: #7a8795; font-size: 11px; }
        .privacy.small { margin-top: 14px; }

        .progressDots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 22px;
          height: 24px;
          margin-bottom: 14px;
        }
        .progressDots span {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #c7d0db;
          position: relative;
        }
        .progressDots span:not(:last-child)::after {
          content: "";
          width: 22px;
          height: 2px;
          background: #d9e1e9;
          position: absolute;
          left: 9px;
          top: 4px;
        }
        .progressDots span.active { background: var(--blue); }
        .progressDots span.active:not(:last-child)::after { background: var(--blue); }

        .formSection, .summaryCard, .detailCard, .recommendationCard, .productCard, .copyCard, .smartDataUpsell {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          margin-top: 14px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.04);
        }
        .formSection {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .formSection h3 { grid-column: 1 / -1; margin-bottom: 0; }
        .field { display: block; }
        .fieldWide { grid-column: 1 / -1; }
        .field span {
          display: block;
          color: #273f59;
          font-size: 11px;
          font-weight: 750;
          margin-bottom: 5px;
        }
        .field input, .field select {
          width: 100%;
          height: 42px;
          color: var(--ink);
          background: #fbfdff;
          border: 1px solid #d9e3ec;
          border-radius: 8px;
          padding: 0 10px;
          outline: none;
          font-size: 12px;
          font-weight: 650;
        }
        .field input:focus, .field select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(18, 111, 210, .12); }

        .primaryButton, .secondaryButton {
          width: 100%;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 10px;
          font-weight: 850;
          font-size: 13px;
          margin-top: 16px;
        }
        .primaryButton { border: 0; background: var(--blue); color: white; box-shadow: 0 10px 22px rgba(18,111,210,.2); }
        .secondaryButton { border: 1px solid var(--line); background: #fff; color: var(--ink); }
        .stickyButton { position: sticky; bottom: 16px; }

        .summaryHeader, .screenTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .screenTop h2 { text-align: center; flex: 1; margin: 0; }
        .screenTop svg { color: var(--ink); }
        .summaryHeader h3 { margin: 0; }
        .summaryHeader button, .textLink {
          background: transparent;
          border: 0;
          color: var(--blue);
          padding: 0;
          font-weight: 800;
          font-size: 11px;
        }
        .summaryRow {
          display: grid;
          grid-template-columns: 24px 1fr;
          gap: 9px;
          align-items: start;
          margin-top: 13px;
          font-size: 12px;
        }
        .summaryRow svg { color: #42627e; }
        .summaryRow strong { display: block; color: var(--ink); }
        .summaryRow span { color: #52657a; }
        .summaryRow.compact { grid-template-columns: 24px 1fr 1fr; align-items: center; }

        .scoreGauge {
          width: 178px;
          height: 178px;
          border-radius: 50%;
          margin: 24px auto 14px;
          display: grid;
          place-items: center;
        }
        .scoreGauge > div {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #fff;
          box-shadow: inset 0 0 0 1px #e4ebf2;
        }
        .scoreGauge strong { font-size: 46px; letter-spacing: -0.07em; color: #1e5c32; line-height: .9; }
        .scoreGauge span { font-size: 11px; font-weight: 900; color: var(--ink); }
        .scoreGauge em { font-style: normal; font-size: 10px; color: #52657a; margin-top: -14px; }
        .scoreTitle { color: var(--green); text-align: center; font-size: 15px; margin: 0; }
        .scoreMeaning { text-align: center; color: #52657a; font-size: 13px; margin: 4px 0 12px; }
        .meaningButton {
          height: 34px;
          display: block;
          margin: 0 auto 18px;
          padding: 0 18px;
          border: 1px solid #ccd9e5;
          color: #123e66;
          background: #fff;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 800;
        }
        .pillarPanel h3 { margin-bottom: 2px; }
        .pillarPanel p { color: #52657a; font-size: 12px; margin-bottom: 10px; }
        .pillarGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px 16px;
          justify-items: center;
          margin-top: 12px;
        }
        .pillarTap {
          border: 0;
          background: transparent;
          padding: 0;
          width: 76px;
        }
        .miniScore {
          --ring: var(--green);
          color: var(--ink);
          display: grid;
          justify-items: center;
          gap: 6px;
        }
        .miniScore.blue { --ring: var(--bright-blue); }
        .miniScore.gold { --ring: var(--gold); }
        .miniScore span { font-size: 11px; font-weight: 850; line-height: 1.05; }
        .miniRing {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          box-shadow: inset 0 0 0 1px #dfe8f0;
        }
        .miniRingInner {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          box-shadow: 0 0 0 1px #eef3f7;
          overflow: hidden;
        }
        .miniScore svg { 
          color: var(--ring); 
          width: 14px;
          height: 14px;
          margin: 0 0 1px;
          flex: 0 0 auto;
        }
        .miniScore strong { 
          font-size: 17px; 
          line-height: 1; 
          letter-spacing: -0.04em;
          flex: 0 0 auto;
        }
        .miniScore em { 
          font-size: 8px; 
          line-height: 1;
          color: #52657a; 
          font-style: normal; 
          flex: 0 0 auto;
        }
        .diveButton {
          margin: 22px 0 8px;
          height: 50px;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .pillarHero {
          display: grid;
          grid-template-columns: 88px 1fr;
          gap: 14px;
          align-items: center;
          margin-top: 18px;
        }
        .smallGauge {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }
        .smallGauge > div {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          background: #fff;
          display: grid;
          place-items: center;
          box-shadow: inset 0 0 0 1px #e4ebf2;
        }
        .smallGauge strong { font-size: 22px; line-height: .9; }
        .smallGauge span { font-size: 10px; color: #52657a; margin-top: -8px; }
        .pillarHero h3 { color: var(--green); margin-bottom: 4px; }
        .pillarHero p { color: #52657a; font-size: 12px; line-height: 1.4; margin: 4px 0 0; }

        .pillarDetailHero {
          --takeaway-ring: var(--green);
          display: grid;
          grid-template-columns: 82px 1fr;
          gap: 14px;
          align-items: center;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          padding: 14px;
          margin-top: 18px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.05);
        }
        .pillarDetailHero.blue { --takeaway-ring: var(--bright-blue); }
        .pillarDetailHero.gold { --takeaway-ring: var(--gold); }
        .pillarDetailHero em {
          display: block;
          color: var(--takeaway-ring);
          font-style: normal;
          font-weight: 950;
          font-size: 15px;
          margin-bottom: 6px;
        }
        .pillarDetailHero p {
          color: #52657a;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
        }
        .prosConsGrid {
          display: grid;
          gap: 14px;
          margin-top: 16px;
        }
        .prosCard, .consCard {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          padding: 15px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.05);
        }
        .prosCard h3, .consCard h3 {
          font-size: 14px;
          margin-bottom: 12px;
        }
        .prosCard h3 { color: var(--green); }
        .consCard h3 { color: #c68200; }
        .prosCard ul, .consCard ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 9px;
        }
        .prosCard li, .consCard li {
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 8px;
          align-items: start;
          color: #344d66;
          font-size: 13px;
          line-height: 1.35;
        }
        .prosCard svg { color: var(--green); margin-top: 1px; }
        .consCard svg { color: var(--gold); margin-top: 1px; }

        .keyHeader h2 {
          font-size: 22px;
          margin-bottom: 18px;
        }
        .takeawayCard {
          --takeaway-ring: var(--green);
          display: grid;
          grid-template-columns: 82px 1fr;
          gap: 14px;
          align-items: center;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          padding: 14px;
          margin-top: 14px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.05);
        }
        .takeawayCard.weak { --takeaway-ring: var(--gold); }
        .takeawayGauge {
          width: 74px;
          height: 74px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }
        .takeawayGauge > div {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 1px #e4ebf2;
        }
        .takeawayGauge svg { color: var(--takeaway-ring); margin-bottom: 1px; }
        .takeawayGauge strong { font-size: 20px; line-height: .9; color: var(--ink); }
        .takeawayGauge span { font-size: 9px; color: #52657a; margin-top: 1px; }
        .takeawayText em {
          display: block;
          color: #52657a;
          font-size: 12px;
          font-style: normal;
          font-weight: 850;
          margin-bottom: 5px;
        }
        .takeawayText h3 {
          color: var(--ink);
          font-size: 12px;
          margin-bottom: 4px;
        }
        .takeawayText strong {
          display: block;
          color: var(--green);
          font-size: 15px;
          margin-bottom: 5px;
        }
        .takeawayCard.weak .takeawayText strong { color: #c68200; }
        .takeawayText p {
          color: #52657a;
          font-size: 12px;
          line-height: 1.38;
          margin: 0;
        }
        .compactDetail { margin-top: 16px; }

        .detailRow {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e8eef4;
          font-size: 13px;
        }
        .detailRow.total { border-bottom: 0; font-weight: 900; }
        .detailCard p { color: #52657a; font-size: 13px; line-height: 1.45; margin-bottom: 0; }

        .tabs { display: flex; gap: 8px; margin: 18px 0; }
        .tabs button {
          border: 1px solid var(--line);
          background: #f5f8fb;
          color: #273f59;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 800;
        }
        .tabs button.active { background: var(--blue); color: white; border-color: var(--blue); }
        .recommendationCard { padding: 16px; }
        .recHead { display: flex; align-items: center; gap: 8px; }
        .recHead svg { color: var(--bright-blue); }
        .recHead span { text-transform: uppercase; color: var(--blue); font-size: 10px; font-weight: 950; flex: 1; }
        .recHead strong { color: var(--red); font-size: 12px; }
        .recommendationCard h3 { text-transform: none; letter-spacing: 0; font-size: 14px; margin: 10px 0 4px; }
        .recommendationCard p { color: #52657a; line-height: 1.45; font-size: 13px; }
        .recommendationCard button, .productCard button {
          border: 0;
          background: transparent;
          color: var(--blue);
          font-size: 12px;
          padding: 0;
          font-weight: 850;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .productCard {
          display: grid;
          grid-template-columns: 76px 1fr;
          gap: 12px;
          align-items: center;
        }
        .productImage {
          width: 76px;
          height: 76px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #aeb9c2, #56616d);
          overflow: hidden;
        }
        .realProductImage {
          background: #f4f7fa;
          border: 1px solid #dbe6ef;
        }
        .realProductImage img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
        .productImage.heater { background: linear-gradient(135deg, #e8edf1, #94a4b2); color: #17314d; }
        .productImage.tank { background: linear-gradient(135deg, #709583, #2d5e4d); }
        .productImage.roof { background: linear-gradient(135deg, #9a9c9c, #3e474a); }
        .productImage.erv { background: linear-gradient(135deg, #d8dfe5, #7d8b97); color: #17314d; }
        .productCard span { text-transform: uppercase; color: var(--blue); font-size: 10px; font-weight: 900; }
        .productCard h3 { text-transform: none; letter-spacing: 0; font-size: 13px; margin: 4px 0; }
        .productCard p { color: var(--green); font-size: 12px; margin-bottom: 5px; }
        .productCard em {
          display: block;
          color: var(--gold);
          font-size: 11px;
          font-style: normal;
          font-weight: 950;
          margin-bottom: 8px;
        }


        .productList {
          display: grid;
          gap: 9px;
        }
        .products .productCard {
          margin-top: 0;
          padding: 10px;
          grid-template-columns: 70px 1fr;
          gap: 10px;
        }
        .products .productImage {
          width: 70px;
          height: 70px;
        }
        .productHeroCard {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          margin-top: 18px;
          box-shadow: 0 10px 26px rgba(9, 33, 59, 0.06);
        }
        .productHeroCard img {
          width: 100%;
          height: 170px;
          display: block;
          object-fit: cover;
          background: #f4f7fa;
        }
        .productHeroCard div {
          padding: 15px;
        }
        .productHeroCard span {
          display: block;
          color: var(--blue);
          text-transform: uppercase;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 5px;
        }
        .productHeroCard h3 {
          text-transform: none;
          letter-spacing: 0;
          font-size: 18px;
          margin-bottom: 7px;
        }
        .productHeroCard em {
          color: var(--gold);
          font-style: normal;
          font-weight: 950;
          font-size: 12px;
        }
        .leadFormCard {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          padding: 15px;
          margin-top: 14px;
          box-shadow: 0 10px 26px rgba(9, 33, 59, 0.06);
        }
        .leadFormCard h3 {
          text-transform: none;
          letter-spacing: 0;
          font-size: 16px;
          margin-bottom: 12px;
        }
        .leadFormActions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-top: 12px;
        }
        .leadFormActions .primaryButton,
        .leadFormActions .secondaryButton {
          margin-top: 0;
        }

        .copyCard h3, .smartDataUpsell h3 { text-transform: none; letter-spacing: 0; font-size: 15px; margin-bottom: 8px; }
        .copyCard p, .smartDataUpsell p { color: #52657a; font-size: 13px; line-height: 1.5; margin-bottom: 0; }
        .smartDataUpsell { display: grid; grid-template-columns: 34px 1fr; gap: 12px; background: #f4f9ff; }
        .smartDataUpsell svg { color: var(--blue); }


        .realHomeHero {
          display: block;
          padding: 0;
          overflow: hidden;
        }
        .marketingHeroPhoto {
          width: 100%;
          height: 176px;
          object-fit: cover;
          display: block;
          background: #eef4f8;
        }
        .marketingHeroContent {
  padding: 10px 14px 6px;
}
        .marketingHeroContent strong {
          display: block;
          color: var(--ink);
          font-size: 18px;
          line-height: 1.1;
          margin-bottom: 5px;
        }
        .marketingHeroContent p {
  color: #52657a;
  font-size: 12px;
  line-height: 1.25;
  margin: 0 0 4px;
}
        .heroBadges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .heroBadges span {
          background: #eef5fb;
          color: var(--blue);
          border: 1px solid #d9e8f4;
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 10px;
          font-weight: 900;
        }
        .overviewCard p {
  font-size: 13px;
  line-height: 1.2;
  margin: 0;
}
        .overviewCard,
        .highlightCard {
          padding: 14px 16px !important;
          margin-top: 10px !important;
        }
        .overviewCard h3,
        .highlightCard h3 {
          margin-bottom: 8px;
        }
        .highlightCard .checkList {
  gap: 4px;
}
        .highlightCard .checkList li {
  font-size: 12px;
  line-height: 1.2;
}
        .labelHomePhoto {
          width: 100%;
          height: 118px;
          object-fit: cover;
          display: block;
          border-bottom: 1px solid #e7edf3;
          background: #eef4f8;
        }

        .homeLabel {
          margin-top: 18px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #d2dde8;
          background: #fff;
          box-shadow: 0 10px 28px rgba(9, 33, 59, 0.08);
        }
        .labelTop {
          background: var(--navy);
          color: white;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 16px;
        }
        .labelScore {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          padding: 18px 18px 8px;
          gap: 15px;
        }
        .labelScore > strong { color: var(--green); font-size: 58px; line-height: 1; letter-spacing: -0.08em; }
        .labelScore span { color: var(--green); display: block; font-weight: 950; text-transform: uppercase; font-size: 15px; }
        .labelScore em { color: #52657a; font-style: normal; font-size: 12px; }
        .homeLabel > p { padding: 0 18px 14px; color: #52657a; font-size: 12px; border-bottom: 1px solid #e7edf3; }
        .homeLabel h3 { padding: 0 18px; margin: 13px 0 8px; }
        .labelPillar {
          display: grid;
          grid-template-columns: 18px 78px 1fr 28px 48px;
          align-items: center;
          gap: 7px;
          padding: 6px 18px;
          font-size: 11px;
        }
        .labelPillar svg { color: var(--green); }
        .labelPillar div { height: 7px; background: #e5ebf1; border-radius: 99px; overflow: hidden; }
        .labelPillar i { display: block; height: 100%; background: var(--green); border-radius: 99px; }
        .labelPillar b { background: var(--green); color: white; border-radius: 99px; text-align: center; padding: 2px 0; font-size: 10px; }
        .labelPillar em { color: #52657a; font-style: normal; text-align: right; }
        .benefits {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin: 14px 18px;
          border-top: 1px solid #e7edf3;
          padding-top: 14px;
        }
        .benefits div { text-align: center; }
        .benefits strong { display: block; color: var(--ink); font-size: 14px; }
        .benefits span { display: block; color: #52657a; font-size: 10px; }
        .labelActions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 18px 14px; }
        .labelActions button { height: 38px; border: 0; background: var(--blue); color: white; border-radius: 8px; font-size: 11px; font-weight: 900; }
        .qrIcon { display: block; margin: 0 auto 18px; color: var(--navy); }



        .importOptionsTitle {
          color: var(--navy);
          font-size: 20px;
          font-weight: 950;
          letter-spacing: .01em;
          text-transform: none;
        }
        .demoPropertySelector {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          margin-top: 12px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.04);
        }
        .demoPropertySelector h3 {
          color: var(--navy);
          font-size: 13px;
          margin-bottom: 10px;
        }
        .demoPropertyCards {
          display: grid;
          gap: 9px;
        }
        .demoPropertyCards button {
          text-align: left;
          border: 1px solid #dbe6ef;
          background: #fbfdff;
          border-radius: 12px;
          padding: 11px 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 3px 10px;
          align-items: center;
        }
        .demoPropertyCards button.active {
          border-color: var(--blue);
          background: #eef7ff;
          box-shadow: 0 0 0 3px rgba(18, 111, 210, .10);
        }
        .demoPropertyCards strong {
          color: var(--ink);
          font-size: 13px;
        }
        .demoPropertyCards span {
          color: #52657a;
          font-size: 11px;
        }
        .demoPropertyCards em {
          grid-row: 1 / span 2;
          grid-column: 2;
          color: var(--green);
          font-style: normal;
          font-weight: 950;
          font-size: 12px;
        }



        .mlsPhotoWrap {
          position: relative;
          height: 132px;
          overflow: hidden;
        }
        .mlsPhotoWrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          background: #eef4f8;
        }
        .mlsPhotoWrap span {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(7, 26, 44, .92);
          color: #fff;
          border: 1px solid rgba(242, 165, 26, .92);
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .08em;
        }
        .importOptionsHelp {
          grid-column: 1 / -1;
          color: #52657a;
          font-size: 12px;
          line-height: 1.35;
          margin: -2px 0 2px;
        }

        .mlsPropertyPreview {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          margin-top: 12px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.05);
        }
        .mlsPropertyPreview > div:not(.mlsPhotoWrap) {
          padding: 10px 12px 11px;
        }
        .mlsPropertyPreview strong {
          display: block;
          color: var(--ink);
          font-size: 17px;
          line-height: 1.1;
          margin-bottom: 5px;
        }
        .mlsPropertyPreview p {
          color: #52657a;
          font-size: 12px;
          line-height: 1.35;
          margin: 0 0 9px;
        }
        .uploadDropZone {
          min-height: 76px;
          border-width: 2px;
          background: #f7fbff;
        }
        .uploadDropZone strong {
          font-size: 13px;
        }

        .demoBadge {
          width: max-content;
          margin: 0 auto 10px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #fff6df;
          color: #9a6400;
          border: 1px solid #f2d387;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .08em;
        }
        .demoAssetNote {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          align-items: start;
          border: 1px solid #cfe6c9;
          background: #f1f8ee;
          border-radius: 14px;
          padding: 14px;
          margin-top: 16px;
        }
        .demoAssetNote svg { color: var(--green); }
        .demoAssetNote strong { color: #164d2b; font-size: 13px; }
        .demoAssetNote p { color: #3f5b48; font-size: 12px; line-height: 1.4; margin: 5px 0 0; }
        .demoFormSection {
          grid-template-columns: 1fr;
        }
        .fieldWithHelp {
          display: grid;
          grid-template-columns: 1fr 34px;
          gap: 8px;
          align-items: center;
        }
        .demoHelpButton {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 2px solid var(--gold);
          background: var(--navy-2);
          color: white;
          font-weight: 950;
          box-shadow: 0 6px 16px rgba(7, 26, 44, 0.18);
        }
        .fakeUpload {
          display: grid;
          grid-template-columns: 28px 1fr 34px;
          gap: 10px;
          align-items: center;
          min-height: 54px;
          border: 1px dashed #b9c8d6;
          background: #fbfdff;
          border-radius: 10px;
          padding: 10px;
        }
        .fakeUpload > svg { color: var(--blue); }
        .fakeUpload strong { display: block; font-size: 12px; color: var(--ink); }
        .fakeUpload em { display: block; font-size: 11px; color: #52657a; font-style: normal; margin-top: 2px; }
        .demoParsePreview {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          margin-top: 14px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.04);
        }
        .demoParsePreview ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .demoParsePreview li {
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 8px;
          color: #344d66;
          font-size: 12px;
          line-height: 1.35;
        }
        .demoParsePreview svg { color: var(--green); margin-top: 1px; }
        .demoOverlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(7, 26, 44, .45);
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .demoModal {
          width: min(340px, 100%);
          background: #fff;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 22px 70px rgba(0,0,0,.28);
          border: 1px solid var(--line);
        }
        .demoModal strong { display: block; font-size: 16px; color: var(--ink); }
        .demoModal p { color: #52657a; font-size: 13px; line-height: 1.45; margin: 8px 0 14px; }


        .scanReportButton {
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .analyzingScreen {
          min-height: 680px;
          display: grid;
          place-items: center;
          padding-bottom: 42px;
          background:
            radial-gradient(circle at center 38%, rgba(41, 174, 245, .16), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%);
        }
        .analyzingStage {
          text-align: center;
          width: 100%;
          max-width: 310px;
          margin: 0 auto;
        }
        .brainOrb {
          width: 150px;
          height: 150px;
          margin: 0 auto 26px;
          border-radius: 50%;
          position: relative;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 50%, rgba(242, 165, 26, .22), transparent 36%),
            radial-gradient(circle at 50% 50%, rgba(41, 174, 245, .25), transparent 62%),
            linear-gradient(135deg, var(--navy), var(--navy-2));
          box-shadow:
            0 22px 60px rgba(7, 26, 44, .24),
            inset 0 0 0 2px rgba(255,255,255,.08);
          overflow: visible;
        }
        .brainPulseIcon {
          color: #ffffff;
          z-index: 3;
          filter: drop-shadow(0 0 14px rgba(242, 165, 26, .55));
          animation: brainPulse 1.4s ease-in-out infinite;
        }
        .brainRing {
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          border: 2px solid rgba(242, 165, 26, .62);
          animation: brainOrbit 2.2s linear infinite;
        }
        .brainRing.two {
          inset: 22px;
          border-color: rgba(41, 174, 245, .58);
          animation-duration: 1.6s;
          animation-direction: reverse;
        }
        .brainRing.three {
          inset: -8px;
          border-color: rgba(47, 155, 77, .28);
          animation-duration: 3.4s;
        }
        .analyzingStage h2 {
          font-size: 24px;
          letter-spacing: .11em;
          color: var(--navy);
          margin-bottom: 10px;
        }
        .analyzingStage p {
          color: #52657a;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 18px;
        }
        .analysisSteps {
          display: grid;
          gap: 8px;
        }
        .analysisSteps span {
          display: block;
          padding: 10px 12px;
          border: 1px solid #dbe6ef;
          border-radius: 999px;
          background: rgba(255,255,255,.82);
          color: #27435f;
          font-size: 12px;
          font-weight: 800;
          animation: stepGlow 1.8s ease-in-out infinite;
        }
        .analysisSteps span:nth-child(2) { animation-delay: .35s; }
        .analysisSteps span:nth-child(3) { animation-delay: .7s; }

        @keyframes brainPulse {
          0%, 100% { transform: scale(1); opacity: .92; }
          50% { transform: scale(1.12); opacity: 1; }
        }
        @keyframes brainOrbit {
          0% { transform: rotate(0deg) scale(1); opacity: .72; }
          50% { transform: rotate(180deg) scale(1.06); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: .72; }
        }
        @keyframes stepGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(41,174,245,0); transform: translateY(0); }
          50% { box-shadow: 0 8px 22px rgba(41,174,245,.14); transform: translateY(-1px); }
        }

        .bottomNav {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 62px;
          border-top: 1px solid #e5edf4;
          background: rgba(255,255,255,.96);
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          backdrop-filter: blur(12px);
        }
        .bottomNav button {
          border: 0;
          background: transparent;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 3px;
          color: #596d82;
          font-size: 10px;
        }
        .bottomNav button.active { color: var(--blue); font-weight: 900; }


        .demoMlsScreen {
          padding-bottom: 150px;
        }
        .demoMlsScreen .stickyButton {
          position: relative;
          bottom: auto;
          margin-top: 16px;
          z-index: 1;
        }
        .demoMlsScreen .secondaryButton {
          margin-top: 8px;
        }
        
        .demoMlsScreen .uploadDropZone {
          min-height: 62px;
          padding: 8px 10px;
          align-items: center;
        }
        .demoMlsScreen .uploadDropZone strong {
          font-size: 12px;
          line-height: 1.2;
        }
        .demoMlsScreen .uploadDropZone em {
          font-size: 10px;
          line-height: 1.2;
        }
        .demoMlsScreen .formSection {
          gap: 8px;
        }
        .demoMlsScreen .field span {
          margin-bottom: 4px;
        }

        .affordableUpgradeCard {
          background: #fff6e8;
          border: 2px solid #f2cf82;
        }
        .affordableUpgradeCard h3 {
          color: #071a2c;
          font-weight: 950;
          letter-spacing: .02em;
        }
        .affordableUpgradeCard p {
          font-size: 13px;
          line-height: 1.35;
          margin-top: 8px;
          margin-bottom: 0;
        }
        .affordableUpgradeCard .detailRow {
          padding: 8px 0;
        }
        .affordableUpgradeCard .detailRow strong {
          color: #2f9b4d;
          font-weight: 950;
          font-size: 1.05rem;
        }


        .demoMlsScreen .scanReportButton {
          position: relative;
          z-index: 2;
          margin-top: 14px;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: .05em;
        }


        .keyTakeawayScreen {
          padding-bottom: 132px;
        }
        .keyInsightsAction {
          position: relative;
          z-index: 5;
          margin-bottom: 18px;
        }
        .affordableUpgradeCard {
          padding: 12px 14px;
        }
        .affordableUpgradeCard p {
          font-size: 12px;
          line-height: 1.28;
          margin-top: 7px;
        }
        .affordableUpgradeCard .detailRow {
          padding: 7px 0;
          font-size: 12px;
        }
        .demoMlsScreen {
          padding-top: 20px;
        }
        .demoMlsScreen .tightSubhead {
          font-size: 12px;
          line-height: 1.28;
          margin-bottom: 10px;
        }
        .demoMlsScreen .mlsPropertyPreview {
          margin-top: 10px;
        }
        .demoMlsScreen .mlsPhotoWrap {
          height: 116px;
        }
        .demoMlsScreen .mlsPropertyPreview > div:not(.mlsPhotoWrap) {
          padding: 8px 10px 9px;
        }
        .demoMlsScreen .heroBadges {
          gap: 5px;
        }
        .demoMlsScreen .heroBadges span {
          padding: 3px 7px;
          font-size: 9px;
        }
        .demoMlsScreen .formSection {
          margin-top: 10px;
          padding: 12px;
          gap: 7px;
        }
        .demoMlsScreen .importOptionsHelp {
          font-size: 11px;
          line-height: 1.25;
          margin-bottom: 0;
        }
        .demoMlsScreen .field input {
          height: 38px;
          font-size: 11px;
        }
        
        
        
        
        .demoMlsScreen .scanReportButton {
          margin-top: 12px;
          margin-bottom: 8px;
        }


        .compactFormScreen {
          padding-bottom: 120px;
        }
        .compactSpecsSection {
          gap: 8px;
          padding: 12px;
        }
        .compactSpecsSection .field input,
        .compactSpecsSection .field select {
          height: 38px;
          font-size: 11px;
        }
        .compactSpecsSection .field span {
          margin-bottom: 4px;
        }
        .cognitionBrainOrb {
          background: transparent;
          box-shadow: none;
          overflow: visible;
        }
        .cognitionBrainIcon {
          width: 116px;
          height: 116px;
          object-fit: contain;
          z-index: 3;
          filter: drop-shadow(0 12px 26px rgba(7,26,44,.18));
        }
        .cognitionBrainOrb .brainRing {
          border-color: rgba(10, 127, 170, .38);
        }
        .recommendationSummaryHero {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          padding: 15px;
          margin-top: 18px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.05);
        }
        .recommendationSummaryHero h3 {
          text-transform: none;
          letter-spacing: 0;
          font-size: 17px;
          margin: 12px 0 6px;
        }
        .recommendationSummaryHero p {
          color: #52657a;
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
        }
        .smartSummaryList {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 9px;
        }
        .smartSummaryList li {
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 8px;
          color: #344d66;
          font-size: 13px;
          line-height: 1.35;
        }
        .smartSummaryList svg {
          color: var(--green);
          margin-top: 1px;
        }


        .compactMatchHero {
          margin-top: 18px;
          padding: 13px;
        }
        .matchProductList {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .matchProductCard {
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 12px;
          align-items: start;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 15px;
          padding: 12px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.04);
        }
        .matchIcon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: #eef7ff;
          color: var(--bright-blue);
          border: 1px solid #d7eafa;
        }
        .matchProductCard span {
          display: block;
          color: var(--blue);
          text-transform: uppercase;
          font-size: 10px;
          font-weight: 950;
          margin-bottom: 3px;
        }
        .matchProductCard h3 {
          text-transform: none;
          letter-spacing: 0;
          color: var(--ink);
          font-size: 14px;
          margin-bottom: 4px;
        }
        .matchProductCard p {
          color: #52657a;
          font-size: 12px;
          line-height: 1.35;
          margin-bottom: 5px;
        }
        .matchProductCard em {
          color: var(--green);
          font-style: normal;
          font-weight: 950;
          font-size: 12px;
        }


        .rankingTitle {
          color: var(--green);
          text-align: center;
          font-size: 15px;
          margin: 0 0 14px;
          letter-spacing: .08em;
        }
        .matchingProductsScreen,
        .products {
          padding-bottom: 120px;
        }
        .matchingProductsScreen .matchProductList {
          margin-top: 18px;
          padding-bottom: 8px;
        }
        .matchingProductsScreen .primaryButton,
        .matchingProductsScreen .secondaryButton,
        .products .primaryButton {
          position: relative;
          z-index: 3;
        }
        .bottomNav {
          position: sticky;
          bottom: 0;
          z-index: 50;
          margin-left: -22px;
          margin-right: -22px;
          margin-bottom: -82px;
        }


        .matchImage {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #d7eafa;
          background: #eef7ff;
        }
        .matchImage img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
        .matchingProductsScreen .matchProductCard {
          grid-template-columns: 58px 1fr;
        }


        .pathHeroCard,
        .upgradePlanCard,
        .costIntroCard,
        .costListCard,
        .comparisonCard {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          padding: 15px;
          margin-top: 18px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.05);
        }
        .pathHeroCard p,
        .costIntroCard p,
        .comparisonCard p {
          color: #52657a;
          font-size: 13px;
          line-height: 1.45;
          margin-bottom: 14px;
        }
        .pathScoreRow {
          display: grid;
          grid-template-columns: 1fr 34px 1fr;
          align-items: center;
          gap: 12px;
          color: var(--green);
          margin-bottom: 13px;
        }
        .pathScoreRow div {
          display: grid;
          gap: 1px;
        }
        .pathScoreRow div:last-child {
          text-align: right;
        }
        .pathScoreRow strong {
          font-size: 30px;
          line-height: 1;
          color: var(--green);
        }
        .pathScoreRow span {
          color: #52657a;
          font-size: 11px;
          font-weight: 850;
        }
        .pathBar {
          position: relative;
          height: 10px;
          border-radius: 999px;
          overflow: hidden;
          background: #e7eef4;
        }
        .pathBar i {
          display: block;
          height: 100%;
          background: var(--green);
          border-radius: 999px;
        }
        .pathBar b {
          position: absolute;
          top: -4px;
          width: 4px;
          height: 18px;
          border-radius: 999px;
          background: var(--gold);
          transform: translateX(-2px);
        }
        .pathLabels {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          color: #52657a;
          font-size: 10px;
          font-weight: 850;
        }
        .upgradePlanCard h3,
        .costIntroCard h3,
        .comparisonCard h3 {
          margin-bottom: 11px;
        }
        .upgradeStep {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #e8eef4;
          font-size: 12px;
          color: #273f59;
        }
        .upgradeStep strong {
          color: var(--green);
          white-space: nowrap;
        }
        .upgradeStep.total {
          border-bottom: 0;
          margin-top: 4px;
          font-weight: 950;
        }
        .costItem {
          display: grid;
          grid-template-columns: 38px 1fr 58px;
          gap: 10px;
          align-items: center;
          padding: 11px 0;
          border-bottom: 1px solid #e8eef4;
        }
        .costItem > div:first-child {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #f4f8fc;
          color: var(--blue);
          display: grid;
          place-items: center;
        }
        .costItem strong {
          display: block;
          color: var(--ink);
          font-size: 13px;
        }
        .costItem span {
          color: #52657a;
          font-size: 11px;
        }
        .costItem em {
          color: var(--red);
          font-style: normal;
          font-size: 11px;
          font-weight: 950;
          text-align: right;
        }
        .costTotal {
          margin-top: 14px;
          padding: 14px;
          border: 1px solid #f1d48b;
          background: #fff6e8;
          border-radius: 12px;
          text-align: center;
        }
        .costTotal span {
          display: block;
          color: #52657a;
          font-size: 11px;
          margin-bottom: 5px;
        }
        .costTotal strong {
          color: var(--red);
          font-size: 24px;
        }
        .comparisonBars {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          align-items: end;
          min-height: 174px;
          margin-top: 14px;
        }
        .comparisonBar {
          display: grid;
          justify-items: center;
          gap: 7px;
          min-width: 0;
        }
        .comparisonBar strong {
          color: var(--green);
          font-size: 15px;
        }
        .comparisonBar div {
          width: 34px;
          height: 112px;
          border-radius: 999px;
          background: #e7eef4;
          display: flex;
          align-items: end;
          overflow: hidden;
        }
        .comparisonBar i {
          width: 100%;
          display: block;
          background: linear-gradient(180deg, #29aef5, #126fd2);
          border-radius: 999px;
        }
        .comparisonBar:first-child i {
          background: linear-gradient(180deg, #5fc16f, #2f9b4d);
        }
        .comparisonBar:last-child i {
          background: linear-gradient(180deg, #8d5cf6, #5c36c9);
        }
        .comparisonBar span {
          color: #52657a;
          font-size: 10px;
          line-height: 1.15;
          text-align: center;
          font-weight: 850;
        }
        .comparisonNote {
          margin-top: 14px;
        }


        .recommendations .recommendationCard:first-of-type,
        .products .productList {
          margin-top: 18px;
        }
        .recommendations .recommendationCard {
          margin-top: 10px;
        }
        .products .productCard {
          margin-top: 0;
        }


        .productLeadFormCard {
          margin-top: 18px;
        }
        .leadFormIntro {
          color: #52657a;
          font-size: 12px;
          line-height: 1.35;
          margin: -4px 0 12px;
        }
        .photoUploadSection {
          grid-template-columns: 1fr;
        }
        .homePhotoUpload {
          grid-template-columns: 28px 1fr;
          min-height: 72px;
          border-style: dashed;
          background: #f7fbff;
        }
        .homePhotoUpload strong {
          font-size: 12px;
          line-height: 1.25;
        }
        .homePhotoUpload em {
          font-size: 11px;
          line-height: 1.3;
        }


        .inlineDetailsButton {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--blue);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 0 0;
          margin: 0;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }
        .inlineDetailsButton svg {
          stroke-width: 3;
        }


        .contextBanner {
          border: 1px solid #d6e7f7;
          background: #f1f8ff;
          border-radius: 14px;
          padding: 12px 14px;
          margin: 10px 0 14px;
          display: grid;
          gap: 5px;
        }
        .contextBanner strong {
          color: var(--ink);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .contextBanner span {
          color: #52657a;
          font-size: 12px;
          line-height: 1.3;
        }
        .contextBanner button {
          justify-self: start;
          border: 0;
          background: transparent;
          color: var(--blue);
          font-size: 12px;
          font-weight: 900;
          padding: 3px 0 0;
          cursor: pointer;
        }

        @media (max-width: 540px) {
          .app { padding: 0; background: #fff; }
          .phoneShell { width: 100%; min-height: 100vh; max-height: none; border: 0; border-radius: 0; box-shadow: none; }
          .bannerWrap { border-radius: 0; }
  

        .importOptionsTitle {
          color: var(--navy);
          font-size: 20px;
          font-weight: 950;
          letter-spacing: .01em;
          text-transform: none;
        }
        .demoPropertySelector {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          margin-top: 12px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.04);
        }
        .demoPropertySelector h3 {
          color: var(--navy);
          font-size: 13px;
          margin-bottom: 10px;
        }
        .demoPropertyCards {
          display: grid;
          gap: 9px;
        }
        .demoPropertyCards button {
          text-align: left;
          border: 1px solid #dbe6ef;
          background: #fbfdff;
          border-radius: 12px;
          padding: 11px 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 3px 10px;
          align-items: center;
        }
        .demoPropertyCards button.active {
          border-color: var(--blue);
          background: #eef7ff;
          box-shadow: 0 0 0 3px rgba(18, 111, 210, .10);
        }
        .demoPropertyCards strong {
          color: var(--ink);
          font-size: 13px;
        }
        .demoPropertyCards span {
          color: #52657a;
          font-size: 11px;
        }
        .demoPropertyCards em {
          grid-row: 1 / span 2;
          grid-column: 2;
          color: var(--green);
          font-style: normal;
          font-weight: 950;
          font-size: 12px;
        }



        .mlsPhotoWrap {
          position: relative;
          height: 132px;
          overflow: hidden;
        }
        .mlsPhotoWrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          background: #eef4f8;
        }
        .mlsPhotoWrap span {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(7, 26, 44, .92);
          color: #fff;
          border: 1px solid rgba(242, 165, 26, .92);
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .08em;
        }
        .importOptionsHelp {
          grid-column: 1 / -1;
          color: #52657a;
          font-size: 12px;
          line-height: 1.35;
          margin: -2px 0 2px;
        }

        .mlsPropertyPreview {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          margin-top: 12px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.05);
        }
        .mlsPropertyPreview > div:not(.mlsPhotoWrap) {
          padding: 10px 12px 11px;
        }
        .mlsPropertyPreview strong {
          display: block;
          color: var(--ink);
          font-size: 17px;
          line-height: 1.1;
          margin-bottom: 5px;
        }
        .mlsPropertyPreview p {
          color: #52657a;
          font-size: 12px;
          line-height: 1.35;
          margin: 0 0 9px;
        }
        .uploadDropZone {
          min-height: 76px;
          border-width: 2px;
          background: #f7fbff;
        }
        .uploadDropZone strong {
          font-size: 13px;
        }

        .demoBadge {
          width: max-content;
          margin: 0 auto 10px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #fff6df;
          color: #9a6400;
          border: 1px solid #f2d387;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .08em;
        }
        .demoAssetNote {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          align-items: start;
          border: 1px solid #cfe6c9;
          background: #f1f8ee;
          border-radius: 14px;
          padding: 14px;
          margin-top: 16px;
        }
        .demoAssetNote svg { color: var(--green); }
        .demoAssetNote strong { color: #164d2b; font-size: 13px; }
        .demoAssetNote p { color: #3f5b48; font-size: 12px; line-height: 1.4; margin: 5px 0 0; }
        .demoFormSection {
          grid-template-columns: 1fr;
        }
        .fieldWithHelp {
          display: grid;
          grid-template-columns: 1fr 34px;
          gap: 8px;
          align-items: center;
        }
        .demoHelpButton {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 2px solid var(--gold);
          background: var(--navy-2);
          color: white;
          font-weight: 950;
          box-shadow: 0 6px 16px rgba(7, 26, 44, 0.18);
        }
        .fakeUpload {
          display: grid;
          grid-template-columns: 28px 1fr 34px;
          gap: 10px;
          align-items: center;
          min-height: 54px;
          border: 1px dashed #b9c8d6;
          background: #fbfdff;
          border-radius: 10px;
          padding: 10px;
        }
        .fakeUpload > svg { color: var(--blue); }
        .fakeUpload strong { display: block; font-size: 12px; color: var(--ink); }
        .fakeUpload em { display: block; font-size: 11px; color: #52657a; font-style: normal; margin-top: 2px; }
        .demoParsePreview {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          margin-top: 14px;
          box-shadow: 0 8px 20px rgba(9, 33, 59, 0.04);
        }
        .demoParsePreview ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .demoParsePreview li {
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 8px;
          color: #344d66;
          font-size: 12px;
          line-height: 1.35;
        }
        .demoParsePreview svg { color: var(--green); margin-top: 1px; }
        .demoOverlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(7, 26, 44, .45);
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .demoModal {
          width: min(340px, 100%);
          background: #fff;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 22px 70px rgba(0,0,0,.28);
          border: 1px solid var(--line);
        }
        .demoModal strong { display: block; font-size: 16px; color: var(--ink); }
        .demoModal p { color: #52657a; font-size: 13px; line-height: 1.45; margin: 8px 0 14px; }


        .scanReportButton {
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .analyzingScreen {
          min-height: 680px;
          display: grid;
          place-items: center;
          padding-bottom: 42px;
          background:
            radial-gradient(circle at center 38%, rgba(41, 174, 245, .16), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%);
        }
        .analyzingStage {
          text-align: center;
          width: 100%;
          max-width: 310px;
          margin: 0 auto;
        }
        .brainOrb {
          width: 150px;
          height: 150px;
          margin: 0 auto 26px;
          border-radius: 50%;
          position: relative;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 50%, rgba(242, 165, 26, .22), transparent 36%),
            radial-gradient(circle at 50% 50%, rgba(41, 174, 245, .25), transparent 62%),
            linear-gradient(135deg, var(--navy), var(--navy-2));
          box-shadow:
            0 22px 60px rgba(7, 26, 44, .24),
            inset 0 0 0 2px rgba(255,255,255,.08);
          overflow: visible;
        }
        .brainPulseIcon {
          color: #ffffff;
          z-index: 3;
          filter: drop-shadow(0 0 14px rgba(242, 165, 26, .55));
          animation: brainPulse 1.4s ease-in-out infinite;
        }
        .brainRing {
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          border: 2px solid rgba(242, 165, 26, .62);
          animation: brainOrbit 2.2s linear infinite;
        }
        .brainRing.two {
          inset: 22px;
          border-color: rgba(41, 174, 245, .58);
          animation-duration: 1.6s;
          animation-direction: reverse;
        }
        .brainRing.three {
          inset: -8px;
          border-color: rgba(47, 155, 77, .28);
          animation-duration: 3.4s;
        }
        .analyzingStage h2 {
          font-size: 24px;
          letter-spacing: .11em;
          color: var(--navy);
          margin-bottom: 10px;
        }
        .analyzingStage p {
          color: #52657a;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 18px;
        }
        .analysisSteps {
          display: grid;
          gap: 8px;
        }
        .analysisSteps span {
          display: block;
          padding: 10px 12px;
          border: 1px solid #dbe6ef;
          border-radius: 999px;
          background: rgba(255,255,255,.82);
          color: #27435f;
          font-size: 12px;
          font-weight: 800;
          animation: stepGlow 1.8s ease-in-out infinite;
        }
        .analysisSteps span:nth-child(2) { animation-delay: .35s; }
        .analysisSteps span:nth-child(3) { animation-delay: .7s; }

        @keyframes brainPulse {
          0%, 100% { transform: scale(1); opacity: .92; }
          50% { transform: scale(1.12); opacity: 1; }
        }
        @keyframes brainOrbit {
          0% { transform: rotate(0deg) scale(1); opacity: .72; }
          50% { transform: rotate(180deg) scale(1.06); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: .72; }
        }
        @keyframes stepGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(41,174,245,0); transform: translateY(0); }
          50% { box-shadow: 0 8px 22px rgba(41,174,245,.14); transform: translateY(-1px); }
        }

        .bottomNav { position: sticky; }
        }
      `}</style>
    </main>
  );
}
