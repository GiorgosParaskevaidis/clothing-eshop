import { products, site, xml } from '@/lib/sitemap';
export const dynamic = 'force-dynamic';
export async function GET() {
  const data = await products();
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const entries = [
    '/sitemap.xml',
    ...Array.from({ length: pages }, (_, index) => '/product-sitemaps/' + (index + 1)),
  ];
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      entries.map((path) => '<sitemap><loc>' + xml(site + path) + '</loc></sitemap>').join('') +
      '</sitemapindex>',
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}
