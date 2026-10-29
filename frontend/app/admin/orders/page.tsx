'use client';
import { useEffect, useState } from 'react';
import { AdminArea } from '@/components/admin/admin-area';
import { OrderDetail } from '@/components/account/orders';
import { api } from '@/lib/api';
import {
  type CustomerOrder,
  type OrderOperations,
  type PageResult,
  money,
  isManualPayment,
  paymentMethodName,
} from '@/lib/types';
type Detail = { order: CustomerOrder; operations: OrderOperations };
function Orders() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [data, setData] = useState<PageResult<CustomerOrder> | null>(null),
    [selected, setSelected] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [refundKey, setRefundKey] = useState(''),
    [challenge, setChallenge] = useState('');
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  async function load(id?: string) {
    setData(
      await api<PageResult<CustomerOrder>>(
        '/admin/operations/orders?page=' + page + '&search=' + encodeURIComponent(search),
      ),
    );
    if (id) setSelected(await api<Detail>('/admin/operations/orders/' + id));
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
  const order = selected?.order;
  return (
    <div className="stack">
      <label>
        Search orders
        <input
          value={search}
          maxLength={120}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </label>
      {data?.items.map((item) => (
        <article
          className="split"
          key={item.id}
        >
          <span>
            {item.number} · {item.email} · {item.status} · {paymentMethodName(item.paymentMode)} ·{' '}
            {item.paymentStatus} · {money(item.totalCents)}
          </span>
          <button
            className="small-btn"
            onClick={() => {
              setChallenge('');
              setRefundKey(crypto.randomUUID());
              void action(() => load(item.id));
            }}
          >
            Open {item.number}
          </button>
        </article>
      ))}
      {data && (
        <nav
          className="account-links"
          aria-label="Order pages"
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
      {order && selected && (
        <section className="stack">
          <OrderDetail order={order} />
          <p>
            Payment: {order.paymentStatus} · Fulfillment: {order.fulfillmentStatus}
          </p>
          <button
            className="small-btn"
            onClick={() => void action(() => load(order.id))}
          >
            Refresh order
          </button>
          {isManualPayment(order.paymentMode) &&
            order.paymentStatus === 'pending' &&
            (order.status === 'awaiting_payment' || order.status === 'fulfilled') && (
              <form
                className="stack"
                key={'payment-' + order.id + '-' + order.version}
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action(async () => {
                    await api('/admin/operations/orders/' + order.id + '/confirm-payment', {
                      method: 'POST',
                      body: JSON.stringify({
                        version: order.version,
                        amountCents: Math.round(Number(form.get('received')) * 100),
                        reference: form.get('reference'),
                      }),
                    });
                    await load(order.id);
                  });
                }}
              >
                <h3>Confirm payment received</h3>
                <p>
                  Record only money actually received in Revolut or confirmed as collected by the
                  courier.
                </p>
                <label>
                  Amount received (€)
                  <input
                    name="received"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    defaultValue={order.totalCents / 100}
                  />
                </label>
                <label>
                  Bank / courier collection reference
                  <input
                    name="reference"
                    maxLength={300}
                    required
                  />
                </label>
                <button
                  className="small-btn"
                  disabled={busy}
                >
                  Confirm receipt
                </button>
              </form>
            )}
          {isManualPayment(order.paymentMode) &&
            ['awaiting_payment', 'confirmed'].includes(order.status) &&
            order.paymentStatus === 'pending' && (
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action(async () => {
                    await api('/admin/operations/orders/' + order.id + '/cancel', {
                      method: 'POST',
                      body: JSON.stringify({ version: order.version, reason: form.get('reason') }),
                    });
                    await load(order.id);
                  });
                }}
              >
                <label>
                  Cancellation reason
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
                  Cancel order and release stock
                </button>
              </form>
            )}
          {(order.status === 'paid' ||
            (order.paymentMode === 'CashOnDelivery' && order.status === 'confirmed')) && (
            <form
              key={order.id + '-' + order.version}
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void action(async () => {
                  await api('/admin/operations/orders/' + order.id + '/ship', {
                    method: 'POST',
                    body: JSON.stringify({
                      courier: form.get('courier'),
                      trackingNumber: form.get('trackingNumber'),
                      trackingUrl: form.get('trackingUrl'),
                      version: order.version,
                    }),
                  });
                  await load(order.id);
                });
              }}
            >
              <h3>Dispatch order</h3>
              <label>
                Courier
                <input
                  name="courier"
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Tracking number
                <input
                  name="trackingNumber"
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Tracking URL (optional HTTPS)
                <input
                  name="trackingUrl"
                  type="url"
                  maxLength={1000}
                />
              </label>
              <button
                className="small-btn"
                disabled={busy}
              >
                Mark shipped
              </button>
            </form>
          )}
          {selected.operations.shipments.map((shipment, index) => (
            <p key={index}>
              {shipment.courier} · {shipment.trackingNumber}
            </p>
          ))}
          <h3>Refunds</h3>
          {selected.operations.refunds.map((refund) => (
            <p key={refund.id}>
              {money(refund.amountCents)} · {refund.state}
            </p>
          ))}
          {selected.operations.disputes.length > 0 && (
            <section className="notice">
              <h3>Payment disputes</h3>
              {selected.operations.disputes.map((dispute, index) => (
                <p key={index}>
                  {dispute.providerId} · {money(dispute.amountCents, dispute.currency)} ·{' '}
                  {dispute.state}
                </p>
              ))}
              <p>
                Review and respond in the payment provider dashboard. Dispatch and new refunds are
                blocked while a dispute is active.
              </p>
            </section>
          )}
          {['succeeded', 'partially_refunded'].includes(order.paymentStatus) && (
            <details>
              <summary>
                {isManualPayment(order.paymentMode)
                  ? 'Record a completed manual refund'
                  : 'Request a refund'}
              </summary>
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action(async () => {
                    const result = await api<{ challengeToken: string }>('/auth/admin/reauth', {
                      method: 'POST',
                      body: JSON.stringify({ password: form.get('password') }),
                    });
                    setChallenge(result.challengeToken);
                  });
                }}
              >
                <label>
                  Confirm your password
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </label>
                <button
                  className="small-btn"
                  disabled={busy}
                >
                  Verify password for refund
                </button>
              </form>
              {challenge && (
                <form
                  className="stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void action(async () => {
                      await api('/admin/operations/orders/' + order.id + '/refund', {
                        method: 'POST',
                        body: JSON.stringify({
                          requestKey: refundKey,
                          amountCents: Math.round(Number(form.get('amount')) * 100),
                          reason: form.get('reason'),
                          challengeToken: challenge,
                          code: form.get('code'),
                        }),
                      });
                      setChallenge('');
                      setRefundKey(crypto.randomUUID());
                      await load(order.id);
                    });
                  }}
                >
                  <label>
                    Refund amount (€)
                    <input
                      name="amount"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      max={order.totalCents / 100}
                    />
                  </label>
                  <label>
                    {isManualPayment(order.paymentMode)
                      ? 'Refund reason and transfer reference'
                      : 'Refund reason'}
                    <input
                      name="reason"
                      required
                      maxLength={300}
                    />
                  </label>
                  <label>
                    Fresh authenticator or recovery code
                    <input
                      name="code"
                      required
                      autoComplete="one-time-code"
                      maxLength={32}
                    />
                  </label>
                  <p>
                    {isManualPayment(order.paymentMode)
                      ? 'Send the refund outside the application first, then record the exact amount and transfer reference here. This records the completed refund and does not transfer money or restock products.'
                      : 'Submitting queues the refund. Provider confirmation appears in the order history. This action does not restock products.'}
                  </p>
                  <button
                    className="small-btn"
                    disabled={busy}
                  >
                    {isManualPayment(order.paymentMode)
                      ? 'Record completed refund'
                      : 'Queue refund'}
                  </button>
                </form>
              )}
            </details>
          )}
          <h3>Returns & withdrawal</h3>
          {selected.operations.returns.map((request) => (
            <article
              className="stack"
              key={request.id + '-' + request.version}
            >
              <h4>
                {request.kind} · {request.state}
              </h4>
              <p>{request.reason}</p>
              <label>
                Decision note
                <input
                  maxLength={700}
                  value={returnNotes[request.id] ?? ''}
                  onChange={(event) =>
                    setReturnNotes((previous) => ({
                      ...previous,
                      [request.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="account-links">
                {(request.state === 'requested'
                  ? ['approved', 'rejected']
                  : request.state === 'received'
                    ? ['closed']
                    : []
                ).map((state) => (
                  <button
                    key={state}
                    className="small-btn"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await api('/admin/operations/returns/' + request.id + '/state', {
                          method: 'POST',
                          body: JSON.stringify({
                            state,
                            version: request.version,
                            reason: returnNotes[request.id] ?? '',
                          }),
                        });
                        await load(order.id);
                      })
                    }
                  >
                    {state === 'approved'
                      ? 'Approve return'
                      : state === 'rejected'
                        ? 'Reject return'
                        : 'Close return'}
                  </button>
                ))}
              </div>
              {['approved', 'received'].includes(request.state) && (
                <form
                  className="stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void action(async () => {
                      const items = selected.operations.returnItems
                        .filter((item) => item.returnId === request.id)
                        .map((item) => ({
                          orderItemId: item.orderItemId,
                          receivedQuantity: Number(form.get('received-' + item.orderItemId)),
                          restockQuantity: Number(form.get('restock-' + item.orderItemId)),
                        }));
                      await api('/admin/operations/returns/' + request.id + '/inspect', {
                        method: 'POST',
                        body: JSON.stringify({
                          version: request.version,
                          reason: form.get('reason'),
                          items,
                        }),
                      });
                      await load(order.id);
                    });
                  }}
                >
                  {selected.operations.returnItems
                    .filter((item) => item.returnId === request.id)
                    .map((item) => (
                      <fieldset key={item.orderItemId}>
                        <legend>
                          Item{' '}
                          {order.items.find((line) => line.id === item.orderItemId)?.productName} ·
                          requested {item.quantity}
                        </legend>
                        <label>
                          Total received
                          <input
                            name={'received-' + item.orderItemId}
                            type="number"
                            required
                            min={item.receivedQuantity}
                            max={item.quantity}
                            defaultValue={item.receivedQuantity}
                          />
                        </label>
                        <label>
                          Total inspected and restocked
                          <input
                            name={'restock-' + item.orderItemId}
                            type="number"
                            required
                            min={item.restockedQuantity}
                            max={item.quantity}
                            defaultValue={item.restockedQuantity}
                          />
                        </label>
                      </fieldset>
                    ))}
                  <label>
                    Inspection / restock reason
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
                    Save inspection
                  </button>
                </form>
              )}
            </article>
          ))}
          <h3>History</h3>
          <ol>
            {selected.operations.history.map((item) => (
              <li key={item.id}>{item.detail}</li>
            ))}
          </ol>
        </section>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
export default function Page() {
  return (
    <AdminArea title="Orders">
      <Orders />
    </AdminArea>
  );
}
