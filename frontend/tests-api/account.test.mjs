import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {client} from './auth-client.mjs';

const url=new URL(process.env.API_TEST_DB_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='13307'||!/^\/phase1_[a-f0-9]{12}_test$/.test(url.pathname))throw new Error('Isolated fixture database required.');
const db=await mysql.createConnection(process.env.API_TEST_DB_URL),ownedOrders=new Set();
const password='Account-7!'+randomBytes(12).toString('hex');
const address={label:'Home',name:'Customer A',address:'Saved Street 1',city:'Athens',postalCode:'10563',country:'GR',phone:'2101234567',isDefault:true,version:0};
const checkout=(email,key=randomUUID())=>({requestKey:key,paymentMethod:'CashOnDelivery',email,name:'Order Snapshot',address:'Order Street 1',city:'Athens',postalCode:'10563',country:'GR',acceptTerms:true,items:[{variantId:'hood-M',quantity:1}]});
async function mailToken(email,purpose){
  const messages=await Promise.all((await readdir(process.env.API_TEST_MAIL_DIR)).map(async file=>JSON.parse(await readFile(path.join(process.env.API_TEST_MAIL_DIR,file),'utf8'))));
  const message=messages.filter(item=>item.email.toLowerCase()===email.toLowerCase()&&item.purpose===purpose).sort((a,b)=>a.createdUtc.localeCompare(b.createdUtc)).at(-1);
  assert.ok(message,'Captured fixture email exists.');
  return new URLSearchParams(new URL(message.link).hash.slice(1)).get('token');
}
async function customer(name){
  const jar=client(),email='phase2-'+name+'@phase1.example';
  assert.equal((await jar.request('/auth/register',{email,password,displayName:name})).response.status,202);
  assert.equal((await jar.request('/auth/verify-email',{token:await mailToken(email,'verify-email')})).payload.signedIn,true);
  return {jar,email,id:(await jar.request('/auth/session')).payload.id};
}
async function order(jar,email,key){
  assert.equal((await jar.request('/checkout/context')).response.status,200);
  const response=await jar.request('/checkout',checkout(email,key));assert.equal(response.response.status,200,JSON.stringify(response.payload));
  const [rows]=await db.execute('SELECT id,order_number,user_id,email FROM orders WHERE public_token=?',[response.payload.publicToken]);
  ownedOrders.add(rows[0].id);return {...rows[0],publicToken:response.payload.publicToken,payload:response.payload};
}
let first,second,guest;
test('phase 2 ownership, profiles, addresses and guest orders',async t=>{
  first=await customer('first');second=await customer('second');
  await t.test('anonymous and customer requests cannot access protected account or customer admin data',async()=>{
    const anonymous=client();
    for(const route of ['/account','/account/addresses','/account/orders'])assert.equal((await anonymous.request(route)).response.status,401);
    assert.equal((await first.jar.request('/admin/users')).response.status,401);
    assert.equal((await first.jar.request('/account/orders?pageSize=101')).response.status,400);
  });
  await t.test('profile versions prevent stale writes and supplied user ids have no authority',async()=>{
    const profile=(await first.jar.request('/account')).payload;
    assert.equal((await first.jar.request('/account',{displayName:'New name',version:profile.version,userId:second.id},'PUT')).response.status,200);
    assert.equal((await first.jar.request('/account',{displayName:'Stale',version:profile.version},'PUT')).response.status,409);
    assert.equal((await second.jar.request('/account')).payload.displayName,'second');
  });
  let saved;
  await t.test('address ownership, stale versions, validation and single default are enforced in SQL',async()=>{
    saved=(await first.jar.request('/account/addresses',address)).payload;assert.ok(saved.id);
    const another=(await first.jar.request('/account/addresses',{...address,label:'Work',address:'Work Street 2'})).payload;
    const list=(await first.jar.request('/account/addresses')).payload;assert.equal(list.filter(item=>item.isDefault).length,1);
    assert.equal((await second.jar.request('/account/addresses/'+saved.id,address,'PUT')).response.status,404);
    assert.equal((await second.jar.request('/account/addresses/'+saved.id+'?version=0',null,'DELETE')).response.status,404);
    assert.equal((await first.jar.request('/account/addresses/'+saved.id,address,'PUT')).response.status,409);
    assert.equal((await first.jar.request('/account/addresses',{...address,country:'XX'})).response.status,400);
    assert.equal((await first.jar.request('/account/addresses/'+another.id+'?version='+another.version,null,'DELETE')).response.status,204);
    saved=(await first.jar.request('/account/addresses')).payload[0];assert.equal(saved.isDefault,true);
  });
  let linked;
  await t.test('account checkout uses the session owner and verified email, and order snapshots remain immutable',async()=>{
    linked=await order(first.jar,second.email);
    assert.equal(linked.user_id,first.id);assert.equal(linked.email,first.email);
    assert.equal((await first.jar.request('/account/orders')).payload.total,1);
    assert.equal((await second.jar.request('/account/orders/'+linked.id)).response.status,404);
    assert.equal((await second.jar.request('/account/orders')).payload.total,0);
    assert.equal((await first.jar.request('/account/addresses/'+saved.id,{...address,address:'Changed address',version:saved.version},'PUT')).response.status,200);
    assert.equal((await first.jar.request('/account/orders/'+linked.id)).payload.address,'Order Street 1');
    const publicReceipt=(await client().request('/orders/'+linked.publicToken)).payload;
    for(const field of ['email','address','phone','userId','checkoutOwner'])assert.equal(field in publicReceipt,false);
  });
  await t.test('idempotency is scoped to customer and guest identities instead of a caller-supplied owner',async()=>{
    const key=randomUUID(),one=await order(first.jar,first.email,key),two=await order(second.jar,second.email,key);
    assert.notEqual(one.publicToken,two.publicToken);
    const again=await order(first.jar,first.email,key);assert.equal(again.id,one.id);
    const g1=client(),g2=client(),gkey=randomUUID();
    assert.notEqual((await order(g1,'guest-scope@phase1.example',gkey)).id,(await order(g2,'guest-scope@phase1.example',gkey)).id);
    assert.equal((await client().request('/checkout',checkout('no-context@phase1.example'))).response.status,409);
  });
  await t.test('registration does not automatically claim a guest order with matching email',async()=>{
    guest=await order(client(),first.email);
    assert.equal(guest.user_id,null);
    const list=(await first.jar.request('/account/orders')).payload;assert.ok(!list.items.some(item=>item.id===guest.id));
    assert.equal((await first.jar.request('/account/orders/'+guest.id)).response.status,404);
  });
  let access;
  const guestClient=client();
  await t.test('guest access has generic responses, hashed single-use tokens and a short-lived HttpOnly grant',async()=>{
    const known=await guestClient.request('/orders/access-link',{email:first.email.toUpperCase(),orderNumber:guest.order_number,purpose:'access'});
    const unknown=await guestClient.request('/orders/access-link',{email:'unknown-link@phase1.example',orderNumber:guest.order_number,purpose:'access'});
    assert.equal(known.response.status,202);assert.deepEqual(known.payload,unknown.payload);
    access=await mailToken(first.email,'order-access');
    const [rows]=await db.execute('SELECT token_hash FROM order_access_tokens WHERE order_id=?',[guest.id]);
    assert.notEqual(rows[0].token_hash,access);assert.equal(rows[0].token_hash,createHash('sha256').update(access).digest('hex').toUpperCase());
    assert.equal((await guestClient.request('/orders/claim',{token:access})).response.status,401);
    const result=await guestClient.request('/orders/access',{token:access});assert.equal(result.response.status,204);
    assert.match(result.response.headers.getSetCookie().join(';'),/httponly/i);
    assert.match(result.response.headers.getSetCookie().join(';'),/max-age=900/i);
    assert.equal((await guestClient.request('/orders/access')).payload.address,'Order Street 1');
    assert.equal((await client().request('/orders/access',{token:access})).response.status,400);
    assert.equal((await client().request('/orders/access')).response.status,401);
  });
  await t.test('claim needs the correct purpose, verified matching account and succeeds only once',async()=>{
    assert.equal((await first.jar.request('/orders/claim',{token:access})).response.status,400);
    await first.jar.request('/orders/access-link',{email:first.email,orderNumber:guest.order_number,purpose:'claim'});
    const claim=await mailToken(first.email,'order-claim');
    assert.equal((await second.jar.request('/orders/claim',{token:claim})).response.status,400);
    const results=await Promise.all([first.jar.request('/orders/claim',{token:claim}),first.jar.request('/orders/claim',{token:claim})]);
    assert.deepEqual(results.map(value=>value.response.status).sort(),[200,400]);
    assert.equal((await first.jar.request('/account/orders/'+guest.id)).response.status,200);
    assert.equal((await guestClient.request('/orders/access')).response.status,401);
  });
  await t.test('expired and revoked guest links cannot be exchanged',async()=>{
    const unowned=await order(client(),'expiry-order@phase1.example'),jar=client();
    await jar.request('/orders/access-link',{email:unowned.email,orderNumber:unowned.order_number,purpose:'access'});
    const old=await mailToken(unowned.email,'order-access');
    await jar.request('/orders/access-link',{email:unowned.email,orderNumber:unowned.order_number,purpose:'access'});
    assert.equal((await jar.request('/orders/access',{token:old})).response.status,400);
    const latest=await mailToken(unowned.email,'order-access');
    await db.execute('UPDATE order_access_tokens SET expires_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE order_id=?',[unowned.id]);
    assert.equal((await jar.request('/orders/access',{token:latest})).response.status,400);
  });
  await t.test('admin customer disable revokes sessions immediately and never exposes credentials',async()=>{
    const state=JSON.parse(await readFile(process.env.API_TEST_AUTH_STATE,'utf8')),admin=client();
    const challenge=await admin.request('/admin/login',{email:process.env.API_TEST_ADMIN_EMAIL,password:process.env.API_TEST_ADMIN_PASSWORD});
    assert.equal((await admin.request('/auth/admin/mfa/verify',{challengeToken:challenge.payload.challengeToken,code:state.adminCodes[4]})).response.status,200);
    const rows=(await admin.request('/admin/users?search='+encodeURIComponent(second.email))).payload.items;
    assert.equal(rows.length,1);for(const key of ['passwordHash','securityStamp','concurrencyStamp'])assert.equal(key in rows[0],false);
    assert.equal((await admin.request('/admin/users/'+second.id+'/disable',{})).response.status,204);
    assert.equal((await second.jar.request('/auth/session')).response.status,401);
    assert.equal((await admin.request('/admin/users/'+second.id+'/enable',{})).response.status,204);
    assert.equal((await second.jar.request('/auth/session')).response.status,401);
    assert.equal((await second.jar.request('/auth/login',{email:second.email,password})).response.status,200);
  });
});
test.after(async()=>{
  for(const id of ownedOrders){
    for(const table of ['inventory_movements','order_reservations','order_history','payment_attempts','payment_incidents'])await db.execute('DELETE FROM '+table+' WHERE order_id=?',[id]);
    await db.execute('DELETE FROM order_access_tokens WHERE order_id=?',[id]);
    await db.execute('DELETE FROM order_items WHERE order_id=?',[id]);
    await db.execute('DELETE FROM orders WHERE id=?',[id]);
  }
  await db.execute("UPDATE variants SET available=CASE size WHEN 'S' THEN 10 WHEN 'M' THEN 15 WHEN 'L' THEN 15 ELSE 10 END,version=version+1");
  await db.end();
});
