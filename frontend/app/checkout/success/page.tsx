import { Suspense } from 'react';
import { ReceiptView } from '@/components/receipt';
import { serverTranslator } from '@/lib/server-language';
export default async function Success() {
  const t = await serverTranslator();
  return (
    <Suspense fallback={<p>{t('Loading order…')}</p>}>
      <ReceiptView />
    </Suspense>
  );
}
