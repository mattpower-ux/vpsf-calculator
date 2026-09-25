import asyncio
import logging
import math

import httpx
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import WildfireRiskCacheRecord, utc_now
from app.schemas import WildfireRisk

logger = logging.getLogger(__name__)
DATASET_VERSION = "wrc-2024"
SERVICE_ROOT = "https://services1.arcgis.com/gGHDlz6USftL5Pau/arcgis/rest/services"
LAYERS = (
    ("community", f"{SERVICE_ROOT}/place_boundaries_conus_ak_hi/FeatureServer/0/query"),
    ("county", f"{SERVICE_ROOT}/county_boundaries_conus_ak_hi/FeatureServer/0/query"),
)


def national_percentile(value: object) -> float | None:
    # The published RISK_NATIO field is a percentage string, not a burn probability.
    if not isinstance(value, str) or not value.strip().endswith("%"):
        return None
    try:
        percentile = float(value.strip()[:-1])
    except ValueError:
        return None
    return percentile if math.isfinite(percentile) and 0 <= percentile <= 100 else None


def risk_level(percentile: float) -> str:
    # Official WRC web-map "National Risk Rank" expression: <40, <70, <90, >=90.
    if percentile < 40:
        return "Low"
    if percentile < 70:
        return "Medium"
    if percentile < 90:
        return "High"
    return "Very High"


class UsfsWildfireClient:
    async def risk_for_point(self, latitude: float, longitude: float) -> WildfireRisk:
        failed = False
        async with httpx.AsyncClient(timeout=8) as client:
            for area_type, url in LAYERS:
                fields = "NAME,STUSPS,NAMELSAD,GEOID,vintage,RISK_NATIO"
                if area_type == "community":
                    fields += ",exclude"
                try:
                    response = await client.get(url, params={
                        "f": "json", "where": "1=1", "outFields": fields,
                        "returnGeometry": "false", "geometry": f"{longitude},{latitude}",
                        "geometryType": "esriGeometryPoint", "inSR": "4326",
                        "spatialRel": "esriSpatialRelIntersects",
                    })
                    response.raise_for_status()
                    payload = response.json()
                    if not isinstance(payload, dict) or "error" in payload or not isinstance(payload.get("features"), list):
                        raise ValueError("Invalid USFS ArcGIS response")
                    features = payload["features"]
                    # An ambiguous boundary match must not silently select a different area.
                    if len(features) != 1:
                        continue
                    attributes = features[0].get("attributes")
                    if not isinstance(attributes, dict):
                        raise ValueError("Missing USFS attributes")
                    if str(attributes.get("exclude", 0)).strip() not in {"0", "0.0", "None", ""}:
                        continue
                    percentile = national_percentile(attributes.get("RISK_NATIO"))
                    if percentile is None:
                        continue
                    name = attributes.get("NAMELSAD") or attributes.get("NAME")
                    area_id = attributes.get("GEOID")
                    if not name or not area_id:
                        raise ValueError("Missing USFS area identity")
                    return WildfireRisk(
                        status="available", level=risk_level(percentile), nationalPercentile=percentile,
                        areaName=", ".join(filter(None, [name, attributes.get("STUSPS")])),
                        areaId=area_id, areaType=area_type,
                        boundaryVintage=attributes.get("vintage") or "",
                        latitude=latitude, longitude=longitude, retrievedAt=utc_now().isoformat(),
                    )
                except (httpx.HTTPError, ValueError, TypeError, AttributeError):
                    failed = True
                    logger.warning("USFS %s lookup unavailable", area_type)
        return WildfireRisk(
            status="unavailable" if failed else "no_data", latitude=latitude,
            longitude=longitude, retrievedAt=utc_now().isoformat(),
        )


async def cached_wildfire_risk(db: Session, latitude: float | None, longitude: float | None) -> WildfireRisk:
    if latitude is None or longitude is None:
        return WildfireRisk()
    latitude, longitude = round(latitude, 6), round(longitude, 6)
    key = f"{DATASET_VERSION}:{latitude:.6f}:{longitude:.6f}"
    record = db.get(WildfireRiskCacheRecord, key)
    if record:
        try:
            return WildfireRisk.model_validate(record.result)
        except ValidationError:
            logger.warning("Ignoring invalid stored USFS result")
    try:
        result = await asyncio.wait_for(UsfsWildfireClient().risk_for_point(latitude, longitude), timeout=18)
    except (TimeoutError, httpx.HTTPError, ValueError):
        return WildfireRisk(status="unavailable", latitude=latitude, longitude=longitude)
    # Outages are retryable; never save them as permanently low or missing risk.
    if result.status in {"available", "no_data"}:
        if record:
            record.result = result.model_dump(mode="json")
        else:
            db.add(WildfireRiskCacheRecord(key=key, result=result.model_dump(mode="json")))
        try:
            db.commit()
        except IntegrityError:
            # Another request may have saved this coordinate while we awaited USFS.
            db.rollback()
    return result
