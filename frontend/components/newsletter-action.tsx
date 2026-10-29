'use client';
import { useLanguage } from '@/lib/language';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useEmailFragment } from '@/lib/use-email-fragment';
export function NewsletterAction({ confirm = false }: { confirm?: boolean }) {
  const { t } = useLanguage();
  const { token, setToken, revision } = useEmailFragment(true, true);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (revision > 0) setMessage('');
  }, [revision]);
  return (
    <main
      id="main-content"
      className="wrap page-shell"
    >
      <h1 className="page-title">{confirm ? t('Confirm subscription') : t('Drop updates')}</h1>
      <button
        className="btn"
        disabled={busy || !token}
        onClick={async () => {
          setBusy(true);
          try {
            await api('/newsletter/' + (confirm ? 'confirm' : 'unsubscribe'), {
              method: 'POST',
              body: JSON.stringify({ token }),
            });
            setToken('');
            setMessage(confirm ? 'Your subscription is confirmed.' : 'You have been unsubscribed.');
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Please retry.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {confirm ? t('Confirm subscription') : t('Unsubscribe')}
      </button>
      <p role="status">{t(message)}</p>
    </main>
  );
}
