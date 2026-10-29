'use client';
import { LanguageSelector, useLanguage } from '@/lib/language';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clearCheckoutAttempt } from '@/lib/checkout-attempt';
import { CartLine, Product, Store } from '@/lib/types';
type CartContextType = {
  lines: CartLine[];
  products: Product[];
  store: Store | null;
  ready: boolean;
  error: string;
  add: (variantId: string, product?: Product) => void;
  update: (variantId: string, quantity: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
};
const CartContext = createContext<CartContextType | null>(null);
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('Missing cart provider');
  return context;
}
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [ready, setReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api<Product[]>('/products'), api<Store>('/store')]);
      setProducts(p);
      setStore(s);
      setReady(true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Store unavailable');
      setReady(false);
    }
  }, []);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('tsn_cart_v1') ?? '[]');
      if (Array.isArray(saved)) {
        const unique = new Map<string, CartLine>();
        for (const item of saved.slice(0, 8))
          if (
            typeof item?.variantId === 'string' &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            item.quantity <= 10
          )
            unique.set(item.variantId, { variantId: item.variantId, quantity: item.quantity });
        setLines([...unique.values()]);
      }
    } catch {}
    setHydrated(true);
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem('tsn_cart_v1', JSON.stringify(lines));
      } catch {}
  }, [lines, hydrated]);
  const basketIds = lines
    .map((line) => line.variantId)
    .sort()
    .join(',');
  useEffect(() => {
    if (!hydrated || !basketIds) return;
    let active = true;
    api<Product[]>('/basket/products?ids=' + encodeURIComponent(basketIds))
      .then((selected) => {
        if (active)
          setProducts((current) => [
            ...current.filter((p) => !selected.some((s) => s.id === p.id)),
            ...selected,
          ]);
      })
      .catch((error) => setError(error.message));
    return () => {
      active = false;
    };
  }, [basketIds, hydrated]);
  const update = (variantId: string, quantity: number) =>
    setLines((old) =>
      quantity <= 0
        ? old.filter((x) => x.variantId !== variantId)
        : old.map((x) =>
            x.variantId === variantId ? { ...x, quantity: Math.min(10, quantity) } : x,
          ),
    );
  const add = (variantId: string, product?: Product) => {
    const variant = (product ? [product] : products)
      .flatMap((p) => p.variants)
      .find((v) => v.id === variantId);
    if (!variant || variant.available < 1) return;
    if (product) setProducts((current) => [...current.filter((p) => p.id !== product.id), product]);
    setLines((old) => {
      if (old.length >= 8 && !old.some((line) => line.variantId === variantId)) return old;
      const current = old.find((x) => x.variantId === variantId);
      return current
        ? old.map((x) =>
            x.variantId === variantId
              ? { ...x, quantity: Math.min(x.quantity + 1, variant.available, 10) }
              : x,
          )
        : [...old, { variantId, quantity: 1 }];
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <CartContext.Provider
      value={{
        lines,
        products,
        store,
        ready,
        error,
        add,
        update,
        clear: () => {
          setLines([]);
          clearCheckoutAttempt();
        },
        open,
        setOpen,
        refresh,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function cartDetails(lines: CartLine[], products: Product[]) {
  return lines.map((line) => {
    const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
    const variant = product?.variants.find((v) => v.id === line.variantId);
    return { ...line, product, variant };
  });
}
export function Header() {
  const { t } = useLanguage();
  const cart = useCart();
  const count = cart.lines.reduce((sum, x) => sum + x.quantity, 0);
  return (
    <>
      <div className="bar">
        {t('DROP 01  /  LIMITED RUN  /  NUMBERED PIECES  /  NEVER RESTOCKED')}
      </div>
      <header>
        <div className="wrap head">
          <Link
            className="brand"
            href="/#top"
            aria-label="thesamenot"
          >
            <img
              src="/images/logo.png"
              alt={t('thesamenot logo')}
              width={46}
              height={46}
            />
            <span>thesamenot</span>
          </Link>
          <nav aria-label={t('Main menu')}>
            <Link href="/#drop">{t('Drop 01')}</Link>
            <Link href="/#products">{t('Pieces')}</Link>
            <Link href="/shop">{t('Shop')}</Link>
            <Link href="/#about">{t('The brand')}</Link>
            <Link href="/#crew">{t('Crew')}</Link>
          </nav>
          <LanguageSelector />
          <Link
            href="/account"
            className="account-nav"
            aria-label={t('Your account')}
          >
            {t('Account')}
          </Link>
          <button
            className="cartbtn"
            onClick={() => cart.setOpen(!cart.open)}
            aria-label={t('Cart')}
            aria-expanded={cart.open}
            aria-controls="cart"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 7h12l-1 13H7L6 7z" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            <span>
              {t('Cart (')}
              {count})
            </span>
          </button>
        </div>
      </header>
      <CartPanel />
    </>
  );
}
export function SkipLink() {
  const { t } = useLanguage();
  return (
    <a
      className="skip-link"
      href="#main-content"
      onClick={() => {
        const main = document.getElementById('main-content');
        if (main) {
          main.tabIndex = -1;
          main.focus();
          main.scrollIntoView({ block: 'start' });
        }
      }}
    >
      {t('Skip to content')}
    </a>
  );
}
function CartPanel() {
  const { t, formatMoney } = useLanguage();
  const cart = useCart();
  const details = useMemo(
    () => cartDetails(cart.lines, cart.products),
    [cart.lines, cart.products],
  );
  const total = details.reduce((sum, x) => sum + (x.product?.priceCents ?? 0) * x.quantity, 0);
  if (!cart.open) return null;
  return (
    <section
      id="cart"
      className="open"
      aria-label={t('Shopping cart')}
    >
      <div className="wrap cartin">
        <div className="split">
          <h2 className="section-title">{t('Your cart')}</h2>
          <button
            className="small-btn"
            onClick={() => cart.setOpen(false)}
          >
            {t('Close')}
          </button>
        </div>
        {!cart.lines.length ? (
          <p className="muted">{t('Your cart is empty. Pick a piece and a size below.')}</p>
        ) : (
          <>
            {details.map((item) => (
              <div
                className="crow"
                key={item.variantId}
              >
                <div>
                  <span className="label">{item.product?.name ?? t('Unavailable piece')}</span>
                  <p className="muted">
                    {t('Size ')}
                    {item.variant?.size ?? item.variantId}
                  </p>
                </div>
                <div className="cart-actions">
                  <span className="mono">
                    {formatMoney((item.product?.priceCents ?? 0) * item.quantity)}
                  </span>
                  <button
                    className="small-btn"
                    aria-label={`${t('Decrease')} ${item.variantId}`}
                    onClick={() => cart.update(item.variantId, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    className="small-btn"
                    aria-label={`${t('Increase')} ${item.variantId}`}
                    disabled={item.quantity >= Math.min(item.variant?.available ?? 0, 10)}
                    onClick={() => cart.update(item.variantId, item.quantity + 1)}
                  >
                    +
                  </button>
                  <button
                    className="small-btn danger"
                    aria-label={`${t('Remove')} ${item.variantId}`}
                    onClick={() => cart.update(item.variantId, 0)}
                  >
                    {t('Remove')}
                  </button>
                </div>
              </div>
            ))}
            <div className="split total">
              <span className="label">{t('Subtotal')}</span>
              <span className="section-title">{formatMoney(total)}</span>
            </div>
            {cart.ready ? (
              <Link
                className="btn red"
                href="/checkout"
                onClick={() => cart.setOpen(false)}
              >
                {t('Checkout')}
              </Link>
            ) : (
              <p role="alert">{t(cart.error || 'Loading your basket…')}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
export function Footer() {
  const { t } = useLanguage();
  return (
    <footer>
      <div className="wrap foot">
        <Link
          className="brand"
          href="/#top"
        >
          <img
            src="/images/logo.png"
            alt=""
            width={40}
            height={40}
          />
          <span>thesamenot</span>
        </Link>
        <div className="links">
          <Link href="/policies/shipping">{t('Shipping')}</Link>
          <Link href="/policies/returns">{t('Returns')}</Link>
          <Link href="/policies/terms">{t('Terms')}</Link>
          <Link href="/policies/privacy">{t('Privacy')}</Link>
        </div>
        <span>{t('© 2026 thesamenot')}</span>
      </div>
    </footer>
  );
}
