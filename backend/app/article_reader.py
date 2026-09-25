import re
from html import escape
from urllib.parse import urlencode, urljoin, urlsplit, urlunsplit

import httpx
import nh3
from bs4 import BeautifulSoup


ARTICLE_HOSTS = {"www.greenbuildermedia.com", "greenbuildermedia.com"}
ARTICLE_PATH = re.compile(r"^/(blog|transcripts)/[a-zA-Z0-9_-]+/?$")
VIDEO_HOSTS = {"www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"}
MAX_PAGE_BYTES = 3_000_000

READER_CSS = """
@font-face { font-family: Roboto; font-style: normal; font-weight: 300; font-display: swap; src: url('https://www.greenbuildermedia.com/_hcms/googlefonts/Roboto/300.woff2') format('woff2'); }
@font-face { font-family: Roboto; font-style: normal; font-weight: 400; font-display: swap; src: url('https://www.greenbuildermedia.com/_hcms/googlefonts/Roboto/regular.woff2') format('woff2'); }
@font-face { font-family: Roboto; font-style: normal; font-weight: 700; font-display: swap; src: url('https://www.greenbuildermedia.com/_hcms/googlefonts/Roboto/700.woff2') format('woff2'); }
@font-face { font-family: Roboto; font-style: normal; font-weight: 900; font-display: swap; src: url('https://www.greenbuildermedia.com/_hcms/googlefonts/Roboto/900.woff2') format('woff2'); }
html, body { margin: 0; padding: 0; background: #fff; }
body.vpsf-article-reader { color: #343358; font-family: Roboto, Arial, sans-serif; line-height: 1.6; }
.reader h1, .reader h2, .reader h3 { font-family: Roboto, Arial, sans-serif; }
.reader { box-sizing: border-box; width: 100%; max-width: 760px; margin: 0 auto; padding: 24px 18px 32px; }
.reader .blog-post { width: 100%; margin: 0; padding: 0; }
.reader .reader-date { display: block; margin: 0 0 14px; font-size: 14px; color: #666; }
.reader h1 { font-size: 28px; line-height: 1.2; margin: 0 0 24px; overflow-wrap: anywhere; }
.reader .blog-post__body { margin: 0; padding: 0; font-size: 16px; line-height: 1.65; overflow-wrap: anywhere; }
.reader h2 { font-size: 23px; line-height: 1.3; }
.reader h3 { font-size: 20px; line-height: 1.35; }
.reader img, .reader video { max-width: 100% !important; height: auto !important; }
.reader figure { max-width: 100%; margin-left: 0; margin-right: 0; }
.reader table, .reader pre { display: block; max-width: 100%; overflow-x: auto; }
.reader .reader-video { width: 100%; aspect-ratio: 16 / 9; margin: 20px 0; }
.reader .reader-video iframe { display: block; width: 100%; height: 100%; border: 0; }
.reader-footer { clear: both; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e1e5eb; font-size: 13px; }
.reader a { overflow-wrap: anywhere; }
"""


def normalize_article_url(url: str) -> str:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in ARTICLE_HOSTS
        or parsed.username or parsed.password
        or parsed.port not in (None, 443)
        or not ARTICLE_PATH.fullmatch(parsed.path)
    ):
        raise ValueError("Only Green Builder Media article URLs are supported")
    return urlunsplit(("https", "www.greenbuildermedia.com", parsed.path.rstrip("/"), "", ""))


def reader_url(url: str) -> str:
    return "/api/articles/read?" + urlencode({"url": normalize_article_url(url)})


async def fetch_article(url: str) -> tuple[str, str]:
    current = normalize_article_url(url)
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        for _ in range(4):
            async with client.stream("GET", current) as response:
                if response.is_redirect:
                    # Revalidate every destination before following a redirect.
                    current = normalize_article_url(urljoin(current, response.headers.get("location", "")))
                    continue
                response.raise_for_status()
                if "text/html" not in response.headers.get("content-type", ""):
                    raise ValueError("The requested page is not an HTML article")
                page = bytearray()
                async for chunk in response.aiter_bytes():
                    page.extend(chunk)
                    if len(page) > MAX_PAGE_BYTES:
                        raise ValueError("The article is too large for the reader")
                return page.decode(response.encoding or "utf-8", errors="replace"), current
    raise ValueError("Too many article redirects")


