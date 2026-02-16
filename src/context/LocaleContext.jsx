import { createContext, useCallback, useMemo, useState } from 'react';
import { DICTS } from '../i18n/dictionaries.js';

const STORAGE_KEY = 'templesale.locale';
const DEFAULT_LOCALE = 'pt-BR';
const SUPPORTED_LOCALES = Object.keys(DICTS);

const matchSupportedLocale = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized.startsWith('pt')) return 'pt-BR';
  if (normalized.startsWith('en')) return 'en-US';
  if (normalized.startsWith('es')) return 'es-ES';
  if (normalized.startsWith('it')) return 'it-IT';
  if (normalized.startsWith('ar')) return 'ar-SA';
  if (normalized.startsWith('de')) return 'de-DE';
  if (normalized.startsWith('ja')) return 'ja-JP';
  if (normalized.startsWith('zh')) return 'zh-CN';
  const exact = SUPPORTED_LOCALES.find((loc) => loc.toLowerCase() === normalized);
  if (exact) return exact;
  const prefix = SUPPORTED_LOCALES.find((loc) => normalized.startsWith(loc.slice(0, 2).toLowerCase()));
  return prefix || null;
};

const resolveInitialLocale = () => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = matchSupportedLocale(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // ignore storage failures
  }
  const browserLocale =
    typeof navigator !== 'undefined'
      ? navigator.languages?.[0] || navigator.language
      : null;
  return matchSupportedLocale(browserLocale) || DEFAULT_LOCALE;
};

export const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  supportedLocales: SUPPORTED_LOCALES
});

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(resolveInitialLocale);

  const setLocale = useCallback((value) => {
    const next = matchSupportedLocale(value) || DEFAULT_LOCALE;
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage failures
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      supportedLocales: SUPPORTED_LOCALES
    }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
