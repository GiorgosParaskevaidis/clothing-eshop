'use client';
import { useLanguage } from '@/lib/language';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { AuthSession } from '@/lib/types';

const AccountContext = createContext<{
  session: AuthSession;
  clearSession: () => void;
  refreshSession: () => Promise<void>;
} | null>(null);
export function useAccountArea() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('Account context is required.');
  return value;
}
export function AccountArea({
  children,
  title = 'Your account',
}: {
  children: ReactNode;
  title?: string;
}) {
  const { t } = useLanguage();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    api<AuthSession>('/auth/session')
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return (
    <main
      id="main-content"
      className="wrap page-shell account-shell"
    >
      <span className="label season">{t('thesamenot / account')}</span>
      <h1 className="page-title">{t(title)}</h1>
      {loading ? (
        <p>{t('Loading…')}</p>
      ) : session ? (
        <AccountContext.Provider
          value={{
            session,
            clearSession: () => setSession(null),
            refreshSession: async () => setSession(await api<AuthSession>('/auth/session')),
          }}
        >
          <p>
            {session.displayName} · {session.email}
          </p>
          <nav
            className="account-links"
            aria-label={t('Account')}
          >
            <Link href="/account">{t('Profile & security')}</Link>
            <Link href="/account/addresses">{t('Addresses')}</Link>
            <Link href="/account/orders">{t('Orders')}</Link>
            <Link href="/order-access">{t('Claim a guest order')}</Link>
            <Link href="/shop">{t('Shop')}</Link>
          </nav>
          <button
            className="small-btn"
            onClick={async () => {
              try {
                await api('/auth/logout', { method: 'POST' });
                setSession(null);
                setMessage('You are signed out.');
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Please retry.');
              }
            }}
          >
            {t('Sign out')}
          </button>
          {children}
        </AccountContext.Provider>
      ) : (
        <div className="account-links">
          <Link href="/account/login">{t('Sign in')}</Link>
          <Link href="/account/register">{t('Create an account')}</Link>
          <Link href="/">{t('Continue shopping')}</Link>
        </div>
      )}
      <p role="status">{t(message)}</p>
    </main>
  );
}
