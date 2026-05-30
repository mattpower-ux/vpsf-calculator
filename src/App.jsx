import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Home,
  Upload,
  FileSearch,
  ClipboardList,
  BarChart3,
  Shield,
  Droplets,
  HeartPulse,
  Leaf,
  DollarSign,
  Map,
  Zap,
  Package,
  Megaphone,
  Award,
  CheckCircle,
  AlertTriangle,
  ChevronLeft
} from "lucide-react";

const pillars = [
  { key: "energy", label: "Energy", max: 200, icon: Zap },
  { key: "resilience", label: "Resilience", max: 200, icon: Shield },
  { key: "health", label: "Health", max: 200, icon: HeartPulse },
  { key: "carbon", label: "Carbon", max: 150, icon: Leaf },
  { key: "water", label: "Water", max: 100, icon: Droplets },
  { key: "financial", label: "Financial Risk", max: 100, icon: DollarSign },
  { key: "community", label: "Community", max: 50, icon: Map }
];

const defaultHome = {
  address: "",
  city: "",
  state: "",
  zip: "",
  squareFeet: "",
  yearBuilt: "",
  homeType: "Single-family",
  hvac: "Heat pump",
  waterHeater: "Heat pump water heater",
  solar: "PV + battery",
  evReady: "EV charger installed",
  hers: "21–30",
  fortified: "FORTIFIED Silver",
  flood: "Elevated / flood-resistant",
  roof: "Impact-rated roof",
  ventilation: "ERV / HRV",
  materials: "Low / no-VOC",
  iaq: "IAQ monitoring",
  carbon: "Documented EPDs",
  waterStandard: "WaterSense Home v2",
  leak: "Leak detection + auto shutoff",
  landscape: "Drought-tolerant",
  insurance: "Verified discount",
  warranty: "Long-term warranties",
  walkscore: "70+",
  transit: "Nearby transit/services"
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
    "Code-minimum": 40
  }[home.hers] || 40;

  let energy = energyBase;
  if (home.solar === "PV") energy += 10;
  if (home.solar === "PV + battery") energy += 20;
  if (home.hvac === "Heat pump" || home.hvac === "Geothermal") energy += 10;
  if (home.evReady !== "None") energy += 5;
  energy = Math.min(200, energy);

  let resilience =
    {
      "FORTIFIED Gold": 160,
      "FORTIFIED Silver": 140,
      "FORTIFIED Bronze": 120,
      "Wildfire Prepared Home": 100,
      "None": 40
    }[home.fortified] || 40;
  if (home.flood.includes("Elevated")) resilience += 10;
  if (home.roof.includes("Impact")) resilience += 10;
  resilience = Math.min(200, resilience);

  let health =
    home.ventilation === "ERV / HRV" ? 100 : 60;
  if (home.materials.includes("VOC")) health += 30;
  if (home.iaq.includes("monitoring")) health += 30;
  health = Math.min(200, health);

  let carbon =
    {
      "Zero Carbon Certified": 120,
      "Documented EPDs": 90,
      "Partial disclosure": 60,
      "No accounting": 30
    }[home.carbon] || 30;
  if (home.hvac === "Heat pump" || home.hvac === "Geothermal") carbon += 10;
  if (home.solar !== "None") carbon += 10;
  carbon = Math.min(150, carbon);

  let water =
    {
      "WaterSense Home v2": 60,
      "HERS H2O": 50,
      "WERS rated": 40,
      "Code-minimum": 20
    }[home.waterStandard] || 20;
  if (home.leak.includes("auto")) water += 15;
  if (home.landscape.includes("Drought")) water += 10;
  water = Math.min(100, water);

  let financial = 45;
  if (home.insurance.includes("Verified")) financial += 25;
  if (home.warranty.includes("Long")) financial += 20;
  financial = Math.min(100, financial);

  let community = 10;
  if (home.walkscore === "70+") community += 15;
  if (home.transit.includes("Nearby")) community += 10;
  community = Math.min(50, community);

  const scores = { energy, resilience, health, carbon, water, financial, community };
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { scores, total };
}

function classification(score) {
  if (score >= 850) return "Exceptional";
  if (score >= 700) return "High Performance";
  if (score >= 550) return "Good / Efficient";
  if (score >= 400) return "Code Plus";
  return "High Risk";
}

