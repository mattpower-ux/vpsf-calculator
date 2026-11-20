const categoryName = product => typeof product.category === 'string' && product.category.trim() ? product.category.trim() : 'Other Products';
const categoryId = product => categoryName(product).toLowerCase();

export function catalogCategories(products) {
  const groups = new Map();
  for (const product of products) {
    const id = categoryId(product);
    if (!groups.has(id)) groups.set(id, { id, label: categoryName(product), count: 0 });
    groups.get(id).count++;
  }
  return [...groups.values()].sort((a,b) => a.label.localeCompare(b.label));
}

export function productsInCategory(products, category) {
  return category ? products.filter(product => categoryId(product) === category) : products;
}

export function recommendationCategory(rec) {
  return {'resilience-siding':'siding','heating-boiler':'condensing boiler','energy-water-heating':'water heating','water-fixtures':'fixtures','roof-risk':'roofing','health-ventilation':'ventilation','water-irrigation':'irrigation'}[rec.id] || null;
}
export function searchProducts(products, query) {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return products.filter(p => words.every(word => [p.name,p.brand,p.product,p.category,p.description,p.summary].filter(Boolean).join(' ').toLowerCase().includes(word)));
}

export function focusedProducts(products, category, {all = false} = {}) {
  const selected = productsInCategory(products, category);
  if (!category) return selected;
  const sorted = [...selected].sort((a,b) => Number(!!b.isSponsored)-Number(!!a.isSponsored) || Number(b.id==='james-hardie-plank' && !!b.isSponsored)-Number(a.id==='james-hardie-plank' && !!a.isSponsored));
  return all ? sorted : sorted.slice(0,10);
}
