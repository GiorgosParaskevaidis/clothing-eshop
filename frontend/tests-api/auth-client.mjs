import { createHmac } from 'node:crypto';

export function client(base=process.env.API_TEST_URL) {
  const cookies=new Map();
  let csrf;
  function receive(response) {
    for(const value of response.headers.getSetCookie()) {
      const pair=value.split(';')[0],index=pair.indexOf('=');
      cookies.set(pair.slice(0,index),pair.slice(index+1));
    }
  }
  const cookie=()=>Array.from(cookies,([key,value])=>key+'='+value).join('; ');
  async function request(path,body,method=body?'POST':'GET',options={}) {
    if(path==='/checkout'&&body?.items&&!body.quoteId&&!options.skipQuote) {
      const quote=await request('/checkout/quote',{items:body.items,country:body.country});
      if(quote.response.ok)body={...body,quoteId:quote.payload.id};
    }
    if(method!=='GET'&&method!=='HEAD'&&!options.noCsrf&&!csrf) {
      const response=await fetch(base+'/api/security/csrf',{headers:{Cookie:cookie()}});
      receive(response);csrf=(await response.json()).token;
    }
    const response=await fetch(base+'/api'+path,{method,
      headers:{'Content-Type':'application/json','X-Store-Request':'1',Cookie:cookie(),...(csrf&&!options.noCsrf?{'X-CSRF-Token':csrf}:{}),...options.headers},
      body:options.rawBody??(body?JSON.stringify(body):undefined)});
    receive(response);
    return {response,payload:await response.json().catch(()=>null)};
  }
  return {request,cookie,cookies};
}
export function totp(secret,time=Date.now()) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits=0,value=0;const bytes=[];
  for(const char of secret.toUpperCase()) {
    const index=alphabet.indexOf(char);if(index<0) continue;
    value=(value<<5)|index;bits+=5;
    if(bits>=8){bits-=8;bytes.push((value>>bits)&255);}
  }
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));
  const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();
  const offset=hash[hash.length-1]&15;
  return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
