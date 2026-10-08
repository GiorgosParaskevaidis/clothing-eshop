import { Countdown,Crew,ProductCard } from '@/components/storefront';
import { serverApi } from '@/lib/server-api';
import { Product,Store } from '@/lib/types';
export const dynamic='force-dynamic';
export default async function Home() {
  let products:Product[]=[];let unavailable=false;
  let store:Store={brand:'thesamenot',dropOpensAt:'2026-11-14T20:00:00+02:00',salesEnabled:false,shippingCents:400,freeShippingThresholdCents:8000,instagramUrl:'',contactEmail:'',checkoutAvailable:false,simulation:false};
  try {[products,store]=await Promise.all([serverApi<Product[]>('/products'),serverApi<Store>('/store')]);}catch{unavailable=true;}
  return <main id="main-content"><div id="top"/>{store.simulation&&<div className="preview-note">Preview store · Test orders only · No money is charged</div>}<section id="drop" className="wrap hero"><div className="col"><span className="mono season">Winter &apos;26 — Limited edition</span><h1>Drop<br/>01</h1><p className="hero-description">Two pieces. Very few of them. When they are gone, they are gone.</p><Countdown target={store.dropOpensAt}/><div className="hero-buttons"><a className="btn red" href="#products">See the pieces</a><a className="btn" href="#crew">Join the list</a></div></div><div className="art"><div className="disc"/><img src="/images/ghost.png" alt="The thesamenot ghost smoking a cigar" width={680} height={680} fetchPriority="high"/></div></section>
    <div className="tape-clip"><div className="tape" aria-hidden="true">Not the same &nbsp;/&nbsp; Not for everyone &nbsp;/&nbsp; Limited &nbsp;/&nbsp; Not the same &nbsp;/&nbsp; Not for everyone &nbsp;/&nbsp; Limited</div></div>
    <section id="products" className="wrap products-section"><div className="sec-head"><h2 className="big">The pieces</h2><span className="mono edition-note">{products.length.toString().padStart(2,'0')} pieces / {products[0]?.edition??50} units each</span></div>{unavailable?<div className="notice" role="alert">The pieces are temporarily unavailable. Please try again shortly.</div>:<div className="grid2">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>}</section>
    <section id="about"><div className="wrap about-inner"><h2>Not the same.<br/><em>Not for everyone.</em></h2><div className="three"><div><span className="n">01</span><h3>Very few pieces</h3><p>Every drop has a fixed quantity. When it sells out, it does not come back.</p></div><div><span className="n">02</span><h3>Premium sweats</h3><p>Heavyweight fabric, boxy fit, made to last many winters.</p></div><div><span className="n">03</span><h3>Our own artwork</h3><p>The character, the tag and the logo belong to the brand. Screen printed.</p></div></div></div></section><Crew store={store}/>
  </main>;
}
