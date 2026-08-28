from app.schemas import ProductRecommendation


SEED_PRODUCTS = [
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