def clean_body(body, source_url: str) -> str:
    for node in body.select('script, style, link, form, nav, .post-share, .blog-post__tags, .transcript-tags, .hs-cta-wrapper, #hs_cos_wrapper_blog_post_audio, [id*="deepthink" i], [class*="deepthink" i], [id*="chatbot" i], [class*="chatbot" i], #hubspot-messages-iframe-container'):
        node.decompose()

    for frame in list(body.find_all("iframe")):
        src = urljoin(source_url, frame.get("src", ""))
        parsed = urlsplit(src)
        if parsed.scheme != "https" or parsed.hostname not in VIDEO_HOSTS or not parsed.path.startswith(("/embed/", "/video/")):
            frame.decompose()
            continue
        frame.attrs = {"src": src, "title": frame.get("title", "Article video"), "loading": "lazy", "allowfullscreen": "", "referrerpolicy": "strict-origin-when-cross-origin"}
        container = frame.find_parent(class_=["hs-embed-wrapper", "transcript-embed"])
        wrapper = BeautifulSoup('<div class="reader-video"></div>', "html.parser").div
        if container and container is not body:
            frame.extract()
            wrapper.append(frame)
            container.replace_with(wrapper)
        else:
            frame.wrap(wrapper)

    for node in body.find_all(True):
        for attr in ("href", "src", "poster"):
            if node.get(attr):
                node[attr] = urljoin(source_url, node[attr])
        if node.name == "a" and node.get("href"):
            try:
                node["href"] = reader_url(node["href"])
                node["target"] = "_self"
            except ValueError:
                node["target"] = "_blank"
        if node.name == "img":
            # Original src remains high resolution; CSS fits it to the reader.
            node.attrs.pop("srcset", None)
            node["loading"] = "lazy"

    attributes = {tag: set(attrs) for tag, attrs in nh3.ALLOWED_ATTRIBUTES.items()}
    attributes["*"] = {"class", "id", "style", "title"}
    attributes["a"] = {"href", "target", "title"}
    attributes["img"] = {"src", "alt", "width", "height", "loading"}
    attributes["iframe"] = {"src", "title", "loading", "allowfullscreen", "referrerpolicy"}
    attributes["video"] = {"src", "poster", "controls", "preload"}
    attributes["source"] = {"src", "type"}
    return nh3.clean(
        str(body),
        tags=nh3.ALLOWED_TAGS | {"iframe", "video", "source"},
        attributes=attributes,
        url_schemes={"https", "http", "mailto"},
        filter_style_properties={
            "color", "background-color", "font-family", "font-size", "font-weight", "font-style",
            "text-align", "text-decoration", "line-height", "width", "height", "max-width",
            "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
            "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
            "border", "border-color", "border-style", "border-width", "border-collapse", "float", "clear",
        },
    )


def document_shell(title: str, content: str, source_url: str, stylesheets: list[str] | None = None) -> str:
    styles = "".join(f'<link rel="stylesheet" href="{escape(url, quote=True)}">' for url in stylesheets or [])
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>{escape(title)}</title>
{styles}<style>{READER_CSS}</style></head>
<body class="vpsf-article-reader"><main class="reader">{content}
<footer class="reader-footer"><a href="{escape(source_url, quote=True)}" target="_blank" rel="noopener noreferrer">Original article at Green Builder Media</a></footer>
</main></body></html>'''


def extract_article(page: str, source_url: str) -> str:
    soup = BeautifulSoup(page, "html.parser")
    body = soup.select_one("#hs_cos_wrapper_post_body, .blog-post__body, .post-body, [itemprop='articleBody']")
    title = soup.select_one("article h1, .post-header h1, h1")
    date = soup.select_one(".blog-post__timestamp, .post-date, time")
    date_text = ""
    if date:
        for icon in date.select("svg, script"):
            icon.decompose()
        date_text = date.get_text(" ", strip=True)

    if body is None and soup.select_one(".transcript-body"):
        body = soup.select_one(".transcript-wrap")
        date_text = next((item.get_text(strip=True) for item in body.select(".transcript-meta span") if re.fullmatch(r"\d{4}-\d{2}-\d{2}", item.get_text(strip=True))), "")
        # The title and date are rendered once above the original transcript.
        title_text = title.get_text(" ", strip=True) if title else ""
        for node in body.select(".transcript-eyebrow, .transcript-title, .transcript-meta, .transcript-tags"):
            node.decompose()
    else:
        title_text = title.get_text(" ", strip=True) if title else ""

    if body is None or not title_text or not body.get_text(strip=True):
        raise ValueError("This page does not contain a supported article body")

    stylesheets = []
    for link in soup.select('head link[rel="stylesheet"][href]'):
        url = urljoin(source_url, link["href"])
        parsed = urlsplit(url)
        if parsed.scheme == "https" and parsed.hostname in ARTICLE_HOSTS and "/template_assets/" in parsed.path:
            stylesheets.append(url)
    date_html = f'<time class="reader-date">{escape(date_text)}</time>' if date_text else ""
    content = f'<article class="blog-post">{date_html}<h1>{escape(title_text)}</h1><div class="blog-post__body">{clean_body(body, source_url)}</div></article>'
    return document_shell(title_text, content, source_url, stylesheets)
