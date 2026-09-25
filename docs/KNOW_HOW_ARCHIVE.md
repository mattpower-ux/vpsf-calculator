# Know-How Archive

The seven pillar archives use a checked-in catalog of actual Green Builder Media
blog articles, not the former four-to-five starter links. Each pillar contains
up to 100 deduplicated articles. The UI displays 12 per page, with previous/next
controls and a page selector at both ends of the list. Search covers titles and
short descriptions within the selected pillar. Dates are publication dates.

The September 25, 2026 index has 100 articles each for Energy, Water, Health,
Resilience, Carbon, and Ownership, and 66 for Community. Counts reflect subject
matching, not a claim that the publisher has no additional relevant articles.

## Sources and Refresh

`frontend/src/data/knowHowArticles.json` records the indexing time, source pages,
and each article's canonical URL, title, publication date, and short publisher
excerpt. Articles may appear in more than one relevant pillar, but not twice
within the same pillar.

To refresh from Green Builder Media's public topic pages and sitemap:

```powershell
backend/.venv312/Scripts/python.exe scripts/build_know_how_catalog.py
```

The maintenance script follows topic pagination (up to eight pages per tag),
combines related tags, and supplements narrower pillars with matching sitemap
articles. Broad tags and sitemap candidates are filtered by subject keywords.
These are editorial discovery rules, not a complete or automatically updated
index of every post on the publisher's site. Review relevance and the generated
diff before committing, building, and deploying. A failed crawl leaves the
existing catalog untouched.

The catalog ships with the calculator; browsing, searching, and paging cause no
external provider requests and do not consume ATTOM or RentCast pulls. It does
not depend on a live crawl or the backend being available.

## Clean Reader

Every catalog URL uses the existing `/api/articles/read` reader and opens in
the calculator-sized article window. Article bodies are fetched on first open
and cached in `article_cache` in the existing `/var/data/vpsf.db` on Render.
Site branding, topic buttons, advertising chrome, and the floating chatbot
remain excluded. Topic links encountered inside articles still use clean,
paginated linked-title lists.

## Verification

```powershell
cd frontend
node --test src/archivePagination.test.js src/api/client.test.js src/wildfire.test.js
npm run build
cd ../backend
.venv312/Scripts/python.exe -m pytest tests -q
```

Tests cover catalog URL safety, all seven collections, unique URLs per pillar,
complete page traversal, partial last pages, bounds, search, source extraction,
same-topic crawl pagination, short excerpts, and relevance filters.
