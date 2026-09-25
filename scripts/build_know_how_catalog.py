"""Rebuild the checked-in Know-How index from public Green Builder article listings.

Run with backend/.venv312/Scripts/python.exe scripts/build_know_how_catalog.py.
Only this maintenance command crawls the site; calculator visitors use the index.
"""

import argparse
import json
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
HOST = "https://www.greenbuildermedia.com"
OUTPUT = ROOT / "frontend/src/data/knowHowArticles.json"
ARTICLE_PATH = re.compile(r"^/blog/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*/?$")
TOPICS = {
    "energy": ["hvac", "net-zero", "solar", "insulation"],
    "water": ["water-conservation", "plumbing", "water"],
    "health": ["healthy-homes", "indoor-air-quality", "ventilation"],
    "resilience": ["resilient-housing", "wildfire", "roofing"],
    "carbon": ["decarbonization", "epds", "eco-leaders"],
    "financial": ["cognition-weekly-hot-take", "todays-homeowner"],
    "community": ["net-zero", "the-sonders-project"],
}
# Broad market/project tags need a second relevance check, not blanket inclusion.
KEYWORDS = {
    "water": r"water|plumbing|drought|irrigation",
    "carbon": r"carbon|emission|\bepds?\b|circular|recycl|material|concrete|\bcement\b|timber|life.cycle",
    "financial": r"afford|insurance|insurability|financ|mortgage|appraisal|resale|home.value|cost|saving|payback|investment|warrant|maintenan|tax.credit|incentive|utility.bill|ownership|homeowner.budget",
    "community": r"communit|neighborhood|neighbourhood|walkab|\btransit\b|transportation|urban|cities|\bcity\b|\btown\b|broadband|bike|bicycl|mobility|green.space|public.space|mixed.use|zoning|density|infill|habitat|biodiversity|affordable.housing|workforce.housing|missing.middle",
}
MAX_ARTICLES = 100
MAX_TOPIC_PAGES = 8


def normalize_url(url):
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname not in {"www.greenbuildermedia.com", "greenbuildermedia.com"}
            or parsed.username or parsed.password or parsed.port not in (None, 443)
            or not ARTICLE_PATH.fullmatch(parsed.path)):
        return None
    return HOST + parsed.path.rstrip("/")


def text(node):
    return " ".join(node.get_text(" ", strip=True).split()) if node else ""


def description_excerpt(value):
    """Keep a short publisher excerpt, preferring the first complete sentence."""
    value = " ".join(value.split())
    first = value
    for ending in re.finditer(r"[.!?](?=\s+[A-Z]|$)", value):
        candidate = value[:ending.end()]
        if len(candidate.split()) >= 6:
            first = candidate
            break
    if len(first.split()) <= 24 and len(first) <= 200:
        return first
    words = first.split()[:24]
    while len(" ".join(words)) > 197:
        words.pop()
    return " ".join(words).rstrip(".,;:") + "..."


def published_date(value):
    # HubSpot's datetime attribute on these listings is malformed; use visible date.
    match = re.search(r"([A-Z][a-z]{2}) (\d{1,2}), (\d{4})", value)
    if not match:
        return ""
    try:
        return datetime.strptime(match.group(0), "%b %d, %Y").date().isoformat()
    except ValueError:
        return ""


def parse_listing(page, source_url):
    soup = BeautifulSoup(page, "html.parser")
    posts = []
    for card in soup.select("article.blog-index__post"):
        link = card.select_one(".blog-index__post-title a[href]")
        url = normalize_url(urljoin(source_url, link["href"])) if link else None
        summary = description_excerpt(text(card.select_one(".blog-index__post-body")))
        if url and text(link) and summary:
            posts.append({
                "url": url, "title": text(link), "description": summary,
                "date": published_date(text(card.select_one("time"))),
            })
    next_link = soup.select_one(".blog-pagination__next-link[href]")
    next_url = urljoin(source_url, next_link["href"]) if next_link else None
    # Follow only the same topic's pagination, never an arbitrary outgoing URL.
    topic_path = urlsplit(source_url).path.split("/page/")[0].rstrip("/")
    if next_url and (urlsplit(next_url).netloc != urlsplit(HOST).netloc or not re.fullmatch(
            re.escape(topic_path) + r"/page/[1-9][0-9]*", urlsplit(next_url).path)):
        next_url = None
    return posts, next_url


