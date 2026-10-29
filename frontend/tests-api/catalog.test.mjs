import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {client} from './auth-client.mjs';
const url=new URL(process.env.API_TEST_DB_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='13307'||!/^\/phase1_[a-f0-9]{12}_test$/.test(url.pathname))throw new Error('Isolated fixture required');
const db=await mysql.createConnection(process.env.API_TEST_DB_URL),admin=client(),anonymous=client();
const draft={name:'Catalog Test',slug:'catalog-test',description:'Fixture description',priceCents:2500,edition:5,inventoryMode:'limited',material:'Fixture fabric',care:'Fixture care',sizeGuide:'Fixture size chart',status:'draft',version:0,categoryIds:[]};
let id,variantId,key;
async function product(){return(await admin.request('/admin/catalog/'+id)).payload;}
test('phase 3 catalog, publication, stock and image safety',async t=>{
 const state=JSON.parse(await readFile(process.env.API_TEST_AUTH_STATE,'utf8'));
 const login=await admin.request('/admin/login',{email:process.env.API_TEST_ADMIN_EMAIL,password:process.env.API_TEST_ADMIN_PASSWORD});
 assert.equal((await admin.request('/auth/admin/mfa/verify',{challengeToken:login.payload.challengeToken,code:state.adminCodes[5]})).response.status,200);
 await t.test('draft creation is protected and publishing requires complete content, SKU and image',async()=>{
  assert.equal((await anonymous.request('/admin/catalog/',draft)).response.status,401);
  const created=await admin.request('/admin/catalog/',draft);assert.equal(created.response.status,200,JSON.stringify(created.payload));id=created.payload.id;
  assert.equal((await anonymous.request('/products/'+draft.slug)).response.status,404);
  const current=await product();
  assert.equal((await admin.request('/admin/catalog/'+id,{...draft,status:'published',version:current.version},'PUT')).response.status,400);
  assert.equal((await admin.request('/admin/catalog/',draft)).response.status,409);
 });
 await t.test('SKU identity, stale writes and audited stock enforce edition limits',async()=>{
  const result=await admin.request('/admin/catalog/'+id+'/variants',{sku:'TEST-CATALOG-M-BLACK',size:'M',color:'Black',active:true,version:0});assert.equal(result.response.status,200);variantId=result.payload.id;
  const current=await product(),variant=current.variants[0];
  assert.equal((await admin.request('/admin/stock/'+variantId,{available:5,version:variant.version,reason:'Initial fixture stock'},'PUT')).response.status,204);
  assert.equal((await admin.request('/admin/stock/'+variantId,{available:5,version:variant.version,reason:'Stale change'},'PUT')).response.status,409);
  let updated=await product();
  assert.equal((await admin.request('/admin/stock/'+variantId,{available:6,version:updated.variants[0].version,reason:'Over cap'},'PUT')).response.status,409);
  const history=(await admin.request('/admin/catalog/stock/'+variantId+'/history')).payload;
  assert.equal(history[0].delta,5);assert.equal(history[0].reason,'Initial fixture stock');
  assert.equal((await admin.request('/admin/catalog/'+id,{...draft,version:current.version-1},'PUT')).response.status,409);
 });
 await t.test('uploads reject SVG, forged MIME, invalid bytes and oversized dimensions',async()=>{
  const current=await product(),route='/admin/catalog/'+id+'/images?version='+current.version+'&alt=Test&position=0';
  for(const [type,bytes] of [['image/svg+xml',Buffer.from('<svg/>')],['image/png',Buffer.from('<html>fake</html>')]]) {
   const result=await admin.request(route,null,'POST',{headers:{'Content-Type':type},rawBody:bytes});
   assert.equal(result.response.status,400,JSON.stringify(result.payload));
  }
  const large=await sharp({create:{width:4097,height:1,channels:3,background:'red'}}).png().toBuffer();
  assert.equal((await admin.request(route,null,'POST',{headers:{'Content-Type':'image/png'},rawBody:large})).response.status,400);
  const png=await sharp({create:{width:32,height:24,channels:3,background:'red'}}).png().toBuffer();
  assert.equal((await admin.request(route,null,'POST',{headers:{'Content-Type':'image/jpeg'},rawBody:png})).response.status,400);
  const uploaded=await admin.request(route,null,'POST',{headers:{'Content-Type':'image/png'},rawBody:png});
  assert.equal(uploaded.response.status,200,JSON.stringify(uploaded.payload));key=uploaded.payload.key;
  assert.match(key,/^[a-f0-9]{32}\.webp$/);
  assert.equal((await anonymous.request('/media/'+key)).response.status,404);
  const response=await fetch(process.env.API_TEST_URL+'/api/admin/media/'+key,{headers:{Cookie:admin.cookie()}});
  const metadata=await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(metadata.format,'webp');assert.equal(metadata.width,32);assert.equal(metadata.height,24);assert.equal(metadata.exif,undefined);
 });
 await t.test('publication, categories, filtering and deterministic pagination run on the server',async()=>{
  const category=(await admin.request('/admin/catalog/categories',{name:'Test category',slug:'test-category',version:0})).payload;
  const current=await product();
  assert.equal((await admin.request('/admin/catalog/'+id,{...draft,status:'published',version:current.version,categoryIds:[category.id]},'PUT')).response.status,200);
  const detail=(await anonymous.request('/products/'+draft.slug)).payload;assert.equal(detail.images.length,1);assert.equal(detail.categories[0].slug,'test-category');
  const image=await fetch(process.env.API_TEST_URL+'/api/media/'+key);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/webp');
  const filtered=(await anonymous.request('/catalog?category=test-category&size=M&color=Black&inStock=true&minPrice=2000&maxPrice=3000&sort=price-asc&pageSize=1')).payload;
  assert.equal(filtered.total,1);assert.equal(filtered.items[0].id,id);
  assert.equal((await anonymous.request('/catalog?color=Blue')).payload.items.some(p=>p.id===id),false);
  assert.equal((await anonymous.request('/catalog?pageSize=1000')).response.status,400);
  assert.equal((await anonymous.request('/catalog?sort=DROP')).response.status,400);
  const page1=(await anonymous.request('/catalog?pageSize=1&page=1')).payload,page2=(await anonymous.request('/catalog?pageSize=1&page=2')).payload;
  assert.equal(page1.items.length,1);assert.equal(page2.items.length,1);assert.notEqual(page1.items[0].id,page2.items[0].id);
  assert.equal((await anonymous.request('/basket/products?ids='+variantId)).payload[0].id,id);
 });
 await t.test('archive preserves SKU/history and removes the product from public pages and checkout',async()=>{
  const current=await product();
  assert.equal((await admin.request('/admin/catalog/'+id+'?version='+current.version,null,'DELETE')).response.status,204);
  assert.equal((await anonymous.request('/products/'+draft.slug)).response.status,404);
  assert.equal((await anonymous.request('/basket/products?ids='+variantId)).payload.length,0);
  assert.equal((await admin.request('/admin/products/'+id,{name:draft.name,description:draft.description,priceCents:2500,active:true,version:(await product()).version},'PUT')).response.status,409);
  assert.equal((await product()).variants[0].sku,'TEST-CATALOG-M-BLACK');
 });
 await t.test('replenishable stock may grow, while limited mode cannot erase committed stock accounting',async()=>{
  const current=await product();
  assert.equal((await admin.request('/admin/catalog/'+id,{...draft,status:'draft',inventoryMode:'replenishable',version:current.version},'PUT')).response.status,200);
  const variant=(await product()).variants[0];
  assert.equal((await admin.request('/admin/stock/'+variant.id,{available:20,version:variant.version,reason:'Core collection replenishment'},'PUT')).response.status,204);
  assert.equal((await admin.request('/admin/catalog/'+id,{...draft,version:(await product()).version},'PUT')).response.status,409);
 });
 await t.test('a catalog larger than one page returns bounded deterministic data without loading every variant',async()=>{
  const rows=Array.from({length:150},(_,i)=>['load-'+i,'Load fixture '+i,'Fixture',1000+i,50,'/images/hood_front.jpg','/images/hood_back.jpg',true,'load-piece-'+i,'published']);
  try {
   await db.query('INSERT INTO products(id,name,description,price_cents,edition,front_image,back_image,active,slug,status) VALUES ?',[rows]);
   await db.query('INSERT INTO variants(id,product_id,size,available,sku,color) VALUES ?',[rows.map((row,i)=>['load-var-'+i,row[0],'M',5,'LOAD-'+i,'Test'])]);
   const start=performance.now(),first=await anonymous.request('/catalog?query=Load%20fixture&page=1&sort=price-asc'),second=await anonymous.request('/catalog?query=Load%20fixture&page=2&sort=price-asc');
   assert.equal(first.payload.total,150);assert.equal(first.payload.items.length,24);assert.equal(second.payload.items.length,24);
   assert.ok(first.payload.items.every(p=>p.variants.length===1));assert.ok(!first.payload.items.some(p=>second.payload.items.some(other=>other.id===p.id)));
   assert.ok(performance.now()-start<10000,'Bounded fixture catalog pages complete within ten seconds.');
  }finally{await db.execute("DELETE FROM variants WHERE id LIKE 'load-var-%'");await db.execute("DELETE FROM products WHERE id LIKE 'load-%'");}
 });
 await t.test('ordered SKU identities and price/image snapshots survive retirement and replacement',async()=>{
  assert.equal((await admin.request('/admin/catalog/'+id,{...draft,status:'published',inventoryMode:'replenishable',version:(await product()).version},'PUT')).response.status,200);
  const guest=client();await guest.request('/checkout/context');
  const checkout=await guest.request('/checkout',{requestKey:randomUUID(),paymentMethod:'CashOnDelivery',email:'catalog-buyer@phase1.example',name:'Catalog buyer',phone:'2101234567',address:'Fixture street',city:'Athens',postalCode:'10563',country:'GR',acceptTerms:true,items:[{variantId,quantity:1}]});
  assert.equal(checkout.response.status,200,JSON.stringify(checkout.payload));
  assert.equal((await guest.request('/orders/'+checkout.payload.publicToken)).payload.status,'confirmed');
  const [orders]=await db.execute('SELECT id FROM orders WHERE public_token=?',[checkout.payload.publicToken]);
  const [before]=await db.execute('SELECT sku,color,unit_price_cents,image_url FROM order_items WHERE order_id=?',[orders[0].id]);
  assert.equal(before[0].sku,'TEST-CATALOG-M-BLACK');assert.equal(before[0].color,'Black');assert.equal(before[0].unit_price_cents,2500);assert.equal(before[0].image_url,'/api/media/'+key);
  let current=await product(),variant=current.variants.find(v=>v.id===variantId);
  assert.equal((await admin.request('/admin/catalog/'+id+'/variants/'+variantId,{...variant,sku:'RENAMED-ORDERED-SKU'},'PUT')).response.status,409);
  assert.equal((await admin.request('/admin/catalog/'+id+'?version='+current.version,null,'DELETE')).response.status,204);
  assert.equal((await admin.request('/admin/catalog/'+id+'/variants/'+variantId,{...variant,active:false},'PUT')).response.status,200);
  assert.equal((await admin.request('/admin/catalog/'+id+'/variants',{sku:'REPLACEMENT-M-BLACK',size:'M',color:'Black',active:true,version:0})).response.status,200);
  current=await product();
  assert.equal((await admin.request('/admin/catalog/'+id,{...draft,priceCents:3500,status:'archived',inventoryMode:'replenishable',version:current.version},'PUT')).response.status,200);
  current=await product();
  assert.equal((await admin.request('/admin/catalog/'+id+'/images/'+current.images[0].id+'?version='+current.version,null,'DELETE')).response.status,204);
  const [after]=await db.execute('SELECT sku,color,unit_price_cents,image_url FROM order_items WHERE order_id=?',[orders[0].id]);
  assert.deepEqual(after,before);assert.equal((await fetch(process.env.API_TEST_URL+'/api/media/'+key)).status,200);
 });
});
test.after(async()=>{await db.end();});
