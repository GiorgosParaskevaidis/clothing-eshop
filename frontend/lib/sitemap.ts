import { serverApi } from './server-api';
export type SitemapData = {
  total: number;
  pageSize: number;
  items: { slug: string; updatedUtc: string }[];
};
export const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const xml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
export const products = (page = 1) => serverApi<SitemapData>('/catalog/sitemap?page=' + page);
