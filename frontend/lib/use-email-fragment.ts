'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
export function useEmailFragment(enabled = true, allowQuery = false) {
  const pathname = usePathname();
  const [token, setToken] = useState(''),
    [purpose, setPurpose] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setToken('');
      setPurpose('');
      return;
    }
    function read() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const params = hash.has('token')
        ? hash
        : allowQuery
          ? new URLSearchParams(window.location.search)
          : hash;
      if (!params.has('token')) return;
      const value = params.get('token') ?? '';
      setToken(value.length <= 256 ? value : '');
      setPurpose((params.get('purpose') ?? '').slice(0, 60));
      setRevision((current) => current + 1);
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + (allowQuery ? '' : window.location.search),
      );
    }
    read();
    window.addEventListener('hashchange', read);
    window.addEventListener('popstate', read);
    return () => {
      window.removeEventListener('hashchange', read);
      window.removeEventListener('popstate', read);
    };
  }, [enabled, allowQuery, pathname]);
  return { token, purpose, setToken, revision };
}
