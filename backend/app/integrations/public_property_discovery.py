"""Exact-address public web discovery for basic property facts.

This integration uses search-result metadata rather than scraping listing pages.
It accepts facts only from known property sources whose result text contains the
entered street, locality, and state or ZIP.  It never treats nearby homes or
unit listings as evidence for a whole-building address.
"""
from collections import Counter, defaultdict
import json
import re
from urllib.parse import urlsplit

import httpx

from app.address_normalization import contains_exact_street, normalize_state, normalize_street_address, normalize_text, normalize_zip
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
    raw = f"{result.get('title', '')} {result.get('snippet', result.get('description', ''))} {result.get('url', '')}".lower()
    return normalize_street_address(re.sub(r"[-_/]+", " ", raw))


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
    if not entered_has_unit and re.search(r"\b(?:apt|apartment|unit|suite)\s+\w+\b", text):
        return None
    return provider, " ".join((str(result.get("title") or ""), str(result.get("snippet") or result.get("description") or "")))


def _first_match(text: str, patterns: tuple[str, ...]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).replace(",", "")
    return ""


def _facts(text: str) -> dict[str, str]:
    normalized = re.sub(r"\s+", " ", text)
    facts = {
        "squareFeet": _first_match(normalized, (
            r"\b([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{2,4})\s*(?:square\s*feet|square\s*foot|sq\.?\s*ft\.?|sqft)\b",
        )),
        "yearBuilt": _first_match(normalized, (
            r"\b(?:built\s+in|year\s+built\s*[:\-]?)\s*((?:17|18|19|20)\d{2})\b",
        )),
        "bedrooms": _first_match(normalized, (r"\b(\d{1,2})\s*(?:bedrooms?|beds?|bd)\b",)),
        "bathrooms": _first_match(normalized, (r"\b(\d{1,2}(?:\.\d)?)\s*(?:bathrooms?|baths?|ba)\b",)),
    }
    types = (
        (r"\bmulti[ -]?family\b", "Multi-Family"),
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
    return home


async def search_public_property(address: str, key: str, *, archived: bool = False) -> dict:
    if not key:
        return {}
    headers = {"Accept": "application/json", "Content-Type": "application/json", "Authorization": "Bearer " + key}
    body = {
        "q": f'"{address}" site:web.archive.org' if archived else f'"{address}" property',
        "rich": False,
        "deep": False,
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
