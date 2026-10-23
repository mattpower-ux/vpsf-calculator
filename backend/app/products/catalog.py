from app.schemas import ProductRecommendation


SEED_PRODUCTS = [
    ProductRecommendation(
        id="us-boiler-alta-altac-200", brand="U.S. Boiler", product="ALTA ALTAC-200 Combi Boiler",
        pillar="Energy", category="Condensing Boiler", weight="Standard",
        summary="ENERGY STAR lists ALTAC-200 at 95% AFUE for natural gas or propane, with domestic hot-water integration. Verify heating load, hot-water demand, venting, and condensate drainage with an installer. Certification record: ENERGY STAR ID 2385559, reviewed October 23, 2026. Request specifications through VPSF; brand selection alone does not add points.",
    ),
    ProductRecommendation(
        id="us-boiler-alpine", brand="U.S. Boiler", product="Alpine Condensing Gas Boiler",
        pillar="Energy", category="Condensing Boiler", weight="Standard",
        summary="U.S. Boiler lists Alpine at 95% AFUE and ENERGY STAR certified, with natural-gas or propane operation and outdoor-temperature sensing. This is space-heating equipment; domestic hot-water design needs separate review. Verify the selected model, load, and system water temperatures. Manufacturer specifications reviewed October 23, 2026.",
    ),
    ProductRecommendation(
        id="navien-ncb-250-150h", brand="Navien", product="NCB-250/150H Combi Boiler",
        pillar="Energy", category="Condensing Boiler", weight="Standard",
        summary="Navien lists the NCB-250/150H at 95% AFUE and ENERGY STAR certified. It combines hydronic space heating with domestic hot water and supports natural gas or propane. Size heating and hot-water loads separately; rated flow depends on temperature rise. Manufacturer specifications reviewed October 23, 2026. Requests are handled by VPSF.",
    ),
    ProductRecommendation(
        id="rheem-proterra",
        brand="Rheem",
        product="ProTerra Heat Pump Water Heater",
        pillar="Energy",
        category="Water Heating",
        weight="Priority",
        summary="High-efficiency heat pump water heater seed record.",
    ),
    ProductRecommendation(
        id="rainwater-management-tank",
        brand="Rainwater Management Solutions",
        product="Rainwater Storage Tank",
        pillar="Water",
        category="Rainwater Reuse",
        weight="Priority",
        summary="Rainwater capture and reuse product seed record.",
    ),
    ProductRecommendation(
        id="certainteed-impact-shingles",
        brand="CertainTeed",
        product="Impact Resistant Shingles",
        pillar="Resilience",
        category="Roofing",
        weight="Priority",
        summary="Impact-resistant roofing seed record for storm resilience recommendations.",
    ),
    ProductRecommendation(
        id="renewaire-erv",
        brand="RenewAire",
        product="Energy Recovery Ventilator",
        pillar="Health",
        category="Ventilation",
        weight="Priority",
        summary="Ventilation product seed record for indoor air quality recommendations.",
    ),
    ProductRecommendation(
        id="moen-eco-performance-showerhead",
        brand="Moen",
        product="Eco-Performance Showerhead",
        pillar="Water",
        category="Fixtures",
        weight="Priority",
        summary="Efficient shower fixture seed record for water savings recommendations.",
    ),
    ProductRecommendation(
        id="niagara-high-efficiency-toilet",
        brand="Niagara",
        product="High-Efficiency Toilet",
        pillar="Water",
        category="Fixtures",
        weight="Priority",
        summary="High-efficiency toilet seed record for water savings recommendations.",
    ),
    ProductRecommendation(
        id="rachio-smart-irrigation",
        brand="Rachio",
        product="Smart Irrigation Controller",
        pillar="Water",
        category="Irrigation",
        weight="Priority",
        summary="Smart irrigation seed record for outdoor water demand management.",
    ),
    ProductRecommendation(
        id="atas-solar-ready-metal-roofing",
        brand="ATAS",
        product="Solar-Ready Metal Roofing",
        pillar="Resilience",
        category="Roofing",
        weight="Priority",
        summary="Durable roof system seed record for resilience and solar readiness.",
    ),
    ProductRecommendation(
        id="certainteed-solaris-cool-roof",
        brand="CertainTeed",
        product="Solaris Cool Roof Shingles",
        pillar="Resilience",
        category="Roofing",
        weight="Priority",
        summary="Cool roof seed record for heat and roof-performance recommendations.",
    ),
    ProductRecommendation(
        id="euroshield-recycled-rubber-roofing",
        brand="Euroshield",
        product="Recycled Rubber Roofing",
        pillar="Carbon",
        category="Roofing",
        weight="Standard",
        summary="Recycled-content roofing seed record for carbon and durability recommendations.",
    ),
]


def list_recommendations() -> list[ProductRecommendation]:
    return SEED_PRODUCTS
