'use client';
import { useLanguage } from '@/lib/language';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Product, Store } from '@/lib/types';
import { useCart } from './cart';
import Link from 'next/link';

export function Countdown({ target }: { target: string }) {
  const { t, locale } = useLanguage();
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);
  const values =
    remaining === null
      ? [0, 0, 0, 0]
      : [
          Math.floor(remaining / 86400000),
          Math.floor((remaining % 86400000) / 3600000),
          Math.floor((remaining % 3600000) / 60000),
          Math.floor((remaining % 60000) / 1000),
        ];
  const label = new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Athens',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(target));
  return (
    <div className="countdown">
      <span className="label muted">
        {remaining === 0 ? t('Drop is live') : `${t('Opens')} ${label} · ${t('Athens')}`}
      </span>
      <div
        className="count"
        role="timer"
        aria-live="off"
      >
        {['Days', 'Hours', 'Minutes', 'Secs'].map((label, i) => (
          <div key={label}>
            <b>{String(values[i]).padStart(2, '0')}</b>
            <span>{t(label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ProductCard({ product }: { product: Product }) {
  const { t, formatMoney } = useLanguage();
  const cart = useCart();
  const current = cart.products.find((p) => p.id === product.id) ?? product;
  const [view, setView] = useState<'front' | 'back'>('front');
  const [size, setSize] = useState('L');
  const [color, setColor] = useState(product.variants[0]?.color ?? '');
  const variant = current.variants.find((v) => v.size === size && v.color === color);
  const colors = [...new Set(current.variants.map((v) => v.color))];
  const available = current.variants.reduce((sum, v) => sum + v.available, 0);
  return (
    <article
      className="card"
      aria-label={current.name}
    >
      <div className="shot">
        <img
          src={view === 'front' ? current.frontImage : current.backImage}
          alt={`${current.name}, ${t(view)}`}
          width={900}
          height={1200}
          loading="lazy"
        />
        <span className="badge">
          {current.inventoryMode === 'limited'
            ? t('LIMITED / ') + current.edition
            : t('CORE COLLECTION')}
        </span>
      </div>
      <div className="info">
        <div className="row">
          {(['front', 'back'] as const).map((v) => (
            <button
              key={v}
              className={`pill ${view === v ? 'on' : ''}`}
              onClick={() => setView(v)}
              aria-pressed={view === v}
            >
              {v === 'front' ? t('Front') : t('Back')}
            </button>
          ))}
        </div>
        <div className="title">
          <h3>
            <Link href={'/products/' + current.slug}>{current.name}</Link>
          </h3>
          <span>{formatMoney(current.priceCents)}</span>
        </div>
        <p className="desc">{t(current.description)}</p>
        <div>
          {colors.length > 1 && (
            <label>
              {t('Color')}
              <select
                value={color}
                onChange={(event) => setColor(event.target.value)}
              >
                {colors.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          <span className="label size-label">{t('Size')}</span>
          <div className="row">
            {current.variants
              .filter((v) => v.color === color)
              .map((v) => (
                <button
                  key={v.id}
                  className={`chip ${size === v.size ? 'on' : ''}`}
                  disabled={v.available === 0}
                  aria-label={`${current.name} ${t('size')} ${v.size}${v.available === 0 ? ' ' + t('sold out') : ''}`}
                  aria-pressed={size === v.size}
                  onClick={() => setSize(v.size)}
                >
                  {v.size}
                </button>
              ))}
          </div>
        </div>
        <div>
          <div className="meter">
            <span>{t('AVAILABLE')}</span>
            <span>
              {available} / {current.edition}
            </span>
          </div>
          <div className="bar-bg">
            <div
              className="bar-fg"
              style={{ width: `${Math.min(100, (available / current.edition) * 100)}%` }}
            />
          </div>
        </div>
        <button
          className="btn red"
          disabled={!variant?.available || !cart.ready}
          onClick={() => variant && cart.add(variant.id, current)}
        >
          {variant?.available ? t('Add to cart') : t('Sold out')}
        </button>
      </div>
    </article>
  );
}
export function Crew({ store }: { store: Store }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email, consent }),
      });
      setMessage(result.message);
      setEmail('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="crew"
      className="wrap crew"
    >
      <div>
        <h2>{t('The crew')}</h2>
        <p>
          {t(
            'Get drop news before everyone else. After the drop, send us a photo of your piece and you could be on the wall.',
          )}
        </p>
        <form onSubmit={join}>
          <label
            htmlFor="newsletter-email"
            className="label size-label"
          >
            {t('Your email')}
          </label>
          <div className="form">
            <input
              id="newsletter-email"
              type="email"
              required
              maxLength={254}
              placeholder={t('email@example.com')}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="btn red"
              disabled={busy}
            >
              {t('Join')}
            </button>
          </div>
          <label className="consent">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t('I agree to receive drop updates. ')}
            <a href="/policies/privacy">{t('Privacy')}</a>
          </label>
          <div
            className="form-status"
            role="status"
          >
            {t(message)}
          </div>
        </form>
        {store.instagramUrl && (
          <a
            className="btn"
            href={store.instagramUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('Instagram')}
          </a>
        )}
      </div>
      <div>
        <span className="mono wall-label">{t('Wall — fills up after the drop')}</span>
        <div className="wall">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <img
                src="/images/logo.png"
                alt=""
                width={100}
                height={100}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
