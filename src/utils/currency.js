// frontend/src/utils/currency.js
// CONVERSAO DE MOEDA Util centralizado para formatação e resolução de moeda por país/região.

const DEFAULT_CURRENCY_BY_COUNTRY = {
  BR: 'BRL',
  US: 'USD',
  IT: 'EUR'
};

const CURRENCY_SETTINGS = {
  BRL: {
    locale: 'pt-BR',
    symbol: 'R$',
    example: '5.646,18'
  },
  USD: {
    locale: 'en-US',
    symbol: 'US$',
    example: '5,646.18'
  },
  EUR: {
    locale: 'it-IT',
    symbol: '€',
    example: '5.646,18'
  }
};

const CURRENCY_TO_BRL = {
  BRL: 1,
  USD: 5.0,
  EUR: 5.5
};

const NORMALIZED_COUNTRY_CACHE = new Map();

const normalizeCountryCode = (input) => {
  if (!input) return null;
  if (NORMALIZED_COUNTRY_CACHE.has(input)) return NORMALIZED_COUNTRY_CACHE.get(input);

  const value = String(input).trim().toLowerCase();
  let normalized = null;

  if (['br', 'bra', 'brasil', 'brazil', 'pt-br'].includes(value)) normalized = 'BR';
  else if (['us', 'usa', 'eua', 'united states', 'united states of america', 'u.s.', 'u.s.a', 'estados unidos', 'en-us'].includes(value)) normalized = 'US';
  else if (['it', 'ita', 'italia', 'itália', 'italy', 'it-it'].includes(value)) normalized = 'IT';

  NORMALIZED_COUNTRY_CACHE.set(input, normalized);
  return normalized;
};

export const getUserCurrencyPreference = () => {
  if (typeof localStorage === 'undefined') return null;
  const stored = (localStorage.getItem('templesale:currency') || '').trim().toUpperCase();
  return ['BRL', 'USD', 'EUR'].includes(stored) ? stored : null;
};

export const resolveCurrencyFromCountry = (country) => {
  const code = normalizeCountryCode(country);
  if (code && DEFAULT_CURRENCY_BY_COUNTRY[code]) {
    return DEFAULT_CURRENCY_BY_COUNTRY[code];
  }
  return 'USD';
};

export const getCurrencySettings = (currency) => {
  if (!currency || !CURRENCY_SETTINGS[currency]) return CURRENCY_SETTINGS.USD;
  return CURRENCY_SETTINGS[currency];
};

export const resolveCurrencyForProduct = (productCountry) => {
  const preference = getUserCurrencyPreference();
  return preference || resolveCurrencyFromCountry(productCountry);
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return Number(value) || 0;

  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (trimmed.includes(',') && trimmed.includes('.')) {
    const lastComma = trimmed.lastIndexOf(',');
    const lastDot = trimmed.lastIndexOf('.');
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousand = decimal === ',' ? '.' : ',';
    return Number(trimmed.replaceAll(thousand, '').replace(decimal, '.')) || 0;
  }

  if (trimmed.includes(',')) {
    return Number(trimmed.replaceAll('.', '').replace(',', '.')) || 0;
  }

  return Number(trimmed.replaceAll(',', '')) || 0;
};

export const formatCurrency = (amount, currency) => {
  const { locale, symbol } = getCurrencySettings(currency);
  const formatted = toNumber(amount).toLocaleString(locale, {
    style: 'currency',
    currency
  });

  if (currency === 'USD' && !formatted.includes('US$')) {
    return formatted.replace('$', `${symbol} `).replace(`${symbol}  `, `${symbol} `).trim();
  }

  return formatted;
};

export const convertCurrency = (amount, fromCurrency = 'BRL', toCurrency = 'BRL') => {
  const normalized = toNumber(amount);
  if (fromCurrency === toCurrency) return normalized;

  const fromRate = CURRENCY_TO_BRL[fromCurrency] ?? 1;
  const toRate = CURRENCY_TO_BRL[toCurrency] ?? 1;
  if (toRate === 0) return normalized;

  const amountInBRL = normalized * fromRate;
  return amountInBRL / toRate;
};

export const formatProductPrice = (amount, productCountry, options = {}) => {
  const { respectPreference = true, overrideCurrency = null } = options;
  const currency =
    overrideCurrency ||
    (respectPreference
      ? resolveCurrencyForProduct(productCountry)
      : resolveCurrencyFromCountry(productCountry));

  return formatCurrency(amount, currency);
};

// Export utilitários para eventuais usos específicos.
export const currencyUtils = {
  formatProductPrice,
  resolveCurrencyForProduct,
  resolveCurrencyFromCountry,
  getUserCurrencyPreference,
  getCurrencySettings,
  formatCurrency,
  convertCurrency
};

export default formatProductPrice;
