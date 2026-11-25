"""Exact-address public web discovery for basic property facts.

This integration uses search-result metadata rather than scraping listing pages.
It accepts facts only from known property sources whose result text contains the
entered street, locality, and state or ZIP.  It never treats nearby homes or
unit listings as evidence for a whole-building address.
"""
from collections import Counter, defaultdict
import json
from functools import lru_cache
from pathlib import Path
import re
from urllib.parse import urlsplit

import httpx

from app.address_normalization import STREET_SUFFIXES, contains_exact_street, normalize_state, normalize_street_address, normalize_text, normalize_zip
from app.schemas import FieldProvenance, PropertyInput


CRAWL4AI_SEARCH_URL = "https://api.crawl4ai.com/tools/search"
MAX_RESPONSE_BYTES = 768 * 1024
TRUSTED_PROPERTY_DOMAINS = {
    "zillow.com": "Zillow",
    "redfin.com": "Redfin",
    "realtor.com": "Realtor.com",
    "homes.com": "Homes.com",
    "trulia.com": "Trulia",
    "movoto.com": "Movoto",
}
PROVIDER_PRIORITY = {name: index for index, name in enumerate(TRUSTED_PROPERTY_DOMAINS.values())}
PROPERTY_CORRECTIONS_PATH = Path(__file__).resolve().parents[1] / "data" / "property_corrections.json"
NORMALIZED_STREET_SUFFIX_PATTERN = "|".join(
    sorted((re.escape(suffix) for suffix in set(STREET_SUFFIXES.values())), key=len, reverse=True)
)


def _address_identity(address: str) -> tuple[str, str, str, str]:
    parts = [part.strip() for part in address.split(",")]
    street = normalize_street_address(parts[0] if parts else "")
    city = normalize_text(parts[1] if len(parts) > 1 else "")
    region = parts[2] if len(parts) > 2 else ""
    state = normalize_state(re.sub(r"\b\d{5}(?:-\d{4})?\b", "", region).strip())
    return street, city, state, normalize_zip(region)


def _provider(url: object) -> str | None:
    if not isinstance(url, str):
        return None
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower()
    except ValueError:
        return None
    for domain, name in TRUSTED_PROPERTY_DOMAINS.items():
        if host == domain or host.endswith("." + domain):
            return name
    if host == "web.archive.org":
        snapshot = re.match(r"^/web/(?:\d{1,14}[a-z_]{0,4}/)?(https?://.+)$", parsed.path, re.IGNORECASE)
        if not snapshot:
            return None
        original = urlsplit(snapshot.group(1))
        if (original.hostname or "").lower() == "web.archive.org":
            return None
        original_provider = _provider(snapshot.group(1))
        return f"Internet Archive snapshot · {original_provider}" if original_provider else None
    if host.endswith(".gov"):
        return "Municipal public record"
    return None


def _normalized_result_text(result: dict) -> str:
    # Establish identity only from search metadata and the result URL. Deep page
    # text can mention nearby homes and is evidence only after this check passes.
    raw = f"{result.get('title', '')} {result.get('snippet', result.get('description', ''))} {result.get('url', '')}".lower()
    return normalize_street_address(re.sub(r"[-_/]+", " ", raw))


def _address_scoped_markdown(result: dict, address: str) -> str:
    """Use deep text only near an explicit occurrence of the entered address."""
    markdown = result.get("markdown")
    street, city, state, zip_code = _address_identity(address)
    if not isinstance(markdown, str) or not street or not city:
        return ""
    normalized = normalize_street_address(re.sub(r"[-_/]+", " ", markdown.lower()))
    pattern = re.compile(rf"(?<!\w){re.escape(street)}(?!\w)")
    street_address_pattern = re.compile(
        r"\b(?!0)\d{1,6}\s+[a-z0-9]*[a-z][a-z0-9]*(?:\s+[a-z0-9]+){0,4}\s+"
        rf"(?:{NORMALIZED_STREET_SUFFIX_PATTERN})\b"
    )
    for match in pattern.finditer(normalized):
        window = normalized[match.start():match.end() + 700]
        if city not in window:
            continue
        if not (zip_code and zip_code in window) and not (state and re.search(rf"\b{re.escape(state.lower())}\b", window)):
            continue
        for other in street_address_pattern.finditer(window, match.end() - match.start()):
            if normalize_street_address(other.group(0)) == street:
                continue
            locality = window[other.end():other.end() + 100]
            if not re.match(rf"[\s,;:\-]*{re.escape(city)}\b", locality):
                continue
            if not (zip_code and zip_code in locality) and not (state and re.search(rf"\b{re.escape(state.lower())}\b", locality)):
                continue
            window = window[:other.start()]
            break
        return window
    return ""


