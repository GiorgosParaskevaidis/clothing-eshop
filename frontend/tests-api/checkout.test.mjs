import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHmac } from 'node:crypto';
import mysql from 'mysql2/promise';

const base=process.env.API_TEST_URL??'http://127.0.0.1:5080';
if(!process.env.API_TEST_DB_URL || !process.env.API_TEST_ADMIN_PASSWORD)throw new Error('Configure the isolated test database and admin credentials. Never run against a live store.');
const dbUrl=new URL(process.env.API_TEST_DB_URL);
if(!dbUrl.pathname.endsWith('_test'))throw new Error('Refusing to modify a database whose name does not end in _test.');
const db=await mysql.createConnection(process.env.API_TEST_DB_URL);
let cookie='';
async function request(path,body,method=body?'POST':'GET',extra={}) {
  const response=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json','X-Store-Request':'1',...(cookie?{Cookie:cookie}:{}),...extra},body:body?JSON.stringify(body):undefined});
  const payload=await response.json().catch(()=>null);return {response,payload};
}
const checkout=(items=[{variantId:'hood-M',quantity:1}])=>({requestKey:randomUUID(),email:'integration@example.com',name:'Integration Test',address:'Test Street 1',city:'Athens',postalCode:'10563',country:'GR',acceptTerms:true,items});
async function stock(id,quantity){await db.execute('UPDATE variants SET available=?,version=version+1 WHERE id=?',[quantity,id]);}
async function available(id){const [rows]=await db.execute('SELECT available FROM variants WHERE id=?',[id]);return rows[0].available;}
function signedEvent(id,type,session,secret='whsec_local_integration_fixture') {
  const body=JSON.stringify({id,object:'event',type,api_version:'2026-09-30.clover',data:{object:{object:'checkout.session',...session}}});
  const t=Math.floor(Date.now()/1000);return {body,signature:`t=${t},v1=${createHmac('sha256',secret).update(t+'.'+body).digest('hex')}`};
}
async function webhook(event){return fetch(base+'/api/payments/webhook',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':event.signature},body:event.body});}
test('commerce integration against isolated MariaDB',async t=>{
  const store=await request('/store');assert.equal(store.payload.simulation,true);
  const login=await request('/admin/login',{email:process.env.API_TEST_ADMIN_EMAIL??'admin@thesamenot.local',password:process.env.API_TEST_ADMIN_PASSWORD});assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];
  await t.test('server recalculates price and rejects altered idempotent payload',async()=>{
    const input={...checkout(),totalCents:1,priceCents:1};
    const first=await request('/checkout',input);assert.equal(first.response.status,200);assert.equal(first.payload.totalCents,4600);
    const second=await request('/checkout',input);assert.equal(second.payload.publicToken,first.payload.publicToken);
    const altered=await request('/checkout',{...input,name:'Different Buyer'});assert.equal(altered.response.status,409);
  });
  await t.test('simultaneous checkouts cannot sell the last unit twice',async()=>{
    await stock('hood-XL',1);
    const results=await Promise.all([request('/checkout',checkout([{variantId:'hood-XL',quantity:1}])),request('/checkout',checkout([{variantId:'hood-XL',quantity:1}]))]);
    assert.deepEqual(results.map(x=>x.response.status).sort(),[200,409]);assert.equal(await available('hood-XL'),0);
  });
  await t.test('one invalid line rolls back the entire reservation',async()=>{
    await stock('hood-S',0);await stock('crew-S',1);
    const result=await request('/checkout',checkout([{variantId:'hood-S',quantity:1},{variantId:'crew-S',quantity:1}]));
    assert.equal(result.response.status,409);assert.equal(await available('crew-S'),1);
  });
  await t.test('concurrent identical requests reserve stock once',async()=>{
    await stock('crew-M',3);const input=checkout([{variantId:'crew-M',quantity:1}]);
    const results=await Promise.all([request('/checkout',input),request('/checkout',input)]);
    assert.equal(results[0].response.status,200);assert.equal(results[1].response.status,200);assert.equal(results[0].payload.publicToken,results[1].payload.publicToken);assert.equal(await available('crew-M'),2);
  });
  await t.test('stock edits reject a stale version',async()=>{
    const products=await request('/admin/products');const variant=products.payload[0].variants[0];
    const first=await request('/admin/stock/'+variant.id,{available:variant.available,version:variant.version},'PUT');assert.equal(first.response.status,204);
    const stale=await request('/admin/stock/'+variant.id,{available:variant.available,version:variant.version},'PUT');assert.equal(stale.response.status,409);
  });
  await t.test('stock increases cannot manufacture units beyond the edition limit',async()=>{
    const products=await request('/admin/products');const product=products.payload[0];const variant=product.variants[0];
    const response=await request('/admin/stock/'+variant.id,{available:variant.available+product.edition,version:variant.version},'PUT');
    assert.equal(response.response.status,409);
  });
  await t.test('signed payment completion is authoritative and idempotent',async()=>{
    await stock('crew-L',3);const result=await request('/checkout',checkout([{variantId:'crew-L',quantity:1}]));assert.equal(result.response.status,200);
    const [rows]=await db.execute('SELECT id,total_cents FROM orders WHERE public_token=?',[result.payload.publicToken]);const order=rows[0];
    const sessionId='cs_fixture_paid_'+randomUUID();
    await db.execute("UPDATE orders SET payment_mode='Stripe',stripe_session_id=? WHERE id=?",[sessionId,order.id]);
    const session={id:sessionId,metadata:{order_id:order.id},payment_status:'paid',amount_total:order.total_cents,currency:'eur'};
    const invalid=signedEvent('evt_fixture_invalid_'+randomUUID(),'checkout.session.completed',{...session,amount_total:1});assert.equal((await webhook(invalid)).status,400);
    const event=signedEvent('evt_fixture_paid_'+randomUUID(),'checkout.session.completed',session);
    assert.equal((await webhook(event)).status,200);assert.equal((await webhook(event)).status,200);
    const receipt=await request('/orders/'+result.payload.publicToken);assert.equal(receipt.payload.status,'paid');assert.equal(await available('crew-L'),2);
    assert.equal('email' in receipt.payload,false);assert.equal('address' in receipt.payload,false);
  });
  await t.test('signed expiration releases stock once',async()=>{
    await stock('crew-XL',3);const result=await request('/checkout',checkout([{variantId:'crew-XL',quantity:1}]));const [rows]=await db.execute('SELECT id FROM orders WHERE public_token=?',[result.payload.publicToken]);
    const sessionId='cs_fixture_expired_'+randomUUID();
    await db.execute("UPDATE orders SET payment_mode='Stripe',stripe_session_id=? WHERE id=?",[sessionId,rows[0].id]);
    const event=signedEvent('evt_fixture_expired_'+randomUUID(),'checkout.session.expired',{id:sessionId,metadata:{order_id:rows[0].id}});
    assert.equal((await webhook(event)).status,200);assert.equal((await webhook(event)).status,200);assert.equal(await available('crew-XL'),3);
  });
  await t.test('invalid signatures and cross-origin mutations are rejected',async()=>{
    const event=signedEvent('evt_invalid_signature','checkout.session.completed',{},'wrong-secret');assert.equal((await webhook(event)).status,400);
    const response=await fetch(base+'/api/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com',consent:true})});assert.equal(response.status,403);
  });
});
test.after(async()=>{
  // Remove fixtures from this explicitly isolated database before restoring the edition quantities.
  await db.execute('DELETE FROM payment_events');
  await db.execute('DELETE FROM order_items');
  await db.execute('DELETE FROM orders');
  await db.execute("UPDATE variants SET available=CASE size WHEN 'S' THEN 10 WHEN 'M' THEN 15 WHEN 'L' THEN 15 ELSE 10 END,version=version+1");
  await db.end();
});
