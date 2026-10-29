'use client';
import { useLanguage } from '@/lib/language';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart, cartDetails } from '@/components/cart';
import { api } from '@/lib/api';
import { checkoutAttempt } from '@/lib/checkout-attempt';
import {
  paymentMethodName,
  type CustomerAddress,
  type CustomerProfile,
  type CheckoutQuote,
  type PaymentMethod,
} from '@/lib/types';
export default function Checkout() {
  const { t, formatMoney } = useLanguage();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [context, setContext] = useState<{ customer: boolean; email: string | null } | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CashOnDelivery');
  const bankMethod = cart.store?.paymentMethods.find((method) => method.id === 'BankTransfer');
  useEffect(() => {
    void cart.refresh();
  }, [cart.refresh]);
  useEffect(() => {
    if (bankMethod?.available === false) setPaymentMethod('CashOnDelivery');
  }, [bankMethod?.available]);
  const selectedAddress = addresses.find((address) => address.id === addressId);
  useEffect(() => {
    api<{ customer: boolean; email: string | null }>('/checkout/context')
      .then(async (value) => {
        setContext(value);
        if (value.customer) {
          const [customer, saved] = await Promise.all([
            api<CustomerProfile>('/account'),
            api<CustomerAddress[]>('/account/addresses'),
          ]);
          setProfile(customer);
          setAddresses(saved);
          setAddressId(saved.find((address) => address.isDefault)?.id ?? '');
        }
      })
      .catch((error) => setError(error.message));
  }, []);
  const basketKey = JSON.stringify(cart.lines);
  const attemptSignature = JSON.stringify({
    owner: context?.customer ? context.email : 'guest',
    paymentMethod,
    items: [...cart.lines].sort((a, b) => a.variantId.localeCompare(b.variantId)),
  });
  useEffect(() => {
    if (context && cart.ready && cart.lines.length)
      setRequestKey(checkoutAttempt(attemptSignature));
  }, [context, cart.ready, cart.lines.length, attemptSignature]);
  useEffect(() => {
    if (!context || cart.lines.length === 0) return;
    let active = true;
    setQuote(null);
    api<CheckoutQuote>('/checkout/quote', {
      method: 'POST',
      body: JSON.stringify({ items: JSON.parse(basketKey), country: 'GR' }),
    })
      .then((value) => {
        if (active) setQuote(value);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [context, basketKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const details = cartDetails(cart.lines, cart.products);
  const subtotal =
    quote?.subtotalCents ??
    details.reduce((sum, x) => sum + (x.product?.priceCents ?? 0) * x.quantity, 0);
  const shipping = quote?.shippingCents ?? 0;
  const invalid = details.some((x) => !x.product || !x.variant || x.quantity > x.variant.available);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const terms = event.currentTarget.elements.namedItem('terms') as HTMLInputElement | null;
    try {
      const result = await api<{ checkoutUrl: string }>('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          requestKey,
          quoteId: quote?.id,
          paymentMethod,
          email: form.get('email'),
          name: form.get('name'),
          address: form.get('address'),
          city: form.get('city'),
          postalCode: form.get('postalCode'),
          phone: form.get('phone') ?? '',
          country: 'GR',
          acceptTerms: form.get('terms') === 'on',
          items: cart.lines,
        }),
      });
      window.location.assign(result.checkoutUrl);
    } catch (e) {
      if (terms) terms.checked = false;
      setError(e instanceof Error ? e.message : 'Checkout failed');
      void cart.refresh();
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      className="wrap page-shell"
    >
      <Link
        href="/#products"
        className="label muted"
      >
        {t('← Back to the pieces')}
      </Link>
      <h1 className="page-title">{t('Checkout')}</h1>
      {!cart.ready ? (
        <p role="status">{t(cart.error || 'Loading your basket…')}</p>
      ) : !cart.lines.length ? (
        <p>
          {t('Your cart is empty. ')}
          <Link href="/#products">{t('Choose a piece.')}</Link>
        </p>
      ) : (
        <div className="checkout-grid">
          <form
            key={addressId}
            className="stack"
            onSubmit={submit}
          >
            <h2 className="section-title">{t('Your details')}</h2>
            {context?.customer ? (
              <p>{t('Your order will appear in your account.')}</p>
            ) : (
              <p>
                {t('Checkout as a guest, or ')}
                <Link href="/account/login">{t('sign in')}</Link>
                {t(' to keep your order in your account.')}
              </p>
            )}
            {addresses.length > 0 && (
              <label>
                {t('Saved shipping address')}
                <select
                  value={addressId}
                  onChange={(event) => setAddressId(event.target.value)}
                >
                  <option value="">{t('Enter a different address')}</option>
                  {addresses.map((address) => (
                    <option
                      key={address.id}
                      value={address.id}
                    >
                      {address.label} — {address.address}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {t('Email')}
              <input
                name="email"
                defaultValue={context?.email ?? ''}
                readOnly={context?.customer}
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              {t('Full name')}
              <input
                name="name"
                defaultValue={selectedAddress?.name ?? profile?.displayName ?? ''}
                autoComplete="name"
                required
                maxLength={120}
              />
            </label>
            <label>
              {t('Street address')}
              <input
                name="address"
                defaultValue={selectedAddress?.address ?? ''}
                autoComplete="street-address"
                required
                maxLength={250}
              />
            </label>
            <div className="grid2">
              <label>
                {t('City')}
                <input
                  name="city"
                  defaultValue={selectedAddress?.city ?? ''}
                  autoComplete="address-level2"
                  required
                  maxLength={120}
                />
              </label>
              <label>
                {t('Postal code')}
                <input
                  name="postalCode"
                  defaultValue={selectedAddress?.postalCode ?? ''}
                  autoComplete="postal-code"
                  required
                  maxLength={24}
                />
              </label>
            </div>
            <label>
              {t('Telephone')}
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                defaultValue={selectedAddress?.phone ?? ''}
              />
            </label>
            <label>
              {t('Country')}
              <input
                value={t('Greece')}
                readOnly
              />
            </label>
            <label>
              <span id="checkout-payment-method-label">{t('Payment method')}</span>
              <select
                aria-labelledby="checkout-payment-method-label"
                name="paymentMethod"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                required
              >
                {cart.store?.paymentMethods.map((method) => (
                  <option
                    key={method.id}
                    value={method.id}
                    disabled={!method.available}
                  >
                    {t(paymentMethodName(method.id))}
                    {!method.available
                      ? t(
                          method.unavailableReason === 'Disabled'
                            ? ' — unavailable'
                            : ' — available soon',
                        )
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            {bankMethod && !bankMethod.available && (
              <p className="muted">
                {t(
                  bankMethod.unavailableReason === 'Disabled'
                    ? 'Bank transfer is currently unavailable. Please choose cash on delivery.'
                    : 'Bank transfer will be available once our Revolut account details have been added.',
                )}
              </p>
            )}
            <p>
              {paymentMethod === 'BankTransfer'
                ? t(
                    'Use your order number as the payment reference. We dispatch after confirming the deposit.',
                  )
                : t('Pay the order total to the courier on delivery.')}
            </p>
            <label className="consent">
              <input
                name="terms"
                type="checkbox"
                required
              />
              {t('I accept the ')}
              <Link href="/policies/terms">{t('terms')}</Link>
              {t(' and')} <Link href="/policies/privacy">{t('privacy policy')}</Link>.
            </label>
            {cart.store?.preview && (
              <p className="notice">
                {t('Preview only. Do not send a bank transfer. No real order will be dispatched.')}
              </p>
            )}
            {invalid && (
              <p className="notice">
                {t(
                  'Some quantities are no longer available. Update your basket before continuing.',
                )}
              </p>
            )}
            {!cart.store?.salesEnabled && (
              <p className="notice">{t('The drop is not open for orders yet.')}</p>
            )}
            {cart.store?.salesEnabled && !cart.store.checkoutAvailable && (
              <p className="notice">{t('Checkout is temporarily unavailable.')}</p>
            )}
            {error && (
              <p
                role="alert"
                className="notice"
              >
                {t(error)}{' '}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setRequestKey(checkoutAttempt(attemptSignature, true));
                    setError('');
                    setQuote(null);
                    api<CheckoutQuote>('/checkout/quote', {
                      method: 'POST',
                      body: JSON.stringify({ items: cart.lines, country: 'GR' }),
                    })
                      .then(setQuote)
                      .catch((error) => setError(error.message));
                  }}
                >
                  {t('Start a new attempt')}
                </button>
              </p>
            )}
            <button
              className="btn red"
              disabled={
                busy ||
                invalid ||
                !cart.store?.salesEnabled ||
                !cart.store.checkoutAvailable ||
                !requestKey ||
                !context ||
                !quote
              }
            >
              {busy ? t('Placing order…') : t('Place order')}
            </button>
          </form>
          <aside className="summary">
            <h2 className="section-title">{t('Your pieces')}</h2>
            {details.map((x) => (
              <div
                className="crow"
                key={x.variantId}
              >
                <div>
                  <strong>{x.product?.name}</strong>
                  <p className="muted">
                    {t('Size ')}
                    {x.variant?.size}
                    {t(' · Quantity ')}
                    {x.quantity}
                  </p>
                </div>
                <span className="mono">
                  {formatMoney((x.product?.priceCents ?? 0) * x.quantity)}
                </span>
              </div>
            ))}
            <div className="split">
              <span>{t('Subtotal')}</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="split">
              <span>{t('Shipping')}</span>
              <span>
                {quote ? (shipping ? formatMoney(shipping) : t('Free')) : t('Calculating…')}
              </span>
            </div>
            <div className="split total">
              <strong>{t('Total')}</strong>
              <strong>{formatMoney(subtotal + shipping)}</strong>
            </div>
            <p className="muted">
              {quote
                ? t(quote.methodName) +
                  ' · ' +
                  t(
                    'Quote valid for 10 minutes. If prices change, you will review the new total before payment.',
                  )
                : t('Calculating your checkout total…')}
            </p>
            {quote?.taxCents != null && (
              <p className="muted">
                {t('Tax included in total: ')}
                {formatMoney(quote.taxCents)}
              </p>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
