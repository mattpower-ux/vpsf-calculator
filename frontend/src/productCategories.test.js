import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogCategories, productsInCategory } from './productCategories.js';
import { buildMenuGroups } from './menuNavigation.js';

test('directory covers the whole catalog, including new and uncategorized products', () => {
  const products = [{category:'Water'}, {category:' Energy + Water '}, {category:'water'}, {category:'Roofing'}, {}];
  const categories = catalogCategories(products);
  assert.equal(categories.length, 4);
  assert.equal(categories.find(c => c.id === 'water').count, 2);
  assert.equal(categories.reduce((sum,c) => sum+c.count,0), products.length);
  for (const c of categories) assert.equal(productsInCategory(products,c.id).length,c.count);
  assert.equal(productsInCategory(products,null).length,products.length);
  assert.deepEqual(productsInCategory(products,'nonexistent'),[]);
});

test('menu categories opens full directory, not recommendation matches', () => {
  const item = buildMenuGroups([],[]).flatMap(g=>g.items || []).find(i=>i.id==='categories');
  assert.equal(item.target.screen,28);
});
