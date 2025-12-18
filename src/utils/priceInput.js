// Helpers to parse and sanitize currency inputs consistently across product forms.
const parsePriceFlexible = (value) => {
  if (value == null) return '';
  const str = String(value).trim();
  if (!str) return '';

  const normalized = str.replace(/[^\d.,]/g, '');
  if (!normalized) return '';

  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const lastSepIndex = Math.max(lastDot, lastComma);
  let decimalSep = null;

  if (lastSepIndex !== -1) {
    const sepChar = normalized[lastSepIndex];
    const decimals = normalized.length - lastSepIndex - 1;
    const digitsAfter = normalized.slice(lastSepIndex + 1);
    const digitsOnlyAfter = /^\d+$/.test(digitsAfter);
    const hasBoth = lastDot !== -1 && lastComma !== -1;

    if (digitsOnlyAfter && decimals > 0) {
      if (decimals <= 2) {
        decimalSep = sepChar;
      } else if (decimals === 3 && hasBoth) {
        decimalSep = sepChar;
      }
    }

    if (decimals === 3 && !hasBoth) {
      decimalSep = null;
    }
  }

  let cleaned = normalized;
  const marker = '<<DECIMAL>>';

  if (decimalSep) {
    const decimalRegex = new RegExp(`\\${decimalSep}(?=[^\\${decimalSep}]*$)`);
    cleaned = cleaned.replace(decimalRegex, marker);
  }

  cleaned = cleaned.replace(/[.,]/g, '');
  if (decimalSep) cleaned = cleaned.replace(marker, '.');

  if (!cleaned) return '';

  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : '';
};

const sanitizePriceInput = (value, currency) => {
  if (value == null) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (/^0+$/.test(digits)) return '';

  const decimalSeparator = currency === 'USD' ? '.' : ',';
  const thousandSeparator = currency === 'USD' ? ',' : '.';
  const decimalPlaces = 2;
  const padded = digits.padStart(decimalPlaces + 1, '0');
  const integerDigits = padded.slice(0, -decimalPlaces);
  const decimalDigits = padded.slice(-decimalPlaces);
  const normalizedInteger = integerDigits.replace(/^0+(?=\d)/, '') || '0';
  const withThousands = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);

  return `${withThousands}${decimalSeparator}${decimalDigits}`;
};

export { parsePriceFlexible, sanitizePriceInput };
