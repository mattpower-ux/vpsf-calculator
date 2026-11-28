from app.advice.catalog_metadata import initial_metadata
from app.advice.context import build_home_context
from app.advice.products import match_products
from app.demo_hardie import hardie_demo_home
from app.products.catalog import SEED_PRODUCTS
from app.schemas import PropertyInput


def catalog_by_id():
    return {product.id: product for product in SEED_PRODUCTS}


def matchable(product):
    return {**product.model_dump(), **initial_metadata(product).model_dump()}


def test_vulcan_soffit_vent_is_an_ember_protection_product():
    product = catalog_by_id()["vulcan-soffit-vent"]
    metadata = initial_metadata(product)

    assert product.brand == "Vulcan Vents"
    assert product.category == "Ember Protection"
    assert "mitigatenow.com" in product.companyUrl
    assert product.imageUrl.startswith("https://")
    assert metadata.needTags == ["ember-protection"]
    assert metadata.requirements == ["ember-design"]
    assert metadata.pillars == ["resilience"]
    assert metadata.sourceUrl == "https://vulcanvents.com/vents/soffit-vents/"
    assert metadata.reviewedAt == "2026-11-27"


def test_cultured_stone_is_a_fire_resistant_siding_option():
    product = catalog_by_id()["cultured-stone-veneer"]
    metadata = initial_metadata(product)

    assert product.brand == "Cultured Stone"
    assert product.category == "Siding"
    assert "westlakeroyalbuildingproducts.com/stone/cultured-stone" in product.companyUrl
    assert product.imageUrl.startswith("https://")
    assert metadata.needTags == ["fire-resistant-siding"]
    assert metadata.requirements == ["siding-assembly"]
    assert metadata.pillars == ["resilience"]
    assert metadata.sourceUrl == "https://www.westlakeroyalbuildingproducts.com/technical-data-sheet-cultured-stone"
    assert metadata.reviewedAt == "2026-11-27"


def test_new_resilience_products_match_their_homeowner_needs():
    catalog = catalog_by_id()

    wildfire_home = hardie_demo_home().model_dump()
    wildfire_home["wildfireMitigation"] = "None"
    ember_context = build_home_context(PropertyInput(**wildfire_home), {}, {}, {})
    assert [match["productId"] for match in match_products(ember_context, [matchable(catalog["vulcan-soffit-vent"])])] == ["vulcan-soffit-vent"]

    siding_home = {**wildfire_home, "siding": "Wood siding"}
    siding_context = build_home_context(PropertyInput(**siding_home), {"siding": {"origin": "user-confirmed"}}, {}, {})
    assert [match["productId"] for match in match_products(siding_context, [matchable(catalog["cultured-stone-veneer"])])] == ["cultured-stone-veneer"]


def test_simpson_h10a_is_a_storm_protection_product():
    product = catalog_by_id()["simpson-h10a-hurricane-tie"]
    metadata = initial_metadata(product)

    assert product.brand == "Simpson Strong-Tie"
    assert product.product == "H10A Hurricane Tie"
    assert metadata.needTags == ["storm-protection"]
    assert metadata.requirements == ["storm-design"]
    assert metadata.sourceUrl == "https://www.strongtie.com/resources/product-installers-guide/h10a-installation"
    assert metadata.reviewedAt == "2026-11-27"
