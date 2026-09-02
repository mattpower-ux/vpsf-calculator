import React, { useEffect, useMemo, useState } from "react";
import { getAdminProductClicks, getAdminProducts, getAdminPropertyQueries, updateProductWeighting } from "../api/client";
import cognitionIcon from "../assets/cognition-icon.png";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Download,
  Edit3,
  FileText,
  Gauge,
  Home,
  Layers,
  LineChart,
  Package,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
  Zap
} from "lucide-react";

const PILLARS = ["Energy", "Water", "Health", "Resilience", "Carbon", "Community", "Ownership"];
const factorLevels = ["Low", "Average", "High", "Extreme"];

const weightingFactors = [
  ["Energy", "Utility Cost Multiplier", "Grid Reliability", "Solar Opportunity"],
  ["Water", "Drought Severity", "Water Rates", "Flood Risk"],
  ["Health", "Air Quality Risk", "Healthcare Access", "Extreme Heat Exposure"],
  ["Resilience", "Hurricane Risk", "Wildfire Risk", "Power Failure Risk"],
  ["Carbon", "Grid Carbon Intensity", "Transit Availability", "EV Infrastructure"],
  ["Community", "Broadband Access", "Walkability", "Public Transportation"],
  ["Ownership", "Insurance Cost Pressure", "Property Tax Burden", "Maintenance Burden"]
];

const regionalWeightingProfiles = {
  "Florida Coastal 2026": {
    note: "Insurance pressure, hurricane exposure, flood risk, high cooling loads, and strong solar economics move resilience, water, and ownership risk upward.",
    weights: { Energy: 18, Water: 17, Health: 12, Resilience: 26, Carbon: 7, Community: 7, Ownership: 13 },
    factors: {
      Energy: ["High", "Average", "High"],
      Water: ["Average", "High", "Extreme"],
      Health: ["Average", "Average", "Extreme"],
      Resilience: ["Extreme", "Low", "High"],
      Carbon: ["Average", "Low", "Average"],
      Community: ["Average", "Average", "Low"],
      Ownership: ["Extreme", "Average", "High"]
    }
  },
  "Mountain West": {
    note: "Drought, wildfire, water rates, large temperature swings, and outage risk increase the value of water, resilience, energy, and ownership planning.",
    weights: { Energy: 19, Water: 20, Health: 10, Resilience: 18, Carbon: 8, Community: 10, Ownership: 15 },
    factors: {
      Energy: ["Average", "Average", "High"],
      Water: ["Extreme", "High", "Low"],
      Health: ["High", "Average", "Average"],
      Resilience: ["Low", "Extreme", "High"],
      Carbon: ["Average", "Low", "Average"],
      Community: ["Average", "Low", "Low"],
      Ownership: ["High", "Average", "Average"]
    }
  },
  "Texas Heat Belt": {
    note: "Extreme heat, grid stress, high cooling demand, solar opportunity, and water volatility make energy, health, resilience, and ownership costs more important.",
    weights: { Energy: 24, Water: 13, Health: 15, Resilience: 18, Carbon: 8, Community: 8, Ownership: 14 },
    factors: {
      Energy: ["High", "High", "Extreme"],
      Water: ["High", "Average", "Average"],
      Health: ["Average", "Average", "Extreme"],
      Resilience: ["High", "Low", "Extreme"],
      Carbon: ["Average", "Low", "High"],
      Community: ["Average", "Low", "Low"],
      Ownership: ["High", "High", "Average"]
    }
  },
  "Midwest Rural": {
    note: "Lower water scarcity but higher grid reliability concerns, storm exposure, broadband gaps, maintenance burden, and older housing stock raise community and ownership weighting.",
    weights: { Energy: 20, Water: 9, Health: 11, Resilience: 18, Carbon: 7, Community: 17, Ownership: 18 },
    factors: {
      Energy: ["Average", "High", "Average"],
      Water: ["Low", "Low", "Average"],
      Health: ["Average", "High", "Average"],
      Resilience: ["Low", "Low", "High"],
      Carbon: ["Average", "Low", "Low"],
      Community: ["High", "Low", "Low"],
      Ownership: ["Average", "Average", "High"]
    }
  },
  "California Wildfire": {
    note: "Wildfire, insurance availability, drought, heat, electricity costs, and carbon policy make resilience, energy, water, health, and ownership risk more prominent.",
    weights: { Energy: 18, Water: 15, Health: 14, Resilience: 23, Carbon: 9, Community: 8, Ownership: 13 },
    factors: {
      Energy: ["High", "High", "High"],
      Water: ["High", "High", "Average"],
      Health: ["Extreme", "Average", "High"],
      Resilience: ["Low", "Extreme", "High"],
      Carbon: ["High", "Average", "High"],
      Community: ["Average", "Average", "Average"],
      Ownership: ["Extreme", "High", "Average"]
    }
  },
  Custom: {
    note: "Custom weights are recalculated from the selected regional cost and risk factors.",
    weights: { Energy: 15, Water: 14, Health: 13, Resilience: 16, Carbon: 12, Community: 15, Ownership: 15 },
    factors: {
      Energy: ["Average", "Average", "Average"],
      Water: ["Average", "Average", "Average"],
      Health: ["Average", "Average", "Average"],
      Resilience: ["Average", "Average", "Average"],
      Carbon: ["Average", "Average", "Average"],
      Community: ["Average", "Average", "Average"],
      Ownership: ["Average", "Average", "Average"]
    }
  }
};

const baseWeightScores = { Energy: 15, Water: 14, Health: 13, Resilience: 16, Carbon: 12, Community: 15, Ownership: 15 };
const levelWeightScores = { Low: -2, Average: 0, High: 3, Extreme: 6 };

function cloneFactors(factors) {
  return Object.fromEntries(Object.entries(factors).map(([pillar, values]) => [pillar, [...values]]));
}

function normalizeWeights(rawWeights) {
  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);
  let running = 0;
  const normalized = {};
  PILLARS.forEach((pillar, index) => {
    if (index === PILLARS.length - 1) {
      normalized[pillar] = 100 - running;
      return;
    }
    const value = Math.max(5, Math.round((rawWeights[pillar] / total) * 100));
    normalized[pillar] = value;
    running += value;
  });
  return normalized;
}

