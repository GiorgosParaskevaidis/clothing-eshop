'use client';

import { useEffect, useState } from 'react';
import { AdminArea } from '@/components/admin/admin-area';
import { api } from '@/lib/api';
import { useLanguage } from '@/lib/language';
import type { PaymentSettings } from '@/lib/types';

function PaymentSettingsForm() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<PaymentSettings | null>(null);
  const [challenge, setChallenge] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function load() {
    setChallenge('');
    setBusy(true);
    setMessage('');
    try {
      setDraft(await api<PaymentSettings>('/admin/payment-settings'));
      setFailed(false);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="stack">
      <p>
        {t(
          'Manage the Revolut account used for new bank transfer orders. Cash on delivery remains available.',
        )}
      </p>
      <p className="muted">
        {t(
          'Saved changes apply immediately to new orders. Existing orders keep their original payment instructions.',
        )}
      </p>
      <button
        type="button"
        className="small-btn"
        disabled={busy}
        onClick={() => void load()}
      >
        {t('Reload saved settings')}
      </button>
      {!draft && !message && <p role="status">{t('Loading…')}</p>}
      {draft && (
        <>
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              const password = event.currentTarget.elements.namedItem(
                'password',
              ) as HTMLInputElement;
              const value = password.value;
              password.value = '';
              setBusy(true);
              setMessage('');
              try {
                const result = await api<{ challengeToken: string }>('/auth/admin/reauth', {
                  method: 'POST',
                  body: JSON.stringify({ password: value }),
                });
                setChallenge(result.challengeToken);
                setFailed(false);
              } catch (error) {
                setFailed(true);
                setMessage(error instanceof Error ? error.message : 'Please retry.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset
              className="stack"
              disabled={busy || Boolean(challenge)}
            >
              <legend>{t('Bank transfer to Revolut')}</legend>
              <label className="consent">
                <input
                  name="bankTransferEnabled"
                  type="checkbox"
                  checked={draft.bankTransferEnabled}
                  onChange={(event) =>
                    setDraft({ ...draft, bankTransferEnabled: event.target.checked })
                  }
                />
                {t('Enable bank transfer')}
              </label>
              <label>
                {t('Account holder')}
                <input
                  name="accountHolder"
                  value={draft.accountHolder}
                  maxLength={140}
                  required={draft.bankTransferEnabled}
                  autoComplete="off"
                  onChange={(event) => setDraft({ ...draft, accountHolder: event.target.value })}
                />
              </label>
              <label>
                IBAN
                <input
                  name="iban"
                  value={draft.iban}
                  maxLength={64}
                  spellCheck={false}
                  autoComplete="off"
                  required={draft.bankTransferEnabled}
                  onChange={(event) => setDraft({ ...draft, iban: event.target.value })}
                />
              </label>
              <label>
                {t('BIC (optional)')}
                <input
                  name="bic"
                  value={draft.bic}
                  maxLength={11}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setDraft({ ...draft, bic: event.target.value })}
                />
              </label>
              <p className="muted">
                {t(
                  'To enable bank transfer, enter an account holder and a valid IBAN. BIC is optional.',
                )}
              </p>
              <label>
                {t('Confirm your password')}
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
                {t('Verify password to save settings')}
              </button>
            </fieldset>
          </form>
          {challenge && (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                const code = new FormData(event.currentTarget).get('code');
                event.currentTarget.reset();
                setBusy(true);
                setMessage('');
                try {
                  const saved = await api<PaymentSettings>('/admin/payment-settings', {
                    method: 'PUT',
                    body: JSON.stringify({ ...draft, challengeToken: challenge, code }),
                  });
                  setDraft(saved);
                  setFailed(false);
                  setMessage(
                    'Payment settings saved. New orders use these details; existing orders keep their original instructions.',
                  );
                } catch (error) {
                  setFailed(true);
                  setMessage(error instanceof Error ? error.message : 'Please retry.');
                } finally {
                  // A proof may have been consumed even if the response was lost or a version conflicted.
                  setChallenge('');
                  setBusy(false);
                }
              }}
            >
              <p>
                {t(
                  'Review the account details above, then enter a fresh authenticator or recovery code to save.',
                )}
              </p>
              <p>
                <strong>{t('Bank transfer after saving: ')}</strong>
                {draft.bankTransferEnabled ? t('Enabled') : t('Disabled')}
              </p>
              <label>
                {t('Fresh authenticator or recovery code')}
                <input
                  name="code"
                  required
                  autoComplete="one-time-code"
                  maxLength={32}
                  disabled={busy}
                />
              </label>
              <div className="account-links">
                <button
                  className="small-btn"
                  disabled={busy}
                >
                  {busy ? t('Saving…') : t('Save payment settings')}
                </button>
                <button
                  type="button"
                  className="small-btn"
                  disabled={busy}
                  onClick={() => setChallenge('')}
                >
                  {t('Edit details before saving')}
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {message && (
        <p
          className={failed ? 'notice' : undefined}
          role={failed ? 'alert' : 'status'}
        >
          {t(message)}
        </p>
      )}
    </section>
  );
}

export default function PaymentSettingsPage() {
  const { t } = useLanguage();
  return (
    <AdminArea title={t('Payment settings')}>
      <PaymentSettingsForm />
    </AdminArea>
  );
}
