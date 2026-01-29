export const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

export const normalizeDialCode = (dialCode) => {
  const digits = onlyDigits(String(dialCode || '').replace(/^\+/, ''));
  return digits ? `+${digits}` : '';
};

export const normalizePhoneNumber = (dialCode, localNumber) => {
  const safeDial = normalizeDialCode(dialCode);
  const localDigits = onlyDigits(localNumber);
  if (!safeDial && !localDigits) return '';
  if (safeDial && localDigits) return `${safeDial} ${localDigits}`;
  return safeDial || localDigits;
};

export const limitDigits = (value, maxDigits) => {
  const digits = onlyDigits(value);
  return Number.isFinite(maxDigits) && maxDigits > 0 ? digits.slice(0, maxDigits) : digits;
};

export const parsePhoneNumber = (raw, countries = []) => {
  const digits = onlyDigits(raw);
  if (!digits) {
    return { dialCode: '', localNumber: '', matchedCountry: null };
  }

  const candidates = Array.isArray(countries) ? [...countries] : [];
  candidates.sort((a, b) => {
    const aDigits = onlyDigits(a?.dialCode);
    const bDigits = onlyDigits(b?.dialCode);
    return bDigits.length - aDigits.length;
  });

  const matchedCountry =
    candidates.find((country) => {
      const dialDigits = onlyDigits(country?.dialCode);
      return dialDigits && digits.startsWith(dialDigits);
    }) || null;

  const dialDigits = matchedCountry ? onlyDigits(matchedCountry.dialCode) : '';
  const localNumber = dialDigits ? digits.slice(dialDigits.length) : digits;

  return {
    dialCode: matchedCountry ? normalizeDialCode(matchedCountry.dialCode) : dialDigits ? `+${dialDigits}` : '',
    localNumber,
    matchedCountry
  };
};

const findCountryByCode = (countries, code) => {
  if (!code) return null;
  const upper = String(code).trim().toUpperCase();
  return (countries || []).find((c) => String(c.code || '').trim().toUpperCase() === upper) || null;
};

export const ensurePhoneHasDialCode = (phone, countryCode, countries = []) => {
  const parsed = parsePhoneNumber(phone, countries);
  if (parsed.dialCode) {
    return parsed;
  }
  const fallbackCountry = findCountryByCode(countries, countryCode);
  if (!fallbackCountry?.dialCode) {
    return parsed;
  }
  return {
    dialCode: normalizeDialCode(fallbackCountry.dialCode),
    localNumber: parsed.localNumber || onlyDigits(phone),
    matchedCountry: fallbackCountry
  };
};

export const formatLocalWithExample = (localDigits, example = '') => {
  const digits = onlyDigits(localDigits).split('');
  if (!digits.length) return '';

  const numericExample = onlyDigits(example);
  if (!example || !numericExample) {
    if (digits.length <= 4) return digits.join('');
    if (digits.length <= 7) return `${digits.slice(0, 3).join('')} ${digits.slice(3).join('')}`;
    if (digits.length <= 11) {
      return `${digits.slice(0, 2).join(' ')} ${digits.slice(2, 7).join('')} ${digits.slice(7).join('')}`.trim();
    }
    return digits.join('').replace(/(\d{3})(?=\d)/g, '$1 ');
  }

  let result = '';
  for (const char of example) {
    if (!digits.length) break;
    if (/\d/.test(char)) {
      result += digits.shift();
    } else {
      result += char;
    }
  }
  if (digits.length) {
    result = `${result.trim()} ${digits.join('')}`.trim();
  }
  return result.trim();
};

export const formatPhoneDisplay = ({ dialCode, localDigits, example }) => {
  const safeDial = normalizeDialCode(dialCode);
  const formattedLocal = formatLocalWithExample(localDigits, example);
  return [safeDial, formattedLocal].filter(Boolean).join(' ').trim();
};

export const getPhoneActions = (phone, { countries = [], countryCode } = {}) => {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const parsed = ensurePhoneHasDialCode(raw, countryCode, countries);
  const telDigits = onlyDigits(`${parsed.dialCode}${parsed.localNumber}`);
  if (!telDigits) return null;
  const display = formatPhoneDisplay({
    dialCode: parsed.dialCode || '',
    localDigits: parsed.localNumber || '',
    example: parsed.matchedCountry?.example
  }) || raw || `+${telDigits}`;
  return {
    display,
    telHref: `tel:+${telDigits}`,
    whatsappHref: `https://wa.me/${telDigits}`
  };
};

export default {
  getPhoneActions,
  onlyDigits,
  normalizeDialCode,
  normalizePhoneNumber,
  parsePhoneNumber,
  limitDigits,
  formatLocalWithExample,
  formatPhoneDisplay,
  ensurePhoneHasDialCode
};