function Field({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function PillarCard({ pillar, value, onClick }) {
  const Icon = pillar.icon;
  const pct = Math.round((value / pillar.max) * 100);
  return (
    <button className="pillarCard" onClick={onClick}>
      <div className="pillarTop">
        <Icon size={20} />
        <strong>{pillar.label}</strong>
      </div>
      <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      <p>{value}/{pillar.max} · {pct}%</p>
    </button>
  );
}

export default function App() {
  const [screen, setScreen] = useState(0);
  const [selectedPillar, setSelectedPillar] = useState("energy");
  const [home, setHome] = useState(defaultHome);
  const result = useMemo(() => scoreHome(home), [home]);
  const update = (key, value) => setHome((h) => ({ ...h, [key]: value }));

  const currentPillar = pillars.find((p) => p.key === selectedPillar);

  return (
    <main className="app">
      <section className="phone">
        {screen > 0 && (
          <button className="back" onClick={() => setScreen(screen - 1)}>
            <ChevronLeft size={18} /> Back
          </button>
        )}

        {screen === 0 && (
          <div className="screen hero">
            <p className="eyebrow">COGNITION SmartData</p>
            <h1>Value Per Square Foot Calculator</h1>
            <p className="lede">
              Score homes across energy, water, health, resilience, carbon,
              ownership risk, and community value.
            </p>

            <button className="primary" onClick={() => setScreen(1)}>
              <FileSearch /> Import MLS Listing
            </button>
            <button className="secondary" onClick={() => setScreen(1)}>
              <Upload /> Upload Specs / Photos
            </button>
            <button className="secondary" onClick={() => setScreen(1)}>
              <ClipboardList /> Enter Specs Myself
            </button>

            <div className="note">
              <strong>COGNITION Smart Parse</strong>
              <span>Upload a listing, brochure, appraisal, or spec sheet to prefill home attributes.</span>
            </div>
          </div>
        )}

        {screen === 1 && (
          <div className="screen">
            <h2>Property Details</h2>
            <p className="muted">Start with basic home information.</p>
            <div className="grid">
              <Field label="Property Address" value={home.address} onChange={(v) => update("address", v)} />
              <Field label="City" value={home.city} onChange={(v) => update("city", v)} />
              <Field label="State" value={home.state} onChange={(v) => update("state", v)} />
              <Field label="ZIP Code" value={home.zip} onChange={(v) => update("zip", v)} />
              <Field label="Square Feet" value={home.squareFeet} onChange={(v) => update("squareFeet", v)} />
              <Field label="Year Built" value={home.yearBuilt} onChange={(v) => update("yearBuilt", v)} />
              <Field label="Home Type" value={home.homeType} onChange={(v) => update("homeType", v)}
                options={["Single-family", "Townhome", "Condo", "Multifamily", "Manufactured home"]} />
            </div>
            <button className="primary bottom" onClick={() => setScreen(2)}>Continue <ArrowRight /></button>
          </div>
        )}

        {screen === 2 && (
          <div className="screen">
            <h2>Building Specs</h2>
            <p className="muted">Use dropdowns to quickly classify the home.</p>
            <div className="grid">
              <Field label="HERS Score" value={home.hers} onChange={(v) => update("hers", v)}
                options={["≤ 0", "1–10", "11–20", "21–30", "31–40", "41–50", "51–60", "61–70", "71–80", "81–90", "Code-minimum"]} />
              <Field label="HVAC" value={home.hvac} onChange={(v) => update("hvac", v)}
                options={["Heat pump", "Gas furnace", "Electric resistance", "Geothermal"]} />
              <Field label="Water Heater" value={home.waterHeater} onChange={(v) => update("waterHeater", v)}
                options={["Heat pump water heater", "Tank electric", "Tank gas", "Tankless", "Solar thermal"]} />
              <Field label="Solar / Battery" value={home.solar} onChange={(v) => update("solar", v)}
                options={["None", "PV", "PV + battery"]} />
              <Field label="EV Readiness" value={home.evReady} onChange={(v) => update("evReady", v)}
                options={["None", "EV ready", "EV charger installed"]} />
              <Field label="Resilience Certification" value={home.fortified} onChange={(v) => update("fortified", v)}
                options={["FORTIFIED Gold", "FORTIFIED Silver", "FORTIFIED Bronze", "Wildfire Prepared Home", "None"]} />
              <Field label="Water Standard" value={home.waterStandard} onChange={(v) => update("waterStandard", v)}
                options={["WaterSense Home v2", "HERS H2O", "WERS rated", "Code-minimum"]} />
              <Field label="Carbon Strategy" value={home.carbon} onChange={(v) => update("carbon", v)}
                options={["Zero Carbon Certified", "Documented EPDs", "Partial disclosure", "No accounting"]} />
            </div>
            <button className="primary bottom" onClick={() => setScreen(3)}>Review Home <ArrowRight /></button>
          </div>
        )}

        {screen === 3 && (
          <div className="screen">
            <h2>Review</h2>
            <div className="review">
              <p><strong>Address:</strong> {home.address || "Not entered"}</p>
              <p><strong>Size:</strong> {home.squareFeet || "Not entered"} sq. ft.</p>
              <p><strong>Home Type:</strong> {home.homeType}</p>
              <p><strong>Energy:</strong> {home.hers}, {home.hvac}, {home.solar}</p>
              <p><strong>Resilience:</strong> {home.fortified}</p>
              <p><strong>Water:</strong> {home.waterStandard}</p>
              <p><strong>Carbon:</strong> {home.carbon}</p>
            </div>
            <button className="primary bottom" onClick={() => setScreen(4)}>
              Generate VPSF Score <BarChart3 />
            </button>
          </div>
        )}

        {screen === 4 && (
          <div className="screen">
            <p className="eyebrow">VPSF Score</p>
            <h1 className="score">{result.total}</h1>
            <h2>{classification(result.total)}</h2>
            <p className="muted">Tap any pillar to see score drivers and improvement opportunities.</p>
            <div className="pillars">
              {pillars.map((p) => (
                <PillarCard
                  key={p.key}
                  pillar={p}
                  value={result.scores[p.key]}
                  onClick={() => {
                    setSelectedPillar(p.key);
                    setScreen(5);
                  }}
                />
              ))}
            </div>
            <button className="primary bottom" onClick={() => setScreen(6)}>
              COGNITION Recommendations <ArrowRight />
            </button>
          </div>
        )}

        {screen === 5 && (
          <div className="screen">
            <p className="eyebrow">Pillar Detail</p>
            <h2>{currentPillar.label}</h2>
            <div className="bigCard">
              <currentPillar.icon size={32} />
              <h1>{result.scores[selectedPillar]}/{currentPillar.max}</h1>
              <p>{Math.round((result.scores[selectedPillar] / currentPillar.max) * 100)}% of available points</p>
            </div>

            <div className="insight">
              <CheckCircle /> Strong performance indicators detected.
            </div>
            <div className="warning">
              <AlertTriangle /> Additional verification could increase this pillar score.
            </div>

            <button className="primary bottom" onClick={() => setScreen(6)}>
              View Recommendations <ArrowRight />
            </button>
          </div>
        )}

        {screen === 6 && (
          <div className="screen">
            <p className="eyebrow">COGNITION Insight</p>
            <h2>Recommendations</h2>

            <div className="rec">
              <Droplets />
              <div>
                <strong>Improve Water Performance</strong>
                <p>Add leak detection, smart shutoff, and drought-tolerant landscaping.</p>
                <span>Potential VPSF gain: +15</span>
              </div>
            </div>

            <div className="rec">
              <Shield />
              <div>
                <strong>Strengthen Resilience</strong>
                <p>Document roof attachments, impact openings, and backup power.</p>
                <span>Potential VPSF gain: +20</span>
              </div>
            </div>

            <div className="rec">
              <Leaf />
              <div>
                <strong>Improve Carbon Documentation</strong>
                <p>Add EPD-backed materials and lower-carbon concrete selections.</p>
                <span>Potential VPSF gain: +10</span>
              </div>
            </div>

            <button className="primary bottom" onClick={() => setScreen(7)}>
              Recommended Products <Package />
            </button>
          </div>
        )}

        {screen === 7 && (
          <div className="screen">
            <p className="eyebrow">Product Intelligence</p>
            <h2>Recommended Products</h2>

            {[
              ["Leak Detection System", "Water + Financial Risk", "+15 VPSF"],
              ["Heat Pump Water Heater", "Energy + Carbon", "+12 VPSF"],
              ["ERV Ventilation System", "Health", "+20 VPSF"]
            ].map(([name, category, gain]) => (
              <div className="product" key={name}>
                <div className="thumb"><Package /></div>
                <div>
                  <strong>{name}</strong>
                  <p>{category}</p>
                  <span>{gain}</span>
                </div>
              </div>
            ))}

            <button className="primary bottom" onClick={() => setScreen(8)}>
              Marketing Studio <Megaphone />
            </button>
          </div>
        )}

        {screen === 8 && (
          <div className="screen">
            <p className="eyebrow">COGNITION Marketing Studio</p>
            <h2>Buyer Messaging</h2>

            <div className="copyBox">
              <strong>MLS Talking Point</strong>
              <p>
                This home is positioned as a high-performance, lower-risk property
                with strong energy, health, and resilience features designed to
                reduce ownership costs over time.
              </p>
            </div>

            <div className="copyBox">
              <strong>Sales Strategy</strong>
              <p>
                Lead with monthly cost stability, healthier indoor air, lower
                maintenance risk, and future-ready systems.
              </p>
            </div>

            <button className="primary bottom" onClick={() => setScreen(9)}>
              Generate VPSF Label <Award />
            </button>
          </div>
        )}

        {screen === 9 && (
          <div className="screen">
            <p className="eyebrow">Home Performance Label</p>
            <div className="label">
              <h2>VPSF Certified Home</h2>
              <h1>{result.total}</h1>
              <p>{classification(result.total)}</p>
              {pillars.map((p) => (
                <div className="labelRow" key={p.key}>
                  <span>{p.label}</span>
                  <strong>{result.scores[p.key]}/{p.max}</strong>
                </div>
              ))}
              <div className="qr">QR</div>
            </div>
            <button className="secondary bottom" onClick={() => setScreen(0)}>
              Start New Evaluation <Home />
            </button>
          </div>
        )}
      </section>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .app {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(44,188,255,.25), transparent 35%),
            linear-gradient(135deg, #061420, #0a2135 55%, #071827);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 28px;
          font-family: Inter, Arial, sans-serif;
          color: white;
        }
        .phone {
          width: 420px;
          min-height: 820px;
          background: rgba(10,32,52,.92);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 36px;
          box-shadow: 0 28px 100px rgba(0,0,0,.4);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .screen { padding-top: 28px; }
        .hero { padding-top: 70px; }
        .eyebrow {
          color: #67d4ff;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          font-size: 12px;
        }
        h1 { font-size: 38px; line-height: 1.02; margin: 10px 0 16px; }
        h2 { font-size: 28px; margin: 8px 0 12px; }
        .lede, .muted { color: #c8d8e8; line-height: 1.5; }
        .score { font-size: 84px; margin-bottom: 0; }
        button {
          cursor: pointer;
          font: inherit;
        }
        .primary, .secondary {
          width: 100%;
          border: 0;
          border-radius: 18px;
          padding: 16px;
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 850;
        }
        .primary {
          background: #2ec7ff;
          color: #061420;
        }
        .secondary {
          background: rgba(255,255,255,.08);
          color: white;
          border: 1px solid rgba(255,255,255,.12);
        }
        .bottom { margin-top: 24px; }
        .back {
          position: absolute;
          top: 18px;
          left: 18px;
          background: rgba(255,255,255,.08);
          color: white;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 999px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .note, .review, .bigCard, .copyBox, .label {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 24px;
          padding: 18px;
          margin-top: 18px;
        }
        .note span { display: block; color: #c8d8e8; margin-top: 6px; line-height: 1.45; }
        .grid {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }
        .field span {
          display: block;
          color: #b6cadb;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .field input, .field select {
          width: 100%;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.08);
          color: white;
          border-radius: 14px;
          padding: 13px;
          outline: none;
        }
        .field option { color: #061420; }
        .pillars {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 18px;
        }
        .pillarCard {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          color: white;
          border-radius: 20px;
          padding: 14px;
          text-align: left;
        }
        .pillarTop {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bar {
          height: 8px;
          background: rgba(255,255,255,.14);
          border-radius: 999px;
          overflow: hidden;
          margin-top: 12px;
        }
        .bar div {
          height: 100%;
          background: #2ec7ff;
        }
        .pillarCard p { color: #c8d8e8; font-size: 13px; margin-bottom: 0; }
        .bigCard {
          text-align: center;
        }
        .bigCard h1 { font-size: 56px; }
        .insight, .warning, .rec, .product {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 20px;
          padding: 16px;
          margin-top: 14px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .warning { border-color: rgba(255,190,80,.35); }
        .rec p, .product p, .copyBox p { color: #c8d8e8; line-height: 1.45; margin: 6px 0; }
        .rec span, .product span {
          color: #67d4ff;
          font-weight: 800;
        }
        .thumb {
          min-width: 62px;
          height: 62px;
          border-radius: 18px;
          background: linear-gradient(135deg, #2ec7ff, #d7f5ff);
          color: #061420;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .label {
          background: #f4fbff;
          color: #071827;
          text-align: center;
        }
        .label h1 {
          font-size: 78px;
          margin: 8px 0 0;
        }
        .labelRow {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #d6e7f2;
          padding: 10px 0;
          text-align: left;
        }
        .qr {
          margin: 18px auto 0;
          width: 74px;
          height: 74px;
          border-radius: 10px;
          background: repeating-linear-gradient(45deg, #071827, #071827 5px, white 5px, white 10px);
          color: transparent;
        }
        @media (max-width: 520px) {
          .app { padding: 0; }
          .phone {
            width: 100%;
            min-height: 100vh;
            border-radius: 0;
          }
        }
      `}</style>
    </main>
  );
}
