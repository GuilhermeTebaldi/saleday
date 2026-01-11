import formatProductPrice from './currency.js';

const MIN_PRODUCT_YEAR = 1900;

export const sanitizeProductYearInput = (value) =>
  String(value ?? '').replace(/\D/g, '').slice(0, 4);

// Keep year values compatible with DB constraints (4 digits, valid range).
export const normalizeProductYear = (value, currentYear = new Date().getFullYear()) => {
  const sanitized = sanitizeProductYearInput(value);
  if (!sanitized || sanitized.length !== 4) return null;
  const numeric = Number(sanitized);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < MIN_PRODUCT_YEAR || numeric > currentYear) return null;
  return sanitized;
};

export const isProductFree = (product) => {
  if (!product) return false;
  if (product.is_free) return true;

  const price = product.price;
  if (price === null || price === undefined) return false;

  if (typeof price === 'string') {
    const trimmed = price.trim();
    if (trimmed === '') return false;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric === 0;
  }

  if (typeof price === 'number') {
    return Number.isFinite(price) && price === 0;
  }

  const numeric = Number(price);
  return Number.isFinite(numeric) && numeric === 0;
};

export const hasProductPriceValue = (product) => {
  if (!product) return false;
  const price = product.price;
  return price !== null && price !== undefined && String(price).trim() !== '';
};

export const getProductPriceLabel = (product, fallbackLabel = 'Valor a negociar') => {
  if (!product) return fallbackLabel;
  if (isProductFree(product)) return 'Grátis';
  if (hasProductPriceValue(product)) {
    return formatProductPrice(product.price, product.country);
  }
  return fallbackLabel;
};

export default {
  sanitizeProductYearInput,
  normalizeProductYear,
  isProductFree,
  hasProductPriceValue,
  getProductPriceLabel
};
