const COUNTRY_DIALING_CODES = {
  BR: '55',
  PT: '351',
  AO: '244',
  MZ: '258',
  CV: '238',
  GW: '245',
  ST: '239',
  TL: '670',
  DE: '49',
  AT: '43',
  LI: '423',
  US: '1',
  CA: '1',
  GB: '44',
  IE: '353',
  AU: '61',
  NZ: '64',
  ZA: '27',
  NG: '234',
  KE: '254',
  PH: '63',
  SG: '65',
  IN: '91',
  JP: '81',
  CN: '86',
  TW: '886',
  HK: '852',
  MO: '853',
  ES: '34',
  AR: '54',
  BO: '591',
  CL: '56',
  CO: '57',
  CR: '506',
  CU: '53',
  DO: '1',
  EC: '593',
  SV: '503',
  GT: '502',
  HN: '504',
  MX: '52',
  NI: '505',
  PA: '507',
  PY: '595',
  PE: '51',
  PR: '1',
  UY: '598',
  VE: '58',
  IT: '39',
  SM: '378',
  VA: '379',
  CH: '41'
};

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const stripDialingCode = (digits, dialingCode) => {
  if (!dialingCode || !digits.startsWith(dialingCode)) return digits;
  const next = digits.slice(dialingCode.length);
  return next.length >= 6 ? next : digits;
};

const groupBy = (digits, size = 3) => {
  if (!digits) return '';
  const parts = [];
  for (let i = 0; i < digits.length; i += size) {
    parts.push(digits.slice(i, i + size));
  }
  return parts.join(' ');
};

const formatByCountry = (digits, countryCode) => {
  switch (countryCode) {
    case 'BR':
      if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }
      if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      return groupBy(digits, 4);
    case 'PT':
      if (digits.length === 9) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      }
      return groupBy(digits, 3);
    case 'US':
    case 'CA':
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return groupBy(digits, 3);
    case 'GB':
      if (digits.length === 11) {
        return `${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
      }
      if (digits.length === 10) {
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      }
      return groupBy(digits, 3);
    case 'DE':
      if (digits.length >= 10) {
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
      }
      return groupBy(digits, 3);
    default:
      return groupBy(digits, 3);
  }
};

const buildE164Digits = (raw, dialingCode) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const digits = onlyDigits(trimmed);
  if (!digits) return '';
  if (trimmed.startsWith('00')) {
    return digits.slice(2);
  }
  if (trimmed.startsWith('+')) {
    return digits;
  }
  if (dialingCode && digits.startsWith(dialingCode)) {
    return digits;
  }
  return dialingCode ? `${dialingCode}${digits}` : digits;
};

export const getPhoneActions = (phone, countryCode) => {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const normalizedCountry = String(countryCode || '').toUpperCase();
  const dialingCode = COUNTRY_DIALING_CODES[normalizedCountry] || '';
  const e164Digits = buildE164Digits(raw, dialingCode);
  if (!e164Digits) return null;
  const rawDigits = onlyDigits(raw);
  const nationalDigits = stripDialingCode(rawDigits, dialingCode);
  const formattedNational = formatByCountry(nationalDigits, normalizedCountry);
  const display = dialingCode ? `+${dialingCode} ${formattedNational}` : `+${e164Digits}`;
  return {
    display,
    telHref: `tel:+${e164Digits}`,
    whatsappHref: `https://wa.me/${e164Digits}`
  };
};

export default {
  getPhoneActions
};
