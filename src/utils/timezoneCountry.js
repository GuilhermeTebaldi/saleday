// Map known timezones to the most likely ISO country code.
const TIMEZONE_COUNTRY_MAP = {
  'America/Sao_Paulo': 'BR',
  'America/Fortaleza': 'BR',
  'America/Bahia': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Mexico_City': 'MX',
  'America/Chicago': 'US',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Prague': 'CZ',
  'Europe/Warsaw': 'PL',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Zurich': 'CH',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Singapore': 'SG',
  'Asia/Jakarta': 'ID',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Africa/Johannesburg': 'ZA',
  'Africa/Cairo': 'EG',
  'America/Santiago': 'CL',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Caracas': 'VE',
  'America/Montevideo': 'UY',
  'America/Phoenix': 'US',
  'America/Denver': 'US'
};

export function detectCountryFromTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') return null;
  const normalized = timezone.trim();
  const country = TIMEZONE_COUNTRY_MAP[normalized];
  if (country) return country;
  const parts = normalized.split('/');
  if (parts.length === 2) {
    const suffix = parts[1];
    if (suffix.length === 2) {
      return suffix.toUpperCase();
    }
  }
  return null;
}
