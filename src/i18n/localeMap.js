import { COUNTRY_LANGUAGE_MAP, normalizeCountryCode } from '../data/countries.js';

const LANGUAGE_TO_LOCALE = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  it: 'it-IT',
  ar: 'ar-SA',
  de: 'de-DE',
  ja: 'ja-JP',
  zh: 'zh-CN'
};

export function localeFromCountry(country) {
  const code = normalizeCountryCode(country);
  if (!code) return 'pt-BR';
  const language = COUNTRY_LANGUAGE_MAP[code];
  return LANGUAGE_TO_LOCALE[language] || 'pt-BR';
}
