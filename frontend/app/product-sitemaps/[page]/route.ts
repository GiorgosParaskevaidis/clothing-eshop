import { products, site, xml } from '@/lib/sitemap';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const page = Number((await params).page);
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    return new Response('Not found', { status: 404 });
  const data = await products(page);
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      data.items
        .map((item) => '<url><loc>' + xml(site + '/products/' + item.slug) + '</loc></url>')
        .join('') +
      '</urlset>',
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}