def relevant(pillar, article):
    pattern = KEYWORDS.get(pillar)
    return not pattern or bool(re.search(pattern, article["title"] + " " + article["description"], re.I))


def select_articles(pillar, articles):
    unique = {article["url"]: article for article in articles if relevant(pillar, article)}
    return sorted(unique.values(), key=lambda item: (item["date"], item["url"]), reverse=True)[:MAX_ARTICLES]


def build(output):
    cache = {}
    fetched = set()
    with httpx.Client(timeout=30, follow_redirects=False, headers={"User-Agent": "VPSF-KnowHow-Indexer/1.0"}) as client:
        def fetch(url):
            if url not in cache:
                time.sleep(0.15)
                response = client.get(url)
                response.raise_for_status()
                cache[url] = response.text
                fetched.add(url)
            return cache[url]

        collections = {}
        for pillar, topics in TOPICS.items():
            articles = []
            for topic in topics:
                url = f"{HOST}/blog/topic/{topic}"
                visited = set()
                for _ in range(MAX_TOPIC_PAGES):
                    if not url or url in visited:
                        break
                    visited.add(url)
                    posts, url = parse_listing(fetch(url), url)
                    if not posts:
                        raise ValueError(f"No supported posts for topic {topic}")
                    articles.extend(posts)
                print(f"{pillar}: {topic}, {len(visited)} pages, {len(select_articles(pillar, articles))} matches", flush=True)
            collections[pillar] = select_articles(pillar, articles)

        # Fill narrower pillars from individual sitemap articles with matching subjects.
        sitemap = ET.fromstring(fetch(HOST + "/sitemap.xml"))
        candidates = []
        for entry in sitemap.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
            url = normalize_url(entry.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}loc", ""))
            if url:
                candidates.append((entry.findtext("{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod", ""), url))
        for pillar in KEYWORDS:
            articles = {item["url"]: item for item in collections[pillar]}
            for _, url in sorted(candidates, reverse=True):
                if len(articles) >= MAX_ARTICLES:
                    break
                if url in articles or not re.search(KEYWORDS[pillar], urlsplit(url).path.replace("-", " "), re.I):
                    continue
                soup = BeautifulSoup(fetch(url), "html.parser")
                title = soup.select_one("article h1, .post-header h1, h1")
                body = soup.select_one("#hs_cos_wrapper_post_body, .blog-post__body, .post-body")
                summary = soup.select_one('meta[name="description"]')
                date = soup.select_one('meta[property="article:published_time"]')
                if not title or not body:
                    continue
                description = description_excerpt(summary.get("content", "") if summary else text(body.select_one("h2, p")))
                item = {"url": url, "title": text(title), "description": description,
                        "date": date.get("content", "")[:10] if date else published_date(text(soup.select_one(".blog-post__timestamp, time")))}
                if description and relevant(pillar, item):
                    articles[url] = item
            collections[pillar] = select_articles(pillar, articles.values())
            print(f"{pillar}: {len(collections[pillar])} final articles", flush=True)

    if any(len(items) < 25 for items in collections.values()):
        raise ValueError("Unexpectedly small collection; existing catalog was not overwritten")
    document = {"generatedAt": datetime.now(timezone.utc).isoformat(), "source": HOST,
                "sourcePages": sorted(fetched), "pillars": collections}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: len(items) for key, items in collections.items()}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    build(parser.parse_args().output)
