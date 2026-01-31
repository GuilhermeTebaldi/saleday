import { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { getUnseenSellerOrderIds, markSellerOrdersSeen } from '../utils/orders.js';

const POLL_INTERVAL_MS = 12000;

const SellerOrdersToast = () => {
  const { token, user } = useContext(AuthContext);
  const userId = user?.id;
  const [orders, setOrders] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const intervalRef = useRef(null);

  const loadOrders = useCallback(async () => {
    if (!token || !userId) {
      setOrders([]);
      return;
    }
    try {
      const { data } = await api.get('/orders/seller', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setOrders(payload);
    } catch (error) {
      // silêncio: melhor não mostrar erro para não poluir a experiência global
      console.error('sellerOrdersToast.loadOrders', error);
    }
  }, [token, userId]);

  useEffect(() => {
    if (!token || !userId) return undefined;
    loadOrders();
    const id = setInterval(loadOrders, POLL_INTERVAL_MS);
    intervalRef.current = id;
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, userId, loadOrders]);

  const newOrderIds = useMemo(() => getUnseenSellerOrderIds(userId, orders), [userId, orders]);

  useEffect(() => {
    // sempre que chegar algo novo, reabrir toast
    if (newOrderIds.length > 0) {
      setIsCollapsed(false);
    }
  }, [newOrderIds.length]);

  if (!token || !userId || newOrderIds.length === 0) {
    return null;
  }

  const plural = newOrderIds.length > 1;

  const handleCollapse = () => setIsCollapsed(true);

  const handleOpen = () => {
    markSellerOrdersSeen(userId, newOrderIds);
    setIsCollapsed(false);
  };

  if (isCollapsed) {
    const plural = newOrderIds.length > 1;
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="fixed bottom-[92px] right-3 sm:bottom-6 sm:right-4 z-[12000] inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-amber-800 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.35)] backdrop-blur-sm"
        aria-label="Reabrir solicitações novas"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
          {newOrderIds.length}
        </span>
        <span>{plural ? 'Solicitações' : 'Solicitação'}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-[92px] right-3 sm:bottom-6 sm:right-4 z-[12000] w-[min(250px,calc(100vw-14px))] sm:w-[min(280px,calc(100vw-24px))] rounded-lg border border-amber-200 bg-white/95 px-2 py-1.5 shadow-[0_12px_26px_-18px_rgba(0,0,0,0.35)] backdrop-blur-sm"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-700">
            Vendas
          </p>
          <p className="text-xs font-semibold text-slate-900">
            Você recebeu {newOrderIds.length} {plural ? 'novas solicitações' : 'nova solicitação'}.
          </p>
          <p className="text-[11px] text-amber-800">
            Abra <strong>Solicitações</strong> para responder rápido.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCollapse}
          className="text-slate-400 transition hover:text-slate-600"
          aria-label="Fechar alerta de novas solicitações"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
          +{newOrderIds.length} pedido{plural ? 's' : ''}
        </span>
        <Link
          to="/sales-requests"
          className="inline-flex min-w-[90px] items-center justify-center gap-1 rounded-lg border border-[var(--ts-cta,#1f8f5f)] bg-white px-2.5 py-1.25 text-[11px] font-semibold text-[var(--ts-cta,#1f8f5f)] shadow-[0_8px_16px_-12px_rgba(31,143,95,0.28)] transition hover:bg-[rgba(31,143,95,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(31,143,95,0.45)]"
          onClick={handleOpen}
        >
          Solicitações
        </Link>
      </div>
    </div>
  );
};

export default SellerOrdersToast;
