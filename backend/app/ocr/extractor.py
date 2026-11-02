from fastapi import UploadFile, HTTPException
import base64
from io import BytesIO
from pathlib import Path
import httpx
import re
from app.config import get_settings

from app.schemas import PropertyInput


async def extract_property_from_upload(file: UploadFile) -> PropertyInput:
    filename = file.filename or "uploaded-listing"
    contents = await file.read(10 * 1024 * 1024 + 1)
    if not contents or len(contents) > 10 * 1024 * 1024:
        raise HTTPException(413, "Choose a non-empty file smaller than 10 MB.")
    suffix = Path(filename).suffix.lower()
    types = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".txt": "text/plain"}
    if suffix not in types:
        raise HTTPException(415, "Supported files: PDF, JPG, PNG, or TXT.")
    text = ""
    if suffix == ".txt":
        try:
            text = contents.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(422, "The text file must use UTF-8 encoding.")
    elif suffix == ".pdf":
        from pypdf import PdfReader
        try:
            reader = PdfReader(BytesIO(contents))
            if reader.is_encrypted:
                raise ValueError("encrypted")
            if len(reader.pages) > 30:
                raise HTTPException(413, "Please upload at most 30 pages at a time.")
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(422, "This PDF is damaged or password-protected. Export an unlocked PDF and retry.")
    elif not ((suffix == ".png" and contents.startswith(b"\x89PNG\r\n\x1a\n")) or (suffix in {".jpg", ".jpeg"} and contents.startswith(b"\xff\xd8\xff"))):
        raise HTTPException(422, "The file does not contain a valid JPG or PNG image.")
    if not text.strip():
        settings = get_settings()
        if settings.ocr_provider != "mistral" or not settings.mistral_api_key:
            raise HTTPException(503, "Photo and scanned-PDF reading is not configured yet. Try a PDF with selectable text, or enter the details manually.")
        kind = "document_url" if suffix == ".pdf" else "image_url"
        data_url = f"data:{types[suffix]};base64,{base64.b64encode(contents).decode()}"
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post("https://api.mistral.ai/v1/ocr", headers={"Authorization": f"Bearer {settings.mistral_api_key}"}, json={"model": "mistral-ocr-latest", "document": {"type": kind, kind: data_url}})
                response.raise_for_status()
                text = "\n".join(page.get("markdown", "") for page in response.json().get("pages", []))
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            raise HTTPException(502, "The document reader could not process this file. Please retry.")
    text = re.sub(r"[*#|]", " ", text)[:200000]

    address_match = re.search(r"address[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    sqft_match = re.search(r"(\d[\d,]*)\s*(?:sq\.?\s*ft|square\s*feet)", text, re.IGNORECASE)
    year_match = re.search(r"(?:built|year built)[:\s]+(19\d{2}|20\d{2})", text, re.IGNORECASE)
    beds_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)", text, re.IGNORECASE)
    baths_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)", text, re.IGNORECASE)

    return PropertyInput(
        address=address_match.group(1).strip() if address_match else "",
        squareFeet=sqft_match.group(1).replace(",", "") if sqft_match else "",
        yearBuilt=year_match.group(1) if year_match else "",
        bedrooms=beds_match.group(1) if beds_match else "",
        bathrooms=baths_match.group(1) if baths_match else "",
        sourceNote="Extracted details require your review. No score has been changed.",
    )
