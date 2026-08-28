from fastapi import UploadFile
import re

from app.schemas import PropertyInput


async def extract_property_from_upload(file: UploadFile) -> PropertyInput:
    filename = file.filename or "uploaded-listing"
    contents = await file.read()
    text = contents.decode("utf-8", errors="ignore")

    address_match = re.search(r"address[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    sqft_match = re.search(r"(\d[\d,]*)\s*(?:sq\.?\s*ft|square\s*feet)", text, re.IGNORECASE)
    year_match = re.search(r"(?:built|year built)[:\s]+(19\d{2}|20\d{2})", text, re.IGNORECASE)
    beds_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)", text, re.IGNORECASE)
    baths_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)", text, re.IGNORECASE)

    return PropertyInput(
        address=address_match.group(1).strip() if address_match else filename,
        squareFeet=sqft_match.group(1).replace(",", "") if sqft_match else "",
        yearBuilt=year_match.group(1) if year_match else "",
        bedrooms=beds_match.group(1) if beds_match else "",
        bathrooms=baths_match.group(1) if baths_match else "",
        sourceNote="Basic text extraction completed. Image/PDF OCR provider still needs to be configured.",
    )