def _exact_result(result: dict, address: str) -> tuple[str, str] | None:
    provider = _provider(result.get("url"))
    street, city, state, zip_code = _address_identity(address)
    if not provider or not street or not city or (not state and not zip_code):
        return None
    text = _normalized_result_text(result)
    if not contains_exact_street(text, street) or city not in text:
        return None
    if not (zip_code and zip_code in text) and not (state and re.search(rf"\b{re.escape(state.lower())}\b", text)):
        return None
    entered_has_unit = bool(re.search(r"\b(?:apt|apartment|unit|suite)\b|#\s*\w+", street))
    if not entered_has_unit and re.search(r"\b(?:apt|apartment|suite)\s+\w+\b|\b(?<!\d )(?<!-)unit\s+\w+\b", text):
        return None
    return provider, " ".join((str(result.get("title") or ""),
                                str(result.get("snippet") or result.get("description") or ""),
                                _address_scoped_markdown(result, address)))


def _first_match(text: str, patterns: tuple[str, ...]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return re.sub(r"[,\s]", "", match.group(1))
    return ""


def _facts(text: str) -> dict[str, str]:
    normalized = re.sub(r"\s+", " ", text)
    facts = {
        "squareFeet": _first_match(normalized, (
            r"\b([1-9]\d{0,2}(?:[,\s]\d{3})+|[1-9]\d{2,4})\s*(?:(?:finished|total|heated|living)\s+)?(?:square\s*(?:feet|foot|ft\.?)|sq\.?\s*ft\.?|sqft)\b",
        )),
        "yearBuilt": _first_match(normalized, (
            r"\b(?:built\s+in|year\s+built\s*[:\-]?)\s*((?:17|18|19|20)\d{2})\b",
        )),
        "bedrooms": _first_match(normalized, (r"\b(\d{1,2})\s*(?:bedrooms?|beds?|bd)\b",)),
        "bathrooms": _first_match(normalized, (r"\b(\d{1,2}(?:\.\d)?)\s*(?:bathrooms?|baths?|ba)\b",)),
        "unitCount": _first_match(normalized, (r"\b(\d{1,2})[ -]unit\s+(?:multi[ -]?family|apartment|residential|building|property)\b",)),
    }
    types = (
        (r"\bmulti[ -]?family\b", "Multifamily"),
        (r"\bsingle[ -]?family\b", "Single Family Detached"),
        (r"\btown(?:home|house)\b", "Townhome"),
        (r"\bcondo(?:minium)?\b", "Condominium"),
        (r"\bduplex\b", "Duplex"),
    )
    facts["homeType"] = next((label for pattern, label in types if re.search(pattern, normalized, re.IGNORECASE)), "")
    return {field: value for field, value in facts.items() if value}


def _selected_value(evidence: list[tuple[str, str]]) -> tuple[str, list[str]]:
    counts = Counter(value for _, value in evidence)
    highest = max(counts.values())
    tied = {value for value, count in counts.items() if count == highest}
    ordered = sorted(evidence, key=lambda item: PROVIDER_PRIORITY.get(item[0], 99))
    selected = next(value for _, value in ordered if value in tied)
    providers = list(dict.fromkeys(provider for provider, value in ordered if value == selected))
    return selected, providers


@lru_cache(maxsize=1)
def _property_corrections() -> dict:
    try:
        value = json.loads(PROPERTY_CORRECTIONS_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def _apply_property_correction(home: PropertyInput, address: str) -> PropertyInput:
    street, city, state, zip_code = _address_identity(address)
    correction = _property_corrections().get("|".join((street, city, state, zip_code)))
    if not isinstance(correction, dict) or not isinstance(correction.get("facts"), dict):
        return home
    source = "Public records: " + str(correction.get("source") or "VPSF admin-verified property correction")[:280]
    allowed = {"homeType", "unitCount", "hvac", "hvacAge"}
    for field, value in correction["facts"].items():
        if field in allowed and isinstance(value, str) and value.strip() and len(value) <= 300:
            setattr(home, field, value.strip())
            home.provenance[field] = FieldProvenance(origin="imported", source=source)
    return home


def property_correction_for_address(address: str) -> PropertyInput | None:
    street, city, state, zip_code = _address_identity(address)
    if not _property_corrections().get("|".join((street, city, state, zip_code))):
        return None
    home = PropertyInput(
        address=street.title(), city=city.title(), state=state, zip=zip_code,
        homeType="Unknown", stories="", occupancy="", solar="Unknown", hers="Unknown",
        evReady="Unknown", fortified="Unknown", backup="Unknown", healthCert="Unknown",
        ventilation="Unknown", iaq="Unknown", daylighting="Unknown", carbonStrategy="Unknown",
        waterStandard="Unknown", leak="Unknown", reuse="Unknown", landscape="Unknown",
        pietim="Unknown", insurance="Unknown", maintenance="Unknown", transit="Unknown",
        greenspace="Unknown", amenities="Unknown", bike="Unknown",
        sourceNote="VPSF applied an admin-verified public-record correction for this exact property.",
    )
    return _apply_property_correction(home, address)


def property_from_search_results(address: str, data: object) -> PropertyInput | None:
    web = data.get("rows", []) if isinstance(data, dict) else []
    collected: dict[str, list[tuple[str, str]]] = defaultdict(list)
    matched_providers: list[str] = []
    for result in web if isinstance(web, list) else []:
        if not isinstance(result, dict):
            continue
        exact = _exact_result(result, address)
        if not exact:
            continue
        provider, text = exact
        matched_providers.append(provider)
        for field, value in _facts(text).items():
            collected[field].append((provider, value))
    if not collected:
        return None

    street, city, state, zip_code = _address_identity(address)
    selected: dict[str, str] = {}
    provenance: dict[str, FieldProvenance] = {}
    for field, evidence in collected.items():
        value, providers = _selected_value(evidence)
        selected[field] = value
        provenance[field] = FieldProvenance(origin="imported", source="Public listing metadata: " + ", ".join(providers))
    providers = list(dict.fromkeys(matched_providers))
    home = PropertyInput(
        address=street.title(), city=city.title(), state=state, zip=zip_code,
        squareFeet=selected.get("squareFeet", "Unknown"),
        yearBuilt=selected.get("yearBuilt", "Unknown"),
        bedrooms=selected.get("bedrooms", "Unknown"),
        bathrooms=selected.get("bathrooms", "Unknown"),
        unitCount=selected.get("unitCount", "Unknown"),
        homeType=selected.get("homeType", "Unknown"),
        stories="Unknown", garage="Unknown", lotSize="Unknown", occupancy="Unknown",
        provenance=provenance,
        sourceNote=("Exact-address public listing metadata contributed basic property facts from "
                    + ", ".join(providers) + ". These facts remain reviewable in the home form."),
    )
    home.provenance = {
        field: provenance.get(field, FieldProvenance())
        for field in PropertyInput.model_fields if field not in {"provenance", "sourceNote"}
    }
    return _apply_property_correction(home, address)


async def search_public_property(address: str, key: str, *, archived: bool = False) -> dict:
    if not key:
        return {}
    headers = {"Accept": "application/json", "Content-Type": "application/json", "Authorization": "Bearer " + key}
    body = {
        "q": f'"{address}" site:web.archive.org' if archived else f'"{address}" property',
        "rich": False,
        "deep": True,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(15, connect=5), follow_redirects=False, trust_env=False) as client:
        async with client.stream("POST", CRAWL4AI_SEARCH_URL, headers=headers, json=body) as response:
            response.raise_for_status()
            raw = bytearray()
            async for chunk in response.aiter_bytes():
                if len(raw) + len(chunk) > MAX_RESPONSE_BYTES:
                    raise ValueError("Crawl4AI response exceeds limit")
                raw.extend(chunk)
    payload = json.loads(raw)
    return payload if isinstance(payload, dict) else {}
