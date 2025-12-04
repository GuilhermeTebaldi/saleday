const simpleNormalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const BASE_COUNTRIES = [
  { code: 'BR', label: 'Brasil', language: 'pt', aliases: ['Brazil'] },
  { code: 'PT', label: 'Portugal', language: 'pt' },
  { code: 'AO', label: 'Angola', language: 'pt' },
  { code: 'MZ', label: 'Moçambique', language: 'pt', aliases: ['Mozambique'] },
  { code: 'CV', label: 'Cabo Verde', language: 'pt', aliases: ['Cape Verde'] },
  { code: 'GW', label: 'Guiné-Bissau', language: 'pt', aliases: ['Guinea-Bissau', 'Guine Bissau'] },
  { code: 'ST', label: 'São Tomé e Príncipe', language: 'pt', aliases: ['Sao Tome and Principe'] },
  { code: 'TL', label: 'Timor-Leste', language: 'pt', aliases: ['East Timor', 'Timor Leste'] },
  { code: 'DE', label: 'Alemanha', language: 'de', aliases: ['Germany', 'Alemania'] },
  { code: 'AT', label: 'Áustria', language: 'de', aliases: ['Austria'] },
  { code: 'LI', label: 'Liechtenstein', language: 'de' },
  { code: 'US', label: 'Estados Unidos', language: 'en', aliases: ['USA', 'United States', 'EUA'] },
  { code: 'CA', label: 'Canadá', language: 'en', aliases: ['Canada'] },
  { code: 'GB', label: 'Reino Unido', language: 'en', aliases: ['United Kingdom', 'UK', 'Inglaterra', 'England'] },
  { code: 'IE', label: 'Irlanda', language: 'en', aliases: ['Ireland'] },
  { code: 'AU', label: 'Austrália', language: 'en', aliases: ['Australia'] },
  { code: 'NZ', label: 'Nova Zelândia', language: 'en', aliases: ['New Zealand'] },
  { code: 'ZA', label: 'África do Sul', language: 'en', aliases: ['South Africa'] },
  { code: 'NG', label: 'Nigéria', language: 'en', aliases: ['Nigeria'] },
  { code: 'KE', label: 'Quênia', language: 'en', aliases: ['Kenya'] },
  { code: 'PH', label: 'Filipinas', language: 'en', aliases: ['Philippines'] },
  { code: 'SG', label: 'Singapura', language: 'en', aliases: ['Singapore'] },
  { code: 'IN', label: 'Índia', language: 'en', aliases: ['India'] },
  { code: 'JP', label: 'Japão', language: 'ja', aliases: ['Japan', 'Japao'] },
  { code: 'CN', label: 'China', language: 'zh', aliases: ['Chine', 'China'] },
  { code: 'TW', label: 'Taiwan', language: 'zh' },
  { code: 'HK', label: 'Hong Kong', language: 'zh', aliases: ['Hongkong'] },
  { code: 'MO', label: 'Macau', language: 'zh', aliases: ['Macao'] },
  { code: 'ES', label: 'Espanha', language: 'es', aliases: ['Spain'] },
  { code: 'AR', label: 'Argentina', language: 'es' },
  { code: 'BO', label: 'Bolívia', language: 'es', aliases: ['Bolivia'] },
  { code: 'CL', label: 'Chile', language: 'es' },
  { code: 'CO', label: 'Colômbia', language: 'es', aliases: ['Colombia'] },
  { code: 'CR', label: 'Costa Rica', language: 'es' },
  { code: 'CU', label: 'Cuba', language: 'es' },
  { code: 'DO', label: 'República Dominicana', language: 'es', aliases: ['Dominican Republic'] },
  { code: 'EC', label: 'Equador', language: 'es', aliases: ['Ecuador'] },
  { code: 'SV', label: 'El Salvador', language: 'es' },
  { code: 'GT', label: 'Guatemala', language: 'es' },
  { code: 'HN', label: 'Honduras', language: 'es' },
  { code: 'MX', label: 'México', language: 'es', aliases: ['Mexico'] },
  { code: 'NI', label: 'Nicarágua', language: 'es', aliases: ['Nicaragua'] },
  { code: 'PA', label: 'Panamá', language: 'es', aliases: ['Panama'] },
  { code: 'PY', label: 'Paraguai', language: 'es', aliases: ['Paraguay'] },
  { code: 'PE', label: 'Peru', language: 'es' },
  { code: 'PR', label: 'Porto Rico', language: 'es', aliases: ['Puerto Rico'] },
  { code: 'UY', label: 'Uruguai', language: 'es', aliases: ['Uruguay'] },
  { code: 'VE', label: 'Venezuela', language: 'es' },
  { code: 'IT', label: 'Itália', language: 'it', aliases: ['Italia', 'Italy'] },
  { code: 'SM', label: 'San Marino', language: 'it' },
  { code: 'VA', label: 'Vaticano', language: 'it', aliases: ['Vatican', 'Holy See'] },
  { code: 'CH', label: 'Suíça', language: 'it', aliases: ['Switzerland'] }
];

export const COUNTRY_OPTIONS = [...BASE_COUNTRIES].sort((a, b) =>
  a.label.localeCompare(b.label, 'pt-BR')
);

export const COUNTRY_LANGUAGE_MAP = COUNTRY_OPTIONS.reduce((acc, item) => {
  acc[item.code] = item.language;
  return acc;
}, {});

const ALIAS_MAP = COUNTRY_OPTIONS.reduce((acc, item) => {
  acc[item.code] = item.code;
  acc[simpleNormalize(item.label)] = item.code;
  (item.aliases || []).forEach((alias) => {
    acc[simpleNormalize(alias)] = item.code;
    acc[alias.toUpperCase()] = item.code;
  });
  return acc;
}, {});

export function normalizeCountryCode(value) {
  if (!value) return '';
  const upper = String(value).trim().toUpperCase();
  if (COUNTRY_LANGUAGE_MAP[upper]) return upper;
  const normalized = simpleNormalize(value);
  if (ALIAS_MAP[normalized]) return ALIAS_MAP[normalized];
  return '';
}

export function getCountryLabel(code) {
  if (!code) return '';
  const found = COUNTRY_OPTIONS.find((item) => item.code === code);
  return found ? found.label : '';
}
