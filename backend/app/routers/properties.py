from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from httpx import HTTPError, HTTPStatusError
from sqlalchemy.orm import Session

from app.adapters import get_listing_adapter
from app.config import Settings, get_settings
from app.db import get_db
from app.integrations.mapbox import MapboxClient
from app.integrations.rentcast import RentCastClient
from app.ocr import extract_property_from_upload
from app.repositories import create_property, create_source_document
from app.schemas import GeocodeRequest, GeocodeResponse, ListingImportRequest, PropertyInput

router = APIRouter(prefix="/api/properties", tags=["properties"])


def mapbox_context_value(context: dict, key: str) -> str:
    value = context.get(key)
    if isinstance(value, dict):
        return value.get("name") or value.get("mapbox_id") or ""
    return ""


def geocode_response_from_mapbox(query: str, data: dict) -> GeocodeResponse:
    features = data.get("features", [])
    if not features:
        raise HTTPException(status_code=404, detail="No address match found")

    feature = features[0]
    properties = feature.get("properties", {})
    context = properties.get("context", {})
    coordinates = properties.get("coordinates", {})
    geometry_coordinates = feature.get("geometry", {}).get("coordinates", [])

    longitude = coordinates.get("longitude")
    latitude = coordinates.get("latitude")
    if (longitude is None or latitude is None) and len(geometry_coordinates) >= 2:
        longitude = geometry_coordinates[0]
        latitude = geometry_coordinates[1]

    return GeocodeResponse(
        query=query,
        normalizedAddress=properties.get("full_address") or properties.get("name") or query,
        address=properties.get("address") or properties.get("name") or "",
        city=mapbox_context_value(context, "place"),
        state=mapbox_context_value(context, "region"),
        zip=mapbox_context_value(context, "postcode"),
        latitude=latitude,
        longitude=longitude,
        confidence=properties.get("match_code", {}).get("confidence"),
    )


@router.post("/geocode", response_model=GeocodeResponse)
async def geocode_property(
    request: GeocodeRequest,
    settings: Settings = Depends(get_settings),
) -> GeocodeResponse:
    client = MapboxClient(settings.mapbox_access_token)
    if not client.is_configured:
        raise HTTPException(status_code=503, detail="MAPBOX_ACCESS_TOKEN is not configured")

    try:
        data = await client.geocode(request.address)
    except HTTPError as error:
        raise HTTPException(status_code=502, detail="Mapbox geocoding request failed") from error

    return geocode_response_from_mapbox(request.address, data)


def first_value(record: dict, *keys: str) -> str:
    for key in keys:
        value = record.get(key)
        if value is not None and value != "":
            return str(value)
    return ""


def acres_from_square_feet(value: object) -> str:
    if value is None or value == "":
        return ""
    try:
        acres = float(value) / 43560
    except (TypeError, ValueError):
        return str(value)
    return f"{acres:.2f} acres"


def property_input_from_rentcast(record: dict) -> PropertyInput:
    features = record.get("features") or {}
    lot_size = first_value(record, "lotSize")
    garage_spaces = first_value(features, "garageSpaces")
    heating_type = first_value(features, "heatingType")
    cooling_type = first_value(features, "coolingType")
    property_input = PropertyInput(
        address=first_value(record, "addressLine1", "formattedAddress"),
        city=first_value(record, "city"),
        state=first_value(record, "state"),
        zip=first_value(record, "zipCode", "zipcode"),
        squareFeet=first_value(record, "squareFootage", "livingArea"),
        yearBuilt=first_value(record, "yearBuilt"),
        homeType=first_value(record, "propertyType") or "Unknown",
        stories=first_value(features, "floorCount") or "Unknown",
        bedrooms=first_value(record, "bedrooms"),
        bathrooms=first_value(record, "bathrooms"),
        garage=f"{garage_spaces} Car Garage" if garage_spaces else first_value(features, "garageType"),
        lotSize=acres_from_square_feet(lot_size) if lot_size else "",
        occupancy="Owner Occupied",
        hvac=heating_type or cooling_type or "Unknown",
        roof=first_value(features, "roofType") or "Unknown",
        sourceNote="RentCast returned public property facts. Energy, resilience, water, health, and upgrade details still need documents, photos, or homeowner confirmation.",
    )
    return property_input


@router.post("/rentcast", response_model=PropertyInput)
async def enrich_property_with_rentcast(
    request: GeocodeRequest,
    settings: Settings = Depends(get_settings),
) -> PropertyInput:
    client = RentCastClient(settings.rentcast_api_key)
    if not client.is_configured:
        raise HTTPException(status_code=503, detail="RENTCAST_API_KEY is not configured")

    try:
        records = await client.property_by_address(request.address)
    except HTTPStatusError as error:
        detail = error.response.text[:300] if error.response is not None else ""
        raise HTTPException(
            status_code=502,
            detail=f"RentCast property request failed with status {error.response.status_code}: {detail}",
        ) from error
    except HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"RentCast property request failed before a response was received: {type(error).__name__}",
        ) from error

    if not records:
        raise HTTPException(status_code=404, detail="No RentCast property record found")

    return property_input_from_rentcast(records[0])


@router.post("/manual", response_model=PropertyInput)
async def create_manual_property(property_input: PropertyInput, db: Session = Depends(get_db)) -> PropertyInput:
    record = create_property(db, property_input, source="manual")
    property_input.sourceNote = f"Saved manual property #{record.id}."
    return property_input


@router.post("/import", response_model=PropertyInput)
async def import_property(request: ListingImportRequest, db: Session = Depends(get_db)) -> PropertyInput:
    adapter = get_listing_adapter(request.source)
    property_input = await adapter.fetch(request)
    identifier = request.listingId or request.url or request.address
    create_property(db, property_input, source=request.source, source_identifier=identifier)
    return property_input


@router.post("/ocr", response_model=PropertyInput)
async def import_property_from_ocr(file: UploadFile = File(...), db: Session = Depends(get_db)) -> PropertyInput:
    property_input = await extract_property_from_upload(file)
    property_record = create_property(db, property_input, source="ocr", source_identifier=file.filename)
    create_source_document(
        db,
        property_id=property_record.id,
        filename=file.filename or "uploaded-listing",
        content_type=file.content_type or "",
        extracted_facts=property_input.model_dump(),
        confidence=35,
    )
    property_input.sourceNote = f"Saved OCR upload as property #{property_record.id}; extraction needs review."
    return property_input
