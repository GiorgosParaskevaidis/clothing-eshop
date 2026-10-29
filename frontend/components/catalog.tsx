import { serverTranslator } from '@/lib/server-language';
import Link from 'next/link';
import { serverApi, ServerApiError } from '@/lib/server-api';
import type { Product, Category, PageResult } from '@/lib/types';
import { ProductCard } from './storefront';

export type CatalogSearch = Record<string, string | string[] | undefined>;
const keys = ['query', 'size', 'color', 'minPrice', 'maxPrice', 'inStock', 'sort', 'page'] as const;
export async function CatalogView({
  search,
  category,
}: {
  search: CatalogSearch;
  category?: Category;
}) {
  const t = await serverTranslator();
  const values = new URLSearchParams();
  for (const key of keys) {
    const value = search[key];
    if (typeof value === 'string' && value) values.set(key, value);
  }
  if (category) values.set('category', category.slug);
  const base = category ? '/categories/' + category.slug : '/shop';
  const apiValues = new URLSearchParams(values);
  let result: [PageResult<Product>, Category[]];
  try {
    for (const field of ['minPrice', 'maxPrice']) {
      const value = values.get(field);
      if (value !== null) {
        if (!/^\d{1,6}([.]\d{1,2})?$/.test(value)) throw new ServerApiError(400);
        apiValues.set(field, String(Math.round(Number(value) * 100)));
      }
    }
    result = await Promise.all([
      serverApi<PageResult<Product>>('/catalog?' + apiValues),
      serverApi<Category[]>('/categories'),
    ]);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 400)
      return (
        <main
          id="main-content"
          className="wrap page-shell"
        >
          <h1 className="page-title">{t('Check your filters')}</h1>
          <p role="alert">{t('Choose valid prices, filters and a page number.')}</p>
          <Link href={base}>{t('Clear filters')}</Link>
        </main>
      );
    throw error;
  }
  const [data, categories] = result;
  function pageLink(page: number) {
    const query = new URLSearchParams(values);
    query.delete('category');
    query.set('page', String(page));
    return base + '?' + query;
  }
  return (
    <main
      id="main-content"
      className="wrap page-shell"
    >
      <h1 className="page-title">{category?.name ?? t('Shop')}</h1>
      <nav
        className="account-links"
        aria-label={t('Categories')}
      >
        <Link href="/shop">{t('All pieces')}</Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={'/categories/' + item.slug}
          >
            {item.name}
          </Link>
        ))}
      </nav>
      <form
        action={base}
        className="catalog-filters"
      >
        <label>
          {t('Search')}
          <input
            name="query"
            defaultValue={values.get('query') ?? ''}
            maxLength={120}
          />
        </label>
        <label>
          {t('Size')}
          <input
            name="size"
            defaultValue={values.get('size') ?? ''}
            maxLength={8}
          />
        </label>
        <label>
          {t('Color')}
          <input
            name="color"
            defaultValue={values.get('color') ?? ''}
            maxLength={60}
          />
        </label>
        <label>
          {t('Minimum price (€)')}
          <input
            name="minPrice"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            defaultValue={values.get('minPrice') ?? ''}
          />
        </label>
        <label>
          {t('Maximum price (€)')}
          <input
            name="maxPrice"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            defaultValue={values.get('maxPrice') ?? ''}
          />
        </label>
        <label>
          {t('Sort')}
          <select
            name="sort"
            defaultValue={values.get('sort') ?? 'newest'}
          >
            <option value="newest">{t('Newest')}</option>
            <option value="price-asc">{t('Price: low to high')}</option>
            <option value="price-desc">{t('Price: high to low')}</option>
            <option value="name">{t('Name')}</option>
          </select>
        </label>
        <label className="consent">
          <input
            name="inStock"
            type="checkbox"
            value="true"
            defaultChecked={values.get('inStock') === 'true'}
          />
          {t('In stock only')}
        </label>
        <button className="small-btn">{t('Apply filters')}</button>
      </form>
      <p>
        {data.total}
        {t(' pieces')}
      </p>
      {data.total === 0 && <p>{t('No pieces match these filters.')}</p>}
      <div className="product-grid">
        {data.items.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
          />
        ))}
      </div>
      <nav
        className="account-links"
        aria-label={t('Catalog pages')}
      >
        {data.page > 1 && <Link href={pageLink(data.page - 1)}>{t('Previous')}</Link>}
        <span>
          {t('Page ')}
          {data.page}
        </span>
        {data.page * data.pageSize < data.total && (
          <Link href={pageLink(data.page + 1)}>{t('Next')}</Link>
        )}
      </nav>
    </main>
  );
}
