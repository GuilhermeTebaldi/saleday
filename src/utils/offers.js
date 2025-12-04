// frontend/src/utils/offers.js
import { getCurrencySettings } from './currency.js';

export const OFFER_PREFIX = '__OFFER__';
export const OFFER_RESPONSE_PREFIX = '__OFFER_RESPONSE__';

export function parseOfferMessage(content) {
  if (typeof content !== 'string' || !content.startsWith(OFFER_PREFIX)) return null;
  try {
    const data = JSON.parse(content.slice(OFFER_PREFIX.length));
    if (!data || typeof data.amount !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function parseOfferResponse(content) {
  if (typeof content !== 'string' || !content.startsWith(OFFER_RESPONSE_PREFIX)) return null;
  try {
    const data = JSON.parse(content.slice(OFFER_RESPONSE_PREFIX.length));
    if (!data || !data.targetMessageId || !data.status) return null;
    return data;
  } catch {
    return null;
  }
}

export function formatOfferAmount(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '—';
  const code = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'USD';
  const { locale } = getCurrencySettings(code);
  try {
    return numeric.toLocaleString(locale, { style: 'currency', currency: code });
  } catch {
    return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
