import pytest

from app.address_normalization import normalize_street_address


@pytest.mark.parametrize("suffix", ["Street", "St", "Str", "St.", "Str."])
def test_street_suffix_variants_share_one_identity(suffix):
    assert normalize_street_address(f"22 Dow {suffix}") == "22 dow street"


@pytest.mark.parametrize(("entered", "normalized"), [
    ("10 Main Avn.", "10 main avenue"),
    ("7 Lake Boul.", "7 lake boulevard"),
    ("9 Oak Drv.", "9 oak drive"),
    ("4 Pine Pkwy.", "4 pine parkway"),
])
def test_common_suffix_aliases_normalize_consistently(entered, normalized):
    assert normalize_street_address(entered) == normalized
