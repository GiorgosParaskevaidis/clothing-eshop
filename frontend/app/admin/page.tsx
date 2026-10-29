'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminOrder, Product, money } from '@/lib/types';
import { AdminSignIn } from '@/components/auth/admin-sign-in';
import { SecuritySettings } from '@/components/auth/security-settings';
import Link from 'next/link';
import { useLanguage } from '@/lib/language';
type Subscriber = { email: string; consentUtc: string; consentVersion: string };
export default function Admin() {
  const { t } = useLanguage();
  const [session, setSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [tab, setTab] = useState<'products' | 'orders' | 'newsletter'>('products');
  const [message, setMessage] = useState('');
  async function refresh() {
    try {
      const [p, o, s] = await Promise.all([
        api<Product[]>('/admin/products'),
        api<AdminOrder[]>('/admin/orders'),
        api<Subscriber[]>('/admin/subscribers'),
      ]);
      setProducts(p);
      setOrders(o);
      setSubscribers(s);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not refresh');
    }
  }
  useEffect(() => {
    api<{ email: string }>('/admin/session')
      .then((result) => {
        setSession(result.email);
        void refresh();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    api<{ enabled: boolean }>('/auth/config')
      .then((result) => setAccounts(result.enabled))
      .catch(() => {});
  }, []);
  async function action(callback: () => Promise<unknown>) {
    setMessage('');
    try {
      await callback();
      await refresh();
      setMessage('Saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save');
    }
  }
  if (loading)
    return (
      <main
        id="main-content"
        className="wrap page-shell"
      >
        <p>Loading…</p>
      </main>
    );
  if (!session)
    return (
      <main
        id="main-content"
        className="wrap page-shell admin-login"
      >
        <span className="label season">thesamenot</span>
        <h1 className="page-title">Store admin</h1>
        <AdminSignIn
          onAuthenticated={(email) => {
            setSession(email);
            setMessage('');
            void refresh();
          }}
        />
      </main>
    );
  const paid = orders.filter((o) => ['succeeded', 'partially_refunded'].includes(o.paymentStatus));
  return (
    <main
      id="main-content"
      className="wrap page-shell admin"
    >
      <div className="split">
        <div>
          <span className="label season">thesamenot / management</span>
          <h1 className="page-title">Drop control</h1>
        </div>
        <button
          className="small-btn"
          onClick={async () => {
            await api('/admin/logout', { method: 'POST' });
            setSession(null);
            setOrders([]);
            setSubscribers([]);
          }}
        >
          Sign out
        </button>
      </div>
      <div className="stats">
        <div>
          <span className="label muted">Paid revenue</span>
          <strong>{money(paid.reduce((sum, o) => sum + o.totalCents, 0))}</strong>
        </div>
        <div>
          <span className="label muted">Orders</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span className="label muted">Newsletter</span>
          <strong>{subscribers.length}</strong>
        </div>
      </div>
      <nav
        className="account-links"
        aria-label="Administration"
      >
        <Link href="/admin/products">Product catalog</Link>
        <Link href="/admin/orders">Order operations</Link>
        <Link href="/admin/shipping">Shipping</Link>
        <Link href="/admin/payments">{t('Payment settings')}</Link>
        <Link href="/admin/users">Customers</Link>
        <Link href="/admin/jobs">Background jobs</Link>
      </nav>
      <div className="admin-tabs">
        {(['products', 'orders', 'newsletter'] as const).map((t) => (
          <button
            className={`pill ${tab === t ? 'on' : ''}`}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <button
          className="small-btn"
          onClick={refresh}
        >
          Refresh
        </button>
      </div>
      <p
        role="status"
        className="form-status"
      >
        {message}
      </p>
      {tab === 'products' && (
        <div className="grid2">
          {products.map((product) => (
            <section
              className="summary"
              key={product.id}
            >
              <img
                className="admin-product-photo"
                src={product.frontImage}
                alt={product.name}
                width={96}
                height={128}
              />
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action(() =>
                    api(`/admin/products/${product.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        name: form.get('name'),
                        description: form.get('description'),
                        priceCents: Math.round(Number(form.get('price')) * 100),
                        active: form.get('active') === 'on',
                        version: product.version,
                      }),
                    }),
                  );
                }}
              >
                <label>
                  Name
                  <input
                    name="name"
                    defaultValue={product.name}
                    key={product.name}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    defaultValue={product.description}
                    key={product.description}
                    required
                    maxLength={1000}
                  />
                </label>
                <label>
                  Price (€)
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="10000"
                    defaultValue={product.priceCents / 100}
                    key={product.priceCents}
                    required
                  />
                </label>
                <label className="consent">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={product.active}
                    key={String(product.active)}
                  />
                  Visible in store
                </label>
                <button className="btn">Save product</button>
              </form>
              <h3 className="label">Available stock</h3>
              {product.variants.map((variant) => (
                <form
                  key={`${variant.id}-${variant.version}`}
                  className="stock-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void action(() =>
                      api(`/admin/stock/${variant.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          available: Number(form.get('available')),
                          version: variant.version,
                        }),
                      }),
                    );
                  }}
                >
                  <label
                    htmlFor={variant.id}
                    className="mono"
                  >
                    {variant.size}
                  </label>
                  <input
                    id={variant.id}
                    name="available"
                    type="number"
                    min="0"
                    max="100000"
                    defaultValue={variant.available}
                    required
                  />
                  <button className="small-btn">Save</button>
                </form>
              ))}
            </section>
          ))}
        </div>
      )}
      {tab === 'orders' && (
        <div className="stack">
          {!orders.length && <p>No orders yet.</p>}
          {orders.map((order) => (
            <section
              className="summary"
              key={order.id}
            >
              <div className="split">
                <h2 className="section-title">{order.id.slice(0, 8).toUpperCase()}</h2>
                <span className={`status ${order.status}`}>{order.status}</span>
              </div>
              <p className="muted">
                {new Date(order.createdUtc + 'Z').toLocaleString()} · {order.paymentMode}
              </p>
              <p>
                {order.name} · {order.email}
              </p>
              <p>
                {order.address}, {order.city} {order.postalCode}, {order.country}
              </p>
              {order.items.map((item) => (
                <div
                  className="crow"
                  key={item.variantId}
                >
                  <span>
                    {item.productName} / {item.size} × {item.quantity}
                  </span>
                  <span>{money(item.unitPriceCents * item.quantity)}</span>
                </div>
              ))}
              <div className="split total">
                <strong>Total, including shipping</strong>
                <strong>{money(order.totalCents)}</strong>
              </div>
              {order.status === 'paid' && (
                <Link
                  className="btn"
                  href="/admin/orders"
                >
                  Add courier and tracking
                </Link>
              )}
            </section>
          ))}
        </div>
      )}
      {tab === 'newsletter' && (
        <section className="summary">
          <h2 className="section-title">The list</h2>
          <p className="muted">
            Consented subscribers. Sending campaigns requires connecting your email provider.
          </p>
          {subscribers.map((subscriber) => (
            <div
              className="crow"
              key={subscriber.email}
            >
              <span>{subscriber.email}</span>
              <span className="muted">
                {new Date(subscriber.consentUtc + 'Z').toLocaleDateString()}
              </span>
            </div>
          ))}
        </section>
      )}
      {accounts && (
        <details className="account-security">
          <summary>Account security</summary>
          <SecuritySettings
            admin
            onSignedOut={() => {
              setSession(null);
              setProducts([]);
              setOrders([]);
              setSubscribers([]);
            }}
          />
        </details>
      )}
    </main>
  );
}
