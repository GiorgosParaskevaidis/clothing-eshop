import { serverTranslator } from '@/lib/server-language';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cache } from 'react';
import { headers } from 'next/headers';
import { ProductCard } from '@/components/storefront';
import type { Product } from '@/lib/types';
const product = cache(async (slug: string) => {
  const response = await fetch(
    (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:5080') +
      '/api/products/' +
      encodeURIComponent(slug),
    { cache: 'no-store', signal: AbortSignal.timeout(5000) },
  );
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Store unavailable');
  return (await response.json()) as Product;
});
type Props = { params: Promise<{ slug: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await serverTranslator();
  const value = await product((await params).slug);
  return {
    title: value.name,
    description: t(value.description),
    alternates: { canonical: '/products/' + value.slug },
    openGraph: { title: value.name, description: t(value.description), images: [value.frontImage] },
  };
}
export default async function ProductPage({ params }: Props) {
  const t = await serverTranslator();
  const value = await product((await params).slug);
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: value.name,
    description: t(value.description),
    image: [new URL(value.frontImage, site).href],
    offers: {
      '@type': 'Offer',
      url: site + '/products/' + value.slug,
      priceCurrency: value.currency,
      price: (value.priceCents / 100).toFixed(2),
      availability:
        'https://schema.org/' +
        (value.variants.some((v) => v.available > 0) ? 'InStock' : 'OutOfStock'),
    },
  };
  return (
    <main
      id="main-content"
      className="wrap page-shell"
    >
      <Link href="/shop">{t('← All pieces')}</Link>
      <h1 className="page-title">{value.name}</h1>
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
      />
      <div className="checkout-grid">
        <ProductCard product={value} />
        <section className="stack">
          <h2>{t('About this piece')}</h2>
          <p>{t(value.description)}</p>
          <h3>{t('Material')}</h3>
          <p>{value.material || t('Details pending for this demo piece.')}</p>
          <h3>{t('Care')}</h3>
          <p>{value.care || t('Details pending for this demo piece.')}</p>
          <h3>{t('Size guide')}</h3>
          <p className="preserve-lines">
            {value.sizeGuide || t('Details pending for this demo piece.')}
          </p>
          {value.images.slice(2).map((image) => (
            <img
              key={image.id}
              src={image.url}
              alt={image.altText}
              width={image.width}
              height={image.height}
              loading="lazy"
            />
          ))}
        </section>
      </div>
    </main>
  );
}
