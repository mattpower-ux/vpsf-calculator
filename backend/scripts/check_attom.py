import sys

import httpx

from integration_env import load_backend_env, require_env


def main() -> None:
    load_backend_env()
    api_key = require_env("ATTOM_API_KEY")
    address1 = sys.argv[1] if len(sys.argv) > 1 else "1600 Pennsylvania Ave NW"
    address2 = sys.argv[2] if len(sys.argv) > 2 else "Washington, DC"

    response = httpx.get(
        "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile",
        headers={"apikey": api_key, "accept": "application/json"},
        params={"address1": address1, "address2": address2},
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    properties = data.get("property", [])
    if not properties:
        raise SystemExit(f"ATTOM responded, but no property was found for: {address1}, {address2}")

    print("ATTOM OK")
    print(f"Address: {address1}, {address2}")
    print(f"Records: {len(properties)}")


if __name__ == "__main__":
    main()
