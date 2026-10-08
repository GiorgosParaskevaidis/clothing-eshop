'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useCart,cartDetails } from '@/components/cart';
import { api } from '@/lib/api';
import { money } from '@/lib/types';
export default function Checkout() {
  const cart=useCart();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [requestKey,setRequestKey]=useState('');
  useEffect(()=>{setRequestKey(crypto.randomUUID());},[]);
  const details=cartDetails(cart.lines,cart.products);
  const subtotal=details.reduce((sum,x)=>sum+(x.product?.priceCents??0)*x.quantity,0);
  const shipping=cart.store&&subtotal<cart.store.freeShippingThresholdCents?cart.store.shippingCents:0;
  const invalid=details.some(x=>!x.product||!x.variant||x.quantity>x.variant.available);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const form=new FormData(event.currentTarget);
    try {const result=await api<{checkoutUrl:string}>('/checkout',{method:'POST',body:JSON.stringify({requestKey,email:form.get('email'),name:form.get('name'),address:form.get('address'),city:form.get('city'),postalCode:form.get('postalCode'),country:'GR',acceptTerms:form.get('terms')==='on',items:cart.lines})});window.location.assign(result.checkoutUrl);}
    catch(e){setError(e instanceof Error?e.message:'Checkout failed');void cart.refresh();setBusy(false);}
  }
  return <main id="main-content" className="wrap page-shell"><Link href="/#products" className="label muted">← Back to the pieces</Link><h1 className="page-title">Checkout</h1>
    {!cart.ready?<p role="status">{cart.error||'Loading your basket…'}</p>:!cart.lines.length?<p>Your cart is empty. <Link href="/#products">Choose a piece.</Link></p>:<div className="checkout-grid"><form className="stack" onSubmit={submit}><h2 className="section-title">Your details</h2><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Full name<input name="name" autoComplete="name" required maxLength={120}/></label><label>Street address<input name="address" autoComplete="street-address" required maxLength={250}/></label><div className="grid2"><label>City<input name="city" autoComplete="address-level2" required maxLength={120}/></label><label>Postal code<input name="postalCode" autoComplete="postal-code" required maxLength={24}/></label></div><label>Country<input value="Greece" readOnly/></label><label className="consent"><input name="terms" type="checkbox" required/>I accept the <Link href="/policies/terms">terms</Link> and <Link href="/policies/privacy">privacy policy</Link>.</label>
      {cart.store?.simulation&&<p className="notice">Test checkout. This order will not charge your card.</p>}
      {invalid&&<p className="notice">Some quantities are no longer available. Update your basket before continuing.</p>}
      {!cart.store?.salesEnabled&&<p className="notice">The drop is not open for orders yet.</p>}
      {cart.store?.salesEnabled&&!cart.store.checkoutAvailable&&<p className="notice">Checkout is temporarily unavailable.</p>}
      {error&&<p role="alert" className="notice">{error} <button type="button" className="text-button" onClick={()=>{setRequestKey(crypto.randomUUID());setError('');}}>Start a new attempt</button></p>}
      <button className="btn red" disabled={busy||invalid||!cart.store?.salesEnabled||!cart.store.checkoutAvailable||!requestKey}>{busy?'Opening checkout…':cart.store?.simulation?'Continue to test checkout':'Continue to secure payment'}</button>
    </form><aside className="summary"><h2 className="section-title">Your pieces</h2>{details.map(x=><div className="crow" key={x.variantId}><div><strong>{x.product?.name}</strong><p className="muted">Size {x.variant?.size} · Quantity {x.quantity}</p></div><span className="mono">{money((x.product?.priceCents??0)*x.quantity)}</span></div>)}<div className="split"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="split"><span>Shipping</span><span>{shipping?money(shipping):'Free'}</span></div><div className="split total"><strong>Total</strong><strong>{money(subtotal+shipping)}</strong></div><p className="muted">The final total is confirmed before payment.</p></aside></div>}
  </main>;
}
