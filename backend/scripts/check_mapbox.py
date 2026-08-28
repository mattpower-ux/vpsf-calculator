import sys

import httpx

from integration_env import load_backend_env, require_env


def main() -> None:
    load_backend_env()
    token = require_env("MAPBOX_ACCESS_TOKEN")
    query = " ".join(sys.argv[1:]) or "1600 Pennsylvania Ave NW, Washington, DC"

    response = httpx.get(
        "https://api.mapbox.com/search/geocode/v6/forward",
        params={"q": query, "country": "us", "limit": 1, "access_token": token},
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    features = data.get("features", [])
    if not features:
        raise SystemExit(f"Mapbox responded, but no match was found for: {query}")

    match = features[0]
    print("Mapbox OK")
    print(f"Query: {query}")
    print(f"Match: {match.get('properties', {}).get('full_address') or match.get('properties', {}).get('name')}")


if __name__ == "__main__":
    main()
