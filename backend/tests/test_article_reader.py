import asyncio

import httpx
import pytest
from bs4 import BeautifulSoup
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import article_reader
from app.article_reader import extract_article, normalize_article_url
from app.db import get_db
from app.models import ArticleCacheRecord
from app.routers import articles


SOURCE = "https://www.greenbuildermedia.com/blog/test-ventilation"
PAGE = '''<html><head>
<link rel="stylesheet" href="/hubfs/hub_generated/template_assets/1/template_blog.min.css">
<script src="/chatbot.js"></script></head><body>
<nav>Menu</nav><img alt="Site logo" src="/logo.png"><aside>Banner advertising</aside>
<article class="blog-post"><div class="blog-post__timestamp"><svg><title>calendar icon</title></svg>Jul 28, 2026</div>
<div class="blog-post__tags">Green topic buttons</div><h1>Ventilation &amp; Comfort</h1>
<div class="post-share">Share buttons</div><div class="blog-post__body">
<span id="hs_cos_wrapper_post_body"><h2>How it works</h2>
<p style="color: red; position: fixed" onclick="alert(1)">Fresh <strong>air</strong>.</p>
<img src="/hubfs/air.jpg" alt="Ventilation diagram" onerror="alert(1)" width="1200">
<table><tr><td>Balanced</td><td>Exhaust</td></tr></table>
<a href="/blog/another-article">Related article</a><a href="javascript:alert(1)">Unsafe</a>
<div class="hs-embed-wrapper"><div><iframe src="https://www.youtube.com/embed/example" title="Video"></iframe></div></div>
<iframe src="https://evil.example/chatbot"></iframe><script>alert(1)</script>
<div id="deepthink-launcher">Floating chatbot</div></span></div>
<footer>Unrelated footer</footer></article></body></html>'''


def test_clean_article_preserves_content_and_removes_site_controls():
    document = extract_article(PAGE, SOURCE)
    soup = BeautifulSoup(document, "html.parser")
    assert soup.h1.text == "Ventilation & Comfort"
    assert soup.time.text == "Jul 28, 2026"
    assert soup.h2.text == "How it works"
    assert soup.img["src"] == "https://www.greenbuildermedia.com/hubfs/air.jpg"
    assert soup.table.td.text == "Balanced"
    assert soup.select_one(".reader-video iframe")["src"] == "https://www.youtube.com/embed/example"
    assert soup.select_one('a[href^="/api/articles/read"]')
    assert soup.select_one('link[rel="stylesheet"]')
    assert "color:red" in str(soup.p)
    assert not soup.select("script, nav, [onclick], [onerror]")
    for unwanted in ("Site logo", "Green topic buttons", "Share buttons", "Banner advertising", "Floating chatbot", "Unrelated footer", "javascript:", "position:fixed", "evil.example"):
        assert unwanted not in document


def test_transcripts_keep_video_summary_and_body_with_date_first():
    page = '''<div class="transcript-wrap"><div class="transcript-eyebrow">Video Transcript</div>
    <h1 class="transcript-title">Healthy Home</h1><div class="transcript-meta"><span>Author</span><span>2022-05-19</span><span>YouTube</span></div>
    <div class="transcript-embed"><iframe src="https://www.youtube.com/embed/example"></iframe></div>
    <p class="transcript-summary">Two strategies.</p><div class="transcript-body"><p>Original transcript.</p></div>
    <div class="transcript-tags">Topic buttons</div></div>'''
    soup = BeautifulSoup(extract_article(page, "https://www.greenbuildermedia.com/transcripts/healthy-home"), "html.parser")
    assert soup.time.text == "2022-05-19"
    assert len(soup.find_all("h1")) == 1
    assert soup.h1.text == "Healthy Home"
    assert soup.select_one(".transcript-summary").text == "Two strategies."
    assert soup.select_one(".transcript-body").text == "Original transcript."
    assert soup.select_one(".reader-video iframe")
    assert not soup.select(".transcript-tags, .transcript-meta")


@pytest.mark.parametrize("url", [
    "http://www.greenbuildermedia.com/blog/test", "https://evil.example/blog/test",
    "https://www.greenbuildermedia.com.evil.example/blog/test", "https://127.0.0.1/blog/test",
    "https://www.greenbuildermedia.com:8000/blog/test", "https://user@www.greenbuildermedia.com/blog/test",
    "https://www.greenbuildermedia.com/blog/../private", "https://www.greenbuildermedia.com/",
])
def test_reader_rejects_non_article_and_unsafe_urls(url):
    with pytest.raises(ValueError):
        normalize_article_url(url)


def test_reader_normalizes_tracking_parameters():
    assert normalize_article_url(SOURCE + "/?utm_source=test#section") == SOURCE


def test_reader_does_not_follow_redirects_to_another_host(monkeypatch):
    calls = []

    def response(request):
        calls.append(str(request.url))
        return httpx.Response(302, headers={"location": "https://127.0.0.1/private"})

    original_client = httpx.AsyncClient
    monkeypatch.setattr(article_reader.httpx, "AsyncClient", lambda **kwargs: original_client(transport=httpx.MockTransport(response), **kwargs))
    with pytest.raises(ValueError):
        asyncio.run(article_reader.fetch_article(SOURCE))
    assert calls == [SOURCE]


def test_reader_cache_survives_new_database_sessions_and_source_outage(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'articles.db'}", connect_args={"check_same_thread": False})
    ArticleCacheRecord.__table__.create(engine)
    calls = []

    async def fetch(url):
        calls.append(url)
        return PAGE, url

    def db_session():
        with Session(engine) as db:
            yield db

    app = FastAPI()
    app.include_router(articles.router)
    app.dependency_overrides[get_db] = db_session
    monkeypatch.setattr(articles, "fetch_article", fetch)
    with TestClient(app) as client:
        first = client.get("/api/articles/read", params={"url": SOURCE})
        assert first.status_code == 200
        assert first.headers["x-article-cache"] == "MISS"
        assert "default-src 'none'" in first.headers["content-security-policy"]

        async def offline(url):
            raise httpx.ConnectError("Offline")

        monkeypatch.setattr(articles, "fetch_article", offline)
        second = client.get("/api/articles/read", params={"url": SOURCE + "?utm_source=archive"})
        assert second.status_code == 200
        assert second.headers["x-article-cache"] == "HIT"
        assert second.text == first.text
        assert calls == [SOURCE]
        failure = client.get("/api/articles/read", params={"url": SOURCE + "-missing"})
        assert failure.status_code == 502
        assert "Try again" in failure.text and "Original article" in failure.text
    engine.dispose()


def test_unrecognized_page_does_not_turn_whole_site_into_article():
    with pytest.raises(ValueError):
        extract_article("<html><nav>Menu</nav><h1>Home</h1><footer>Chatbot</footer></html>", SOURCE)
