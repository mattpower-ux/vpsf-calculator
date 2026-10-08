export function manualChapters(guide) {
  return (guide?.topics || [])
    .filter((topic) => !topic.faq)
    .map((topic, index) => ({ ...topic, number: index + 1 }));
}

export function manualChapterAt(chapters, index) {
  return Number.isInteger(index) && index >= 0 && index < chapters.length ? chapters[index] : null;
}
