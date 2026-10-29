'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANGUAGE_COOKIE, languageLocale, translate, type Language } from './translations';

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required.');
  const { language, setLanguage } = context;
  return useMemo(
    () => ({
      language,
      locale: languageLocale(language),
      setLanguage,
      t: (text: string | null | undefined) => translate(language, text ?? ''),
      formatMoney: (cents: number, currency = 'EUR') =>
        new Intl.NumberFormat(languageLocale(language), {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(cents / 100),
    }),
    [language, setLanguage],
  );
}

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  return (
    <label className="language-selector">
      <span className="sr-only">{language === 'el' ? 'Γλώσσα' : 'Language'}</span>
      <select
        aria-label="Ελληνικά / English"
        value={language}
        onChange={(event) => {
          const next = event.target.value === 'en' ? 'en' : 'el';
          document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
          setLanguage(next);
          router.refresh();
        }}
      >
        <option
          value="el"
          lang="el"
        >
          Ελληνικά
        </option>
        <option
          value="en"
          lang="en"
        >
          English
        </option>
      </select>
    </label>
  );
}
