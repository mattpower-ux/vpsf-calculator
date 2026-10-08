const categoryOrder = ["Getting Started", "Property Data", "Results", "Improvements"];

export function manualChapters(guide) {
  return (guide?.topics || [])
    .filter((topic) => !topic.faq)
    .sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.category);
      const bIndex = categoryOrder.indexOf(b.category);
      return (aIndex < 0 ? categoryOrder.length : aIndex) - (bIndex < 0 ? categoryOrder.length : bIndex);
    })
    .map((topic, index) => ({ ...topic, number: index + 1 }));
}

export function manualChapterAt(chapters, index) {
  return Number.isInteger(index) && index >= 0 && index < chapters.length ? chapters[index] : null;
}
