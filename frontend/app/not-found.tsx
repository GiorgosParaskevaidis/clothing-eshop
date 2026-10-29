'use client';
import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <main
      id="main-content"
      className="wrap page-shell"
    >
      <h1 className="page-title">{t('Page not found.')}</h1>
      <p>{t('This page does not exist.')}</p>
      <Link href="/shop">{t('Continue shopping')}</Link>
    </main>
  );
}