function calculateWeightsFromFactors(factors) {
  const rawWeights = Object.fromEntries(
    PILLARS.map((pillar) => [
      pillar,
      baseWeightScores[pillar] + (factors[pillar] || []).reduce((sum, level) => sum + (levelWeightScores[level] || 0), 0)
    ])
  );
  return normalizeWeights(rawWeights);
}

const initialProducts = [
  { brand: "ATAS", product: "Solar-Ready Metal Roofing", pillar: "Resilience", category: "Roofing", weight: "Priority" },
  { brand: "CertainTeed", product: "Solaris Cool Roof Shingles", pillar: "Resilience", category: "Roofing", weight: "Priority" },
  { brand: "Euroshield", product: "Recycled Rubber Roofing", pillar: "Resilience", category: "Roofing", weight: "Priority" },
  { brand: "GAF", product: "Timberline HDZ Shingles", pillar: "Resilience", category: "Roofing", weight: "Downgrade" },
  { brand: "Kohler", product: "WaterSense Bathroom Faucet", pillar: "Water", category: "Fixtures", weight: "Standard" },
  { brand: "Moen", product: "Eco-Performance Showerhead", pillar: "Water", category: "Fixtures", weight: "Priority" },
  { brand: "Niagara", product: "High-Efficiency Toilet", pillar: "Water", category: "Fixtures", weight: "Priority" },
  { brand: "Rachio", product: "Smart Irrigation Controller", pillar: "Water", category: "Irrigation", weight: "Priority" },
  { brand: "RenewAire", product: "Energy Recovery Ventilator", pillar: "Health", category: "Ventilation", weight: "Priority" },
  { brand: "Rheem", product: "ProTerra Heat Pump Water Heater", pillar: "Energy", category: "Water Heating", weight: "Priority" }
].sort((a, b) => a.brand.localeCompare(b.brand));

const properties = [
  { address: "1313 Cognition Drive", city: "Orlando", zip: "32101", score: 520, status: "Demo", lastRun: "Today" },
  { address: "44 Harbor View Dr.", city: "Jacksonville", zip: "32202", score: 742, status: "Complete", lastRun: "Yesterday" },
  { address: "17 Net Zero Lane", city: "Austin", zip: "78704", score: 875, status: "Complete", lastRun: "May 29" },
  { address: "902 Palm Ridge Ct.", city: "Gainesville", zip: "32601", score: 488, status: "Needs Review", lastRun: "May 27" }
];

const users = [
  {
    user: "m.power@greenbuildermedia.com",
    role: "Admin",
    sessions: 18,
    propertiesQueried: 42,
    productsViewed: 31,
    mostViewedProduct: "CertainTeed Solaris",
    ip: "172.59.67.154",
    zip: "32101",
    lastSeen: "Today 11:42 AM"
  },
  {
    user: "builder.demo@company.com",
    role: "Manufacturer",
    sessions: 7,
    propertiesQueried: 13,
    productsViewed: 24,
    mostViewedProduct: "Rheem ProTerra",
    ip: "172.68.12.50",
    zip: "32801",
    lastSeen: "Today 9:17 AM"
  },
  {
    user: "realtor.demo@brokerage.com",
    role: "Realtor",
    sessions: 5,
    propertiesQueried: 19,
    productsViewed: 11,
    mostViewedProduct: "Moen Showerhead",
    ip: "104.28.78.12",
    zip: "32202",
    lastSeen: "Yesterday"
  },
  {
    user: "anonymous-demo",
    role: "Guest",
    sessions: 2,
    propertiesQueried: 4,
    productsViewed: 7,
    mostViewedProduct: "Rachio Controller",
    ip: "172.70.174.88",
    zip: "34498",
    lastSeen: "May 30"
  }
];

const reports = [
  { name: "Manufacturer Lead Summary", period: "Last 30 days", metric: "82 leads", trend: "+18%" },
  { name: "Top Viewed Products", period: "Last 30 days", metric: "416 views", trend: "+34%" },
  { name: "Property Query Volume", period: "Last 30 days", metric: "129 homes", trend: "+22%" },
  { name: "Water Upgrade Demand", period: "Last 30 days", metric: "47 matches", trend: "+41%" }
];

function Badge({ children, tone }) {
  return <span className={`badge ${tone || ""}`}>{children}</span>;
}

