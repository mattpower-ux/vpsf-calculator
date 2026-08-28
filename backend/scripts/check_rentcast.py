import sys

import httpx

from integration_env import load_backend_env, require_env


def main() -> None:
    load_backend_env()
    api_key = require_env("RENTCAST_API_KEY")
    address = " ".join(sys.argv[1:]) or "5500 Grand Lake Dr, San Antonio, TX 78244"

    response = httpx.get(
        "https://api.rentcast.io/v1/properties",
        headers={"Accept": "application/json", "X-Api-Key": api_key},
        params={"address": address, "limit": 1},
        timeout=20,
    )
    response.raise_for_status()
    records = response.json()
    if not records:
        raise SystemExit(f"RentCast responded, but no property was found for: {address}")

    record = records[0]
    print("RentCast OK")
    print(f"Address: {record.get('formattedAddress') or address}")
    print(f"Property type: {record.get('propertyType') or 'Unknown'}")
    print(f"Year built: {record.get('yearBuilt') or 'Unknown'}")
    print(f"Square feet: {record.get('squareFootage') or 'Unknown'}")


if __name__ == "__main__":
    main()
