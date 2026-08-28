from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.adapters import get_listing_adapter
from app.db import get_db
from app.ocr import extract_property_from_upload
from app.repositories import create_property, create_source_document
from app.schemas import ListingImportRequest, PropertyInput

router = APIRouter(prefix="/api/properties", tags=["properties"])


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
