import React, { useMemo, useState } from "react";
import vpsfBanner from "./assets/vpsf-banner.jpg";
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

const PILLARS = [
  { key: "energy", label: "Energy", short: "Energy", max: 200, icon: Zap, accent: "green" },
  { key: "water", label: "Water", short: "Water", max: 100, icon: Droplets, accent: "blue" },
  { key: "health", label: "Health", short: "Health", max: 200, icon: HeartPulse, accent: "green" },
  { key: "resilience", label: "Resilience", short: "Resilience", max: 200, icon: Shield, accent: "green" },
  { key: "carbon", label: "Carbon & Materials", short: "Carbon", max: 150, icon: Leaf, accent: "gold" },
  { key: "financial", label: "Financial Risk", short: "Financial", max: 100, icon: Wallet, accent: "blue" },
  { key: "community", label: "Community & Mobility", short: "Community", max: 50, icon: Bike, accent: "green" }
];

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
  waterHeater: "Heat Pump Water Heater",
  roof: "Architectural Shingle",
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
      {screen > 0 && (
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
    ["Overview", Home, 4],
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

function StartScreen({ setScreen }) {
  return (
    <div className="screen startScreen">

      <h1>Let’s get started</h1>
      <p className="centerCopy">Choose how you’d like to provide information about the home.</p>

      <div className="startActions">
        <button onClick={() => setScreen(1)}>
          <span className="actionIcon"><Home size={28} /></span>
          <div><strong>Import MLS Listing</strong><em>We’ll pull property details from the MLS.</em></div>
        </button>
        <button onClick={() => setScreen(1)}>
          <span className="actionIcon"><Upload size={28} /></span>
          <div><strong>Upload Specs / Photos</strong><em>Upload documents or photos. We’ll extract details.</em></div>
        </button>
        <button onClick={() => setScreen(1)}>
          <span className="actionIcon"><ClipboardList size={28} /></span>
          <div><strong>Enter Specs Myself</strong><em>Manually enter the home information and specs.</em></div>
        </button>
      </div>

      <aside className="smartParse">
        <Sparkles size={16} />
        <strong>COGNITION Smart Parse Enabled</strong>
        <p>Our COGNITION Insight engine will extract specs and pre-fill as much information as possible.</p>
        <ul>
          <li><Check size={14} /> HVAC, windows, insulation, roof</li>
          <li><Check size={14} /> Solar, batteries, EV charger</li>
          <li><Check size={14} /> Flood zone, wind zone, and more</li>
        </ul>
      </aside>

      <p className="privacy">Your data is secure and private.</p>
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

      <button className="primaryButton stickyButton" onClick={() => setScreen(2)}>
        Next: Home Specs <ArrowRight size={18} />
      </button>
    </div>
  );
}

function HomeSpecs({ home, update, setScreen }) {
  return (
    <div className="screen formScreen">
      <ProgressDots step={2} />
      <h2>Add Home Specs</h2>
      <p className="subhead">Use dropdowns to document the seven VPSF pillars.</p>

      <section className="formSection">
        <h3>Energy</h3>
        <Field label="HERS Score" value={home.hers} onChange={(v) => update("hers", v)} options={selectOptions.hers} />
        <Field label="HVAC System" value={home.hvac} onChange={(v) => update("hvac", v)} options={selectOptions.hvac} />
        <Field label="Water Heating" value={home.waterHeater} onChange={(v) => update("waterHeater", v)} options={selectOptions.waterHeater} />
        <Field label="Solar / Battery" value={home.solar} onChange={(v) => update("solar", v)} options={selectOptions.solar} />
        <Field wide label="EV Readiness" value={home.evReady} onChange={(v) => update("evReady", v)} options={selectOptions.evReady} />
      </section>

      <section className="formSection">
        <h3>Resilience + Health</h3>
        <Field label="Resilience Certification" value={home.fortified} onChange={(v) => update("fortified", v)} options={selectOptions.fortified} />
        <Field label="Flood Design" value={home.flood} onChange={(v) => update("flood", v)} options={selectOptions.flood} />
        <Field label="Ventilation" value={home.ventilation} onChange={(v) => update("ventilation", v)} options={selectOptions.ventilation} />
        <Field label="Health Standard" value={home.healthCert} onChange={(v) => update("healthCert", v)} options={selectOptions.healthCert} />
      </section>

      <section className="formSection">
        <h3>Carbon, Water + Financial</h3>
        <Field label="Carbon Strategy" value={home.carbonStrategy} onChange={(v) => update("carbonStrategy", v)} options={selectOptions.carbonStrategy} />
        <Field label="Water Standard" value={home.waterStandard} onChange={(v) => update("waterStandard", v)} options={selectOptions.waterStandard} />
        <Field label="Leak Protection" value={home.leak} onChange={(v) => update("leak", v)} options={selectOptions.leak} />
        <Field label="PIETIM" value={home.pietim} onChange={(v) => update("pietim", v)} options={selectOptions.pietim} />
      </section>

      <button className="primaryButton stickyButton" onClick={() => setScreen(3)}>
        Review & Confirm <ArrowRight size={18} />
      </button>
    </div>
  );
}

function ReviewScreen({ home, setScreen }) {
  const propertyRows = [
    [MapPin, `${home.address}`, `${home.city}, ${home.state} ${home.zip}`],
    [Home, home.homeType, `${home.squareFeet} sq ft • ${home.stories} stories`],
    [ClipboardList, `Year Built: ${home.yearBuilt}`, `${home.bedrooms} Bed • ${home.bathrooms} Bath • ${home.garage}`],
    [Sun, `Climate Zone: ${home.climateZone}`, `Lot Size: ${home.lotSize}`]
  ];
  const specRows = [
    [Zap, "HVAC System", home.hvac],
    [Droplets, "Water Heating", home.waterHeater],
    [Home, "Roofing", home.roof],
    [Wind, "Ventilation", home.ventilation],
    [Sun, "Solar", home.solar]
  ];

  return (
    <div className="screen reviewScreen">
      <ProgressDots step={3} />
      <h2>Review & Confirm</h2>
      <p className="subhead">Review your information before generating your score.</p>

      <section className="summaryCard">
        <div className="summaryHeader"><h3>Property Summary</h3><button onClick={() => setScreen(1)}>Edit</button></div>
        {propertyRows.map(([Icon, a, b]) => (
          <div className="summaryRow" key={a}>
            <Icon size={18} />
            <div><strong>{a}</strong><span>{b}</span></div>
          </div>
        ))}
      </section>

      <section className="summaryCard">
        <div className="summaryHeader"><h3>Home Specs Summary</h3><button onClick={() => setScreen(2)}>Edit</button></div>
        {specRows.map(([Icon, a, b]) => (
          <div className="summaryRow compact" key={a}>
            <Icon size={17} />
            <strong>{a}</strong>
            <span>{b}</span>
          </div>
        ))}
        <button className="textLink">View all specs (18)</button>
      </section>

      <button className="primaryButton stickyButton" onClick={() => setScreen(4)}>
        Generate VPSF Score <ArrowRight size={18} />
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
      <h3 className="scoreTitle">{scoreInfo.label}</h3>
      <p className="scoreMeaning">{scoreInfo.meaning}</p>
      <button className="meaningButton">What does this mean?</button>

      <section className="pillarPanel">
        <h3>Pillar Performance</h3>
        <p>Tap a pillar to see details & recommendations.</p>
        <div className="pillarGrid">
          {PILLARS.map((pillar) => (
            <button className="pillarTap" key={pillar.key} onClick={() => { setSelectedPillar(pillar.key); setScreen(5); }}>
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
    water: "Lack of low-flow fixtures, reuse systems, or verified water performance can cost dollars and waste H₂O.",
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

function PillarBreakdown({ result, selectedPillar, setScreen }) {
  const ranked = [...PILLARS].sort((a, b) => {
    const bPct = result.scores[b.key] / b.max;
    const aPct = result.scores[a.key] / a.max;
    return bPct - aPct;
  });
  const bestPillar = ranked[0];
  const weakestPillar = ranked[ranked.length - 1];
  const focusPillar = PILLARS.find((item) => item.key === selectedPillar) || bestPillar;
  const focusValue = result.scores[focusPillar.key];

  return (
    <div className="screen pillarBreakdown keyTakeawayScreen withNav">
      <header className="screenTop keyHeader"><h2>Key Takeaway</h2></header>

      <TakeawayCard
        title="Best Score"
        pillar={bestPillar}
        value={result.scores[bestPillar.key]}
        isBest
      />

      <TakeawayCard
        title="Weakest Score"
        pillar={weakestPillar}
        value={result.scores[weakestPillar.key]}
      />

      <section className="detailCard compactDetail">
        <h3>Selected Pillar Detail</h3>
        <div className="detailRow"><span>{focusPillar.label}</span><strong>{focusValue} / {focusPillar.max}</strong></div>
        <div className="detailRow"><span>Performance Level</span><strong>{pillarPerformanceLabel(focusValue, focusPillar.max)}</strong></div>
        <p>Use this screen as a quick executive summary before opening the full COGNITION recommendations.</p>
      </section>

      <button className="primaryButton" onClick={() => setScreen(6)}>View Recommendations <ArrowRight size={18} /></button>
      <BottomNav active="Pillars" setScreen={setScreen} />
    </div>
  );
}

function Recommendations({ setScreen }) {
  const recs = [
    [Droplets, "Water Performance", "Add Rainwater Harvesting System", "+15 pts", "Could improve your Water score and increase resilience."],
    [Leaf, "Carbon & Materials", "Use Low-Carbon Concrete", "+10 pts", "Switching to lower-carbon concrete could improve your score."],
    [Shield, "Resilience & Durability", "Upgrade to Impact-Resistant Roof", "+12 pts", "Consider a Class 4 impact-resistant roofing system."]
  ];
  return (
    <div className="screen recommendations withNav">
      <header className="screenTop"><h2>Recommendations</h2></header>
      <div className="tabs"><button className="active">All (9)</button><button>High Impact (3)</button><button>Quick Wins (2)</button></div>
      {recs.map(([Icon, eyebrow, title, gain, copy]) => (
        <article className="recommendationCard" key={title}>
          <div className="recHead"><Icon size={22} /><span>{eyebrow}</span><strong>{gain}</strong></div>
          <h3>{title}</h3>
          <p>{copy}</p>
          <button>View Details</button>
        </article>
      ))}
      <button className="primaryButton" onClick={() => setScreen(7)}>View Recommended Products</button>
      <BottomNav active="Recommendations" setScreen={setScreen} />
    </div>
  );
}

function Products({ setScreen }) {
  const products = [
    ["Heat Pump Water Heater", "Rheem Performance Platinum Hybrid", "Improve Energy & Water Scores", "heater"],
    ["Rainwater Harvesting System", "Rainwater Management Solutions Tank", "Improve Water Score", "tank"],
    ["Impact-Resistant Roofing", "CertainTeed Impact Resistant Shingles", "Improve Resilience Score", "roof"],
    ["ERV Ventilation System", "RenewAire Energy Recovery Ventilator", "Improve Health Score", "erv"]
  ];
  return (
    <div className="screen products withNav">
      <header className="screenTop"><h2>Recommended Products</h2><Filter size={18} /></header>
      <div className="tabs"><button className="active">All Pillars</button><button>Energy</button><button>Water</button><button>Resilience</button></div>
      {products.map(([type, name, benefit, style]) => (
        <article className="productCard" key={name}>
          <div className={`productImage ${style}`}><Package size={30} /></div>
          <div>
            <span>{type}</span>
            <h3>{name}</h3>
            <p>{benefit}</p>
            <button>View Product <ArrowRight size={15} /></button>
          </div>
        </article>
      ))}
      <button className="primaryButton" onClick={() => setScreen(8)}>Open Marketing Studio</button>
      <BottomNav active="More" setScreen={setScreen} />
    </div>
  );
}

function MarketingStudio({ setScreen }) {
  return (
    <div className="screen marketing withNav">
      <header className="screenTop"><h2>COGNITION Marketing Studio</h2></header>
      <section className="copyCard">
        <h3>MLS Copy</h3>
        <p>A high-performance home designed for lower monthly costs, healthier indoor air, stronger storm protection, and long-term climate resilience.</p>
      </section>
      <section className="copyCard">
        <h3>Sales Talking Points</h3>
        <ul className="checkList">
          <li><Check size={15} /> Lower utility and insurance costs</li>
          <li><Check size={15} /> Healthier indoor environment</li>
          <li><Check size={15} /> Stronger storm and flood protection</li>
          <li><Check size={15} /> Higher resale value potential</li>
        </ul>
      </section>
      <section className="smartDataUpsell">
        <Sparkles size={22} />
        <div><h3>Unlock Full COGNITION SmartData</h3><p>Get deeper market analytics, buyer insights, climate risk data, and more.</p></div>
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
  const [screen, setScreen] = useState(0);
  const [selectedPillar, setSelectedPillar] = useState("energy");
  const [home, setHome] = useState(defaultHome);
  const result = useMemo(() => scoreHome(home), [home]);
  const update = (key, value) => setHome((current) => ({ ...current, [key]: value }));

  return (
    <main className="app">
      <AppChrome screen={screen} setScreen={setScreen}>
        {screen === 0 && <StartScreen setScreen={setScreen} />}
        {screen === 1 && <PropertyDetails home={home} update={update} setScreen={setScreen} />}
        {screen === 2 && <HomeSpecs home={home} update={update} setScreen={setScreen} />}
        {screen === 3 && <ReviewScreen home={home} setScreen={setScreen} />}
        {screen === 4 && <Dashboard result={result} setScreen={setScreen} setSelectedPillar={setSelectedPillar} />}
        {screen === 5 && <PillarBreakdown result={result} selectedPillar={selectedPillar} setScreen={setScreen} />}
        {screen === 6 && <Recommendations setScreen={setScreen} />}
        {screen === 7 && <Products setScreen={setScreen} />}
        {screen === 8 && <MarketingStudio setScreen={setScreen} />}
        {screen === 9 && <LabelScreen result={result} setScreen={setScreen} />}
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
        body { margin: 0; background: var(--soft); }
        button, input, select { font: inherit; }
        button { cursor: pointer; }

        .app {
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 28px;
          background:
            radial-gradient(circle at top, rgba(15, 87, 160, 0.08), transparent 34%),
            linear-gradient(180deg, #fbfcfe 0%, #f4f7fa 100%);
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
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid var(--gold);
          border-radius: 999px;
          background: var(--navy-2);
          color: #ffffff;
          box-shadow: 0 10px 26px rgba(7, 26, 44, 0.28);
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

        .startScreen { padding-top: 28px; }
        .startScreen h1 { text-align: center; font-size: 24px; }
        .startActions { display: grid; gap: 12px; margin: 22px 0; }
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
        .smartParse ul, .checkList { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; }
        .smartParse li, .checkList li { display: flex; align-items: center; gap: 8px; color: #244633; font-size: 12px; }
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
          display: grid;
          place-items: center;
          align-content: center;
          box-shadow: 0 0 0 1px #eef3f7;
        }
        .miniScore svg { color: var(--ring); margin-bottom: -2px; }
        .miniScore strong { font-size: 18px; line-height: .9; letter-spacing: -0.04em; }
        .miniScore em { font-size: 9px; color: #52657a; font-style: normal; }
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
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #fff;
          display: grid;
          place-items: center;
          align-content: center;
          box-shadow: inset 0 0 0 1px #e4ebf2;
        }
        .takeawayGauge svg { color: var(--takeaway-ring); margin-bottom: -2px; }
        .takeawayGauge strong { font-size: 22px; line-height: .85; color: var(--ink); }
        .takeawayGauge span { font-size: 10px; color: #52657a; margin-top: -7px; }
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
        }
        .productImage.heater { background: linear-gradient(135deg, #e8edf1, #94a4b2); color: #17314d; }
        .productImage.tank { background: linear-gradient(135deg, #709583, #2d5e4d); }
        .productImage.roof { background: linear-gradient(135deg, #9a9c9c, #3e474a); }
        .productImage.erv { background: linear-gradient(135deg, #d8dfe5, #7d8b97); color: #17314d; }
        .productCard span { text-transform: uppercase; color: var(--blue); font-size: 10px; font-weight: 900; }
        .productCard h3 { text-transform: none; letter-spacing: 0; font-size: 13px; margin: 4px 0; }
        .productCard p { color: var(--green); font-size: 12px; margin-bottom: 8px; }

        .copyCard h3, .smartDataUpsell h3 { text-transform: none; letter-spacing: 0; font-size: 15px; margin-bottom: 8px; }
        .copyCard p, .smartDataUpsell p { color: #52657a; font-size: 13px; line-height: 1.5; margin-bottom: 0; }
        .smartDataUpsell { display: grid; grid-template-columns: 34px 1fr; gap: 12px; background: #f4f9ff; }
        .smartDataUpsell svg { color: var(--blue); }

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

        @media (max-width: 540px) {
          .app { padding: 0; background: #fff; }
          .phoneShell { width: 100%; min-height: 100vh; max-height: none; border: 0; border-radius: 0; box-shadow: none; }
          .bannerWrap { border-radius: 0; }
          .bottomNav { position: fixed; }
        }
      `}</style>
    </main>
  );
}
