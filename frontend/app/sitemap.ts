import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-api';
import type { Category } from '@/lib/types';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const categories = await serverApi<Category[]>('/categories');
  return [
    '',
    '/shop',
    '/policies/shipping',
    '/policies/returns',
    '/policies/terms',
    '/policies/privacy',
    ...categories.map((category) => '/categories/' + category.slug),
  ].map((path) => ({ url: site + path, changeFrequency: 'weekly', priority: path ? 0.5 : 1 }));
}
