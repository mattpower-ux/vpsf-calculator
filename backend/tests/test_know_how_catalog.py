import importlib.util
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    "catalog_builder", Path(__file__).resolve().parents[2] / "scripts/build_know_how_catalog.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_listing_metadata_and_same_topic_pagination():
    page = '''<article class="blog-index__post">
    <h2 class="blog-index__post-title"><a href="/blog/water-savings?tracking=1">Water &amp; Savings</a></h2>
    <div class="blog-index__post-body">Reduce water waste. Learn about smart fixtures.</div>
    <time datetime="broken-date">Sep 25, 2026, 10:57 AM</time></article>
    <a class="blog-pagination__next-link" href="/blog/topic/water-conservation/page/2">Next</a>'''
    source = builder.HOST + "/blog/topic/water-conservation"
    posts, next_url = builder.parse_listing(page, source)
    assert posts == [{"url": builder.HOST + "/blog/water-savings", "title": "Water & Savings",
                      "description": "Reduce water waste. Learn about smart fixtures.", "date": "2026-09-25"}]
    assert next_url == source + "/page/2"
    for destination in ["https://evil.example/page/2", "/blog/topic/hvac/page/2"]:
        assert builder.parse_listing(page.replace("/blog/topic/water-conservation/page/2", destination), source)[1] is None


def test_deduplication_order_relevance_and_limit():
    articles = [{"url": f"{builder.HOST}/blog/insurance-{index}", "title": "Home insurance costs",
                 "description": "Lower ownership costs.", "date": "2026-01-01"} for index in range(120)]
    articles += articles[:10]
    articles.append({"url": builder.HOST + "/blog/design", "title": "Paint colors", "description": "Decor ideas.", "date": "2026-02-01"})
    result = builder.select_articles("financial", articles)
    assert len(result) == 100
    assert len({article["url"] for article in result}) == 100
    assert all("insurance" in article["title"] for article in result)


def test_urls_and_descriptions_are_bounded():
    assert builder.normalize_url("https://greenbuildermedia.com/blog/iaq.-why/?x=1") == builder.HOST + "/blog/iaq.-why"
    for url in ["https://evil.example/blog/test", builder.HOST + "/blog/topic/water", builder.HOST + "/", "http://www.greenbuildermedia.com/blog/test"]:
        assert builder.normalize_url(url) is None
    assert len(builder.description_excerpt("word " * 100).split()) <= 24
    assert builder.description_excerpt("Dr. Smith explains water reuse and conservation.") == "Dr. Smith explains water reuse and conservation."
    assert builder.published_date("not a date") == ""


def test_topic_matching_does_not_match_unrelated_word_fragments():
    assert not builder.relevant("carbon", {"title": "Window replacements", "description": "A home upgrade."})
    assert not builder.relevant("community", {"title": "Electricity transition", "description": "Heat pump equipment."})
    assert builder.relevant("carbon", {"title": "Low-carbon cement", "description": "Materials comparison."})
    assert builder.relevant("community", {"title": "Transit-oriented neighborhoods", "description": "Walking and biking."})
