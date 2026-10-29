'use client';
import { useLanguage } from '@/lib/language';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { type CustomerOrder, type OrderOperations } from '@/lib/types';
export function CustomerOrderOperations({
  order,
  guest = false,
}: {
  order: CustomerOrder;
  guest?: boolean;
}) {
  const { t, formatMoney } = useLanguage();
  const [data, setData] = useState<OrderOperations | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState('');
  const route = guest ? '/orders/access/operations' : '/account/orders/' + order.id + '/operations';
  async function load() {
    setData(await api<OrderOperations>(route));
  }
  useEffect(() => {
    setKey(crypto.randomUUID());
    load().catch((error) => setMessage(error.message));
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="stack">
      <h2>{t('Order updates')}</h2>
      <p>
        {t('Payment: ')}
        {t(order.paymentStatus)}
        {t(' · Fulfillment: ')}
        {t(order.fulfillmentStatus)}
      </p>
      {data?.shipments.map((shipment, index) => (
        <p key={index}>
          {shipment.courier} · {shipment.trackingNumber}{' '}
          {shipment.trackingUrl && (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('Track shipment')}
            </a>
          )}
        </p>
      ))}
      {data?.refunds.map((refund) => (
        <p key={refund.id}>
          {t('Refund ')}
          {formatMoney(refund.amountCents)} · {t(refund.state)}
        </p>
      ))}
      <ol>
        {data?.history.map((event) => (
          <li key={event.id}>{t(event.detail)}</li>
        ))}
      </ol>
      {data?.returns.map((request) => (
        <p key={request.id}>
          {t(request.kind)} · {t(request.state)}
          {t(' · Reference ')}
          {request.id}
        </p>
      ))}
      {(['succeeded', 'partially_refunded', 'refunded'].includes(order.paymentStatus) ||
        (order.paymentMode === 'CashOnDelivery' && order.status === 'fulfilled')) &&
        order.status !== 'payment_exception' && (
          <details>
            <summary>{t('Request a return or withdrawal')}</summary>
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                const form = new FormData(event.currentTarget);
                try {
                  const items = order.items
                    .map((item) => ({
                      orderItemId: item.id,
                      quantity: Number(form.get(String(item.id))),
                    }))
                    .filter((item) => item.quantity > 0);
                  await api(guest ? '/orders/access/returns' : '/account/returns', {
                    method: 'POST',
                    body: JSON.stringify({
                      orderId: order.id,
                      requestKey: key,
                      kind: form.get('kind'),
                      reason: form.get('reason'),
                      items,
                    }),
                  });
                  setKey(crypto.randomUUID());
                  await load();
                  setMessage('Request received. The store will review it and send instructions.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Please retry.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t('Request type')}
                <select name="kind">
                  <option value="return">{t('Return')}</option>
                  <option value="withdrawal">{t('Withdrawal')}</option>
                </select>
              </label>
              {order.items.map((item) => (
                <label key={item.id}>
                  {item.productName} / {item.size}
                  {t(' — quantity to return')}
                  <input
                    name={String(item.id)}
                    type="number"
                    min={0}
                    max={item.quantity}
                    defaultValue={0}
                  />
                </label>
              ))}
              <label>
                {t('Notes (optional)')}
                <textarea
                  name="reason"
                  maxLength={1000}
                />
              </label>
              <p>
                {t('Submitting this form records your request.')}{' '}
                <Link href="/policies/returns">{t('Return policy')}</Link>
                {t('. Refund and physical stock inspection are handled separately.')}
              </p>
              <button
                className="small-btn"
                disabled={busy || !key}
              >
                {t('Submit request')}
              </button>
            </form>
          </details>
        )}
      <p role="status">{t(message)}</p>
      {order.policies && (
        <details>
          <summary>{t('Policies recorded with this order')}</summary>
          {order.policies.map((policy) => (
            <section key={policy.slug}>
              <h3>
                {t(policy.title)} · {policy.version}
              </h3>
              <p className="preserve-lines">
                {policy.slug === 'payment' || !policy.approved ? t(policy.body) : policy.body}
              </p>
            </section>
          ))}
        </details>
      )}
    </section>
  );
}
