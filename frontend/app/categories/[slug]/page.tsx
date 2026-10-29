import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import type { Category } from '@/lib/types';
import { CatalogView, type CatalogSearch } from '@/components/catalog';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<CatalogSearch> };
export const dynamic = 'force-dynamic';
async function category(slug: string) {
  return (await serverApi<Category[]>('/categories')).find((item) => item.slug === slug);
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const value = await category((await params).slug);
  if (!value) notFound();
  return { title: value.name, alternates: { canonical: '/categories/' + value.slug } };
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const value = await category((await params).slug);
  if (!value) notFound();
  return (
    <CatalogView
      category={value}
      search={await searchParams}
    />
  );
}
