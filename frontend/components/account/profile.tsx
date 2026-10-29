'use client';
import { useLanguage } from '@/lib/language';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AccountArea, useAccountArea } from './account-area';
import { SecuritySettings } from '@/components/auth/security-settings';
import type { CustomerProfile } from '@/lib/types';
function ProfileForm() {
  const { t } = useLanguage();
  const { clearSession, refreshSession } = useAccountArea();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<CustomerProfile>('/account')
      .then(setProfile)
      .catch((error) => setMessage(error.message));
  }, []);
  return (
    <>
      <h2>{t('Profile')}</h2>
      {profile && (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const form = new FormData(event.currentTarget);
            try {
              setProfile(
                await api<CustomerProfile>('/account', {
                  method: 'PUT',
                  body: JSON.stringify({
                    displayName: form.get('displayName'),
                    version: profile.version,
                  }),
                }),
              );
              await refreshSession();
              setMessage('Profile saved.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Please retry.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t('Full name')}
            <input
              name="displayName"
              defaultValue={profile.displayName}
              required
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <p>
            {t('Email: ')}
            {profile.email}
            {t('. Change your email in security settings.')}
          </p>
          <button
            className="small-btn"
            disabled={busy}
          >
            {t('Save profile')}
          </button>
        </form>
      )}
      <p role="status">{t(message)}</p>
      <SecuritySettings onSignedOut={clearSession} />
    </>
  );
}
export function CustomerProfilePage() {
  return (
    <AccountArea>
      <ProfileForm />
    </AccountArea>
  );
}
