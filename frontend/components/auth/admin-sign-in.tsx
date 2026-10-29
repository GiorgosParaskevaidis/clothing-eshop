'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { PASSWORD_INPUT_MAX_LENGTH } from '@/lib/password-policy';
import { AdminLogin } from '@/lib/types';

export function AdminSignIn({ onAuthenticated }: { onAuthenticated: (email: string) => void }) {
  const [challenge, setChallenge] = useState<AdminLogin | null>(null);
  const [key, setKey] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const result = challenge
        ? await api<AdminLogin>('/auth/admin/mfa/verify', {
            method: 'POST',
            body: JSON.stringify({
              challengeToken: challenge.challengeToken,
              code: form.get('code'),
            }),
          })
        : await api<AdminLogin>('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
          });
      if (result.requiresMfa) {
        setChallenge(result);
        if (result.requiresSetup) {
          const setup = await api<{ key: string }>('/auth/admin/mfa/setup', {
            method: 'POST',
            body: JSON.stringify({ token: result.challengeToken }),
          });
          setKey(setup.key);
        }
      } else if (result.recoveryCodes) {
        setEmail(result.email!);
        setCodes(result.recoveryCodes);
      } else onAuthenticated(result.email!);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }
  if (codes)
    return (
      <section className="stack">
        <h2>Save your recovery codes</h2>
        <p>
          Keep these privately, away from this device. Each code works once if you lose access to
          your authenticator.
        </p>
        <textarea
          aria-label="Recovery codes"
          readOnly
          rows={10}
          value={codes.join('\n')}
        />
        <button
          className="btn red"
          onClick={() => {
            setCodes(null);
            setKey('');
            onAuthenticated(email);
          }}
        >
          I saved my codes
        </button>
      </section>
    );
  return (
    <>
      <form
        className="stack"
        onSubmit={submit}
      >
        {challenge ? (
          <>
            <h2>{challenge.requiresSetup ? 'Set up your authenticator' : 'Verify your sign in'}</h2>
            {challenge.requiresSetup && (
              <>
                <p>
                  Add a time based account named thesamenot to your authenticator app using this
                  setup key.
                </p>
                <code className="auth-secret">{key}</code>
                <p>Enter the six digit code from the app to finish.</p>
              </>
            )}
            <label>
              Verification code
              <input
                name="code"
                autoComplete="one-time-code"
                required
                maxLength={24}
                autoFocus
              />
            </label>
            {!challenge.requiresSetup && <p>You can also use one of your saved recovery codes.</p>}
          </>
        ) : (
          <>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={PASSWORD_INPUT_MAX_LENGTH}
              />
            </label>
          </>
        )}
        <button
          className="btn red"
          disabled={busy}
        >
          {busy ? 'Please wait…' : challenge ? 'Verify' : 'Sign in'}
        </button>
        {challenge && (
          <button
            type="button"
            className="small-btn"
            onClick={() => {
              setChallenge(null);
              setKey('');
              setMessage('');
            }}
          >
            Start again
          </button>
        )}
      </form>
      <p role="alert">{message}</p>
    </>
  );
}
