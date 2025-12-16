const normalizeOrderStatus = (status) => {
  if (!status && status !== 0) {
    return '';
  }
  const value = String(status).toLowerCase().trim();
  if (!value) return '';
  if (['pending', 'pendente', 'in_sospeso'].includes(value)) {
    return 'pending';
  }
  if (['confirmed', 'confirmado', 'confermato'].includes(value)) {
    return 'confirmed';
  }
  return value;
};

export const isOrderStatusConfirmed = (status) => normalizeOrderStatus(status) === 'confirmed';
export const isOrderStatusPending = (status) => normalizeOrderStatus(status) === 'pending';

export { normalizeOrderStatus };
export default {
  normalizeOrderStatus,
  isOrderStatusConfirmed,
  isOrderStatusPending
};
