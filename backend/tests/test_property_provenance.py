import pytest

from app.routers.properties import (
    apply_attom_permit_facts,
    property_input_from_attom,
    property_input_from_rentcast,
)
from app.schemas import PropertyInput


@pytest.mark.parametrize("mapper", [property_input_from_rentcast, property_input_from_attom])
def test_empty_provider_record_does_not_import_defaults(mapper):
    home = mapper({})
    assert home.occupancy == "Unknown"
    assert home.analysisLevel == "moderate"
    assert set(home.provenance) == set(PropertyInput.model_fields) - {"provenance"}
    assert all(item.origin == "unknown" for item in home.provenance.values())
    # The full API round trip must retain explicit unknowns, blocking the
    # frontend's fallback that otherwise labels nonempty strings imported.
    restored = PropertyInput.model_validate_json(home.model_dump_json())
    assert restored.provenance == home.provenance


@pytest.mark.parametrize("mapper,record,source", [
    (property_input_from_rentcast, {
        "addressLine1": "123 Main St", "bedrooms": 0,
        "features": {"roofType": "Metal", "floorCount": 1},
    }, "RentCast"),
    (property_input_from_attom, {
        "address": {"line1": "123 Main St"},
        "building": {"rooms": {"beds": 0}, "summary": {"levels": 1},
                     "construction": {"roofCover": "Metal"}},
    }, "ATTOM"),
])
def test_only_supplied_facts_are_imported(mapper, record, source):
    home = mapper(record)
    imported = {field for field, item in home.provenance.items() if item.origin == "imported"}
    assert imported == {"address", "bedrooms", "roof", "stories"}
    assert all(home.provenance[field].source == source for field in imported)
    assert home.bedrooms == "0"
    for field in ("occupancy", "analysisLevel", "sourceNote", "solar", "hers", "pietim"):
        assert home.provenance[field].origin == "unknown"


@pytest.mark.parametrize("missing", [None, "", "  ", "Unknown", "N/A", {}, []])
def test_provider_placeholders_are_not_facts(missing):
    for home in (
        property_input_from_rentcast({"yearBuilt": missing, "features": {"garageSpaces": missing}}),
        property_input_from_attom({"summary": {"yearBuilt": missing},
                                  "building": {"parking": {"prkgSpaces": missing}}}),
    ):
        assert home.provenance["yearBuilt"].origin == "unknown"
        assert home.provenance["garage"].origin == "unknown"


def test_permit_hints_are_inferred_not_verified_system_facts():
    home = property_input_from_attom({"building": {"construction": {"roofCover": "Metal"}}})
    home = apply_attom_permit_facts(home, [{"description": "Roof and solar work", "issueDate": "2020-01-01"}])
    assert home.provenance["roof"].origin == "imported"
    assert home.provenance["roofAge"].origin == "inferred"
    assert home.provenance["solar"].origin == "inferred"
    assert home.provenance["occupancy"].origin == "unknown"
    assert home.provenance["analysisLevel"].origin == "unknown"
