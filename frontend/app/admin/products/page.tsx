'use client';
import { useEffect, useState } from 'react';
import { AdminArea } from '@/components/admin/admin-area';
import { api } from '@/lib/api';
import { type Product, type Category, type PageResult, money } from '@/lib/types';

const blank = {
  name: '',
  slug: '',
  description: '',
  priceCents: 100,
  edition: 50,
  inventoryMode: 'limited' as const,
  material: '',
  care: '',
  sizeGuide: '',
  status: 'draft' as const,
  version: 0,
  categories: [] as Category[],
};
function Products() {
  const [data, setData] = useState<PageResult<Product> | null>(null),
    [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Product | null>(null),
    [creating, setCreating] = useState(false),
    [page, setPage] = useState(1),
    [search, setSearch] = useState('');
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<{
    variantId: string;
    items: { id: number; delta: number; reason: string; createdUtc: string }[];
  } | null>(null);
  async function load(id?: string) {
    setData(
      await api<PageResult<Product>>(
        '/admin/catalog/?page=' + page + '&query=' + encodeURIComponent(search),
      ),
    );
    setCategories(await api<Category[]>('/categories'));
    if (id) {
      setSelected(await api<Product>('/admin/catalog/' + id));
      setCreating(false);
      setRevision((value) => value + 1);
    }
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps
  async function action(callback: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await callback();
      setMessage('Saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  }
  const product = selected ?? blank;
  return (
    <div className="stack">
      <div className="account-links">
        <button
          className="small-btn"
          onClick={() => {
            setSelected(null);
            setCreating(true);
            setRevision((v) => v + 1);
          }}
        >
          Add product
        </button>
        <label>
          Search products
          <input
            value={search}
            maxLength={120}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
        </label>
      </div>
      {data?.items.map((item) => (
        <article
          key={item.id}
          className="split"
        >
          <span>
            {item.name} · {item.status} · {money(item.priceCents)}
          </span>
          <button
            className="small-btn"
            onClick={() => void action(() => load(item.id))}
          >
            Edit {item.name}
          </button>
        </article>
      ))}
      {data && (
        <nav
          className="account-links"
          aria-label="Product pages"
        >
          <button
            className="small-btn"
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="small-btn"
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {(selected || creating) && (
        <section className="stack">
          <h2>{creating ? 'New draft' : selected?.name}</h2>
          <form
            key={revision}
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void action(async () => {
                const value = {
                  name: form.get('name'),
                  slug: form.get('slug'),
                  description: form.get('description'),
                  priceCents: Math.round(Number(form.get('price')) * 100),
                  edition: Number(form.get('edition')),
                  inventoryMode: form.get('inventoryMode'),
                  material: form.get('material'),
                  care: form.get('care'),
                  sizeGuide: form.get('sizeGuide'),
                  status: form.get('status'),
                  version: product.version,
                  categoryIds: form.getAll('categoryIds'),
                };
                const result = await api<{ id: string }>('/admin/catalog/' + (selected?.id ?? ''), {
                  method: selected ? 'PUT' : 'POST',
                  body: JSON.stringify(value),
                });
                await load(result.id);
              });
            }}
          >
            <label>
              Name
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={product.name}
              />
            </label>
            <label>
              Slug
              <input
                name="slug"
                required
                maxLength={120}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                defaultValue={product.slug}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={product.description}
              />
            </label>
            <label>
              Price (€)
              <input
                name="price"
                type="number"
                required
                min="0.01"
                max="100000"
                step="0.01"
                defaultValue={product.priceCents / 100}
              />
            </label>
            <label>
              Inventory mode
              <select
                name="inventoryMode"
                defaultValue={product.inventoryMode}
              >
                <option value="limited">Limited edition</option>
                <option value="replenishable">Replenishable</option>
              </select>
            </label>
            <label>
              Edition capacity
              <input
                name="edition"
                type="number"
                required
                min={1}
                max={1000000}
                defaultValue={product.edition}
              />
            </label>
            <label>
              Material
              <textarea
                name="material"
                maxLength={1000}
                defaultValue={product.material}
              />
            </label>
            <label>
              Care
              <textarea
                name="care"
                maxLength={1000}
                defaultValue={product.care}
              />
            </label>
            <label>
              Size guide
              <textarea
                name="sizeGuide"
                maxLength={2000}
                defaultValue={product.sizeGuide}
              />
            </label>
            <fieldset>
              <legend>Categories</legend>
              {categories.map((category) => (
                <label
                  className="consent"
                  key={category.id}
                >
                  <input
                    name="categoryIds"
                    type="checkbox"
                    value={category.id}
                    defaultChecked={product.categories.some((c) => c.id === category.id)}
                  />
                  {category.name}
                </label>
              ))}
            </fieldset>
            <label>
              Publication
              <select
                name="status"
                defaultValue={product.status}
              >
                <option value="draft">Draft</option>
                {selected && (
                  <>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </>
                )}
              </select>
            </label>
            <p>
              Publishing requires material, care, size guide, an active SKU and an uploaded image.
              Archiving removes the piece from sale and keeps its order history.
            </p>
            <button
              className="btn red"
              disabled={busy}
            >
              Save product
            </button>
            {selected && (
              <button
                type="button"
                className="small-btn"
                disabled={busy || selected.status === 'archived'}
                onClick={() =>
                  void action(async () => {
                    await api('/admin/catalog/' + selected.id + '?version=' + selected.version, {
                      method: 'DELETE',
                    });
                    await load(selected.id);
                  })
                }
              >
                Archive product
              </button>
            )}
          </form>
          {selected && (
            <>
              <h3>Variants and stock</h3>
              {selected.variants.map((variant) => (
                <div
                  className="stack"
                  key={variant.id + '-' + variant.version}
                >
                  <form
                    className="catalog-filters"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void action(async () => {
                        await api('/admin/catalog/' + selected.id + '/variants/' + variant.id, {
                          method: 'PUT',
                          body: JSON.stringify({
                            sku: form.get('sku'),
                            size: form.get('size'),
                            color: form.get('color'),
                            active: form.get('active') === 'on',
                            version: variant.version,
                          }),
                        });
                        await load(selected.id);
                      });
                    }}
                  >
                    <label>
                      SKU
                      <input
                        name="sku"
                        required
                        maxLength={80}
                        defaultValue={variant.sku}
                      />
                    </label>
                    <label>
                      Size
                      <input
                        name="size"
                        required
                        maxLength={8}
                        defaultValue={variant.size}
                      />
                    </label>
                    <label>
                      Color
                      <input
                        name="color"
                        required
                        maxLength={60}
                        defaultValue={variant.color}
                      />
                    </label>
                    <label className="consent">
                      <input
                        name="active"
                        type="checkbox"
                        defaultChecked={variant.active}
                      />
                      Active SKU
                    </label>
                    <button
                      className="small-btn"
                      disabled={busy}
                    >
                      Save SKU
                    </button>
                  </form>
                  <form
                    className="catalog-filters"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void action(async () => {
                        await api('/admin/stock/' + variant.id, {
                          method: 'PUT',
                          body: JSON.stringify({
                            available: Number(form.get('available')),
                            reason: form.get('reason'),
                            version: variant.version,
                          }),
                        });
                        await load(selected.id);
                      });
                    }}
                  >
                    <label>
                      Available {variant.sku}
                      <input
                        name="available"
                        type="number"
                        required
                        min={0}
                        max={10000}
                        defaultValue={variant.available}
                      />
                    </label>
                    <label>
                      Adjustment reason
                      <input
                        name="reason"
                        required
                        maxLength={300}
                      />
                    </label>
                    <button
                      className="small-btn"
                      disabled={busy}
                    >
                      Adjust stock
                    </button>
                  </form>
                  <button
                    className="small-btn"
                    onClick={() =>
                      void action(async () =>
                        setHistory({
                          variantId: variant.id,
                          items: await api('/admin/catalog/stock/' + variant.id + '/history'),
                        }),
                      )
                    }
                  >
                    View stock history for {variant.sku}
                  </button>
                  {history?.variantId === variant.id && (
                    <ul>
                      {history.items.map((item) => (
                        <li key={item.id}>
                          {item.delta > 0 ? '+' : ''}
                          {item.delta} · {item.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <form
                className="catalog-filters"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action(async () => {
                    await api('/admin/catalog/' + selected.id + '/variants', {
                      method: 'POST',
                      body: JSON.stringify({
                        sku: form.get('sku'),
                        size: form.get('size'),
                        color: form.get('color'),
                        active: true,
                        version: 0,
                      }),
                    });
                    await load(selected.id);
                  });
                }}
              >
                <label>
                  New SKU
                  <input
                    name="sku"
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  New size
                  <input
                    name="size"
                    required
                    maxLength={8}
                  />
                </label>
                <label>
                  New color
                  <input
                    name="color"
                    required
                    maxLength={60}
                  />
                </label>
                <button
                  className="small-btn"
                  disabled={busy}
                >
                  Add SKU
                </button>
              </form>
              <h3>Images</h3>
              <div className="media-grid">
                {selected.images.map((image) => (
                  <figure key={image.id + '-' + selected.version}>
                    <img
                      src={image.url.replace('/api/media/', '/api/admin/media/')}
                      alt={image.altText}
                      width={200}
                      height={250}
                    />
                    <figcaption>
                      {image.altText} · position {image.position}
                    </figcaption>
                    <form
                      className="stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void action(async () => {
                          await api('/admin/catalog/' + selected.id + '/images/' + image.id, {
                            method: 'PUT',
                            body: JSON.stringify({
                              altText: form.get('alt'),
                              position: Number(form.get('position')),
                              version: selected.version,
                            }),
                          });
                          await load(selected.id);
                        });
                      }}
                    >
                      <label>
                        Description for image {image.position}
                        <input
                          name="alt"
                          required
                          maxLength={200}
                          defaultValue={image.altText}
                        />
                      </label>
                      <label>
                        Position for image {image.position}
                        <input
                          name="position"
                          type="number"
                          required
                          min={0}
                          max={20}
                          defaultValue={image.position}
                        />
                      </label>
                      <button
                        className="small-btn"
                        disabled={busy}
                      >
                        Save image details
                      </button>
                      <button
                        type="button"
                        className="small-btn"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api(
                              '/admin/catalog/' +
                                selected.id +
                                '/images/' +
                                image.id +
                                '?version=' +
                                selected.version,
                              { method: 'DELETE' },
                            );
                            await load(selected.id);
                          })
                        }
                      >
                        Remove image {image.position}
                      </button>
                    </form>
                  </figure>
                ))}
              </div>
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action(async () => {
                    const file = form.get('image') as File;
                    if (!file.size || file.size > 6 * 1024 * 1024)
                      throw new Error('Choose an image up to 6 MB.');
                    const query = new URLSearchParams({
                      version: String(selected.version),
                      alt: String(form.get('alt')),
                      position: String(form.get('position')),
                    });
                    await api('/admin/catalog/' + selected.id + '/images?' + query, {
                      method: 'POST',
                      headers: { 'Content-Type': file.type },
                      body: file,
                    });
                    await load(selected.id);
                  });
                }}
              >
                <label>
                  Image file
                  <input
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>
                <label>
                  Image description
                  <input
                    name="alt"
                    required
                    maxLength={200}
                  />
                </label>
                <label>
                  Position
                  <input
                    name="position"
                    type="number"
                    min={0}
                    max={20}
                    required
                    defaultValue={selected.images.length}
                  />
                </label>
                <p>
                  JPEG/PNG/WebP up to 6 MB and 4096 pixels per side. Images are re-encoded without
                  metadata.
                </p>
                <button
                  className="small-btn"
                  disabled={busy}
                >
                  Upload image
                </button>
              </form>
            </>
          )}
        </section>
      )}
      <details>
        <summary>Add a category</summary>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action(async () => {
              await api('/admin/catalog/categories', {
                method: 'POST',
                body: JSON.stringify({
                  name: form.get('name'),
                  slug: form.get('slug'),
                  version: 0,
                }),
              });
              await load();
            });
          }}
        >
          <label>
            Category name
            <input
              name="name"
              required
              maxLength={120}
            />
          </label>
          <label>
            Category slug
            <input
              name="slug"
              required
              maxLength={120}
            />
          </label>
          <button
            className="small-btn"
            disabled={busy}
          >
            Save category
          </button>
        </form>
      </details>
      <details>
        <summary>Edit categories</summary>
        {categories.map((category) => (
          <form
            className="catalog-filters"
            key={category.id + '-' + category.version}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void action(async () => {
                await api('/admin/catalog/categories/' + category.id, {
                  method: 'PUT',
                  body: JSON.stringify({
                    name: form.get('name'),
                    slug: form.get('slug'),
                    version: category.version,
                  }),
                });
                await load(selected?.id);
              });
            }}
          >
            <label>
              Name of {category.name}
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={category.name}
              />
            </label>
            <label>
              Slug of {category.name}
              <input
                name="slug"
                required
                maxLength={120}
                defaultValue={category.slug}
              />
            </label>
            <button
              className="small-btn"
              disabled={busy}
            >
              Update {category.name}
            </button>
          </form>
        ))}
      </details>
      <p role="status">{message}</p>
    </div>
  );
}
export default function AdminProducts() {
  return (
    <AdminArea title="Products">
      <Products />
    </AdminArea>
  );
}
