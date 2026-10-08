'use client';
import { useEffect,useState } from 'react';
import { api } from '@/lib/api';
import { Product,Store,money } from '@/lib/types';
import { useCart } from './cart';

export function Countdown({target}:{target:string}) {
  const [remaining,setRemaining]=useState<number|null>(null);
  useEffect(()=>{const tick=()=>setRemaining(Math.max(0,new Date(target).getTime()-Date.now()));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[target]);
  const values=remaining===null?[0,0,0,0]:[Math.floor(remaining/86400000),Math.floor(remaining%86400000/3600000),Math.floor(remaining%3600000/60000),Math.floor(remaining%60000/1000)];
  const label=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(target));
  return <div className="countdown"><span className="label muted">{remaining===0?'Drop is live':`Opens ${label} · Athens`}</span><div className="count" role="timer" aria-live="off">{['Days','Hours','Minutes','Secs'].map((label,i)=><div key={label}><b>{String(values[i]).padStart(2,'0')}</b><span>{label}</span></div>)}</div></div>;
}
export function ProductCard({product}:{product:Product}) {
  const cart=useCart();const current=cart.products.find(p=>p.id===product.id)??product;
  const [view,setView]=useState<'front'|'back'>('front');
  const [size,setSize]=useState('L');
  const variant=current.variants.find(v=>v.size===size);
  const available=current.variants.reduce((sum,v)=>sum+v.available,0);
  return <article className="card" aria-label={current.name}><div className="shot"><img src={view==='front'?current.frontImage:current.backImage} alt={`${current.name}, ${view}`} width={900} height={1200} loading="lazy"/><span className="badge">LIMITED / {current.edition}</span></div><div className="info">
    <div className="row">{(['front','back'] as const).map(v=><button key={v} className={`pill ${view===v?'on':''}`} onClick={()=>setView(v)} aria-pressed={view===v}>{v==='front'?'Front':'Back'}</button>)}</div>
    <div className="title"><h3>{current.name}</h3><span>{money(current.priceCents)}</span></div><p className="desc">{current.description}</p>
    <div><span className="label size-label">Size</span><div className="row">{current.variants.map(v=><button key={v.id} className={`chip ${size===v.size?'on':''}`} disabled={v.available===0} aria-label={`${current.name} size ${v.size}${v.available===0?' sold out':''}`} aria-pressed={size===v.size} onClick={()=>setSize(v.size)}>{v.size}</button>)}</div></div>
    <div><div className="meter"><span>AVAILABLE</span><span>{available} / {current.edition}</span></div><div className="bar-bg"><div className="bar-fg" style={{width:`${Math.min(100,available/current.edition*100)}%`}}/></div></div>
    <button className="btn red" disabled={!variant?.available||!cart.ready} onClick={()=>variant&&cart.add(variant.id)}>{variant?.available?'Add to cart':'Sold out'}</button>
  </div></article>;
}
export function Crew({store}:{store:Store}) {
  const [email,setEmail]=useState('');const [consent,setConsent]=useState(false);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function join(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);try{const result=await api<{message:string}>('/newsletter',{method:'POST',body:JSON.stringify({email,consent})});setMessage(result.message);setEmail('');}catch(e){setMessage(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
  return <section id="crew" className="wrap crew"><div><h2>The crew</h2><p>Get drop news before everyone else. After the drop, send us a photo of your piece and you could be on the wall.</p><form onSubmit={join}><label htmlFor="newsletter-email" className="label size-label">Your email</label><div className="form"><input id="newsletter-email" type="email" required maxLength={254} placeholder="email@example.com" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/><button className="btn red" disabled={busy}>Join</button></div><label className="consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to receive drop updates. <a href="/policies/privacy">Privacy</a></label><div className="form-status" role="status">{message}</div></form>{store.instagramUrl&&<a className="btn" href={store.instagramUrl} rel="noopener noreferrer" target="_blank">Instagram</a>}</div><div><span className="mono wall-label">Wall — fills up after the drop</span><div className="wall">{Array.from({length:6},(_,i)=><div key={i}><img src="/images/logo.png" alt="" width={100} height={100} loading="lazy"/></div>)}</div></div></section>;
}
