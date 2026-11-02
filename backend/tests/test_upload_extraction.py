import asyncio
from io import BytesIO
import pytest
from fastapi import HTTPException, UploadFile
from app.ocr.extractor import extract_property_from_upload

def test_text_extracts_only_present_facts():
    result = asyncio.run(extract_property_from_upload(UploadFile(filename="home.txt", file=BytesIO(b"Address: 123 Example Street\nBuilt: 2001\n1,250 sq ft\n3 beds"))))
    assert result.squareFeet == "1250"
    assert result.address == "123 Example Street"
    assert result.bathrooms == ""

def test_unsupported_file_is_rejected():
    with pytest.raises(HTTPException) as error:
        asyncio.run(extract_property_from_upload(UploadFile(filename="bad.exe", file=BytesIO(b"binary"))))
    assert error.value.status_code == 415

def test_empty_file_is_rejected():
    with pytest.raises(HTTPException):
        asyncio.run(extract_property_from_upload(UploadFile(filename="empty.pdf", file=BytesIO())))

def make_pdf(text=None):
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    if text:
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(f'BT /F1 12 Tf 50 700 Td ({text}) Tj ET'.encode())
        page[NameObject('/Contents')] = writer._add_object(stream)
    result = BytesIO()
    writer.write(result)
    result.seek(0)
    return result

def test_selectable_pdf_needs_no_ocr(monkeypatch):
    monkeypatch.setattr('app.ocr.extractor.get_settings', lambda: pytest.fail('PDF text must not call paid OCR'))
    result = asyncio.run(extract_property_from_upload(UploadFile(filename='listing.pdf', file=make_pdf('1,800 sq ft 4 beds'))))
    assert result.squareFeet == '1800'
    assert result.bedrooms == '4'

def test_scanned_pdf_reports_missing_key(monkeypatch):
    from types import SimpleNamespace
    monkeypatch.setattr('app.ocr.extractor.get_settings', lambda: SimpleNamespace(ocr_provider='mistral', mistral_api_key=''))
    with pytest.raises(HTTPException) as error:
        asyncio.run(extract_property_from_upload(UploadFile(filename='scan.pdf', file=make_pdf())))
    assert error.value.status_code == 503

def test_photo_uses_mistral_and_returns_review_facts(monkeypatch):
    from types import SimpleNamespace
    import httpx
    monkeypatch.setattr('app.ocr.extractor.get_settings', lambda: SimpleNamespace(ocr_provider='mistral', mistral_api_key='test-only'))
    async def post(self, url, **kwargs):
        assert kwargs['json']['document']['type'] == 'image_url'
        assert kwargs['json']['document']['image_url'].startswith('data:image/png;base64,')
        return httpx.Response(200, request=httpx.Request('POST', url), json={'pages':[{'markdown':'Built: 2005\n2 baths'}]})
    monkeypatch.setattr(httpx.AsyncClient, 'post', post)
    result = asyncio.run(extract_property_from_upload(UploadFile(filename='label.png', file=BytesIO(b'\x89PNG\r\n\x1a\nsynthetic'))))
    assert result.yearBuilt == '2005'
    assert result.bathrooms == '2'

def test_broken_pdf_is_rejected():
    with pytest.raises(HTTPException) as error:
        asyncio.run(extract_property_from_upload(UploadFile(filename='bad.pdf', file=BytesIO(b'not a pdf'))))
    assert error.value.status_code == 422
