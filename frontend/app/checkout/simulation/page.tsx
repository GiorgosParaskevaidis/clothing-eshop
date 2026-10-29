import { Suspense } from 'react';
import { ReceiptView } from '@/components/receipt';
import { serverTranslator } from '@/lib/server-language';
export default async function Simulation() {
  const t = await serverTranslator();
  return (
    <Suspense fallback={<p>{t('Loading order…')}</p>}>
      <ReceiptView simulation />
    </Suspense>
  );
}
