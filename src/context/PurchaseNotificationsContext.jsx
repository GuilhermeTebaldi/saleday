import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/api.js';
import { AuthContext } from './AuthContext.jsx';
import { normalizeOrderStatus } from '../utils/orderStatus.js';

const STORAGE_KEY_PREFIX = 'buyerOrdersSeen:';
const POLL_INTERVAL_MS = 12000;

const PurchaseNotificationsContext = createContext({
  orders: [],
  unseenOrderIds: [],
  unseenCount: 0,
  hasUnseenOrders: false,
  latestUnseenOrder: null,
  markOrdersSeen: () => {},
  refreshOrders: () => {}
});

const readStoredIds = (key) => {
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => Number(value)).filter(Number.isFinite);
  } catch {
    return [];
  }
};

const persistStoredIds = (key, ids) => {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore persistence failure
  }
};

const getOrderTimestamp = (order) => {
  const dateValue = order?.confirmed_at || order?.updated_at || order?.created_at;
  const date = new Date(dateValue || 0);
  const timestamp = Number(date.getTime());
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export function PurchaseNotificationsProvider({ children }) {
  const { token, user } = useContext(AuthContext);
  const userId = user?.id;
  const storageKey = useMemo(() => (userId ? `${STORAGE_KEY_PREFIX}${userId}` : null), [userId]);
  const [orders, setOrders] = useState([]);
  const [unseenIds, setUnseenIds] = useState([]);
  const isMountedRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getOrderedConfirmed = useCallback((list = []) => {
    return list
      .filter((order) => normalizeOrderStatus(order?.status) === 'confirmed')
      .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
  }, []);

  const readSeenIds = useCallback(() => readStoredIds(storageKey), [storageKey]);
  const saveSeenIds = useCallback((ids) => persistStoredIds(storageKey, ids), [storageKey]);

  const loadOrders = useCallback(async () => {
    if (!token) {
      if (isMountedRef.current) {
        setOrders([]);
        setUnseenIds([]);
      }
      return;
    }
    try {
      const response = await api.get('/orders/buyer', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = Array.isArray(response.data?.data) ? response.data.data : [];
      const confirmed = getOrderedConfirmed(payload);
      const seenIds = readSeenIds();
      const unseen = confirmed
        .map((order) => Number(order?.id))
        .filter((id) => Number.isFinite(id) && !seenIds.includes(id));
      if (isMountedRef.current) {
        setOrders(confirmed);
        setUnseenIds(unseen);
      }
    } catch (error) {
      console.error('purchaseNotifications.loadOrders', error);
    }
  }, [token, getOrderedConfirmed, readSeenIds]);

  useEffect(() => {
    if (!token) {
      setOrders([]);
      setUnseenIds([]);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }

    loadOrders();
    const timerId = setInterval(loadOrders, POLL_INTERVAL_MS);
    intervalRef.current = timerId;
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, loadOrders]);

  const markOrdersSeen = useCallback(() => {
    if (!storageKey) return;
    const ids = orders.map((order) => Number(order?.id)).filter(Number.isFinite);
    saveSeenIds(ids);
    if (isMountedRef.current) {
      setUnseenIds([]);
    }
  }, [orders, saveSeenIds, storageKey]);

  const latestUnseenOrder = useMemo(() => {
    if (!orders.length || !unseenIds.length) return null;
    const unseenSet = new Set(unseenIds);
    return orders.find((order) => unseenSet.has(Number(order?.id))) ?? null;
  }, [orders, unseenIds]);

  const contextValue = useMemo(
    () => ({
      orders,
      unseenOrderIds: unseenIds,
      unseenCount: unseenIds.length,
      hasUnseenOrders: unseenIds.length > 0,
      latestUnseenOrder,
      markOrdersSeen,
      refreshOrders: loadOrders
    }),
    [orders, unseenIds, latestUnseenOrder, markOrdersSeen, loadOrders]
  );

  return (
    <PurchaseNotificationsContext.Provider value={contextValue}>
      {children}
    </PurchaseNotificationsContext.Provider>
  );
}

export const usePurchaseNotifications = () => useContext(PurchaseNotificationsContext);
