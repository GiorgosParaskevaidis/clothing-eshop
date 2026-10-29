'use client';
import { useLanguage } from '@/lib/language';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Receipt, isManualPayment, paymentMethodName } from '@/lib/types';
import { useCart } from './cart';
export function ReceiptView({ simulation = false }: { simulation?: boolean }) {
  const { t, formatMoney, locale } = useLanguage();
  const params = useSearchParams();
  const router = useRouter();
  const cart = useCart();
  const token = params.get('token') ?? '';
  const [order, setOrder] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) {
      setError('Order not found.');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result = await api<Receipt>(`/orders/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setOrder(result);
        if (result.status === 'pending' && !simulation) timer = setTimeout(load, 2500);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load order');
      }
    }
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, simulation]);
  useEffect(() => {
    if (
      order &&
      (order.status === 'paid' ||
        order.status === 'fulfilled' ||
        (isManualPayment(order.paymentMode) &&
          ['awaiting_payment', 'confirmed'].includes(order.status)))
    ) {
      cart.clear();
      void cart.refresh();
    }
  }, [order?.status, order?.paymentMode]); // eslint-disable-line react-hooks/exhaustive-deps
  async function complete() {
    setBusy(true);
    try {
      await api('/payments/simulation', { method: 'POST', body: JSON.stringify({ token }) });
      router.push(`/checkout/success?token=${encodeURIComponent(token)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test payment failed');
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      className="wrap page-shell receipt"
    >
      <span className="label season">{simulation ? t('Test checkout') : t('Your order')}</span>
      <h1 className="page-title">
        {simulation
          ? t('Try the flow.')
          : order && ['paid', 'fulfilled', 'awaiting_payment', 'confirmed'].includes(order.status)
            ? t('You got it.')
            : t('Order status')}
      </h1>
      {error && (
        <p
          className="notice"
          role="alert"
        >
          {t(error)}
        </p>
      )}
      {!order && !error && <p>{t('Loading order…')}</p>}
      {order && (
        <>
          <p className="mono">
            {t('Order ')}
            {order.number} · {t(order.status).toLocaleUpperCase(locale)}
          </p>
          {order.paymentMode === 'Simulation' && (
            <p className="notice">{t('This is a test order. No payment has been taken.')}</p>
          )}
          {isManualPayment(order.paymentMode) && (
            <section className="stack">
              <p>
                {t('Payment method: ')}
                {t(paymentMethodName(order.paymentMode))}
                {t(' · Payment:')} {t(order.paymentStatus)}
              </p>
              {order.status === 'awaiting_payment' && (
                <p>
                  {t(
                    'Your order has been received. It will be dispatched after we confirm your deposit.',
                  )}
                </p>
              )}
              {order.paymentMode === 'CashOnDelivery' && order.paymentStatus === 'pending' && (
                <p>
                  {t(
                    'Your order has been received. Payment will be collected by the courier on delivery.',
                  )}
                </p>
              )}
              {order.status !== 'cancelled' && order.paymentStatus === 'pending' && (
                <p className="preserve-lines">{t(order.paymentInstructions)}</p>
              )}
              {order.status === 'cancelled' && (
                <p>{t('This order was cancelled and its stock released.')}</p>
              )}
            </section>
          )}
          {order.status === 'pending' && !simulation && (
            <p>
              {t('We are waiting for payment confirmation. This page will update automatically.')}
            </p>
          )}
          {order.status === 'expired' && (
            <p>{t('This checkout expired. Your reservation has been released.')}</p>
          )}
          <div className="summary">
            {order.items.map((x) => (
              <div
                className="crow"
                key={x.variantId}
              >
                <span>
                  {x.productName} / {x.size} × {x.quantity}
                </span>
                <span>{formatMoney(x.unitPriceCents * x.quantity)}</span>
              </div>
            ))}
            <div className="split">
              <span>{t('Shipping')}</span>
              <span>{formatMoney(order.shippingCents)}</span>
            </div>
            <div className="split total">
              <strong>{t('Total')}</strong>
              <strong>{formatMoney(order.totalCents)}</strong>
            </div>
          </div>
          {simulation && order.paymentMode === 'Simulation' && order.status === 'pending' && (
            <button
              className="btn red"
              disabled={busy}
              onClick={complete}
            >
              {busy ? t('Completing…') : t('Simulate successful payment')}
            </button>
          )}
        </>
      )}
      <Link
        className="btn"
        href="/"
      >
        {t('Back to the drop')}
      </Link>
    </main>
  );
}
