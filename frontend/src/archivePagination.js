export const ARCHIVE_PAGE_SIZE = 12;

export function getArchivePage(articles, page = 1, query = "") {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = articles.filter((article) => {
    const text = `${article.title} ${article.description}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / ARCHIVE_PAGE_SIZE));
  const currentPage = Math.min(pageCount, Math.max(1, Math.trunc(Number(page)) || 1));
  const offset = (currentPage - 1) * ARCHIVE_PAGE_SIZE;
  return {
    articles: filtered.slice(offset, offset + ARCHIVE_PAGE_SIZE),
    page: currentPage,
    pageCount,
    total: filtered.length,
    start: filtered.length ? offset + 1 : 0,
    end: Math.min(offset + ARCHIVE_PAGE_SIZE, filtered.length)
  };
}
