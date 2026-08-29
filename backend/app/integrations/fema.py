from typing import Any

import httpx


class FemaFloodClient:
    query_url = (
        "https://services.arcgis.com/2gdL2gxYNFY2TOUb/ArcGIS/rest/services/"
        "FEMA_National_Flood_Hazard_Layer/FeatureServer/0/query"
    )

    async def flood_zone_for_point(self, latitude: float, longitude: float) -> dict[str, Any] | None:
        geometry = f"{longitude},{latitude}"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                self.query_url,
                params={
                    "f": "json",
                    "where": "1=1",
                    "outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DEPTH",
                    "returnGeometry": "false",
                    "geometry": geometry,
                    "geometryType": "esriGeometryPoint",
                    "inSR": "4326",
                    "spatialRel": "esriSpatialRelIntersects",
                },
            )
            response.raise_for_status()
            features = response.json().get("features", [])
            if not features:
                return None
            return features[0].get("attributes", {})


def flood_label(attributes: dict[str, Any] | None) -> str:
    if not attributes:
        return "Unknown"

    zone = attributes.get("FLD_ZONE") or ""
    sfha = attributes.get("SFHA_TF") or ""

    if zone in {"A", "AE", "AH", "AO", "A99", "AR", "V", "VE"} or sfha == "T":
        return f"FEMA Zone {zone} - Special Flood Hazard Area"
    if zone in {"X", "X500", "C"}:
        return f"FEMA Zone {zone} - Lower Mapped Flood Risk"
    if zone:
        return f"FEMA Zone {zone}"
    return "Unknown"
