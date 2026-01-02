const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const toTelValue = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const sanitized = trimmed.replace(/[^\d+]/g, '');
  if (sanitized.startsWith('+')) {
    return `+${sanitized.slice(1).replace(/\D/g, '')}`;
  }
  return sanitized.replace(/\D/g, '');
};

export const getPhoneActions = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const digits = onlyDigits(raw);
  if (!digits) return null;
  const telValue = toTelValue(raw);
  if (!telValue) return null;
  return {
    display: raw,
    telHref: `tel:${telValue}`,
    whatsappHref: `https://wa.me/${digits}`
  };
};

export default {
  getPhoneActions
};
