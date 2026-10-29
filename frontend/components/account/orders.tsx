'use client';
import { useLanguage } from '@/lib/language';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { paymentMethodName, type CustomerOrder, type PageResult } from '@/lib/types';
import { AccountArea } from './account-area';
import { CustomerOrderOperations } from '@/components/order-operations';
type OrderSummary = Pick<CustomerOrder, 'id' | 'number' | 'status' | 'totalCents' | 'createdUtc'>;
export function OrderDetail({ order }: { order: CustomerOrder }) {
  const { t, formatMoney } = useLanguage();
  return (
    <article className="stack">
      <h2>
        {t('Order ')}
        {order.number}
      </h2>
      <p>
        {t('Status: ')}
        {t(order.status)} · {formatMoney(order.totalCents)}
      </p>
      <p>
        {t('Payment method: ')}
        {t(paymentMethodName(order.paymentMode))}
        {t(' · Payment: ')}
        {t(order.paymentStatus)}
      </p>
      {order.paymentStatus === 'pending' &&
        order.status !== 'cancelled' &&
        order.paymentInstructions && (
          <p className="preserve-lines">{t(order.paymentInstructions)}</p>
        )}
      <p>
        {order.name}
        <br />
        {order.address}
        <br />
        {order.postalCode} {order.city}, {order.country}
        <br />
        {order.phone}
      </p>
      <ul>
        {order.items.map((item, index) => (
          <li key={item.variantId + '-' + index}>
            {item.productName} / {item.size} × {item.quantity} ·{' '}
            {formatMoney(item.unitPriceCents * item.quantity)}
          </li>
        ))}
      </ul>
      <p>
        {t('Shipping: ')}
        {formatMoney(order.shippingCents)}
        {t(' · Total: ')}
        {formatMoney(order.totalCents)}
      </p>
    </article>
  );
}
function OrderHistory() {
  const { t, formatMoney, locale } = useLanguage();
  const [page, setPage] = useState(1),
    [data, setData] = useState<PageResult<OrderSummary> | null>(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    api<PageResult<OrderSummary>>('/account/orders?page=' + page)
      .then(setData)
      .catch((error) => setMessage(error.message));
  }, [page]);
  return (
    <>
      {data?.items.length === 0 && (
        <p>
          {t(
            'No orders are linked to your account yet. Guest orders can be claimed with a separate email link.',
          )}
        </p>
      )}
      {data?.items.map((order) => (
        <article
          className="stack"
          key={order.id}
        >
          <h2>
            <Link href={'/account/orders/' + order.id}>
              {t('Order ')}
              {order.number}
            </Link>
          </h2>
          <p>
            {t(order.status)} · {formatMoney(order.totalCents)} ·{' '}
            {new Date(order.createdUtc + 'Z').toLocaleDateString(locale)}
          </p>
        </article>
      ))}
      {data && (
        <nav
          className="account-links"
          aria-label={t('Order pages')}
        >
          <button
            className="small-btn"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            {t('Previous')}
          </button>
          <span>
            {t('Page ')}
            {page}
          </span>
          <button
            className="small-btn"
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('Next')}
          </button>
        </nav>
      )}
      <p role="status">{t(message)}</p>
    </>
  );
}
function SingleOrder({ id }: { id: string }) {
  const { t } = useLanguage();
  const [order, setOrder] = useState<CustomerOrder | null>(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    api<CustomerOrder>('/account/orders/' + encodeURIComponent(id))
      .then(setOrder)
      .catch((error) => setMessage(error.message));
  }, [id]);
  return (
    <>
      {order && (
        <>
          <OrderDetail order={order} />
          <CustomerOrderOperations order={order} />
        </>
      )}
      <p role="status">{t(message)}</p>
    </>
  );
}
export function CustomerOrdersPage() {
  const { t } = useLanguage();
  return (
    <AccountArea title={t('Your orders')}>
      <OrderHistory />
    </AccountArea>
  );
}
export function CustomerOrderPage({ id }: { id: string }) {
  const { t } = useLanguage();
  return (
    <AccountArea title={t('Order details')}>
      <SingleOrder id={id} />
    </AccountArea>
  );
}
