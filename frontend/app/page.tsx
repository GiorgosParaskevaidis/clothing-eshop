import { serverTranslator } from '@/lib/server-language';
import { Countdown, Crew, ProductCard } from '@/components/storefront';
import { serverApi } from '@/lib/server-api';
import { Product, Store } from '@/lib/types';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const t = await serverTranslator();
  let products: Product[] = [];
  let unavailable = false;
  let store: Store = {
    brand: 'thesamenot',
    dropOpensAt: '2026-11-14T20:00:00+02:00',
    salesEnabled: false,
    shippingCents: 400,
    freeShippingThresholdCents: 8000,
    instagramUrl: '',
    contactEmail: '',
    checkoutAvailable: false,
    simulation: false,
    preview: false,
    paymentMethods: [],
  };
  try {
    [products, store] = await Promise.all([
      serverApi<Product[]>('/products'),
      serverApi<Store>('/store'),
    ]);
  } catch {
    unavailable = true;
  }
  return (
    <main id="main-content">
      <div id="top" />
      {store.preview && (
        <div className="preview-note">
          {t('Preview store · Test orders only · Do not send a bank transfer')}
        </div>
      )}
      <section
        id="drop"
        className="wrap hero"
      >
        <div className="col">
          <span className="mono season">{t("Winter '26 — Limited edition")}</span>
          <h1>
            {t('Drop')}
            <br />
            01
          </h1>
          <p className="hero-description">
            {t('Two pieces. Very few of them. When they are gone, they are gone.')}
          </p>
          <Countdown target={store.dropOpensAt} />
          <div className="hero-buttons">
            <a
              className="btn red"
              href="#products"
            >
              {t('See the pieces')}
            </a>
            <a
              className="btn"
              href="#crew"
            >
              {t('Join the list')}
            </a>
          </div>
        </div>
        <div className="art">
          <div className="disc" />
          <img
            src="/images/ghost.png"
            alt={t('The thesamenot ghost smoking a cigar')}
            width={680}
            height={680}
            fetchPriority="high"
          />
        </div>
      </section>
      <div className="tape-clip">
        <div
          className="tape"
          aria-hidden="true"
        >
          {t(
            'Not the same  /  Not for everyone  /  Limited  /  Not the same  /  Not for everyone  /  Limited',
          )}
        </div>
      </div>
      <section
        id="products"
        className="wrap products-section"
      >
        <div className="sec-head">
          <h2 className="big">{t('The pieces')}</h2>
          <Link
            href="/shop"
            className="small-btn"
          >
            {t('Browse all pieces →')}
          </Link>
          <span className="mono edition-note">
            {products.length.toString().padStart(2, '0')}
            {t(' pieces / ')}
            {products[0]?.edition ?? 50} {t('units each')}
          </span>
        </div>
        {unavailable ? (
          <div
            className="notice"
            role="alert"
          >
            {t('The pieces are temporarily unavailable. Please try again shortly.')}
          </div>
        ) : (
          <div className="grid2">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
              />
            ))}
          </div>
        )}
      </section>
      <section id="about">
        <div className="wrap about-inner">
          <h2>
            {t('Not the same.')}
            <br />
            <em>{t('Not for everyone.')}</em>
          </h2>
          <div className="three">
            <div>
              <span className="n">01</span>
              <h3>{t('Very few pieces')}</h3>
              <p>
                {t('Every drop has a fixed quantity. When it sells out, it does not come back.')}
              </p>
            </div>
            <div>
              <span className="n">02</span>
              <h3>{t('Premium sweats')}</h3>
              <p>{t('Heavyweight fabric, boxy fit, made to last many winters.')}</p>
            </div>
            <div>
              <span className="n">03</span>
              <h3>{t('Our own artwork')}</h3>
              <p>{t('The character, the tag and the logo belong to the brand. Screen printed.')}</p>
            </div>
          </div>
        </div>
      </section>
      <Crew store={store} />
    </main>
  );
}
