'use client';
const key = 'tsn_checkout_attempt_v1';
export function checkoutAttempt(signature: string, force = false) {
  try {
    const previous = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      !force &&
      previous?.signature === signature &&
      typeof previous.requestKey === 'string' &&
      /^[a-f0-9-]{36}$/.test(previous.requestKey)
    )
      return previous.requestKey as string;
    const requestKey = crypto.randomUUID();
    sessionStorage.setItem(key, JSON.stringify({ signature, requestKey }));
    return requestKey;
  } catch {
    return crypto.randomUUID();
  }
}
export function clearCheckoutAttempt() {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
