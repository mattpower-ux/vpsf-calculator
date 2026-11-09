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
