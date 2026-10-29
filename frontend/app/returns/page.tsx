import { serverTranslator } from '@/lib/server-language';
import Link from 'next/link';
export async function generateMetadata() {
  const t = await serverTranslator();
  return {
    title: t('Returns & withdrawal'),
    robots: { index: false, follow: false },
  };
}
export default async function Page() {
  const t = await serverTranslator();
  return (
    <main
      id="main-content"
      className="wrap page-shell account-shell"
    >
      <h1 className="page-title">{t('Returns & withdrawal')}</h1>
      <p>{t('Open your order and choose “Request a return or withdrawal”.')}</p>
      <div className="account-links">
        <Link href="/account/orders">{t('Orders in my account')}</Link>
        <Link href="/order-access">{t('Access a guest order by email')}</Link>
      </div>
      <p>
        {t('Keep the request reference from the confirmation.')}{' '}
        <Link href="/policies/returns">{t('Read the return policy.')}</Link>
      </p>
    </main>
  );
}
