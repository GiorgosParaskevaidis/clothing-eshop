import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { client,totp } from './auth-client.mjs';
import mysql from 'mysql2/promise';

const state=JSON.parse(await readFile(process.env.API_TEST_AUTH_STATE,'utf8'));
test('persistent key ring keeps sessions and encrypted MFA usable after restart',async()=>{
  const response=await fetch(process.env.API_TEST_URL+'/api/auth/session',{headers:{Cookie:state.customerCookie}});
  assert.equal(response.status,200);
  const jar=client();
  const login=await jar.request('/admin/login',{email:process.env.API_TEST_ADMIN_EMAIL,password:process.env.API_TEST_ADMIN_PASSWORD});
  assert.equal(login.response.status,200);
  const proof=await jar.request('/auth/admin/mfa/verify',{challengeToken:login.payload.challengeToken,code:totp(state.adminKey)});
  assert.equal(proof.response.status,200);
  assert.equal((await jar.request('/admin/session')).response.status,200);
  if(state.paymentSettings) {
    assert.deepEqual((await jar.request('/admin/payment-settings')).payload,state.paymentSettings);
    const bank=(await jar.request('/store')).payload.paymentMethods.find(method=>method.id==='BankTransfer');
    assert.equal(bank.available,false);
    assert.equal(bank.unavailableReason,'Disabled');
  }
  if(process.env.API_TEST_OPERATIONS_STATE){
   const url=new URL(process.env.API_TEST_DB_URL);
   if(url.hostname!=='127.0.0.1'||url.port!=='13307'||!/^\/phase1_[a-f0-9]{12}_test$/.test(url.pathname))throw new Error('Isolated fixture required.');
   const operations=JSON.parse(await readFile(process.env.API_TEST_OPERATIONS_STATE,'utf8')),db=await mysql.createConnection(process.env.API_TEST_DB_URL);
   try{
    const checkout=client();
    for(const pair of operations.guestCookie.split('; ')){const index=pair.indexOf('=');checkout.cookies.set(pair.slice(0,index),pair.slice(index+1));}
    assert.equal((await checkout.request('/checkout',operations.quoteRequest)).response.status,409,'Tax profile changes invalidate old checkout quotes after restart.');
    await db.execute("UPDATE background_jobs SET next_utc=UTC_TIMESTAMP(6) WHERE id=? AND state='pending'",[operations.restartJob]);
    let completed=false;
    for(let i=0;i<100;i++){const [rows]=await db.execute('SELECT state FROM background_jobs WHERE id=?',[operations.restartJob]);if(rows[0]?.state==='completed'){completed=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
    assert.equal(completed,true,'Persisted email work resumes after the real API restart.');
   }finally{await db.end();}
  }
});
test('login rate limit cannot be bypassed with a forged forwarded IP',async()=>{
  const jar=client();
  // The preceding restart test used two of the five shared login-policy permits.
  for(let i=0;i<3;i++) {
    const result=await jar.request('/auth/login',{email:'missing@phase1.example',password:'incorrect'},'POST',
      {headers:{'X-Forwarded-For':'203.0.113.'+(i+1),'X-Forwarded-Proto':'https'}});
    assert.equal(result.response.status,401);
  }
  const rejected=await jar.request('/auth/login',{email:'missing@phase1.example',password:'incorrect'},'POST',
    {headers:{'X-Forwarded-For':'203.0.113.99'}});
  assert.equal(rejected.response.status,429);assert.ok(rejected.response.headers.get('retry-after'));
});
