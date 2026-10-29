import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomBytes } from 'node:crypto';
import { readdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { client,totp } from './auth-client.mjs';

const databaseUrl=new URL(process.env.API_TEST_DB_URL);
if(databaseUrl.hostname!=='127.0.0.1'||databaseUrl.port!=='13307'||!/^\/phase1_[a-f0-9]{12}_test$/.test(databaseUrl.pathname))
  throw new Error('Authentication fixtures require an isolated local phase1 database.');
const db=await mysql.createConnection(process.env.API_TEST_DB_URL);
const mailDirectory=process.env.API_TEST_MAIL_DIR;
const password='Customer-9!'+randomBytes(20).toString('hex');
const email='customer@phase1.example';
const adminEmail=process.env.API_TEST_ADMIN_EMAIL,adminPassword=process.env.API_TEST_ADMIN_PASSWORD;
const hash=value=>createHash('sha256').update(value).digest('hex').toUpperCase();
let admin=client(),customer=client(),adminCodes,adminKey,enrollmentCode;
async function messages(address,purpose) {
  const files=await readdir(mailDirectory);
  const result=await Promise.all(files.map(async file=>JSON.parse(await readFile(path.join(mailDirectory,file),'utf8'))));
  return result.filter(item=>item.email===address&&item.purpose===purpose).sort((a,b)=>a.createdUtc.localeCompare(b.createdUtc));
}
async function token(address,purpose) {
  const message=(await messages(address,purpose)).at(-1);
  assert.ok(message,'Private development email exists.');
  return new URLSearchParams(new URL(message.link).hash.slice(1)).get('token');
}
async function registered(address,jar=client()) {
  assert.equal((await jar.request('/auth/register',{email:address,password,displayName:'Test Customer'})).response.status,202);
  assert.equal((await jar.request('/auth/verify-email',{token:await token(address,'verify-email')})).response.status,200);
  assert.equal((await jar.request('/auth/login',{email:address,password})).response.status,200);
  return jar;
}
async function adminChallenge(jar=admin) {
  const result=await jar.request('/admin/login',{email:adminEmail,password:adminPassword});
  assert.equal(result.response.status,200);assert.equal(result.payload.requiresMfa,true);
  return result.payload.challengeToken;
}
test('phase 1 database identity and security',async t=>{
  await t.test('migration ledger adopts commerce without changing its seed',async()=>{
    const [rows]=await db.query('SELECT version,state FROM schema_migrations ORDER BY version');
    assert.ok(rows.length>=8);assert.ok(rows.every(row=>row.state==='applied'));
    const [products]=await db.query('SELECT COUNT(*) count FROM products');assert.equal(products[0].count,2);
  });
  await t.test('CSRF, Origin and actual body limits protect mutations',async()=>{
    const preflight=await fetch(process.env.API_TEST_URL+'/api/auth/login',{method:'OPTIONS',headers:{Origin:process.env.API_TEST_PUBLIC_URL,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type,X-Store-Request,X-CSRF-Token'}});
    assert.equal(preflight.headers.get('access-control-allow-origin'),process.env.API_TEST_PUBLIC_URL);
    assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');
    const unknownOrigin=await fetch(process.env.API_TEST_URL+'/api/auth/login',{method:'OPTIONS',headers:{Origin:'https://attacker.example','Access-Control-Request-Method':'POST'}});
    assert.equal(unknownOrigin.headers.get('access-control-allow-origin'),null);
    const jar=client();
    assert.equal((await jar.request('/auth/register',{email,password,displayName:'Test'},'POST',{noCsrf:true})).response.status,403);
    assert.equal((await jar.request('/auth/register',{email,password,displayName:'Test'},'POST',{headers:{Origin:'https://attacker.example'}})).response.status,403);
    assert.equal((await jar.request('/auth/register',{email,password,displayName:'x'.repeat(20000)})).response.status,413);
    const verification=await jar.request('/security/csrf');
    const largeBody=JSON.stringify({email,password,displayName:'x'.repeat(20000)});
    const streamed=await fetch(process.env.API_TEST_URL+'/api/auth/register',{method:'POST',duplex:'half',
      headers:{'Content-Type':'application/json','X-Store-Request':'1','X-CSRF-Token':verification.payload.token,Cookie:jar.cookie()},
      body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(largeBody));controller.close();}})});
    assert.equal(streamed.status,413);
    assert.equal((await jar.request('/auth/register',{email,password,displayName:'Test'},'POST',{headers:{'X-CSRF-Token':'invalid'}})).response.status,403);
    const allowed=await jar.request('/auth/forgot-password',{email:'unknown@phase1.example'},'POST',{headers:{Origin:process.env.API_TEST_PUBLIC_URL}});
    assert.equal(allowed.response.status,202);
    assert.equal(allowed.response.headers.get('cache-control'),'no-store');
    assert.equal(allowed.response.headers.get('x-content-type-options'),'nosniff');
  });
  await t.test('password policy rejects weak, common and oversized secrets',async()=>{
    for(const input of ['Ab3!def','ab3!defg','AB3!DEFG','Abc!defg','Ab3zdefg','Ab3defg ','Password1!','PasswordPassword1!','A1!'+'a'.repeat(126)]) {
      assert.equal((await client().request('/auth/register',{email:'weak@phase1.example',password:input,displayName:'Test'})).response.status,400);
    }
  });
  await t.test('eight-character passwords accept punctuation and Unicode character classes',async()=>{
    for(const [index,input] of ['Ab3!defg','Ab3?defg','Αβ3?δεζη','Αβ3😀δεζη'].entries()) {
      const jar=client(),address='policy-'+index+'@phase1.example';
      assert.equal((await jar.request('/auth/register',{email:address,password:input,displayName:'Password Policy'})).response.status,202);
      assert.equal((await jar.request('/auth/verify-email',{token:await token(address,'verify-email')})).response.status,200);
      assert.equal((await jar.request('/auth/login',{email:address,password:input})).response.status,200);
    }
    assert.equal((await client().request('/auth/register',{email:'unicode-short@phase1.example',password:'Αβ3😀δεζ',displayName:'Short'})).response.status,400);
  });
  await t.test('concurrent registration creates one customer and does not accept supplied roles',async()=>{
    const jars=[client(),client(),client()];
    const results=await Promise.all(jars.map(jar=>jar.request('/auth/register',{email,password,displayName:'Customer',role:'Admin',emailConfirmed:true})));
    assert.deepEqual(results.map(r=>r.response.status),[202,202,202]);
    assert.deepEqual(results[0].payload,results[1].payload);
    const [rows]=await db.execute('SELECT id,password_hash,email_confirmed FROM users WHERE normalized_email=?',[email.toUpperCase()]);
    assert.equal(rows.length,1);assert.equal(rows[0].email_confirmed,0);assert.notEqual(rows[0].password_hash,password);
    const [roles]=await db.execute('SELECT role_id FROM user_roles WHERE user_id=?',[rows[0].id]);assert.deepEqual(roles.map(r=>r.role_id),['customer']);
    assert.equal((await customer.request('/auth/login',{email,password})).response.status,401);
  });
  await t.test('email confirmation binds purpose, expires, and works once',async()=>{
    const verification=await token(email,'verify-email');
    assert.equal((await customer.request('/auth/reset-password',{token:verification,password})).response.status,400);
    assert.equal((await customer.request('/auth/verify-email',{token:verification})).response.status,200);
    assert.equal((await customer.request('/auth/verify-email',{token:verification})).response.status,400);
    const [rows]=await db.execute('SELECT token_hash,used_utc FROM user_action_tokens WHERE token_hash=?',[hash(verification)]);
    assert.equal(rows[0].token_hash.length,64);assert.notEqual(rows[0].token_hash,verification);assert.ok(rows[0].used_utc);
    await customer.request('/auth/register',{email:'expired@phase1.example',password,displayName:'Expired'});
    const expired=await token('expired@phase1.example','verify-email');
    await db.execute('UPDATE user_action_tokens SET expires_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE token_hash=?',[hash(expired)]);
    assert.equal((await customer.request('/auth/verify-email',{token:expired})).response.status,400);
  });
  await t.test('customer session uses an HttpOnly cookie and cannot access any admin route',async()=>{
    const result=await customer.request('/auth/login',{email,password});assert.equal(result.response.status,200);
    const cookie=result.response.headers.getSetCookie().join(';');assert.match(cookie,/tsn_customer=/);assert.match(cookie,/httponly/i);assert.match(cookie,/samesite=lax/i);assert.doesNotMatch(cookie,/expires=/i);
    const session=await customer.request('/auth/session');assert.equal(session.payload.email,email);
    const routes=[
      ['/admin/session',null,'GET'],['/admin/products',null,'GET'],['/admin/orders',null,'GET'],['/admin/subscribers',null,'GET'],
      ['/admin/logout',{},'POST'],['/admin/products/hood',{},'PUT'],['/admin/stock/hood-M',{},'PUT'],['/admin/orders/unknown/fulfill',{},'POST'],
      ['/auth/admin/reauth',{password},'POST'],['/auth/admin/recovery-codes',{},'POST'],['/auth/admin/mfa/reset',{},'POST'],
      ['/auth/admin/password/change',{},'POST'],['/auth/admin/email/change',{},'POST'],
      ['/admin/catalog/',null,'GET'],['/admin/catalog/',{},'POST'],['/admin/catalog/categories',null,'GET'],
      ['/admin/media/unknown.webp',null,'GET'],['/admin/shipping',null,'GET'],['/admin/shipping',{},'PUT'],
      ['/admin/users',null,'GET'],['/admin/operations/orders',null,'GET'],['/admin/operations/jobs',null,'GET']
    ];
    for(const [route,body,method] of routes) assert.equal((await customer.request(route,body,method)).response.status,401,route);
  });
  await t.test('registration confirmation signs in its browser with a fresh customer-only session',async()=>{
    const jar=client(),address='auto-session@phase1.example';
    const registration=await jar.request('/auth/register',{email:address,password,displayName:'Automatic Customer'});
    assert.equal(registration.response.status,202);
    const registrationCookie=registration.response.headers.getSetCookie().join(';');
    assert.match(registrationCookie,/tsn_registration=/);assert.match(registrationCookie,/httponly/i);
    assert.match(registrationCookie,/samesite=strict/i);assert.match(registrationCookie,/max-age=86400/i);
    const continuation=jar.cookies.get('tsn_registration');
    const verification=await token(address,'verify-email');
    const confirmed=await jar.request('/auth/verify-email',{token:verification});
    assert.equal(confirmed.response.status,200);assert.equal(confirmed.payload.signedIn,true);
    assert.match(confirmed.response.headers.getSetCookie().join(';'),/tsn_customer=/);
    assert.equal(jar.cookies.get('tsn_registration'),'');
    assert.equal((await jar.request('/auth/session')).payload.email,address);
    assert.equal((await jar.request('/admin/session')).response.status,401);
    const [sessions]=await db.execute('SELECT s.amr FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE u.normalized_email=?',[address.toUpperCase()]);
    assert.deepEqual(sessions.map(row=>row.amr),['email']);
    const replay=client();replay.cookies.set('tsn_registration',continuation);
    assert.equal((await replay.request('/auth/verify-email',{token:verification})).response.status,400);
    assert.equal((await replay.request('/auth/session')).response.status,401);
  });
  await t.test('verification in another browser or with an invalid registration cookie confirms without signing in',async()=>{
    const original=client(),other=client(),address='other-browser@phase1.example';
    await original.request('/auth/register',{email:address,password,displayName:'Other Browser'});
    const duplicate=await other.request('/auth/register',{email:address,password,displayName:'Duplicate'});
    assert.equal(duplicate.response.status,202);
    assert.match(duplicate.response.headers.getSetCookie().join(';'),/tsn_registration=/);
    // Duplicate requests have indistinguishable cookies but cannot authorize the existing account.
    const reply=await other.request('/auth/verify-email',{token:await token(address,'verify-email')});
    assert.equal(reply.response.status,200);assert.equal(reply.payload.signedIn,false);
    assert.equal((await other.request('/auth/session')).response.status,401);
    for(const [index,value] of ['not-a-valid-value','a'.repeat(1025)].entries()) {
      const jar=client(),email='invalid-continuation-'+index+'@phase1.example';
      await jar.request('/auth/register',{email,password,displayName:'Invalid Continuation'});
      jar.cookies.set('tsn_registration',value);
      const result=await jar.request('/auth/verify-email',{token:await token(email,'verify-email')});
      assert.equal(result.response.status,200);assert.equal(result.payload.signedIn,false);
      assert.equal((await jar.request('/auth/session')).response.status,401);
    }
    const jar=client(),foreign=client();
    await jar.request('/auth/register',{email:'continuation-a@phase1.example',password,displayName:'A'});
    await foreign.request('/auth/register',{email:'continuation-b@phase1.example',password,displayName:'B'});
    const mismatch=await jar.request('/auth/verify-email',{token:await token('continuation-b@phase1.example','verify-email')});
    assert.equal(mismatch.response.status,200);assert.equal(mismatch.payload.signedIn,false);
    assert.equal((await jar.request('/auth/session')).response.status,401);
  });
  await t.test('automatic confirmation cannot bypass admin MFA, account lockout, disabled state or changed stamps',async()=>{
    for(const kind of ['admin','mfa','locked','disabled','stamp']) {
      const jar=client(),address='restricted-confirmation-'+kind+'@phase1.example';
      await jar.request('/auth/register',{email:address,password,displayName:'Restricted'});
      const verification=await token(address,'verify-email');
      if(kind==='admin') await db.execute('INSERT INTO user_roles(user_id,role_id) SELECT id,? FROM users WHERE normalized_email=?',['admin',address.toUpperCase()]);
      if(kind==='mfa') await db.execute('UPDATE users SET two_factor_enabled=1 WHERE normalized_email=?',[address.toUpperCase()]);
      if(kind==='locked') await db.execute('UPDATE users SET lockout_end_utc=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE) WHERE normalized_email=?',[address.toUpperCase()]);
      if(kind==='disabled') await db.execute('UPDATE users SET enabled=0 WHERE normalized_email=?',[address.toUpperCase()]);
      if(kind==='stamp') await db.execute('UPDATE users SET security_stamp=? WHERE normalized_email=?',[randomBytes(16).toString('hex'),address.toUpperCase()]);
      const result=await jar.request('/auth/verify-email',{token:verification});
      assert.equal(result.response.status,kind==='disabled'||kind==='stamp'?400:200);
      if(result.response.status===200) assert.equal(result.payload.signedIn,false);
      assert.equal((await jar.request('/auth/session')).response.status,401);
      assert.equal((await jar.request('/admin/session')).response.status,401);
    }
  });
  await t.test('confirmation cannot silently replace a different signed-in customer',async()=>{
    const jar=await registered('existing-session@phase1.example');
    const address='new-account-while-signed-in@phase1.example';
    await jar.request('/auth/register',{email:address,password,displayName:'New Account'});
    const confirmed=await jar.request('/auth/verify-email',{token:await token(address,'verify-email')});
    assert.equal(confirmed.response.status,200);assert.equal(confirmed.payload.signedIn,false);
    assert.equal((await jar.request('/auth/session')).payload.email,'existing-session@phase1.example');
  });
  await t.test('admin password alone grants no access; authenticator enrollment protects its secret',async()=>{
    const challenge=await adminChallenge();
    assert.equal((await admin.request('/admin/products')).response.status,401);
    const setup=await admin.request('/auth/admin/mfa/setup',{token:challenge});assert.equal(setup.response.status,200);
    adminKey=setup.payload.key;
    const [rows]=await db.execute('SELECT protected_key FROM user_mfa JOIN users ON users.id=user_mfa.user_id WHERE users.email=?',[adminEmail]);
    assert.ok(!rows[0].protected_key.includes(adminKey));
    enrollmentCode=totp(adminKey);
    const result=await admin.request('/auth/admin/mfa/verify',{challengeToken:challenge,code:enrollmentCode});
    assert.equal(result.response.status,200);adminCodes=result.payload.recoveryCodes;assert.equal(adminCodes.length,10);
    assert.match(result.response.headers.getSetCookie().join(';'),/samesite=strict/i);
    assert.equal((await admin.request('/admin/products')).response.status,200);
    assert.equal((await admin.request('/auth/session')).response.status,401);
    assert.equal((await admin.request('/auth/admin/mfa/verify',{challengeToken:challenge,code:totp(adminKey)})).response.status,401);
  });
  await t.test('TOTP replay and expired challenges are rejected',async()=>{
    const jar=client(),challenge=await adminChallenge(jar);
    assert.equal((await jar.request('/auth/admin/mfa/verify',{challengeToken:challenge,code:enrollmentCode})).response.status,401);
    await db.execute('UPDATE user_action_tokens SET expires_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE token_hash=?',[hash(challenge)]);
    assert.equal((await jar.request('/auth/admin/mfa/verify',{challengeToken:challenge,code:adminCodes[0]})).response.status,401);
  });
  await t.test('recovery code redemption is atomic across concurrent challenges',async()=>{
    const first=client(),second=client();
    const a=await adminChallenge(first),b=await adminChallenge(second);
    const results=await Promise.all([first.request('/auth/admin/mfa/verify',{challengeToken:a,code:adminCodes[0]}),second.request('/auth/admin/mfa/verify',{challengeToken:b,code:adminCodes[0]})]);
    assert.deepEqual(results.map(r=>r.response.status).sort(),[200,401]);
    const [codes]=await db.execute('SELECT code_hash,used_utc FROM user_recovery_codes WHERE code_hash=?',[hash(adminCodes[0])]);assert.ok(codes[0].used_utc);
  });
  await t.test('regenerating recovery codes requires password and MFA and invalidates old codes',async()=>{
    assert.equal((await admin.request('/auth/admin/reauth',{password:'incorrect password'})).response.status,401);
    const reauth=await admin.request('/auth/admin/reauth',{password:adminPassword});assert.equal(reauth.response.status,200);
    const result=await admin.request('/auth/admin/recovery-codes',{challengeToken:reauth.payload.challengeToken,code:adminCodes[1]});
    assert.equal(result.response.status,200);const old=adminCodes[2];adminCodes=result.payload.recoveryCodes;
    const jar=client(),challenge=await adminChallenge(jar);
    assert.equal((await jar.request('/auth/admin/mfa/verify',{challengeToken:challenge,code:old})).response.status,401);
  });
  await t.test('MFA replacement revokes sessions and demands a new enrollment',async()=>{
    const reauth=await admin.request('/auth/admin/reauth',{password:adminPassword});
    const reset=await admin.request('/auth/admin/mfa/reset',{challengeToken:reauth.payload.challengeToken,code:adminCodes[0]});
    assert.equal(reset.response.status,200);assert.equal(reset.payload.requiresSetup,true);
    assert.equal((await admin.request('/admin/session')).response.status,401);
    const setup=await admin.request('/auth/admin/mfa/setup',{token:reset.payload.challengeToken});
    assert.equal(setup.response.status,200);assert.notEqual(setup.payload.key,adminKey);adminKey=setup.payload.key;
    const result=await admin.request('/auth/admin/mfa/verify',{challengeToken:reset.payload.challengeToken,code:totp(adminKey)});
    assert.equal(result.response.status,200);adminCodes=result.payload.recoveryCodes;
  });
  await t.test('unknown and known password recovery responses do not expose account existence',async()=>{
    const known=await customer.request('/auth/forgot-password',{email}),unknown=await customer.request('/auth/forgot-password',{email:'unknown-again@phase1.example'});
    assert.equal(known.response.status,202);assert.deepEqual(known.payload,unknown.payload);
    assert.equal((await messages('unknown-again@phase1.example','reset-password')).length,0);
  });
  await t.test('logout revokes only this device and the old cookie cannot be replayed',async()=>{
    const second=client();assert.equal((await second.request('/auth/login',{email,password})).response.status,200);
    const oldCookie=customer.cookie();
    assert.equal((await customer.request('/auth/logout',{})).response.status,204);
    assert.equal((await customer.request('/auth/session',null,'GET',{headers:{Cookie:oldCookie}})).response.status,401);
    assert.equal((await second.request('/auth/session')).response.status,200);
    customer=second;
  });
  await t.test('password reset expires once, revokes all sessions and replaces the hash',async()=>{
    const raw=await token(email,'reset-password');
    const replacement=password+'-reset';
    assert.equal((await client().request('/auth/reset-password',{token:raw,password:'Ab3zdefg'})).response.status,400);
    assert.equal((await client().request('/auth/reset-password',{token:raw,password:replacement})).response.status,204);
    assert.equal((await client().request('/auth/reset-password',{token:raw,password:replacement})).response.status,400);
    assert.equal((await customer.request('/auth/session')).response.status,401);
    assert.equal((await customer.request('/auth/login',{email,password})).response.status,401);
    assert.equal((await customer.request('/auth/login',{email,password:replacement})).response.status,200);
  });
  await t.test('email change confirms the new address and revokes existing sessions',async()=>{
    const target='changed@phase1.example',replacement=password+'-reset';
    assert.equal((await customer.request('/auth/email/change',{email:target,password:replacement})).response.status,202);
    const raw=await token(target,'change-email');
    assert.equal((await client().request('/auth/email/confirm',{token:raw})).response.status,204);
    assert.equal((await customer.request('/auth/session')).response.status,401);
    assert.equal((await customer.request('/auth/login',{email,password:replacement})).response.status,401);
    assert.equal((await customer.request('/auth/login',{email:target,password:replacement})).response.status,200);
    assert.equal((await customer.request('/auth/password/change',{currentPassword:replacement,newPassword:'Ab3zdefg'})).response.status,400);
    assert.equal((await customer.request('/auth/password/change',{currentPassword:replacement,newPassword:password+'-changed'})).response.status,204);
    assert.equal((await customer.request('/auth/session')).response.status,401);
  });
  await t.test('account lockout is atomic, does not extend while locked, and resets after expiry',async()=>{
    const address='locked@phase1.example',jar=await registered(address);
    const attempts=await Promise.all(Array.from({length:5},()=>client().request('/auth/login',{email:address,password:'incorrect'})));
    assert.deepEqual(attempts.map(r=>r.response.status),[401,401,401,401,401]);
    const [before]=await db.execute('SELECT lockout_end_utc FROM users WHERE email=?',[address]);
    assert.ok(before[0].lockout_end_utc);
    assert.equal((await jar.request('/auth/login',{email:address,password})).response.status,401);
    await jar.request('/auth/login',{email:address,password:'incorrect'});
    const [after]=await db.execute('SELECT lockout_end_utc FROM users WHERE email=?',[address]);assert.equal(+before[0].lockout_end_utc,+after[0].lockout_end_utc);
    await db.execute('UPDATE users SET lockout_end_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE email=?',[address]);
    await jar.request('/auth/login',{email:address,password:'incorrect'});
    const [reset]=await db.execute('SELECT access_failed_count,lockout_end_utc FROM users WHERE email=?',[address]);assert.equal(reset[0].access_failed_count,1);assert.equal(reset[0].lockout_end_utc,null);
    assert.equal((await jar.request('/auth/login',{email:address,password})).response.status,200);
  });
  await t.test('disabled users, removed roles, security stamps and expired sessions revoke access immediately',async()=>{
    const address='revoked@phase1.example',jar=await registered(address);
    await db.execute('UPDATE users SET enabled=FALSE WHERE email=?',[address]);assert.equal((await jar.request('/auth/session')).response.status,401);
    await db.execute('UPDATE users SET enabled=TRUE WHERE email=?',[address]);assert.equal((await jar.request('/auth/login',{email:address,password})).response.status,200);
    await db.execute("DELETE ur FROM user_roles ur JOIN users u ON u.id=ur.user_id WHERE u.email=?",[address]);assert.equal((await jar.request('/auth/session')).response.status,401);
    await db.execute("INSERT INTO user_roles(user_id,role_id) SELECT id,'customer' FROM users WHERE email=?",[address]);
    assert.equal((await jar.request('/auth/login',{email:address,password})).response.status,200);
    await db.execute("UPDATE users SET security_stamp=REPLACE(UUID(),'-','') WHERE email=?",[address]);assert.equal((await jar.request('/auth/session')).response.status,401);
    assert.equal((await jar.request('/auth/login',{email:address,password})).response.status,200);
    await db.execute('UPDATE user_sessions s JOIN users u ON u.id=s.user_id SET s.expires_utc=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE u.email=?',[address]);
    assert.equal((await jar.request('/auth/session')).response.status,401);
  });
  await t.test('target throttling counts requests for unknown accounts and supplies Retry-After',async()=>{
    const jar=client(),address='throttled@phase1.example';
    for(let i=0;i<5;i++) assert.equal((await jar.request('/auth/forgot-password',{email:address})).response.status,202);
    const last=await jar.request('/auth/forgot-password',{email:address});assert.equal(last.response.status,429);assert.ok(last.response.headers.get('retry-after'));
  });
  await t.test('persisted test state supports restart and commerce checks without exposing secrets',async()=>{
    const jar=await registered('restart@phase1.example');
    await writeFile(process.env.API_TEST_AUTH_STATE,JSON.stringify({adminCodes,adminKey,customerCookie:jar.cookie()}));
  });
});
test.after(async()=>{await db.end();});
