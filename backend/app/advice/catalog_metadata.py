"""Conservative initial matching metadata. Admin edits take precedence."""
from app.advice.schemas import ProductMetadata


def initial_metadata(product):
    if product.id == "james-hardie-plank":
        return ProductMetadata(needTags=["fire-resistant-siding"],requirements=["siding-assembly"],pillars=["resilience"],sourceUrl="https://www.jameshardie.com/why-james-hardie/siding-performance-durability/fire-resistance/",reviewedAt="2026-11-13",isSponsored=True,sponsorName="James Hardie",verificationNotes="Confirm the exact siding product and complete wall design with the manufacturer or installer.")
    siding_sources = {'allura-lap': 'https://allurausa.com/resources/lap-siding-submittal-sheet', 'gaf-weatherside-purity': 'https://www.gaf.com/en-us/building-materials/residential-building-materials/fiber-cement-siding/weatherside-purity-fiber-cement-siding', 'nichiha-vintagewood': 'https://www.nichiha.com/products/vintagewood/', 'fiberon-wildwood': 'https://www.fiberoncladding.com/pages/testing-certification-documents'}
    if product.id in siding_sources:
        return ProductMetadata(needTags=["fire-resistant-siding"], requirements=["siding-assembly"], pillars=["resilience"], sourceUrl=siding_sources[product.id], reviewedAt="2026-11-13", verificationNotes="Confirm exact product fire documentation and local approval for the complete wall assembly. A WUI listing or ignition-resistance claim is not a noncombustible material classification.")
    category = product.category.lower()
    mapping = {
        "condensing boiler": (["heating"], ["hydronic", "gas"], "https://www.usboiler.net/high-efficiency-boiler.html"),
        "water heating": (["water-heating"], ["space-and-electrical"], "https://www.rheem.com/heatpumpwaterheaters/"),
        "irrigation": (["irrigation"], ["irrigation"], "https://rachio.com/products/rachio-3/"),
        "fixtures": (["fixtures"], ["fixture-fit"], "https://www.epa.gov/watersense/watersense-products"),
        "rainwater reuse": (["rainwater"], ["reuse-code"], "https://rainwatermanagement.com/"),
        "ventilation": (["ventilation"], ["ventilation-design"], "https://renewaire.com/products/"),
        "roofing": (["roofing"], ["roof-design"], ""),
    }
    tags, requirements, url = mapping.get(category, ([], [], ""))
    sources = {
        "navien-ncb-250-150h": "https://www.navieninc.com/products/ncb-h",
        "niagara-high-efficiency-toilet": "https://niagaracorp.com/our-products/toilets/",
        "atas-solar-ready-metal-roofing": "https://www.atas.com/did-you-know-series/solar-ready-roof-systems-attachment-methods",
        "certainteed-impact-shingles": "https://www.certainteed.com/inspiration/how-tos/algae-impact-resistant-shingles",
        "certainteed-solaris-cool-roof": "https://www.certainteed.com/roofing-shingles",
        "euroshield-recycled-rubber-roofing": "https://www.euroshieldroofing.com/",
    }
    url = sources.get(product.id, url)
    return ProductMetadata(needTags=tags, requirements=requirements, pillars=[product.pillar.lower()], sourceUrl=url,
        verificationNotes="Verify the exact model, specifications, installation requirements and current availability with the manufacturer or installer.",
        reviewedAt="2026-11-09" if product.id in {"rachio-smart-irrigation", "renewaire-erv", "niagara-high-efficiency-toilet", "euroshield-recycled-rubber-roofing"} else "", isSponsored=False)
