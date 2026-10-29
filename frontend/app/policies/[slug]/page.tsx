import { serverTranslator } from '@/lib/server-language';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import type { StorePolicy } from '@/lib/types';
const slugs = ['terms', 'privacy', 'returns', 'shipping'];
async function policy(slug: string) {
  if (!slugs.includes(slug)) notFound();
  return serverApi<StorePolicy>('/policies/' + slug);
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const value = await policy((await params).slug);
  const t = await serverTranslator();
  return { title: t(value.title), alternates: { canonical: '/policies/' + value.slug } };
}
export default async function Policy({ params }: { params: Promise<{ slug: string }> }) {
  const t = await serverTranslator();
  const value = await policy((await params).slug);
  return (
    <main
      id="main-content"
      className="wrap page-shell prose"
    >
      <h1 className="page-title">{t(value.title)}</h1>
      {!value.approved && (
        <p className="notice">
          {t('Preview policy — final merchant terms have not been provided.')}
        </p>
      )}
      <p className="preserve-lines">{value.approved ? value.body : t(value.body)}</p>
      <p className="muted">
        {t('Version: ')}
        {value.version}
      </p>
      {value.slug === 'returns' && (
        <Link
          className="btn"
          href="/returns"
        >
          {t('Request a return or withdrawal')}
        </Link>
      )}
      <Link
        className="btn"
        href="/"
      >
        {t('Back to the drop')}
      </Link>
    </main>
  );
}
