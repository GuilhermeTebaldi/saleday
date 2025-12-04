const SELLER_SEEN_KEY = (userId) => {
  if (!userId) return null;
  return `saleday:sellerOrdersSeen:${userId}`;
};

const safeParse = (value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getSeenSellerOrders = (userId) => {
  const key = SELLER_SEEN_KEY(userId);
  if (!key) return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? safeParse(stored) : [];
  } catch {
    return [];
  }
};

export const markSellerOrdersSeen = (userId, orderIds) => {
  const key = SELLER_SEEN_KEY(userId);
  if (!key) return;
  const next = new Set(getSeenSellerOrders(userId));
  (orderIds || []).forEach((id) => {
    if (id) next.add(Number(id));
  });
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(next)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('saleday:seller-orders-sync'));
    }
  } catch {
    // ignore persistence errors
  }
};

export const getUnseenSellerOrderIds = (userId, orders) => {
  if (!userId || !Array.isArray(orders) || !orders.length) return [];
  const seenSet = new Set(getSeenSellerOrders(userId).map((id) => Number(id)));
  return orders
    .filter((order) => {
      const id = Number(order?.id);
      return Number.isFinite(id) && !seenSet.has(id);
    })
    .map((order) => Number(order.id));
};

export default {
  getSeenSellerOrders,
  markSellerOrdersSeen,
  getUnseenSellerOrderIds
};
