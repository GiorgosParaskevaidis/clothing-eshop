export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('X-Store-Request', '1');
  if (init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    const verification = await fetch('/api/security/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!verification.ok) throw new Error('Could not verify this request. Please retry.');
    const { token } = await verification.json();
    headers.set('X-CSRF-Token', token);
  }
  const response = await fetch('/api' + path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    let message =
      response.status === 401
        ? 'Please sign in.'
        : response.status === 429
          ? 'Too many requests. Please try again shortly.'
          : 'The store is temporarily unavailable.';
    try {
      const error = await response.json();
      message = error.message ?? message;
    } catch {}
    throw new Error(message);
  }
  return response.status === 204 || response.headers.get('content-length') === '0'
    ? (undefined as T)
    : await response.json().catch(() => undefined);
}