function WeightSelect({ value, onChange }) {
  return (
    <select
      className={`weightSelect ${value.toLowerCase()}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option>Priority</option>
      <option>Standard</option>
      <option>Downgrade</option>
      <option>Hidden</option>
    </select>
  );
}

function Sidebar({ active, setActive }) {
  const items = [
    ["Dashboard", Gauge],
    ["Properties", Home],
    ["Climate and Location Metrics", SlidersHorizontal],
    ["Products", Package],
    ["Brand Weighting", Layers],
    ["Users", Users],
    ["Reports", BarChart3],
    ["Settings", Settings]
  ];

  return (
    <aside className="adminSidebar">
      <div className="adminLogo cognitionAdminLogo">
        <img
          src={cognitionIcon}
          alt="COGNITION"
          className="adminLogoIcon"
        />
        <strong>COGNITION</strong>
        <span>VPSF ADMIN</span>
      </div>

      <nav>
        {items.map(([label, Icon]) => (
          <button
            key={label}
            className={active === label ? "active" : ""}
            onClick={() => setActive(label)}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      <div className="adminUser">
        <div>AD</div>
        <span>
          <strong>Admin User</strong>
          admin@vpsf.com
        </span>
      </div>
    </aside>
  );
}

function Header({ active }) {
  return (
    <header className="adminHeader">
      <div>
        <h1>{active === "Brand Weighting" ? "Product Recommendation Manager" : active}</h1>
        <p>
          {active === "Brand Weighting"
            ? "Manage brand and product priority weighting across the seven VPSF pillars."
            : active === "Climate and Location Metrics"
              ? "Adjust regional climate, cost, and location factors that shape VPSF scoring impact."
            : "Demo admin workspace for monitoring prototype activity, product interest, and property scoring."}
        </p>
      </div>
      <div className="headerActions">
        <button><Download size={17} /> Export</button>
        <button className="primary">Save Changes</button>
      </div>
    </header>
  );
}

function Dashboard() {
  return (
    <div className="gridPage">
      <Metric title="Properties Scored" value="129" note="+22% this month" icon={Home} />
      <Metric title="Product Views" value="416" note="+34% this month" icon={Package} />
      <Metric title="Lead Requests" value="82" note="+18% this month" icon={Users} />
      <Metric title="Avg. VPSF Score" value="564" note="Existing homes only" icon={Gauge} />

      <section className="panel wide">
        <h2>Recent Admin Signals</h2>
        <div className="activityList">
          <p><strong>Water products</strong> are the highest-opportunity recommendation group this week.</p>
          <p><strong>CertainTeed Solaris</strong> is receiving priority placement in roofing-related recommendations.</p>
          <p><strong>Older Orlando homes</strong> are clustering in the 480–560 VPSF range.</p>
        </div>
      </section>

      <section className="panel">
        <h2>Top Product Categories</h2>
        <MiniBar label="Water Fixtures" value={86} />
        <MiniBar label="Roofing" value={72} />
        <MiniBar label="Ventilation" value={54} />
        <MiniBar label="Water Heating" value={48} />
      </section>
    </div>
  );
}

function Metric({ title, value, note, icon: Icon }) {
  return (
    <section className="metric">
      <Icon size={20} />
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{note}</em>
    </section>
  );
}

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function scoreTone(score) {
  if (!score) return "gray";
  if (score >= 700) return "green";
  if (score >= 500) return "gold";
  return "red";
}

function contactSummary(query) {
  if (!query.leadName && !query.leadEmail) return "None";
  return [query.leadName, query.leadEmail].filter(Boolean).join(" / ");
}

function BrandWeighting({ products, setProducts, passcode }) {
  const [pillar, setPillar] = useState("All");

  const filtered = useMemo(
    () => pillar === "All" ? products : products.filter((item) => item.pillar === pillar),
    [pillar, products]
  );

  const updateWeight = (target, weight) => {
    setProducts((current) =>
      current.map((item) =>
        item.brand === target.brand && item.product === target.product
          ? { ...item, weight }
          : item
      )
    );
    if (target.id) {
      updateProductWeighting(target.id, weight, passcode).catch((error) => {
        console.warn("Product weighting update stayed local because the API was unavailable.", error);
      });
    }
  };

  const deleteProduct = (target) => {
    setProducts((current) =>
      current.filter((item) => !(item.brand === target.brand && item.product === target.product))
    );
  };

  const counts = products.reduce(
    (acc, item) => {
      acc[item.weight] = (acc[item.weight] || 0) + 1;
      return acc;
    },
    { Priority: 0, Standard: 0, Downgrade: 0, Hidden: 0 }
  );

  return (
    <div className="managerLayout">
      <main>
        <div className="toolbar">
          <label><Search size={16} /><input placeholder="Search brand or product..." /></label>
          <div className="pillarFilters">
            {["All", ...PILLARS].map((item) => (
              <button key={item} className={pillar === item ? "active" : ""} onClick={() => setPillar(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <section className="tablePanel">
          <div className="tablePanelHeader">
            <div>
              <Building2 size={34} />
              <span>
                <h2>{pillar === "All" ? "All Recommendation Products" : `${pillar} Products`}</h2>
                <p>Priority products appear first. Downgraded products appear last. Hidden products are excluded.</p>
              </span>
            </div>
            <button><Plus size={16} /> Add Product</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Product</th>
                <th>Pillar</th>
                <th>Category</th>
                <th>Weighting</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={`${item.brand}-${item.product}`} className={item.weight === "Hidden" ? "mutedRow" : ""}>
                  <td><strong>{item.brand}</strong></td>
                  <td>{item.product}</td>
                  <td>{item.pillar}</td>
                  <td>{item.category}</td>
                  <td><WeightSelect value={item.weight} onChange={(weight) => updateWeight(item, weight)} /></td>
                  <td><button className="deleteButton" onClick={() => deleteProduct(item)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      <aside className="rightRail">
        <Panel title="Weighting Summary">
          <SummaryLine tone="green" label="Priority Products" value={counts.Priority} />
          <SummaryLine tone="gray" label="Standard Products" value={counts.Standard} />
          <SummaryLine tone="red" label="Downgraded Products" value={counts.Downgrade} />
          <SummaryLine tone="dark" label="Hidden Products" value={counts.Hidden} />
        </Panel>

        <Panel title="Pillar Breakdown">
          {PILLARS.map((item) => (
            <SummaryLine key={item} tone="blue" label={item} value={products.filter((p) => p.pillar === item).length} />
          ))}
        </Panel>

        <Panel title="Manufacturer Visibility Estimate">
          <MiniBar label="CertainTeed" value={34} />
          <MiniBar label="ATAS" value={18} />
          <MiniBar label="Rheem" value={16} />
          <MiniBar label="RenewAire" value={11} />
          <MiniBar label="Moen" value={7} />
          <p className="finePrint">Estimates reflect current weighting and product counts across all pillars.</p>
        </Panel>
      </aside>
    </div>
  );
}

function Properties({ queries, productClicks, isLoading }) {
  if (isLoading) {
    return <section className="emptyPanel">Loading property query data...</section>;
  }

  return (
    <section className="tablePanel fullPanel">
      <div className="tablePanelHeader">
        <div><Home size={30} /><span><h2>Property Queries</h2><p>Live searches, funnel depth, scores, product clicks, and product-info requests.</p></span></div>
        <button><Download size={16} /> Export CSV</button>
      </div>
      <table className="spreadsheetTable">
        <thead>
          <tr>
            <th>Address</th>
            <th>Market</th>
            <th>ZIP</th>
            <th>VPSF Score</th>
            <th>Furthest Screen</th>
            <th>Product Clicks</th>
            <th>Product Info Lead</th>
            <th>Lead Product</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {queries.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.address || "Unknown"}</strong><small>{item.source}</small></td>
              <td>{[item.city, item.state].filter(Boolean).join(", ") || "Unknown"}</td>
              <td>{item.zip || "Unknown"}</td>
              <td><Badge tone={scoreTone(item.vpsfScore)}>{item.vpsfScore || "Not scored"}</Badge></td>
              <td>{item.maxScreenLabel} <small>Screen {item.maxScreen}</small></td>
              <td>{item.productClicks}</td>
              <td>{contactSummary(item)}</td>
              <td>{item.leadProductId || "None"}</td>
              <td>{formatDate(item.updatedAt)}</td>
            </tr>
          ))}
          {!queries.length && (
            <tr>
              <td colSpan="9">No property queries have been stored yet.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="subTable">
        <h3>Recent Product Clicks</h3>
        <table className="spreadsheetTable">
          <thead><tr><th>Product</th><th>Pillar</th><th>Context</th><th>Query ID</th><th>Clicked</th></tr></thead>
          <tbody>
            {productClicks.slice(0, 12).map((item) => (
              <tr key={item.id}>
                <td><strong>{item.productName || item.productId}</strong></td>
                <td>{item.pillar || "Unknown"}</td>
                <td>{item.context}</td>
                <td>{item.queryId || "None"}</td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
            {!productClicks.length && (
              <tr>
                <td colSpan="5">No product clicks recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersPage() {
  return (
    <section className="tablePanel fullPanel">
      <div className="tablePanelHeader">
        <div><Users size={30} /><span><h2>Users</h2><p>Demo traffic, property query behavior, product interest, IP address, and ZIP code.</p></span></div>
        <button><Download size={16} /> Export CSV</button>
      </div>
      <table className="spreadsheetTable">
        <thead>
          <tr>
            <th>User / Email</th>
            <th>Role</th>
            <th>Sessions</th>
            <th>Properties Queried</th>
            <th>Products Viewed</th>
            <th>Top Product</th>
            <th>IP Address</th>
            <th>ZIP Code</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {users.map((item) => (
            <tr key={item.user}>
              <td><strong>{item.user}</strong></td>
              <td>{item.role}</td>
              <td>{item.sessions}</td>
              <td>{item.propertiesQueried}</td>
              <td>{item.productsViewed}</td>
              <td>{item.mostViewedProduct}</td>
              <td>{item.ip}</td>
              <td>{item.zip}</td>
              <td>{item.lastSeen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


const certainTeedLeads = [
  {
    user: "realtor.demo@brokerage.com",
    role: "Realtor",
    product: "CertainTeed Solaris Cool Roof Shingles",
    property: "1313 Cognition Drive",
    zip: "32101",
    vpsfScore: 520,
    ip: "104.28.78.12",
    action: "Requested specs",
    date: "Today 10:42 AM"
  },
  {
    user: "builder.demo@company.com",
    role: "Builder",
    product: "CertainTeed Solaris Cool Roof Shingles",
    property: "902 Palm Ridge Ct.",
    zip: "32601",
    vpsfScore: 488,
    ip: "172.68.12.50",
    action: "Viewed matching product",
    date: "Yesterday"
  },
  {
    user: "m.power@greenbuildermedia.com",
    role: "Admin Demo",
    product: "CertainTeed Solaris Cool Roof Shingles",
    property: "44 Harbor View Dr.",
    zip: "32202",
    vpsfScore: 742,
    ip: "172.59.67.154",
    action: "Created score card",
    date: "May 30"
  }
];

function Reports({ products }) {
  const [summaryProduct, setSummaryProduct] = useState("CertainTeed Solaris Cool Roof Shingles");
  const [manufacturer, setManufacturer] = useState("CertainTeed");
  const [reportType, setReportType] = useState("CSV spreadsheet");
  const [isAssembling, setIsAssembling] = useState(false);
  const [showLeadPreview, setShowLeadPreview] = useState(false);

  const productNames = products.map((item) => `${item.brand} ${item.product}`);
  const matchedProducts = products.filter((item) =>
    `${item.brand} ${item.product}`.toLowerCase().includes(manufacturer.toLowerCase())
  );

  const runLeadReport = () => {
    setShowLeadPreview(false);
    setIsAssembling(true);
    window.setTimeout(() => {
      setIsAssembling(false);
      setShowLeadPreview(true);
    }, 3000);
  };

  return (
    <div className="reportsPage">
      <div className="gridPage">
        {reports.map((item) => (
          <section className="reportCard" key={item.name}>
            <FileText size={22} />
            <h2>{item.name}</h2>
            <p>{item.period}</p>
            <strong>{item.metric}</strong>
            <Badge tone="green">{item.trend}</Badge>
          </section>
        ))}
      </div>

      <section className="customReportGrid">
        <article className="customReportCard">
          <h2>Create Custom Summary</h2>
          <p>Select a brand/product currently in the recommendation database.</p>
          <label>
            <span>Brand / Product</span>
            <select value={summaryProduct} onChange={(event) => setSummaryProduct(event.target.value)}>
              {productNames.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label>
            <span>Report Format</span>
            <select>
              <option>.txt summary</option>
              <option>.CSV spreadsheet</option>
              <option>Other</option>
            </select>
          </label>
          <button className="primaryReportButton">Create Summary</button>
        </article>

        <article className="customReportCard">
          <h2>Create Custom Lead Report</h2>
          <p>Type a manufacturer name. Matching products will populate automatically.</p>
          <label>
            <span>Manufacturer</span>
            <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
          </label>
          <div className="matchedProductBox">
            <strong>Matched Products</strong>
            {matchedProducts.length ? matchedProducts.map((item) => (
              <span key={`${item.brand}-${item.product}`}>{item.product}</span>
            )) : <em>No products found</em>}
          </div>
          <label>
            <span>Report Format</span>
            <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
              <option>.CSV spreadsheet</option>
              <option>.txt file</option>
              <option>Other</option>
            </select>
          </label>
          <button className="primaryReportButton" onClick={runLeadReport}>Generate Lead Report</button>
        </article>
      </section>

      {isAssembling && (
        <section className="assemblingReport">
          <div className="reportSpinner" />
          <h2>Assembling custom lead report</h2>
          <p>{manufacturer} · {reportType}</p>
        </section>
      )}

      {showLeadPreview && (
        <section className="tablePanel fullPanel leadPreviewPanel fullWidthLeadPreview">
          <div className="tablePanelHeader">
            <div><FileText size={30} /><span><h2>CertainTeed Lead Report Preview</h2><p>Demo export preview for CertainTeed Solaris Cool Roof Shingles.</p></span></div>
            <button><Download size={16} /> Download CSV</button>
          </div>
          <table className="spreadsheetTable">
            <thead>
              <tr>
                <th>User / Email</th>
                <th>Role</th>
                <th>Product</th>
                <th>Property</th>
                <th>ZIP</th>
                <th>VPSF Score</th>
                <th>IP Address</th>
                <th>Action</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {certainTeedLeads.map((item) => (
                <tr key={`${item.user}-${item.date}`}>
                  <td><strong>{item.user}</strong></td>
                  <td>{item.role}</td>
                  <td>{item.product}</td>
                  <td>{item.property}</td>
                  <td>{item.zip}</td>
                  <td>{item.vpsfScore}</td>
                  <td>{item.ip}</td>
                  <td>{item.action}</td>
                  <td>{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="prospectAnalysisPanel">
        <div className="prospectHeader">
          <div>
            <h2>Prospect Analysis</h2>
            <p>AI-assisted lead context for CertainTeed Solaris roofing opportunities.</p>
          </div>
          <Badge tone="green">OpenAI Context Layer</Badge>
        </div>

        <div className="prospectGrid">
          <article className="prospectCard">
            <span>Client Region</span>
            <strong>Florida / Southeast</strong>
            <div className="regionChips">
              <em>Orlando</em>
              <em>Jacksonville</em>
              <em>Gainesville</em>
            </div>
            <p>Lead activity is clustering in hot, humid markets with storm exposure and rising cooling-cost sensitivity.</p>
          </article>

          <article className="prospectCard">
            <span>Age of Current Roof / Product</span>
            <strong>12–17 years</strong>
            <div className="roofAgeMeter">
              <i style={{ width: "76%" }} />
            </div>
            <p>Many queried homes are near or past the typical replacement planning window for asphalt shingles.</p>
          </article>

          <article className="prospectCard">
            <span>Lead Temperature</span>
            <div className="leadTempWrap">
              <div className="leadTempGauge"><b>74%</b></div>
              <strong>Warm / Ready Soon</strong>
            </div>
            <p>Signals suggest strong near-term interest: multiple product views, older roof age, and repeated roofing recommendation clicks.</p>
          </article>

          <article className="prospectCard smartContextCard">
            <span>Smart Context</span>
            <strong>3 lead clusters detected</strong>
            <ul>
              <li><b>Storm Recovery:</b> regions with severe hurricane damage and insurance pressure.</li>
              <li><b>Heat Failure:</b> markets where high heat may accelerate roof aging.</li>
              <li><b>HOA Constraint:</b> communities requiring asphalt-style appearance.</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}


function ScoringControlsPage() {
  const [activeProfile, setActiveProfile] = useState("Midwest Rural");
  const [factorValues, setFactorValues] = useState(() => cloneFactors(regionalWeightingProfiles["Midwest Rural"].factors));
  const [weights, setWeights] = useState(regionalWeightingProfiles["Midwest Rural"].weights);
  const profile = regionalWeightingProfiles[activeProfile] || regionalWeightingProfiles.Custom;

  const handleProfileChange = (profileName) => {
    const nextProfile = regionalWeightingProfiles[profileName] || regionalWeightingProfiles.Custom;
    setActiveProfile(profileName);
    setFactorValues(cloneFactors(nextProfile.factors));
    setWeights(nextProfile.weights);
  };

  const handleFactorChange = (pillar, index, value) => {
    setActiveProfile("Custom");
    setFactorValues((current) => {
      const updated = cloneFactors(current);
      updated[pillar][index] = value;
      setWeights(calculateWeightsFromFactors(updated));
      return updated;
    });
  };

  return (
    <div className="scoringControlsPage">
      <section className="weightingProfile">
        <div>
          <h2>Active Weighting Profile</h2>
          <p>Select a regional scoring profile or create a custom model.</p>
          <span className="profileNote">{profile.note}</span>
        </div>
        <select value={activeProfile} onChange={(event) => handleProfileChange(event.target.value)}>
          {Object.keys(regionalWeightingProfiles).map((profileName) => (
            <option key={profileName}>{profileName}</option>
          ))}
        </select>
      </section>

      <section className="impactPreview">
        <h2>Weighting Impact Preview</h2>
        <div className="impactGrid">
          {PILLARS.map((pillar) => (
            <div key={pillar}>{pillar} <strong>{weights[pillar]}%</strong></div>
          ))}
        </div>
      </section>

      <div className="pillarControlGrid">
        {weightingFactors.map(([pillar, ...factors]) => (
          <article className="pillarControlCard" key={pillar}>
            <h3>{pillar}</h3>
            {factors.map((factor, index) => (
              <label key={factor}>
                {factor}
                <select
                  value={factorValues[pillar][index]}
                  onChange={(event) => handleFactorChange(pillar, index, event.target.value)}
                >
                  {factorLevels.map((level) => <option key={level}>{level}</option>)}
                </select>
              </label>
            ))}
          </article>
        ))}
      </div>

      <section className="overridePanel">
        <h2>Scoring Overrides</h2>
        <label><input type="checkbox" defaultChecked /> Roof age over 15 years reduces Resilience score</label>
        <label><input type="checkbox" defaultChecked /> Utility rates above national average increase Energy weighting</label>
        <label><input type="checkbox" defaultChecked /> Flood Zone AE increases Water weighting</label>
        <label><input type="checkbox" defaultChecked /> Broadband unavailable reduces Community score</label>
        <label><input type="checkbox" defaultChecked /> Healthcare desert reduces Health score</label>
        <label><input type="checkbox" /> HOA restrictions reduce upgrade flexibility</label>
      </section>
    </div>
  );
}

function GenericPage({ title }) {
  return (
    <section className="emptyPanel">
      <Layers size={42} />
      <h2>{title}</h2>
      <p>This is a demo placeholder screen.</p>
    </section>
  );
}

function Panel({ title, children }) {
  return <section className="sidePanel"><h3>{title}</h3>{children}</section>;
}

function SummaryLine({ label, value, tone }) {
  return <div className="summaryLine"><i className={tone} /><span>{label}</span><strong>{value}</strong></div>;
}

function MiniBar({ label, value }) {
  return (
    <div className="miniBar">
      <span>{label}</span>
      <div><i style={{ width: `${value}%` }} /></div>
      <strong>{value}%</strong>
    </div>
  );
}

export default function AdminDemo() {
  const savedPasscode = window.sessionStorage.getItem("vpsf_admin_passcode") || "";
  const [passcode, setPasscode] = useState(savedPasscode);
  const [isUnlocked, setIsUnlocked] = useState(savedPasscode === "2027");
  const [passcodeError, setPasscodeError] = useState("");
  const [active, setActive] = useState("Properties");
  const [products, setProducts] = useState(initialProducts);
  const [queries, setQueries] = useState([]);
  const [productClicks, setProductClicks] = useState([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);

  useEffect(() => {
    if (!isUnlocked) return;
    let isMounted = true;
    setIsLoadingAdmin(true);
    Promise.all([
      getAdminProducts(passcode),
      getAdminPropertyQueries(passcode),
      getAdminProductClicks(passcode)
    ])
      .then(([apiProducts, apiQueries, apiClicks]) => {
        if (!isMounted) return;
        if (apiProducts.length) {
          setProducts(apiProducts.map((item) => ({
            id: item.id,
            brand: item.brand,
            product: item.product,
            pillar: item.pillar,
            category: item.category,
            weight: item.weight
          })));
        }
        setQueries(apiQueries || []);
        setProductClicks(apiClicks || []);
      })
      .catch((error) => {
        console.warn("Admin data stayed on demo data because the API was unavailable.", error);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAdmin(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isUnlocked, passcode]);

  const unlockAdmin = (event) => {
    event.preventDefault();
    if (passcode !== "2027") {
      setPasscodeError("Invalid passcode.");
      return;
    }
    window.sessionStorage.setItem("vpsf_admin_passcode", passcode);
    setPasscodeError("");
    setIsUnlocked(true);
  };

  const content = {
    Dashboard: <Dashboard />,
    Properties: <Properties queries={queries} productClicks={productClicks} isLoading={isLoadingAdmin} />,
    "Climate and Location Metrics": <ScoringControlsPage />,
    Products: <BrandWeighting products={products} setProducts={setProducts} passcode={passcode} />,
    "Brand Weighting": <BrandWeighting products={products} setProducts={setProducts} passcode={passcode} />,
    Users: <UsersPage />,
    Reports: <Reports products={products} />,
    Settings: <GenericPage title="Settings" />
  }[active];

  if (!isUnlocked) {
    return (
      <div className="adminLogin">
        <form onSubmit={unlockAdmin}>
          <img src={cognitionIcon} alt="COGNITION" />
          <h1>VPSF Admin</h1>
          <p>Enter the admin passcode to view property query data.</p>
          <input
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder="Passcode"
            autoFocus
          />
          {passcodeError && <span>{passcodeError}</span>}
          <button className="primary">Unlock Admin</button>
        </form>
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #071a2c; color: #0a2340; }
          .adminLogin { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #071a2c; }
          .adminLogin form { width: min(420px, 100%); display: grid; gap: 14px; padding: 30px; background: #fff; border: 1px solid #dfe7f0; border-radius: 12px; box-shadow: 0 18px 50px rgba(0,0,0,.22); }
          .adminLogin img { width: 52px; height: 52px; }
          .adminLogin h1 { margin: 0; font-size: 30px; }
          .adminLogin p { margin: 0 0 8px; color: #506179; }
          .adminLogin input { height: 46px; border: 1px solid #ccd9e8; border-radius: 8px; padding: 0 12px; font: inherit; }
          .adminLogin span { color: #d8262f; font-size: 13px; font-weight: 800; }
          .adminLogin button { height: 46px; border: 0; border-radius: 8px; background: #126fd2; color: #fff; font-weight: 900; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="adminApp">
      <Sidebar active={active} setActive={setActive} />
      <main className="adminMain">
        <Header active={active} />
        <div className="adminContent">{content}</div>
      </main>

      <style>{`
        :root {
          --navy: #071a2c;
          --navy2: #0c2d4b;
          --blue: #126fd2;
          --bright: #29aef5;
          --green: #219653;
          --red: #d8262f;
          --gold: #f2a51a;
          --muted: #607089;
          --line: #dfe7f0;
          --soft: #f5f8fc;
          --card: #ffffff;
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--soft); color: #0a2340; }
        button, input { font: inherit; }
        .adminApp { min-height: 100vh; display: grid; grid-template-columns: 260px 1fr; background: #f6f9fd; }
        .adminSidebar { background: linear-gradient(180deg, #071a2c, #0b2d4c); color: #fff; padding: 24px 12px; display: flex; flex-direction: column; gap: 24px; }
        .adminLogo { display: grid; grid-template-columns: 50px 1fr; column-gap: 10px; align-items: center; padding: 0 8px 20px; }
        .adminLogo div { width: 46px; height: 46px; border-radius: 12px; border: 2px solid #2f93ff; display: grid; place-items: center; color: #f2c94c; }
        .adminLogo strong { font-size: 32px; line-height: .8; letter-spacing: .02em; }
        .adminLogo span { grid-column: 2; font-size: 13px; letter-spacing: .42em; font-weight: 800; }
        .adminSidebar nav { display: grid; gap: 6px; }
        .adminSidebar nav button { border: 0; color: #d8e8f8; background: transparent; display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 10px; cursor: pointer; text-align: left; }
        .adminSidebar nav button.active { background: linear-gradient(90deg, #126fd2, #0d84f2); color: #fff; font-weight: 800; }
        .adminUser { margin-top: auto; border-top: 1px solid rgba(255,255,255,.18); padding: 18px 8px 0; display: flex; gap: 10px; align-items: center; }
        .adminUser div { width: 40px; height: 40px; border-radius: 999px; background: var(--blue); display: grid; place-items: center; font-weight: 900; }
        .adminUser span { display: grid; font-size: 12px; color: #c9d8e6; }
        .adminUser strong { color: #fff; font-size: 14px; }
        .adminMain { min-width: 0; }
        .adminHeader { height: 112px; padding: 28px 32px; display: flex; align-items: start; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--line); background: #fff; }
        .adminHeader h1 { margin: 0 0 6px; font-size: 30px; letter-spacing: -.03em; }
        .adminHeader p { margin: 0; color: #40506a; }
        .headerActions { display: flex; gap: 12px; }
        .headerActions button, .tablePanelHeader button { height: 44px; border: 1px solid #cfe0f1; color: var(--blue); background: #fff; border-radius: 8px; padding: 0 18px; display: inline-flex; align-items: center; gap: 9px; font-weight: 800; cursor: pointer; }
        .headerActions .primary { background: var(--blue); color: #fff; border-color: var(--blue); }
        .adminContent { padding: 26px 32px; }
        .managerLayout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 22px; }
        .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
        .toolbar label { width: 330px; height: 44px; border: 1px solid #ccd9e8; background: #fff; border-radius: 8px; display: flex; align-items: center; gap: 9px; padding: 0 12px; color: #68788e; }
        .toolbar input { border: 0; outline: 0; width: 100%; }
        .pillarFilters { display: flex; flex-wrap: wrap; gap: 8px; }
        .pillarFilters button { height: 40px; border: 1px solid #cfe0f1; background: #fff; color: #22344c; border-radius: 8px; padding: 0 14px; font-weight: 700; cursor: pointer; }
        .pillarFilters button.active { background: var(--blue); border-color: var(--blue); color: #fff; }
        .tablePanel, .fullPanel, .sidePanel, .metric, .panel, .reportCard, .emptyPanel { background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 28px rgba(9,33,59,.04); }
        .tablePanelHeader { padding: 22px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 18px; align-items: center; }
        .tablePanelHeader > div { display: flex; align-items: center; gap: 14px; color: var(--blue); }
        .tablePanelHeader h2 { margin: 0 0 4px; font-size: 17px; color: #0a2340; text-transform: uppercase; letter-spacing: .03em; }
        .tablePanelHeader p { margin: 0; color: #506179; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { color: #071a2c; font-size: 12px; text-align: left; padding: 14px 22px; background: #fbfdff; border-bottom: 1px solid var(--line); }
        td { padding: 16px 22px; border-bottom: 1px solid var(--line); color: #102842; }
        td small { display: block; margin-top: 4px; color: #607089; font-size: 12px; }
        tr:last-child td { border-bottom: 0; }
        .subTable { border-top: 1px solid var(--line); padding-top: 18px; }
        .subTable h3 { margin: 0; padding: 0 22px 14px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; }
        .weightSelect { min-width: 160px; height: 38px; border: 1px solid #d4e0ec; background: #fff; border-radius: 8px; padding: 0 12px; font-size: 13px; font-weight: 900; text-transform: uppercase; }
        .weightSelect span, .summaryLine i { width: 11px; height: 11px; border-radius: 999px; display: inline-block; }
        .priority span, .green { background: var(--green); }
        .standard span, .gray { background: #9ba8b9; }
        .downgrade span, .red { background: var(--red); }
        .dark { background: #263449; }
        .blue { background: var(--blue); }
        .iconButton { border: 0; color: var(--blue); background: transparent; cursor: pointer; }
        .rightRail { display: grid; gap: 14px; align-content: start; }
        .sidePanel { padding: 18px; }
        .sidePanel h3 { margin: 0 0 16px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; }
        .summaryLine { display: grid; grid-template-columns: 14px 1fr auto; gap: 10px; align-items: center; padding: 8px 0; font-size: 14px; color: #263449; }
        .miniBar { display: grid; grid-template-columns: 92px 1fr 38px; gap: 9px; align-items: center; margin: 12px 0; font-size: 13px; }
        .miniBar div { height: 8px; border-radius: 999px; background: #e8eef5; overflow: hidden; }
        .miniBar i { height: 100%; display: block; border-radius: 999px; background: var(--blue); }
        .miniBar strong { text-align: right; }
        .finePrint { color: #708096; font-size: 12px; line-height: 1.4; }
        .gridPage { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
        .metric { padding: 18px; display: grid; gap: 7px; }
        .metric svg { color: var(--blue); }
        .metric span { color: #596a80; font-size: 13px; }
        .metric strong { font-size: 32px; }
        .metric em { color: var(--green); font-style: normal; font-size: 12px; font-weight: 800; }
        .panel { padding: 20px; }
        .panel.wide { grid-column: span 2; }
        .activityList p { border-bottom: 1px solid var(--line); padding: 10px 0; margin: 0; color: #40506a; }
        .reportCard { padding: 18px; display: grid; gap: 8px; }
        .reportCard svg { color: var(--blue); }
        .reportCard h2 { margin: 0; font-size: 16px; }
        .reportCard p { margin: 0; color: #617189; }
        .reportCard strong { font-size: 24px; }
        .badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 900; background: #eef4fb; color: var(--blue); }
        .badge.green { background: #e7f7ee; color: var(--green); }
        .badge.gold { background: #fff5de; color: #9a6400; }
        .badge.red { background: #ffe9e9; color: var(--red); }
        .emptyPanel { height: 460px; display: grid; place-items: center; text-align: center; padding: 40px; color: #52657a; }
        .emptyPanel svg { color: var(--blue); }
        .spreadsheetTable th, .spreadsheetTable td { white-space: nowrap; font-size: 13px; }

        .deleteButton {
          border: 1px solid #ffd4d4;
          background: #fff2f2;
          color: var(--red);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .mutedRow {
          opacity: .55;
        }
        .reportsPage {
          display: grid;
          gap: 22px;
        }
        .customReportGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        .customReportCard {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: 0 10px 28px rgba(9,33,59,.04);
          padding: 22px;
        }
        .customReportCard h2 {
          margin: 0 0 6px;
          font-size: 18px;
        }
        .customReportCard p {
          color: #607089;
          margin: 0 0 16px;
          line-height: 1.4;
        }
        .customReportCard label {
          display: grid;
          gap: 6px;
          margin-top: 13px;
          color: #263449;
          font-size: 13px;
          font-weight: 800;
        }
        .customReportCard input,
        .customReportCard select {
          width: 100%;
          height: 42px;
          border: 1px solid #ccd9e8;
          border-radius: 8px;
          padding: 0 12px;
          background: #fbfdff;
          color: #102842;
          font-weight: 650;
        }
        .primaryReportButton {
          height: 44px;
          margin-top: 16px;
          border: 0;
          background: var(--blue);
          color: white;
          border-radius: 8px;
          padding: 0 18px;
          font-weight: 900;
          cursor: pointer;
        }
        .matchedProductBox {
          border: 1px solid #dfe7f0;
          background: #f8fbfe;
          border-radius: 10px;
          padding: 12px;
          margin-top: 13px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .matchedProductBox strong {
          width: 100%;
          font-size: 12px;
          color: #263449;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .matchedProductBox span {
          background: #eef7ff;
          color: var(--blue);
          border: 1px solid #d0e6fb;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 850;
        }
        .matchedProductBox em {
          color: #607089;
          font-style: normal;
          font-size: 13px;
        }
        .assemblingReport {
          min-height: 210px;
          display: grid;
          place-items: center;
          text-align: center;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: 0 10px 28px rgba(9,33,59,.04);
          padding: 28px;
        }
        .assemblingReport h2 {
          margin: 14px 0 4px;
          color: #071a2c;
        }
        .assemblingReport p {
          margin: 0;
          color: #607089;
        }
        .reportSpinner {
          width: 58px;
          height: 58px;
          border-radius: 999px;
          border: 5px solid #dcecfb;
          border-top-color: var(--blue);
          animation: adminSpin 1s linear infinite;
        }
        .leadPreviewPanel {
          overflow-x: auto;
        }
        @keyframes adminSpin {
          to { transform: rotate(360deg); }
        }

        
        .fullWidthLeadPreview {
          width: 100%;
          grid-column: 1 / -1;
          max-width: 100%;
        }
        .fullWidthLeadPreview table {
          width: 100%;
          min-width: 1200px;
        }


        .prospectAnalysisPanel {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: 0 10px 28px rgba(9,33,59,.04);
          padding: 22px;
          width: 100%;
          grid-column: 1 / -1;
        }
        .prospectHeader {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: start;
          margin-bottom: 18px;
        }
        .prospectHeader h2 {
          margin: 0 0 5px;
          font-size: 20px;
        }
        .prospectHeader p {
          margin: 0;
          color: #607089;
        }
        .prospectGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .prospectCard {
          border: 1px solid #dfe7f0;
          background: #fbfdff;
          border-radius: 12px;
          padding: 16px;
          min-height: 210px;
        }
        .prospectCard span {
          display: block;
          color: var(--blue);
          text-transform: uppercase;
          letter-spacing: .06em;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 9px;
        }
        .prospectCard strong {
          display: block;
          color: #071a2c;
          font-size: 20px;
          line-height: 1.15;
          margin-bottom: 12px;
        }
        .prospectCard p {
          color: #607089;
          font-size: 13px;
          line-height: 1.4;
          margin: 12px 0 0;
        }
        .regionChips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .regionChips em {
          font-style: normal;
          color: #0a2340;
          background: #eef7ff;
          border: 1px solid #d0e6fb;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 850;
        }
        .roofAgeMeter {
          height: 14px;
          border-radius: 999px;
          background: #e8eef5;
          overflow: hidden;
          margin: 8px 0 10px;
        }
        .roofAgeMeter i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--green), var(--gold), var(--red));
        }
        .leadTempWrap {
          display: grid;
          grid-template-columns: 94px 1fr;
          align-items: center;
          gap: 12px;
        }
        .leadTempGauge {
          width: 94px;
          height: 94px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at center, #fff 0 56%, transparent 57%),
            conic-gradient(var(--red) 0 18%, var(--gold) 18% 48%, var(--green) 48% 74%, #e8eef5 74% 100%);
          box-shadow: inset 0 0 0 1px #dfe7f0;
        }
        .leadTempGauge b {
          color: #071a2c;
          font-size: 22px;
        }
        .smartContextCard ul {
          margin: 0;
          padding-left: 18px;
          color: #40506a;
          font-size: 13px;
          line-height: 1.42;
        }
        .smartContextCard li {
          margin-bottom: 8px;
        }


        .scoringControlsPage { display:grid; gap:18px; }
        .weightingProfile,.impactPreview,.overridePanel{
          background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;
        }
        .weightingProfile{
          display:flex;justify-content:space-between;align-items:center;
        }
        .weightingProfile select,.pillarControlCard select{
          height:40px;border:1px solid #ccd9e8;border-radius:8px;padding:0 10px;
        }
        .profileNote{
          display:block;
          max-width:840px;
          margin-top:10px;
          color:#52657a;
          font-size:13px;
          line-height:1.45;
        }
        .impactGrid{
          display:grid;grid-template-columns:repeat(7,1fr);gap:10px;margin-top:12px;
        }
        .impactGrid div{
          background:#f5f8fc;padding:12px;border-radius:8px;text-align:center;
        }
        .pillarControlGrid{
          display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;
        }
        .pillarControlCard{
          background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;
          display:grid;gap:10px;
        }
        .pillarControlCard h3{margin:0;color:var(--blue);}
        .pillarControlCard label{display:grid;gap:4px;font-size:13px;font-weight:700;}
        .overridePanel label{display:block;padding:6px 0;}


        .adminLogoIcon {
          width: 64px;
          height: 64px;
          object-fit: contain;
        }
        .sidebarBrand {
          display: flex;
          align-items: center;
          gap: 14px;
        }


        .cognitionAdminLogo {
          grid-template-columns: 60px 1fr;
        }
        .cognitionAdminLogo .adminLogoIcon {
          width: 54px;
          height: 54px;
          object-fit: contain;
          grid-row: span 2;
          filter: drop-shadow(0 8px 18px rgba(41,174,245,.24));
        }
        .cognitionAdminLogo strong {
          font-size: 20px;
          line-height: 1;
          letter-spacing: .02em;
        }
        .cognitionAdminLogo span {
          font-size: 11px;
          letter-spacing: .23em;
        }

        @media (max-width: 1050px) {
          .adminApp { grid-template-columns: 1fr; }
          .adminSidebar { position: relative; min-height: auto; }
          .managerLayout { grid-template-columns: 1fr; }
          .gridPage { grid-template-columns: repeat(2, 1fr); }
          .customReportGrid { grid-template-columns: 1fr; }
          .prospectGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .tablePanel { overflow-x: auto; }
        }
      `}</style>
    </div>
  );
}

