import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import mysql from 'mysql2/promise';
import {client} from './auth-client.mjs';
const url=new URL(process.env.API_TEST_DB_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='13307'||!/^\/phase1_[a-f0-9]{12}_test$/.test(url.pathname))throw new Error('Isolated fixture required');
const db=await mysql.createConnection(process.env.API_TEST_DB_URL),admin=client(),guest=client();
const state=JSON.parse(await readFile(process.env.API_TEST_AUTH_STATE,'utf8'));
const orders=[];
async function wait(check){for(let i=0;i<120;i++){const value=await check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timed out waiting for durable fixture work');}
async function mail(email,purpose){return wait(async()=>{const messages=await Promise.all((await readdir(process.env.API_TEST_MAIL_DIR)).map(async file=>JSON.parse(await readFile(path.join(process.env.API_TEST_MAIL_DIR,file),'utf8'))));return messages.filter(item=>item.email===email&&item.purpose===purpose).sort((a,b)=>a.createdUtc.localeCompare(b.createdUtc)).at(-1);});}
const token=message=>new URLSearchParams(new URL(message.link).hash.slice(1)).get('token');
const input=()=>({requestKey:randomUUID(),paymentMethod:'CashOnDelivery',email:'ops-guest@phase1.example',name:'Ops fixture',phone:'2101234567',address:'Operations street',city:'Athens',postalCode:'10563',country:'GR',acceptTerms:true,items:[{variantId:'hood-L',quantity:1}]});
async function create(jar=guest,request=input()){await jar.request('/checkout/context');const result=await jar.request('/checkout',request);assert.equal(result.response.status,200,JSON.stringify(result.payload));const [rows]=await db.execute('SELECT * FROM orders WHERE public_token=?',[result.payload.publicToken]);orders.push(rows[0].id);/* Historical payment fixtures only; public checkout creates manual orders. */await db.execute("UPDATE orders SET payment_mode='Simulation',status='pending',reservation_status='active' WHERE id=?",[rows[0].id]);await db.execute("UPDATE order_reservations SET state='active' WHERE order_id=?",[rows[0].id]);return {...rows[0],publicToken:result.payload.publicToken};}
async function detail(id){return(await admin.request('/admin/operations/orders/'+id)).payload;}
async function proof(){const result=await admin.request('/auth/admin/reauth',{password:process.env.API_TEST_ADMIN_PASSWORD});assert.equal(result.response.status,200);return result.payload.challengeToken;}
async function sendEvent(type,session,id='evt_ops_'+randomUUID(),created=Math.floor(Date.now()/1000)){
 const body=JSON.stringify({id,object:'event',created,livemode:false,type,api_version:'2026-09-30.clover',data:{object:{object:'checkout.session',...session}}});
 const t=Math.floor(Date.now()/1000),signature='t='+t+',v1='+createHmac('sha256','whsec_local_integration_fixture').update(t+'.'+body).digest('hex');
 const response=await fetch(process.env.API_TEST_URL+'/api/payments/webhook',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signature},body});assert.equal(response.status,200);
 await wait(async()=>{const [rows]=await db.execute('SELECT state FROM background_jobs WHERE dedup_key=?',['stripe:'+id]);return ['completed','dead'].includes(rows[0]?.state);});
 return id;
}
test('phase 4 shipping, durable payments, returns, refunds and consent',async t=>{
 const login=await admin.request('/admin/login',{email:process.env.API_TEST_ADMIN_EMAIL,password:process.env.API_TEST_ADMIN_PASSWORD});
 assert.equal((await admin.request('/auth/admin/mfa/verify',{challengeToken:login.payload.challengeToken,code:state.adminCodes[6]})).response.status,200);
 let paid;
 await t.test('shipping versions and authoritative quotes prevent silent price changes and preserve order snapshots',async()=>{
  await guest.request('/checkout/context');const request=input();
  const quote=(await guest.request('/checkout/quote',{items:request.items,country:'GR'})).payload;
  const original=(await admin.request('/admin/shipping')).payload;
  assert.equal(original.costCents,400);assert.equal(original.freeFromCents,8000);
  assert.equal((await admin.request('/admin/shipping',{...original,costCents:600},'PUT')).response.status,204);
  assert.equal((await admin.request('/admin/shipping',original,'PUT')).response.status,409);
  assert.equal((await guest.request('/checkout',{...request,quoteId:quote.id})).response.status,409);
  const other=client();await other.request('/checkout/context');
  assert.equal((await other.request('/checkout',{...request,quoteId:quote.id})).response.status,409);
  const fresh=(await guest.request('/checkout/quote',{items:request.items,country:'GR'})).payload;
  assert.equal(fresh.taxPolicyVersion,'fixture-tax-v1');assert.equal(fresh.netCents+fresh.taxCents,fresh.totalCents);assert.equal(fresh.taxCents,800);
  paid=await create(guest,{...request,quoteId:fresh.id});
  assert.equal(paid.shipping_cents,600);assert.equal(paid.currency,'EUR');
  assert.equal((await admin.request('/admin/shipping',{...original,version:original.version+1},'PUT')).response.status,204);
  assert.equal((await detail(paid.id)).order.shippingCents,600);
  const expired=(await guest.request('/checkout/quote',{items:request.items,country:'GR'})).payload;
  await db.execute('UPDATE checkout_quotes SET expires_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE id=?',[expired.id]);
  assert.equal((await guest.request('/checkout',{...input(),quoteId:expired.id})).response.status,409);
 });
 await t.test('paid transitions write durable history, stock reservations and encrypted deduplicated mail',async()=>{
  assert.equal((await guest.request('/payments/simulation',{token:paid.publicToken})).response.status,200);
  assert.equal((await guest.request('/payments/simulation',{token:paid.publicToken})).response.status,200);
  const value=await detail(paid.id);assert.equal(value.order.paymentStatus,'succeeded');assert.equal(value.order.status,'paid');
  assert.ok(value.order.items[0].sku);assert.equal(value.order.items[0].color,'Default');
  const [reservations]=await db.execute('SELECT state FROM order_reservations WHERE order_id=?',[paid.id]);assert.equal(reservations[0].state,'consumed');
  const [jobs]=await db.execute('SELECT protected_payload FROM background_jobs WHERE dedup_key=?',['email:order:'+paid.id+':paid']);assert.equal(jobs.length,1);assert.equal(jobs[0].protected_payload.includes('ops-guest@phase1.example'),false);
  await mail('ops-guest@phase1.example','order-paid');
 });
 await t.test('guest authorization protects return submission and shipping snapshots require versions',async()=>{
  const d=await detail(paid.id),order=d.order;
  const request={orderId:paid.id,requestKey:randomUUID(),kind:'withdrawal',reason:'',items:[{orderItemId:order.items[0].id,quantity:1}]};
  assert.equal((await client().request('/orders/access/returns',request)).response.status,401);
  await guest.request('/orders/access-link',{email:paid.email,orderNumber:paid.order_number,purpose:'access'});
  assert.equal((await guest.request('/orders/access',{token:token(await mail(paid.email,'order-access'))})).response.status,204);
  assert.equal((await guest.request('/orders/access/operations')).response.status,200);
  const ship={courier:'Fixture Courier',trackingNumber:'TRACK-TEST-1',trackingUrl:'https://example.com/tracking/fixture',version:order.version};
  assert.equal((await admin.request('/admin/operations/orders/'+paid.id+'/ship',{...ship,version:ship.version-1})).response.status,409);
  assert.equal((await admin.request('/admin/operations/orders/'+paid.id+'/ship',ship)).response.status,204);
  assert.equal((await admin.request('/admin/operations/orders/'+paid.id+'/ship',ship)).response.status,409);
  const created=await guest.request('/orders/access/returns',request);assert.equal(created.response.status,200);const returnId=created.payload.id;
  assert.equal((await guest.request('/orders/access/returns',request)).payload.id,returnId);
  assert.equal((await guest.request('/orders/access/returns',{...request,reason:'Changed request'})).response.status,409);
  assert.equal((await guest.request('/orders/access/returns',{...request,requestKey:randomUUID()})).response.status,409);
  const before=(await detail(paid.id)).operations.returns[0];assert.equal(before.state,'requested');
  assert.equal((await admin.request('/admin/operations/returns/'+returnId+'/inspect',{version:before.version,reason:'Cannot inspect yet',items:[]})).response.status,400);
  assert.equal((await admin.request('/admin/operations/returns/'+returnId+'/state',{version:before.version,state:'approved'})).response.status,204);
  const [stock]=await db.execute("SELECT available FROM variants WHERE id='hood-L'");
  const inspect={version:before.version+1,reason:'Physical inspection: resaleable condition',items:[{orderItemId:order.items[0].id,receivedQuantity:1,restockQuantity:1}]};
  assert.equal((await admin.request('/admin/operations/returns/'+returnId+'/inspect',inspect)).response.status,204);
  assert.equal((await admin.request('/admin/operations/returns/'+returnId+'/inspect',inspect)).response.status,409);
  const [after]=await db.execute("SELECT available FROM variants WHERE id='hood-L'");assert.equal(after[0].available,stock[0].available+1);
  assert.equal((await detail(paid.id)).order.paymentStatus,'succeeded');
 });
 await t.test('refunds require fresh password and MFA, reject concurrent replay and never restock automatically',async()=>{
  const [before]=await db.execute("SELECT available FROM variants WHERE id='hood-L'");
  const refund={requestKey:randomUUID(),amountCents:1000,reason:'Partial fixture refund',challengeToken:'invalid',code:'invalid'};
  assert.equal((await admin.request('/admin/operations/orders/'+paid.id+'/refund',refund)).response.status,400);
  const challengeToken=await proof();
  const results=await Promise.all([0,1].map(()=>admin.request('/admin/operations/orders/'+paid.id+'/refund',{...refund,challengeToken,code:state.adminCodes[7]})));
  assert.deepEqual(results.map(r=>r.response.status).sort(),[202,401]);
  const refundId=results.find(result=>result.response.status===202).payload.id;
  await wait(async()=>{const [rows]=await db.execute('SELECT state FROM refunds WHERE id=?',[refundId]);const [jobs]=await db.execute('SELECT state,last_code FROM background_jobs WHERE dedup_key=?',['refund:'+refundId]);if(jobs[0]?.last_code)throw new Error('Refund fixture job failed: '+jobs[0].last_code);return rows[0]?.state==='succeeded';});
  const d=await detail(paid.id);assert.equal(d.order.paymentStatus,'partially_refunded');
  const excessive={...refund,requestKey:randomUUID(),amountCents:paid.total_cents,challengeToken:await proof(),code:state.adminCodes[8]};
  assert.equal((await admin.request('/admin/operations/orders/'+paid.id+'/refund',excessive)).response.status,409);
  const remaining={...refund,requestKey:randomUUID(),amountCents:paid.total_cents-1000,challengeToken:await proof(),code:state.adminCodes[9]};
  assert.equal((await admin.request('/admin/operations/orders/'+paid.id+'/refund',remaining)).response.status,202);
  await wait(async()=>(await detail(paid.id)).order.paymentStatus==='refunded');
  const [after]=await db.execute("SELECT available FROM variants WHERE id='hood-L'");assert.equal(after[0].available,before[0].available);
 });
 await t.test('late paid events after released reservations record received money and block fulfillment without overselling',async()=>{
  const late=await create();
  const session='cs_ops_late_'+randomUUID();
  await db.execute("UPDATE orders SET payment_mode='Stripe',stripe_session_id=? WHERE id=?",[session,late.id]);
  const object={id:session,metadata:{order_id:late.id},payment_intent:'pi_ops_late_'+randomUUID(),payment_status:'unpaid'};
  const event=await sendEvent('checkout.session.expired',object);
  const [released]=await db.execute("SELECT available FROM variants WHERE id='hood-L'");
  await sendEvent('checkout.session.expired',object,event);
  await sendEvent('checkout.session.completed',{...object,payment_status:'paid',amount_total:late.total_cents,currency:'eur'});
  const d=await detail(late.id);assert.equal(d.order.status,'payment_exception');assert.equal(d.order.paymentStatus,'succeeded');
  const [after]=await db.execute("SELECT available FROM variants WHERE id='hood-L'");assert.equal(after[0].available,released[0].available);
  assert.equal((await admin.request('/admin/operations/orders/'+late.id+'/ship',{courier:'Test',trackingNumber:'Test',trackingUrl:'',version:d.order.version})).response.status,409);
  const [incident]=await db.execute('SELECT reason FROM payment_incidents WHERE order_id=?',[late.id]);assert.equal(incident[0].reason,'late_payment');
 });
 await t.test('newsletter requires single-use confirmation and unsubscribe revokes pending tokens',async()=>{
  const email='newsletter-ops@phase1.example',jar=client();
  assert.equal((await jar.request('/newsletter',{email,consent:true})).response.status,200);
  const [pending]=await db.execute('SELECT status FROM subscribers WHERE email=?',[email]);assert.equal(pending[0].status,'pending');
  const confirmation=token(await mail(email,'newsletter-confirm'));
  assert.equal((await jar.request('/newsletter/confirm',{token:confirmation})).response.status,200);
  assert.equal((await jar.request('/newsletter/confirm',{token:confirmation})).response.status,400);
  const unsubscribe=token(await mail(email,'newsletter-unsubscribe'));
  assert.equal((await jar.request('/newsletter/unsubscribe',{token:unsubscribe})).response.status,200);
  assert.equal((await jar.request('/newsletter/unsubscribe',{token:unsubscribe})).response.status,200);
  const [left]=await db.execute('SELECT status,confirmed_utc,unsubscribed_utc,unsubscribe_token_hash FROM subscribers WHERE email=?',[email]);
  assert.equal(left[0].status,'unsubscribed');assert.ok(left[0].confirmed_utc);assert.ok(left[0].unsubscribed_utc);assert.notEqual(left[0].unsubscribe_token_hash,unsubscribe);
 });
 await t.test('provider refunds and disputes are deduplicated and do not regress on older events',async()=>{
  const order=await create(),session='cs_ops_money_'+randomUUID(),intent='pi_ops_money_'+randomUUID(),now=Math.floor(Date.now()/1000);
  await db.execute("UPDATE orders SET payment_mode='Stripe',stripe_session_id=? WHERE id=?",[session,order.id]);
  await sendEvent('checkout.session.completed',{id:session,metadata:{order_id:order.id},payment_intent:intent,payment_status:'paid',amount_total:order.total_cents,currency:'eur'});
  const refund={object:'refund',id:'re_ops_'+randomUUID(),payment_intent:intent,amount:1000,currency:'eur',status:'succeeded',metadata:{}};
  const event=await sendEvent('refund.updated',refund);
  await sendEvent('refund.updated',refund,event);
  await sendEvent('refund.updated',{...refund,status:'pending'},undefined,now-60);
  const before=await detail(order.id);assert.equal(before.order.paymentStatus,'partially_refunded');assert.equal(before.operations.refunds.length,1);assert.equal(before.operations.refunds[0].state,'succeeded');
  const dispute={object:'dispute',id:'dp_ops_'+randomUUID(),payment_intent:intent,amount:1000,currency:'eur',status:'needs_response'};
  await sendEvent('charge.dispute.created',dispute,undefined,now);
  const d=await detail(order.id);assert.equal(d.operations.disputes[0].state,'needs_response');
  const ship={courier:'Fixture',trackingNumber:'FIXTURE',trackingUrl:'',version:d.order.version};
  assert.equal((await admin.request('/admin/operations/orders/'+order.id+'/ship',ship)).response.status,409);
  await sendEvent('charge.dispute.closed',{...dispute,status:'won'},undefined,now+1);
  await sendEvent('charge.dispute.updated',dispute,undefined,now-1);
  const latest=await detail(order.id);assert.equal(latest.operations.disputes[0].state,'won');
  assert.equal((await admin.request('/admin/operations/orders/'+order.id+'/ship',{...ship,version:latest.order.version})).response.status,204);
 });
 await t.test('leases recover abandoned work, dead letters are visible without payloads and replay is audited',async()=>{
  const [source]=await db.execute("SELECT protected_payload FROM background_jobs WHERE kind='email' AND state='completed' LIMIT 1");
  const id=randomUUID().replaceAll('-','');
  await db.execute("INSERT INTO background_jobs(id,dedup_key,kind,protected_payload,state,lease_id,lease_until_utc) VALUES(?,?,'email',?,'processing',?,DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND))",[id,'lease-fixture:'+id,source[0].protected_payload,randomUUID().replaceAll('-','')]);
  await wait(async()=>{const [rows]=await db.execute('SELECT state FROM background_jobs WHERE id=?',[id]);return rows[0]?.state==='completed';});
  const bad=randomUUID().replaceAll('-','');
  await db.execute("INSERT INTO background_jobs(id,dedup_key,kind,protected_payload,attempts) VALUES(?,?,'email','invalid ciphertext',7)",[bad,'dead-fixture:'+bad]);
  await wait(async()=>{const [rows]=await db.execute('SELECT state FROM background_jobs WHERE id=?',[bad]);return rows[0]?.state==='dead';});
  const listing=await admin.request('/admin/operations/jobs');assert.equal(listing.response.status,200);
  assert.equal(JSON.stringify(listing.payload).includes('protectedPayload'),false);
  assert.equal((await admin.request('/admin/operations/jobs/'+bad+'/replay',{})).response.status,204);
  const [audit]=await db.execute("SELECT COUNT(*) n FROM audit_log WHERE action='job.replayed' AND entity_id=?",[bad]);assert.equal(audit[0].n,1);
  const restart=randomUUID().replaceAll('-','');
  await db.execute("INSERT INTO background_jobs(id,dedup_key,kind,protected_payload,next_utc) VALUES(?,?,'email',?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[restart,'restart-fixture:'+restart,source[0].protected_payload]);
  const quoteRequest=input(),quote=(await guest.request('/checkout/quote',{items:quoteRequest.items,country:'GR'})).payload;
  await writeFile(process.env.API_TEST_OPERATIONS_STATE,JSON.stringify({restartJob:restart,quoteRequest:{...quoteRequest,quoteId:quote.id},guestCookie:guest.cookie()}));
 });
});
test.after(async()=>{
 for(const id of orders) {
  await db.execute('DELETE i FROM return_items i JOIN return_requests r ON r.id=i.return_id WHERE r.order_id=?',[id]);
  for(const table of ['return_requests','shipments','refunds','disputes','payment_incidents','order_access_tokens','inventory_movements','order_reservations','order_history','payment_attempts','order_items'])await db.execute('DELETE FROM '+table+' WHERE order_id=?',[id]);
  await db.execute('DELETE FROM orders WHERE id=?',[id]);
 }
 await db.execute("UPDATE variants SET available=CASE size WHEN 'S' THEN 10 WHEN 'M' THEN 15 WHEN 'L' THEN 15 ELSE 10 END,version=version+1 WHERE product_id IN ('hood','crew')");
 await db.end();
});
