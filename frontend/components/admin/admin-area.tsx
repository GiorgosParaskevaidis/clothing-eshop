'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { AdminSignIn } from '@/components/auth/admin-sign-in';
import { useLanguage } from '@/lib/language';
export function AdminArea({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState('');
  useEffect(() => {
    api<{ email: string }>('/admin/session')
      .then((result) => setEmail(result.email))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return (
    <main
      id="main-content"
      className="wrap page-shell admin-shell"
    >
      <span className="label season">thesamenot / admin</span>
      <h1 className="page-title">{title}</h1>
      {loading ? (
        <p>Loading…</p>
      ) : email ? (
        <>
          <p>Signed in as {email}</p>
          <nav
            className="account-links"
            aria-label="Administration"
          >
            <Link href="/admin">Overview</Link>
            <Link href="/admin/products">Products</Link>
            <Link href="/admin/orders">Orders</Link>
            <Link href="/admin/shipping">Shipping</Link>
            <Link href="/admin/payments">{t('Payment settings')}</Link>
            <Link href="/admin/users">Customers</Link>
            <Link href="/admin/jobs">Jobs</Link>
            <button
              className="small-btn"
              onClick={async () => {
                try {
                  await api('/admin/logout', { method: 'POST' });
                  setEmail(null);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Please retry.');
                }
              }}
            >
              Sign out
            </button>
          </nav>
          {children}
        </>
      ) : (
        <AdminSignIn onAuthenticated={setEmail} />
      )}
      <p role="status">{message}</p>
    </main>
  );
}
