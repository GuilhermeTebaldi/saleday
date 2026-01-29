// Lista base de países com DDI e exemplos de telefone.
// Pode ser sobrescrita por uma lista mais completa carregada em tempo de execução.
import { normalizeCountryCode } from './countries.js';
import { normalizeDialCode } from '../utils/phone.js';

const FLAG_CDN_BASE = 'https://flagcdn.com';

export const DEFAULT_PHONE_COUNTRY_CODE = 'BR';

const buildFlagUrl = (code) => {
  const safeCode = normalizeCountryCode(code);
  return safeCode ? `${FLAG_CDN_BASE}/w40/${safeCode.toLowerCase()}.png` : '';
};

const baseEntries = [
  { name: 'Brasil', code: 'BR', dialCode: '+55', example: '(11) 91234-5678', localMaxDigits: 11 },
  { name: 'Argentina', code: 'AR', dialCode: '+54', example: '11 2345-6789', localMaxDigits: 10 },
  { name: 'Estados Unidos', code: 'US', dialCode: '+1', example: '(415) 555-0199', localMaxDigits: 10 },
  { name: 'Canadá', code: 'CA', dialCode: '+1', example: '(416) 555-0199', localMaxDigits: 10 },
  { name: 'México', code: 'MX', dialCode: '+52', example: '55 1234 5678', localMaxDigits: 10 },
  { name: 'Chile', code: 'CL', dialCode: '+56', example: '9 1234 5678', localMaxDigits: 9 },
  { name: 'Colômbia', code: 'CO', dialCode: '+57', example: '300 1234567', localMaxDigits: 10 },
  { name: 'Peru', code: 'PE', dialCode: '+51', example: '912 345 678', localMaxDigits: 9 },
  { name: 'Portugal', code: 'PT', dialCode: '+351', example: '912 345 678', localMaxDigits: 9 },
  { name: 'Espanha', code: 'ES', dialCode: '+34', example: '612 34 56 78', localMaxDigits: 9 },
  { name: 'Itália', code: 'IT', dialCode: '+39', example: '312 345 6789', localMaxDigits: 10 },
  { name: 'França', code: 'FR', dialCode: '+33', example: '6 12 34 56 78', localMaxDigits: 9 },
  { name: 'Alemanha', code: 'DE', dialCode: '+49', example: '1512 3456789', localMaxDigits: 11 },
  { name: 'Reino Unido', code: 'GB', dialCode: '+44', example: '7123 456789', localMaxDigits: 10 },
  { name: 'Irlanda', code: 'IE', dialCode: '+353', example: '85 123 4567', localMaxDigits: 9 },
  { name: 'Japão', code: 'JP', dialCode: '+81', example: '90 1234 5678', localMaxDigits: 10 },
  { name: 'China', code: 'CN', dialCode: '+86', example: '131 2345 6789', localMaxDigits: 11 },
  { name: 'Índia', code: 'IN', dialCode: '+91', example: '91234 56789', localMaxDigits: 10 },
  { name: 'Austrália', code: 'AU', dialCode: '+61', example: '412 345 678', localMaxDigits: 9 },
  { name: 'África do Sul', code: 'ZA', dialCode: '+27', example: '71 234 5678', localMaxDigits: 9 }
];

const sanitizeEntry = (entry) => {
  if (!entry) return null;
  const dialCode = normalizeDialCode(entry.dialCode || entry.ddi);
  if (!dialCode) return null;
  const code = normalizeCountryCode(entry.code);
  return {
    name: entry.name || entry.label || entry.pais || entry.nome || code || dialCode,
    code,
    dialCode,
    example: entry.example || '',
    localMaxDigits: Number.isFinite(entry.localMaxDigits) ? entry.localMaxDigits : undefined,
    flagUrl: entry.flagUrl || buildFlagUrl(code)
  };
};

export const BASE_PHONE_COUNTRIES = baseEntries
  .map((entry) =>
    sanitizeEntry({
      ...entry,
      flagUrl: buildFlagUrl(entry.code)
    })
  )
  .filter(Boolean);

const mapApiEntryToPhoneCountry = (raw) => {
  if (!raw) return null;
  const dialCode = normalizeDialCode(
    raw.dialCode || raw.ddi || raw.callingCode || raw.codigo_telefone || raw.codigoTelefone || raw.phoneCode
  );
  const name =
    raw.name ||
    raw.nome ||
    raw.nome_pais ||
    raw.pais ||
    raw.country ||
    raw.country_name ||
    raw.countryName ||
    '';
  const code = normalizeCountryCode(
    raw.code || raw.sigla || raw.iso2 || raw.iso_2 || raw.country_code || raw.countryCode || raw.uf
  );
  const example = raw.example || raw.exemplo || raw.sample || '';
  const maxDigitsRaw =
    raw.localMaxDigits ||
    raw.maxDigits ||
    raw.phoneLength ||
    raw.phone_length ||
    raw.max_length ||
    raw.phone_max_digits;
  const parsedMax = Number.parseInt(maxDigitsRaw, 10);
  if (!name && !dialCode) return null;
  return sanitizeEntry({
    name,
    code,
    dialCode,
    example,
    localMaxDigits: Number.isFinite(parsedMax) ? parsedMax : undefined,
    flagUrl: raw.flag || raw.flagUrl || raw.bandeira || buildFlagUrl(code)
  });
};

export const mergePhoneCountries = (apiEntries = []) => {
  const map = new Map();
  const mergeKeepingDefined = (current, incoming) => {
    const result = { ...current };
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result[key] = value;
      }
    });
    return result;
  };

  const addEntry = (entry) => {
    if (!entry || !entry.dialCode) return;
    const key = entry.code || entry.dialCode;
    if (!map.has(key)) {
      map.set(key, { ...entry, flagUrl: entry.flagUrl || buildFlagUrl(entry.code) });
    } else {
      const merged = mergeKeepingDefined(map.get(key), {
        ...entry,
        flagUrl: entry.flagUrl || buildFlagUrl(entry.code)
      });
      map.set(key, merged);
    }
  };

  BASE_PHONE_COUNTRIES.forEach(addEntry);

  if (Array.isArray(apiEntries)) {
    apiEntries.map(mapApiEntryToPhoneCountry).filter(Boolean).forEach(addEntry);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
};

export const buildPhoneCountryIndex = (countries) =>
  (countries || []).reduce(
    (acc, country) => {
      const code = normalizeCountryCode(country.code);
      const dialDigits = normalizeDialCode(country.dialCode);
      if (code) acc.byCode[code] = country;
      if (dialDigits) acc.byDial[dialDigits.replace('+', '')] = country;
      return acc;
    },
    { byCode: {}, byDial: {} }
  );
