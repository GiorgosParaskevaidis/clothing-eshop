'use client';
import { useEffect,useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Receipt,money } from '@/lib/types';
import { useCart } from './cart';
export function ReceiptView({simulation=false}:{simulation?:boolean}) {
  const params=useSearchParams();const router=useRouter();const cart=useCart();const token=params.get('token')??'';
  const [order,setOrder]=useState<Receipt|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!token){setError('Order not found.');return;}
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    async function load(){try{const result=await api<Receipt>(`/orders/${encodeURIComponent(token)}`);if(cancelled)return;setOrder(result);if(result.status==='pending'&&!simulation)timer=setTimeout(load,2500);}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load order');}}
    void load();return()=>{cancelled=true;clearTimeout(timer);};
  },[token,simulation]);
  useEffect(()=>{if(order?.status==='paid'||order?.status==='fulfilled'){cart.clear();void cart.refresh();}},[order?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  async function complete(){setBusy(true);try{await api('/payments/simulation',{method:'POST',body:JSON.stringify({token})});router.push(`/checkout/success?token=${encodeURIComponent(token)}`);}catch(e){setError(e instanceof Error?e.message:'Test payment failed');setBusy(false);}}
  return <main id="main-content" className="wrap page-shell receipt"><span className="label season">{simulation?'Test checkout':'Your order'}</span><h1 className="page-title">{simulation?'Try the flow.':order?.status==='paid'||order?.status==='fulfilled'?'You got it.':'Order status'}</h1>{error&&<p className="notice" role="alert">{error}</p>}{!order&&!error&&<p>Loading order…</p>}{order&&<><p className="mono">Order {order.number} · {order.status.toUpperCase()}</p>{order.paymentMode==='Simulation'&&<p className="notice">This is a test order. No payment has been taken.</p>}{order.status==='pending'&&!simulation&&<p>We are waiting for payment confirmation. This page will update automatically.</p>}{order.status==='expired'&&<p>This checkout expired. Your reservation has been released.</p>}<div className="summary">{order.items.map(x=><div className="crow" key={x.variantId}><span>{x.productName} / {x.size} × {x.quantity}</span><span>{money(x.unitPriceCents*x.quantity)}</span></div>)}<div className="split"><span>Shipping</span><span>{money(order.shippingCents)}</span></div><div className="split total"><strong>Total</strong><strong>{money(order.totalCents)}</strong></div></div>{simulation&&order.paymentMode==='Simulation'&&order.status==='pending'&&<button className="btn red" disabled={busy} onClick={complete}>{busy?'Completing…':'Simulate successful payment'}</button>}</>}<Link className="btn" href="/">Back to the drop</Link></main>;
}
