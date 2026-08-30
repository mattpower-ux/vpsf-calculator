from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from httpx import HTTPError, HTTPStatusError
from sqlalchemy.orm import Session

from app.adapters import get_listing_adapter
from app.config import Settings, get_settings
from app.db import get_db
from app.integrations.climate import estimate_climate_zone
from app.integrations.fema import FemaFloodClient, flood_label
from app.integrations.mapbox import MapboxClient
from app.integrations.attom import AttomClient
from app.integrations.rentcast import RentCastClient
from app.ocr import extract_property_from_upload
from app.repositories import create_property, create_source_document, get_api_usage, reserve_api_call
from app.schemas import GeocodeRequest, GeocodeResponse, ListingImportRequest, PropertyInput, RiskEnrichmentRequest, RiskEnrichmentResponse

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


def known_or_unknown(value: str) -> str:
    return value or "Unknown"


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
        squareFeet=known_or_unknown(first_value(record, "squareFootage", "livingArea")),
        yearBuilt=known_or_unknown(first_value(record, "yearBuilt")),
        homeType=first_value(record, "propertyType") or "Unknown",
        stories=first_value(features, "floorCount") or "Unknown",
        bedrooms=known_or_unknown(first_value(record, "bedrooms")),
        bathrooms=known_or_unknown(first_value(record, "bathrooms")),
        garage=f"{garage_spaces} Car Garage" if garage_spaces else known_or_unknown(first_value(features, "garageType")),
        lotSize=acres_from_square_feet(lot_size) if lot_size else "Unknown",
        occupancy="Owner Occupied",
        hvac=heating_type or cooling_type or "Unknown",
        roof=first_value(features, "roofType") or "Unknown",
        sourceNote="RentCast returned public property facts. Energy, resilience, water, health, and upgrade details still need documents, photos, or homeowner confirmation.",
    )
    return property_input


def nested_value(record: dict, *path: str) -> object:
    current: object = record
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def first_nested_value(record: dict, *paths: tuple[str, ...]) -> str:
    for path in paths:
        value = nested_value(record, *path)
        if value is not None and value != "":
            return str(value)
    return ""


def split_address_for_attom(address: str) -> tuple[str, str]:
    parts = [part.strip() for part in address.split(",") if part.strip()]
    if len(parts) >= 3:
        return parts[0], f"{parts[1]}, {parts[2]}"
    if len(parts) == 2:
        return parts[0], parts[1]
    return address.strip(), ""


def property_input_from_attom(record: dict) -> PropertyInput:
    address = record.get("address") or {}
    summary = record.get("summary") or {}
    building = record.get("building") or {}
    size = building.get("size") or {}
    rooms = building.get("rooms") or {}
    lot = record.get("lot") or {}
    assessment = record.get("assessment") or {}
    tax = assessment.get("tax") or {}
    assessed = assessment.get("assessed") or {}
    sale = record.get("sale") or {}
    amount = sale.get("amount") or {}

    lot_acres = first_value(lot, "lotsize1", "lotSize1")
    lot_square_feet = first_value(lot, "lotsize2", "lotSize2")
    lot_size = f"{lot_acres} acres" if lot_acres else acres_from_square_feet(lot_square_feet)
    heating = first_nested_value(
        record,
        ("utilities", "heatingType"),
        ("utilities", "heatingtype"),
        ("building", "interior", "heatingtype"),
    )
    cooling = first_nested_value(
        record,
        ("utilities", "coolingType"),
        ("utilities", "coolingtype"),
        ("building", "interior", "coolingtype"),
    )
    roof = first_nested_value(
        record,
        ("building", "construction", "roofCover"),
        ("building", "construction", "roofcover"),
        ("building", "construction", "roofType"),
        ("building", "construction", "rooftype"),
    )
    garage_spaces = first_nested_value(record, ("building", "parking", "prkgSpaces"), ("building", "parking", "prkgSize"))

    note_parts = ["ATTOM returned public property records."]
    if assessed or tax:
        note_parts.append("Assessment/tax data was available.")
    if amount:
        note_parts.append("Sale/valuation context was available.")

    return PropertyInput(
        address=first_value(address, "line1", "oneLine"),
        city=first_value(address, "locality"),
        state=normalize_attom_state(first_value(address, "countrySubd")),
        zip=first_value(address, "postal1", "postalCode"),
        squareFeet=known_or_unknown(first_value(size, "universalsize", "livingSize", "livingsize", "bldgsize", "grossSize")),
        yearBuilt=known_or_unknown(first_value(summary, "yearbuilt", "yearBuilt")),
        homeType=first_value(summary, "proptype", "propertyType", "propsubtype") or "Unknown",
        stories=first_value(building, "summarylevels", "levels") or "Unknown",
        bedrooms=known_or_unknown(first_value(rooms, "beds", "bedrooms")),
        bathrooms=known_or_unknown(first_value(rooms, "bathstotal", "bathsTotal", "bathrooms")),
        garage=f"{garage_spaces} Car Garage" if garage_spaces else "Unknown",
        lotSize=lot_size or "Unknown",
        occupancy="Owner Occupied",
        hvac=heating or cooling or "Unknown",
        roof=roof or "Unknown",
        sourceNote=" ".join(note_parts),
    )


