import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.article_reader import document_shell, extract_article, fetch_article, normalize_article_url
from app.db import get_db
from app.models import ArticleCacheRecord


router = APIRouter(prefix="/api/articles", tags=["articles"])
READER_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://www.greenbuildermedia.com https://greenbuildermedia.com https://fonts.googleapis.com; img-src https: data:; font-src https: data:; media-src https:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
}


@router.get("/read", response_class=HTMLResponse)
async def read_article(url: str = Query(max_length=2000), db: Session = Depends(get_db)) -> HTMLResponse:
    try:
        source_url = normalize_article_url(url)
    except ValueError:
        return HTMLResponse("<h1>Article unavailable</h1><p>A Green Builder Media article URL is required.</p>", status_code=400, headers=READER_HEADERS)

    cached = db.get(ArticleCacheRecord, source_url)
    if cached:
        return HTMLResponse(cached.document, headers={**READER_HEADERS, "X-Article-Cache": "HIT"})

    try:
        page, final_url = await fetch_article(source_url)
        document = extract_article(page, final_url)
    except (httpx.HTTPError, ValueError):
        content = '<h1>Article temporarily unavailable</h1><p>The clean article could not be loaded. Please try again or read the original below.</p><p><a href="">Try again</a></p>'
        return HTMLResponse(document_shell("Article unavailable", content, source_url), status_code=502, headers=READER_HEADERS)

    db.add(ArticleCacheRecord(url=source_url, document=document))
    try:
        db.commit()
    except IntegrityError:
        # Another reader may have cached the same article while it was fetched.
        db.rollback()
    return HTMLResponse(document, headers={**READER_HEADERS, "X-Article-Cache": "MISS"})
