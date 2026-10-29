'use client';
import { useLanguage } from '@/lib/language';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useEmailFragment } from '@/lib/use-email-fragment';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_INPUT_MAX_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_HELP,
} from '@/lib/password-policy';

type Mode = 'login' | 'register' | 'forgot-password' | 'verify-email' | 'reset-password';
export function AccountForm({ mode }: { mode: Mode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const linkFlow = mode === 'verify-email' || mode === 'reset-password';
  const { token, setToken, purpose, revision } = useEmailFragment(linkFlow);
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    setCompleted(false);
    setBusy(false);
    setMessage('');
    if (mode === 'login' && new URLSearchParams(window.location.search).get('verified') === '1') {
      setMessage('Your email is confirmed. Sign in to continue.');
    }
    api<{ enabled: boolean }>('/auth/config')
      .then((result) => setEnabled(result.enabled))
      .catch(() => setMessage('Accounts are temporarily unavailable.'));
  }, [mode]);
  useEffect(() => {
    if (revision > 0) {
      setCompleted(false);
      setMessage('');
    }
  }, [revision]);
  const title = {
    login: 'Sign in',
    register: 'Create an account',
    'forgot-password': 'Reset your password',
    'verify-email': 'Confirm your email',
    'reset-password': 'Choose a new password',
  }[mode];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'login') {
        await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
        });
        router.replace('/account');
      } else if (mode === 'register') {
        await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: form.get('email'),
            password: form.get('password'),
            displayName: form.get('name'),
          }),
        });
        setMessage(
          'If this address can receive the message, a confirmation link will be sent. Confirm your email before signing in.',
        );
      } else if (mode === 'forgot-password') {
        await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: form.get('email') }),
        });
        setMessage('If this address can receive the message, reset instructions will be sent.');
      } else if (mode === 'verify-email') {
        let signedIn = false;
        if (purpose === 'change-email') {
          await api('/auth/email/confirm', { method: 'POST', body: JSON.stringify({ token }) });
        } else {
          const result = await api<{ signedIn: boolean }>('/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ token }),
          });
          signedIn = result?.signedIn === true;
        }
        setCompleted(true);
        setToken('');
        router.replace(signedIn ? '/account' : '/account/login?verified=1');
      } else {
        await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password: form.get('password') }),
        });
        setCompleted(true);
        setToken('');
        setMessage('Your password changed. Sign in using your new password.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email') }),
      });
      setMessage('If verification is needed, a new link will be sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      className="wrap page-shell account-shell"
    >
      <span className="label season">{t('thesamenot / account')}</span>
      <h1 className="page-title">{t(title)}</h1>
      {enabled === false ? (
        <p>{t('Accounts are not enabled in this preview. You can still shop as a guest.')}</p>
      ) : enabled === null ? (
        <p>{t('Loading…')}</p>
      ) : (
        <>
          <form
            className="stack"
            onSubmit={submit}
          >
            {mode === 'register' && (
              <label>
                {t('Full name')}
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={120}
                />
              </label>
            )}
            {!linkFlow && (
              <label>
                {t('Email')}
                <input
                  name="email"
                  type="email"
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  required
                  maxLength={254}
                />
              </label>
            )}
            {['login', 'register', 'reset-password'].includes(mode) && (
              <label>
                {t('Password')}
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'login' ? 1 : PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_INPUT_MAX_LENGTH}
                  pattern={mode === 'login' ? undefined : PASSWORD_PATTERN}
                  title={mode === 'login' ? undefined : t(PASSWORD_HELP)}
                  aria-describedby={mode === 'login' ? undefined : 'account-password-help'}
                />
              </label>
            )}
            {(mode === 'register' || mode === 'reset-password') && (
              <p id="account-password-help">{t(PASSWORD_HELP)}</p>
            )}
            {linkFlow && !token && !completed && (
              <p>{t('Open the link from your email to continue. Links expire and work once.')}</p>
            )}
            <button
              className="btn red"
              disabled={busy || completed || (linkFlow && !token)}
            >
              {busy ? t('Please wait…') : mode === 'forgot-password' ? t('Send reset link') : title}
            </button>
          </form>
          {mode === 'verify-email' && !completed && (
            <form
              className="stack"
              onSubmit={resend}
            >
              <h2>{t('Need a new confirmation link?')}</h2>
              <label>
                {t('Email')}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <button
                className="small-btn"
                disabled={busy}
              >
                {t('Resend confirmation')}
              </button>
            </form>
          )}
        </>
      )}
      <p role="status">{t(message)}</p>
      <div className="account-links">
        <Link href="/account/login">{t('Sign in')}</Link>
        <Link href="/account/register">{t('Create an account')}</Link>
        <Link href="/account/forgot-password">{t('Forgot password?')}</Link>
        <Link href="/account/verify-email">{t('Confirm email')}</Link>
      </div>
    </main>
  );
}
