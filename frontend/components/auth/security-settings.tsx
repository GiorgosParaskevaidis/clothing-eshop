'use client';
import { useLanguage } from '@/lib/language';
import { useState } from 'react';
import { api } from '@/lib/api';
import { AdminLogin } from '@/lib/types';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_INPUT_MAX_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_HELP,
} from '@/lib/password-policy';

export function SecuritySettings({
  admin = false,
  onSignedOut,
  onMfaReset,
}: {
  admin?: boolean;
  onSignedOut: () => void;
  onMfaReset?: (result: AdminLogin) => void;
}) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const prefix = admin ? '/auth/admin' : '/auth';
  async function run(
    event: React.FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<void>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage('');
    setBusy(true);
    try {
      await action(new FormData(form));
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update your settings.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack account-security">
      <h2>{t('Account security')}</h2>
      <form
        className="stack"
        onSubmit={(event) =>
          void run(event, async (form) => {
            await api(prefix + '/password/change', {
              method: 'POST',
              body: JSON.stringify({
                currentPassword: form.get('currentPassword'),
                newPassword: form.get('newPassword'),
              }),
            });
            onSignedOut();
          })
        }
      >
        <h3>{t('Change password')}</h3>
        <label>
          {t('Current password')}
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={PASSWORD_INPUT_MAX_LENGTH}
          />
        </label>
        <label>
          {t('New password')}
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_INPUT_MAX_LENGTH}
            pattern={PASSWORD_PATTERN}
            title={t(PASSWORD_HELP)}
            aria-describedby="new-password-help"
          />
        </label>
        <p id="new-password-help">
          {t(PASSWORD_HELP)}
          {t(' Changing your password signs you out on every device.')}
        </p>
        <button
          className="btn"
          disabled={busy}
        >
          {t('Change password')}
        </button>
      </form>
      <form
        className="stack"
        onSubmit={(event) =>
          void run(event, async (form) => {
            await api(prefix + '/email/change', {
              method: 'POST',
              body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
            });
            setMessage('Check your new email address for a confirmation link.');
          })
        }
      >
        <h3>{t('Change email')}</h3>
        <label>
          {t('New email')}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          {t('Password')}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={PASSWORD_INPUT_MAX_LENGTH}
          />
        </label>
        <button
          className="btn"
          disabled={busy}
        >
          {t('Send confirmation')}
        </button>
      </form>
      {admin && (
        <form
          className="stack"
          onSubmit={(event) =>
            void run(event, async (form) => {
              const proof = await api<{ challengeToken: string }>('/auth/admin/reauth', {
                method: 'POST',
                body: JSON.stringify({ password: form.get('password') }),
              });
              const reset = form.get('operation') === 'reset';
              const result = await api<AdminLogin>(
                '/auth/admin/' + (reset ? 'mfa/reset' : 'recovery-codes'),
                {
                  method: 'POST',
                  body: JSON.stringify({
                    challengeToken: proof.challengeToken,
                    code: form.get('code'),
                  }),
                },
              );
              if (reset) {
                setCodes(null);
                onMfaReset?.(result);
                onSignedOut();
              } else {
                setCodes(result.recoveryCodes!);
                setMessage('Save your new codes. Your previous recovery codes no longer work.');
              }
            })
          }
        >
          <h3>{t('Authenticator and recovery')}</h3>
          <label>
            {t('Password')}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={PASSWORD_INPUT_MAX_LENGTH}
            />
          </label>
          <label>
            {t('Verification code')}
            <input
              name="code"
              autoComplete="one-time-code"
              required
              maxLength={24}
            />
          </label>
          <label>
            {t('Action')}
            <select name="operation">
              <option value="codes">{t('Generate new recovery codes')}</option>
              <option value="reset">{t('Replace authenticator and sign out')}</option>
            </select>
          </label>
          <p>{t('After replacing the authenticator, sign in again to set up the new one.')}</p>
          <button
            className="btn"
            disabled={busy}
          >
            {t('Update recovery')}
          </button>
        </form>
      )}
      {codes && (
        <>
          <textarea
            aria-label={t('Recovery codes')}
            readOnly
            rows={10}
            value={codes.join('\n')}
          />
          <button
            className="small-btn"
            onClick={() => setCodes(null)}
          >
            {t('I saved my codes')}
          </button>
        </>
      )}
      <p role="status">{t(message)}</p>
    </section>
  );
}