def normalize_attom_state(value: str) -> str:
    return value.upper() if len(value) == 2 else value


def attom_record_from_response(data: dict) -> dict:
    records = data.get("property") or []
    if not records:
        raise HTTPException(status_code=404, detail="No ATTOM property record found")
    return records[0]


@router.post("/attom", response_model=PropertyInput)
async def enrich_property_with_attom(
    request: GeocodeRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> PropertyInput:
    client = AttomClient(settings.attom_api_key)
    if not client.is_configured:
        raise HTTPException(status_code=503, detail="ATTOM_API_KEY is not configured")

    usage = get_api_usage(db, "attom")
    if usage.count >= settings.attom_monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=f"ATTOM monthly pull limit reached: {usage.count}/{settings.attom_monthly_limit}",
        )

    address1, address2 = split_address_for_attom(request.address)
    reserve_api_call(db, "attom", settings.attom_monthly_limit)

    try:
        data = await client.property_detail(address1, address2)
    except HTTPStatusError as error:
        detail = error.response.text[:300] if error.response is not None else ""
        raise HTTPException(
            status_code=502,
            detail=f"ATTOM property request failed with status {error.response.status_code}: {detail}",
        ) from error
    except HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"ATTOM property request failed before a response was received: {type(error).__name__}",
        ) from error

    return property_input_from_attom(attom_record_from_response(data))


@router.post("/rentcast", response_model=PropertyInput)
async def enrich_property_with_rentcast(
    request: GeocodeRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> PropertyInput:
    client = RentCastClient(settings.rentcast_api_key)
    if not client.is_configured:
        raise HTTPException(status_code=503, detail="RENTCAST_API_KEY is not configured")

    usage = get_api_usage(db, "rentcast")
    if usage.count >= settings.rentcast_monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=f"RentCast monthly pull limit reached: {usage.count}/{settings.rentcast_monthly_limit}",
        )

    reserve_api_call(db, "rentcast", settings.rentcast_monthly_limit)

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


@router.post("/risk", response_model=RiskEnrichmentResponse)
async def enrich_property_risk(request: RiskEnrichmentRequest) -> RiskEnrichmentResponse:
    climate_zone = estimate_climate_zone(request.state, request.zip)
    fema_attributes = None
    flood = "Unknown"

    if request.latitude is not None and request.longitude is not None:
        try:
            fema_attributes = await FemaFloodClient().flood_zone_for_point(request.latitude, request.longitude)
            flood = flood_label(fema_attributes)
        except HTTPError:
            flood = "FEMA lookup unavailable"

    return RiskEnrichmentResponse(
        climateZone=climate_zone,
        flood=flood,
        fema=fema_attributes,
        sourceNote="Climate zone is estimated from location. FEMA flood lookup is based on mapped public flood-hazard layers when coordinates are available.",
    )


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
