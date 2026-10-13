import json
from datetime import timedelta

import httpx
from sqlalchemy.orm import Session

from app.models import WalkabilityCacheRecord, utc_now
from app.schemas import WalkabilityEvidence


SOURCE = "https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0"


def unverified(latitude: float | None, longitude: float | None) -> WalkabilityEvidence:
    return WalkabilityEvidence(latitude=latitude, longitude=longitude)


async def fetch_walkability(latitude: float, longitude: float, client: httpx.AsyncClient) -> WalkabilityEvidence:
    params = {
        "geometry": json.dumps({"x": longitude, "y": latitude, "spatialReference": {"wkid": 4326}}),
        "geometryType": "esriGeometryPoint",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": "4326",
        "outFields": "NatWalkInd,GEOID20",
        "returnGeometry": "false",
        "f": "json",
    }
    try:
        response = await client.get(f"{SOURCE}/query", params=params)
        response.raise_for_status()
        features = response.json().get("features", [])
        if len(features) != 1:
            return unverified(latitude, longitude)
        attributes = features[0].get("attributes", {})
        value = attributes.get("NatWalkInd")
        block_group = attributes.get("GEOID20")
        if not block_group or not isinstance(value, (int, float)) or not 1 <= value <= 20:
            return unverified(latitude, longitude)
        return WalkabilityEvidence(status="available", value=float(value), blockGroup=str(block_group), latitude=latitude, longitude=longitude, retrievedAt=utc_now().isoformat())
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return unverified(latitude, longitude)


async def cached_walkability(db: Session, latitude: float | None, longitude: float | None) -> WalkabilityEvidence:
    if latitude is None or longitude is None:
        return unverified(latitude, longitude)
    key = f"{latitude:.6f},{longitude:.6f}"
    record = db.get(WalkabilityCacheRecord, key)
    if record:
        when = record.retrieved_at
        if when.tzinfo is None:
            from datetime import timezone
            when = when.replace(tzinfo=timezone.utc)
        if when >= utc_now() - timedelta(days=30):
            return WalkabilityEvidence.model_validate(record.evidence)
    async with httpx.AsyncClient(timeout=4.0) as client:
        result = await fetch_walkability(latitude, longitude, client)
    if result.status == "available":
        if record:
            record.evidence = result.model_dump()
            record.retrieved_at = utc_now()
        else:
            db.add(WalkabilityCacheRecord(key=key, evidence=result.model_dump()))
        db.commit()
    return result
