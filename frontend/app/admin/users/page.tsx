'use client';
import { useEffect, useState } from 'react';
import { AdminArea } from '@/components/admin/admin-area';
import { api } from '@/lib/api';
import type { PageResult } from '@/lib/types';
type Customer = {
  id: string;
  email: string;
  displayName: string;
  enabled: boolean;
  emailConfirmed: boolean;
};
function Customers() {
  const [data, setData] = useState<PageResult<Customer> | null>(null),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setData(
      await api<PageResult<Customer>>(
        '/admin/users?page=' + page + '&search=' + encodeURIComponent(search),
      ),
    );
  }
  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [page, search]);
  return (
    <>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(String(new FormData(event.currentTarget).get('search') ?? ''));
        }}
      >
        <label>
          Search customers
          <input
            name="search"
            type="search"
            maxLength={100}
          />
        </label>
        <button className="small-btn">Search</button>
      </form>
      {data?.items.map((customer) => (
        <article
          key={customer.id}
          className="stack"
        >
          <h2>{customer.displayName}</h2>
          <p>
            {customer.email} · {customer.enabled ? 'Enabled' : 'Disabled'} ·{' '}
            {customer.emailConfirmed ? 'Email verified' : 'Email pending'}
          </p>
          <div className="account-links">
            <button
              className="small-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(
                    '/admin/users/' + customer.id + (customer.enabled ? '/disable' : '/enable'),
                    { method: 'POST' },
                  );
                  await refresh();
                  setMessage('Customer access updated. Existing sessions were revoked.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Please retry.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {customer.enabled ? 'Disable' : 'Enable'} {customer.email}
            </button>
            <button
              className="small-btn"
              disabled={busy || !customer.enabled}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/admin/users/' + customer.id + '/reset-link', { method: 'POST' });
                  setMessage('Password reset instructions requested for the customer.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Please retry.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send password reset to {customer.email}
            </button>
          </div>
        </article>
      ))}
      {data && (
        <nav
          className="account-links"
          aria-label="Customer pages"
        >
          <button
            className="small-btn"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} · {data.total} customers
          </span>
          <button
            className="small-btn"
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      )}
      <p role="status">{message}</p>
    </>
  );
}
export default function Page() {
  return (
    <AdminArea title="Customers">
      <Customers />
    </AdminArea>
  );
}
