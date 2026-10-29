import type { Metadata } from 'next';
import { CatalogView, type CatalogSearch } from '@/components/catalog';
import { serverTranslator } from '@/lib/server-language';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await serverTranslator();
  return {
    title: t('Shop'),
    description: t('Browse the thesamenot clothing collection.'),
    alternates: { canonical: '/shop' },
  };
}
export default async function Shop({ searchParams }: { searchParams: Promise<CatalogSearch> }) {
  return <CatalogView search={await searchParams} />;
}
