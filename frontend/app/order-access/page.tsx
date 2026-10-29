'use client';
import { useLanguage } from '@/lib/language';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { CustomerOrder } from '@/lib/types';
import { OrderDetail } from '@/components/account/orders';
import { CustomerOrderOperations } from '@/components/order-operations';
import { useEmailFragment } from '@/lib/use-email-fragment';

export default function OrderAccess() {
  const { t } = useLanguage();
  const router = useRouter();
  const { token, setToken, purpose: linkPurpose, revision } = useEmailFragment();
  const [purpose, setPurpose] = useState('access'),
    [message, setMessage] = useState('');
  const [order, setOrder] = useState<CustomerOrder | null>(null),
    [busy, setBusy] = useState(false),
    [complete, setComplete] = useState(false);
  useEffect(() => {
    if (revision > 0) {
      setPurpose(linkPurpose === 'order-claim' ? 'claim' : 'access');
      setComplete(false);
      setOrder(null);
      setMessage('');
    }
  }, [revision, linkPurpose]);
  return (
    <main
      id="main-content"
      className="wrap page-shell account-shell"
    >
      <span className="label season">thesamenot</span>
      <h1 className="page-title">{t('Guest order access')}</h1>
      {order ? (
        <>
          <OrderDetail order={order} />
          <CustomerOrderOperations
            order={order}
            guest
          />
        </>
      ) : token && !complete ? (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage('');
            try {
              if (purpose === 'claim') {
                const result = await api<{ orderId: string }>('/orders/claim', {
                  method: 'POST',
                  body: JSON.stringify({ token }),
                });
                setComplete(true);
                setToken('');
                router.replace('/account/orders/' + result.orderId);
              } else {
                await api('/orders/access', { method: 'POST', body: JSON.stringify({ token }) });
                setOrder(await api<CustomerOrder>('/orders/access'));
                setComplete(true);
                setToken('');
              }
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Please retry.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {purpose === 'claim'
              ? t('Link this guest order to the signed-in account with the same verified email.')
              : t('Open the order details using this single-use email link.')}
          </p>
          {purpose === 'claim' && (
            <p>
              {t(
                'If you are not signed in, sign in first and then reopen the link from your email.',
              )}
            </p>
          )}
          <button
            className="btn red"
            disabled={busy}
          >
            {purpose === 'claim' ? t('Link order to my account') : t('Open order')}
          </button>
        </form>
      ) : (
        !complete && (
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              const data = new FormData(event.currentTarget);
              try {
                await api('/orders/access-link', {
                  method: 'POST',
                  body: JSON.stringify({
                    email: data.get('email'),
                    orderNumber: data.get('number'),
                    purpose,
                  }),
                });
                setMessage(
                  'If the details match a guest order, a one-time link will be emailed. Check your inbox and spam folder.',
                );
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Please retry.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              {t(
                'Use the order number from your receipt and the email used at checkout. Guest orders are never linked automatically just because an email matches.',
              )}
            </p>
            <label>
              {t('Order number')}
              <input
                name="number"
                required
                maxLength={40}
                autoComplete="off"
                placeholder={t('TSN-…')}
              />
            </label>
            <label>
              {t('Order email')}
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label>
              {t('What would you like to do?')}
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              >
                <option value="access">{t('View a guest order')}</option>
                <option value="claim">{t('Link it to my verified account')}</option>
              </select>
            </label>
            <button
              className="btn red"
              disabled={busy}
            >
              {t('Send order link')}
            </button>
          </form>
        )
      )}
      <p role="status">{t(message)}</p>
      <div className="account-links">
        <Link href="/account/login">{t('Sign in')}</Link>
        <Link href="/account/register">{t('Create an account')}</Link>
        <Link href="/account/orders">{t('My orders')}</Link>
        <Link href="/shop">{t('Shop')}</Link>
      </div>
    </main>
  );
}
