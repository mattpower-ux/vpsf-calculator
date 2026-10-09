import csv
import re
from functools import lru_cache
from pathlib import Path

from app.address_normalization import normalize_state


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "iecc_2021_counties.csv"
THERMAL_LABELS = {
    "1": "Very Hot", "2": "Hot", "3": "Warm", "4": "Mixed",
    "5": "Cool", "6": "Cold", "7": "Very Cold", "8": "Subarctic",
}
MOISTURE_LABELS = {"A": "Humid", "B": "Dry", "C": "Marine"}


def _county_key(value: str) -> str:
    name = re.sub(r"\bst[.]?\b", "saint", (value or "").strip().lower())
    name = re.sub(r"\s+(city and borough|census area|county|parish|borough|municipality)$", "", name)
    return re.sub(r"[^a-z0-9]", "", name)


@lru_cache(maxsize=1)
def _county_zones() -> dict[tuple[str, str], str]:
    with DATA_PATH.open(encoding="utf-8", newline="") as source:
        rows = csv.DictReader(line for line in source if not line.startswith("#"))
        return {
            (row["state"], _county_key(row["county"])): row["zone"]
            for row in rows
        }


def estimate_climate_zone(state: str, zip_code: str = "", county: str = "") -> str:
    if not state or not county:
        return "Unknown"
    zone = _county_zones().get((normalize_state(state), _county_key(county)))
    if not zone:
        return "Unknown"
    thermal = THERMAL_LABELS.get(zone[0])
    if not thermal:
        return "Unknown"
    moisture = MOISTURE_LABELS.get(zone[1:], "")
    return f"{zone} - {thermal}{f' {moisture}' if moisture else ''}"
