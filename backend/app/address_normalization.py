import re


STATE_TO_CODE = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "district of columbia": "DC",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
}

STREET_SUFFIXES = {
    "aly": "alley",
    "ave": "avenue",
    "av": "avenue",
    "avn": "avenue",
    "aven": "avenue",
    "blvd": "boulevard",
    "boul": "boulevard",
    "cir": "circle",
    "ct": "court",
    "dr": "drive",
    "drv": "drive",
    "hwy": "highway",
    "ln": "lane",
    "pkwy": "parkway",
    "pl": "place",
    "rd": "road",
    "sq": "square",
    "st": "street",
    "str": "street",
    "strt": "street",
    "ter": "terrace",
    "trl": "trail",
    "way": "way",
}


def normalize_state(value: str | None) -> str:
    state = normalize_text(value)
    if not state:
        return ""
    if len(state) == 2:
        return state.upper()
    return STATE_TO_CODE.get(state, state.upper())


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def normalize_zip(value: str | None) -> str:
    match = re.search(r"\d{5}", value or "")
    return match.group(0) if match else ""


def normalize_street_address(value: str | None) -> str:
    text = normalize_text(value)
    text = re.sub(r"[^\w\s#-]", " ", text)
    words = [STREET_SUFFIXES.get(word, word) for word in text.split()]
    return " ".join(words)


def contains_exact_street(normalized_text: str, normalized_street: str) -> bool:
    """Match a complete normalized street without numeric-prefix collisions."""
    if not normalized_text or not normalized_street:
        return False
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(normalized_street)}(?![a-z0-9])", normalized_text))


def property_query_key(address: str | None, city: str | None, state: str | None, zip_code: str | None) -> str:
    parts = [
        normalize_street_address(address),
        normalize_text(city),
        normalize_state(state),
        normalize_zip(zip_code),
    ]
    return "|".join(parts)
