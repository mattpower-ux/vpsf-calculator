import test from 'node:test';
import assert from 'node:assert/strict';
import {focusedProducts, searchProducts} from './productCategories.js';
import {companyWebsite} from './productInquiry.js';

test('full catalog does not hide category members beyond ten',()=>{
 const products=Array.from({length:35},(_,i)=>({id:String(i),category:'Insulation',name:`Board ${i}`}));
 assert.equal(focusedProducts(products,'insulation',{all:true}).length,35);
 assert.equal(focusedProducts(products,'insulation').length,10);
});
test('search filters names, brands and descriptions without losing pillar filtering',()=>{
 const products=[{name:'Water Saver',brand:'Acme',description:'Graywater reuse',category:'Water Reuse'}, {name:'Warm Wall',brand:'Beta',category:'Insulation'}];
 assert.deepEqual(searchProducts(products,' graywater '),[products[0]]);
 assert.deepEqual(searchProducts(products,'BETA'),[products[1]]);
 assert.equal(searchProducts(products,'').length,2);
});
test('award source is not mistaken for the company website',()=>{
 assert.equal(companyWebsite({brand:'New Manufacturer',companyUrl:'https://manufacturer.example/products/model',sourceUrl:'https://www.greenbuildermedia.com/blog/awards'}),'https://manufacturer.example/products/model');
 assert.equal(companyWebsite({brand:'New Manufacturer',companyUrl:'javascript:alert(1)',sourceUrl:'https://www.greenbuildermedia.com/blog/awards'}),null);
});
