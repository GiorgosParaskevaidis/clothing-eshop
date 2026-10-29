'use client';
import { useLanguage } from '@/lib/language';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <main
      id="main-content"
      className="wrap page-shell"
    >
      <h1 className="page-title">{t('Please try again')}</h1>
      <p role="alert">
        {t('The store could not load this page. Your saved basket is still in this browser.')}
      </p>
      <div className="account-links">
        <button
          className="small-btn"
          onClick={reset}
        >
          {t('Retry')}
        </button>
        <Link href="/shop">{t('Shop')}</Link>
      </div>
    </main>
  );
}
