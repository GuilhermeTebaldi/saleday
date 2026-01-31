// frontend/src/pages/SalesRequests.jsx
// Página para acompanhar e confirmar solicitações de compra.
import { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';
import { getProductPriceLabel } from '../utils/product.js';
import { parseImageList, toAbsoluteImageUrl } from '../utils/images.js';
import { getUnseenSellerOrderIds, markSellerOrdersSeen } from '../utils/orders.js';
import BuyerOrdersList from '../components/BuyerOrdersList.jsx';
import CloseBackButton from '../components/CloseBackButton.jsx';
import LoadingBar from '../components/LoadingBar.jsx';

const STATUS_LABEL = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado'
};

export default function SalesRequests() {
  const { token, user } = useContext(AuthContext);
  const {
    orders: buyerOrders = [],
    unseenOrderIds: unseenBuyerOrderIds = [],
    markOrdersSeen: markBuyerOrdersSeen
  } = usePurchaseNotifications();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [newOrderIds, setNewOrderIds] = useState([]);
  const [soldProductIds, setSoldProductIds] = useState([]);
  const [newBuyerOrderIds, setNewBuyerOrderIds] = useState([]);
  const [activeMobileTab, setActiveMobileTab] = useState('sales');

  const fetchingOrdersRef = useRef(false);
  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!token) return;
    if (fetchingOrdersRef.current) return;
    fetchingOrdersRef.current = true;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const res = await api.get('/orders/seller', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        const list = res.data.data ?? [];
        setOrders(list);
        const unseen = getUnseenSellerOrderIds(user?.id, list);
        setNewOrderIds(unseen);
        if (user?.id) {
          const allIds = list.map((order) => order.id).filter(Boolean);
          markSellerOrdersSeen(user.id, allIds);
        }
      } else {
        setError(res.data?.message || 'Falha ao carregar pedidos.');
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Falha ao carregar pedidos.');
    } finally {
      fetchingOrdersRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [token, user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!token) return undefined;
    const intervalId = setInterval(() => {
      fetchOrders({ silent: true });
    }, 5000);
    return () => clearInterval(intervalId);
  }, [token, fetchOrders]);

  useEffect(() => {
    if (!unseenBuyerOrderIds.length) return;
    setNewBuyerOrderIds((prev) => {
      const next = new Set(prev.map((id) => Number(id)).filter(Number.isFinite));
      unseenBuyerOrderIds.forEach((id) => {
        const normalized = Number(id);
        if (Number.isFinite(normalized)) {
          next.add(normalized);
        }
      });
      return Array.from(next);
    });
    markBuyerOrdersSeen?.();
  }, [unseenBuyerOrderIds, markBuyerOrdersSeen]);

  const addSoldProductId = (productId) => {
    const normalized = Number(productId);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return;
    }
    setSoldProductIds((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      return [...prev, normalized];
    });
  };

  const confirmOrder = async (orderId) => {
    if (!token || !orderId) return;
    setConfirming(orderId);
    try {
      const res = await api.put(
        `/orders/${orderId}/confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        const confirmedOrder = res.data.data;
        addSoldProductId(confirmedOrder?.product_id);
        toast.success('Pedido confirmado com sucesso.');
        await fetchOrders();
      } else {
        toast.error(res.data?.message || 'Falha ao confirmar pedido.');
      }
    } catch (err) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;
      const conflictProductId = err?.response?.data?.data?.product_id;
      if (status === 409 && conflictProductId) {
        addSoldProductId(conflictProductId);
        await fetchOrders();
      }
      const msg = serverMessage || 'Falha ao confirmar pedido.';
      toast.error(msg);
    } finally {
      setConfirming(null);
    }
  };

  const soldProductIdSet = useMemo(() => {
    const next = new Set();
    soldProductIds.forEach((id) => {
      const normalized = Number(id);
      if (Number.isFinite(normalized) && normalized > 0) {
        next.add(normalized);
      }
    });
    return next;
  }, [soldProductIds]);

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!order) return false;
      if (order.status === 'cancelled') return false;
      const productId = Number(order.product_id);
      if (
        order.status === 'pending' &&
        soldProductIdSet.size > 0 &&
        Number.isFinite(productId) &&
        soldProductIdSet.has(productId)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, soldProductIdSet]);
  const pendingCount = useMemo(
    () => visibleOrders.filter((order) => order.status === 'pending').length,
    [visibleOrders]
  );
  const salesBadgeCount = Math.max(pendingCount, newOrderIds.length);
  const purchasesBadgeCount = newBuyerOrderIds.length;
  const salesAlertMessage = useMemo(() => {
    const newCount = newOrderIds.length;
    const pending = pendingCount;
    if (newCount > 0 && pending > 0) {
      return `Você tem ${newCount} nova${newCount > 1 ? 's' : ''} solicitação${newCount > 1 ? 's' : ''} e ${pending} pedido${pending > 1 ? 's' : ''} pendente${pending > 1 ? 's' : ''} de confirmação.`;
    }
    if (newCount > 0) {
      return `Você tem ${newCount} nova${newCount > 1 ? 's' : ''} solicitação${newCount > 1 ? 's' : ''} de compra.`;
    }
    if (pending > 0) {
      return `Você tem ${pending} pedido${pending > 1 ? 's' : ''} pendente${pending > 1 ? 's' : ''} de confirmação.`;
    }
    return '';
  }, [newOrderIds.length, pendingCount]);

  const buildBuyerChatHandler = (order) => () => {
    if (typeof window === 'undefined') return;
    const imageList = parseImageList(order.image_urls);
    const productImage = imageList[0] || toAbsoluteImageUrl(order.image_url) || '';
    const locationLabel = [order.product_city, order.product_state, order.product_country]
      .filter(Boolean)
      .join(', ');
    const forced = {
      productId: order.product_id,
      counterpartId: order.buyer_id,
      counterpartName: buyerNameForOrder(order),
      productTitle: order.product_title,
      productImage,
      productPrice: getProductPriceLabel({
        price: order.total,
        country: order.product_country
      }),
      productLocation: locationLabel
    };
    window.sessionStorage.setItem('templesale:forced-chat', JSON.stringify(forced));
  };

  const buyerNameForOrder = (order) => order.buyer_name || 'Comprador';
  const getOrderTimestamp = (order) => {
    const dateValue = order?.confirmed_at || order?.updated_at || order?.created_at;
    const date = new Date(dateValue || 0);
    const timestamp = Number(date.getTime());
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  const orderedBuyerOrders = useMemo(() => {
    if (!buyerOrders.length) return [];
    const newSet = new Set(newBuyerOrderIds.map((id) => Number(id)).filter(Number.isFinite));
    return [...buyerOrders].sort((a, b) => {
      const aNew = newSet.has(Number(a?.id));
      const bNew = newSet.has(Number(b?.id));
      if (aNew !== bNew) return aNew ? -1 : 1;
      return getOrderTimestamp(b) - getOrderTimestamp(a);
    });
  }, [buyerOrders, newBuyerOrderIds]);

  const handleBuyerOrderAction = useCallback((order) => {
    const orderId = Number(order?.id);
    if (!Number.isFinite(orderId)) return;
    setNewBuyerOrderIds((prev) => prev.filter((id) => Number(id) !== orderId));
  }, []);

  return (
    <section className="sales-requests-page px-4 py-8 sm:px-6 lg:px-8">
      <CloseBackButton />
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Central de pedidos</p>
            <h1 className="text-2xl font-semibold text-slate-900">Pedidos e compras</h1>
           
          </div>
          <div className="hidden sm:flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              Vendas: {visibleOrders.length}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
              Compras: {buyerOrders.length}
            </span>
          </div>
        </header>

        <div className="sales-requests__mobile-tabs sm:hidden">
          <button
            type="button"
            onClick={() => setActiveMobileTab('sales')}
            className={`sales-requests__tab ${
              activeMobileTab === 'sales' ? 'is-active' : ''
            }`}
            aria-pressed={activeMobileTab === 'sales'}
          >
            Vendas
            {salesBadgeCount > 0 && (
              <span className="sales-requests__tab-badge">+{salesBadgeCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab('purchases')}
            className={`sales-requests__tab ${
              activeMobileTab === 'purchases' ? 'is-active' : ''
            }`}
            aria-pressed={activeMobileTab === 'purchases'}
          >
            Compras
            {purchasesBadgeCount > 0 && (
              <span className="sales-requests__tab-badge">+{purchasesBadgeCount}</span>
            )}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div
            className={`sales-requests__panel ${
              activeMobileTab === 'sales' ? 'is-active' : ''
            }`}
          >
            <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Vendas</p>
                  <h2 className="text-xl font-semibold text-slate-900">Solicitações de compra</h2>
                  <p className="text-sm text-slate-500">
                    Acompanhe pedidos recebidos e confirme vendas quando estiver tudo certo.
                  </p>
                </div>
              </div>

              {salesAlertMessage && (
                <div className="sales-requests__alert mt-4">{salesAlertMessage}</div>
              )}

              <div className="mt-4">
                {loading ? (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center text-gray-500">
                    <LoadingBar message="Carregando pedidos..." className="text-gray-500" />
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-6 text-center text-red-600">
                    {error}
                  </div>
                ) : visibleOrders.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center text-gray-500">
                    Nenhuma solicitação de compra até o momento.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleOrders.map((order) => {
                      const isNew = newOrderIds.includes(Number(order.id));
                      const imageList = parseImageList(order.image_urls);
                      const productImage = imageList[0] || toAbsoluteImageUrl(order.image_url) || '';
                      const buyerName = order.buyer_name || 'Comprador';
                      const statusLabel = STATUS_LABEL[order.status] || order.status;
                      const createdAt = order.created_at ? new Date(order.created_at) : null;
                      const updatedAt = order.updated_at ? new Date(order.updated_at) : null;
                      const productLink = `/product/${order.product_id}`;
                      const messageLink = '/messages';
                      const locationLabel = [order.product_city, order.product_state, order.product_country]
                        .filter(Boolean)
                        .join(', ');
                      const handleBuyerChatClick = () => {
                        if (typeof window === 'undefined') return;
                        const forced = {
                          productId: order.product_id,
                          counterpartId: order.buyer_id,
                          counterpartName: buyerName || '',
                          productTitle: order.product_title,
                          productImage,
                          productPrice: getProductPriceLabel({
                            price: order.total,
                            country: order.product_country
                          }),
                          productLocation: locationLabel
                        };
                        window.sessionStorage.setItem('templesale:forced-chat', JSON.stringify(forced));
                      };
                      const priceDisplay = getProductPriceLabel({
                        price: order.total,
                        country: order.product_country
                      });

                      return (
                        <article
                          key={order.id}
                          className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5 flex flex-col gap-4"
                        >
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="w-full sm:w-32 h-32 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                              {productImage ? (
                                <img
                                  src={productImage}
                                  alt={order.product_title || `Produto ${order.product_id}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs text-gray-400">Sem imagem</span>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                      {order.product_title || `Produto #${order.product_id}`}
                                    </h2>
                                    {isNew && (
                                      <span className="sales-request__badge">Nova solicitação</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    Pedido #{order.id} •{' '}
                                    <span
                                      className={
                                        order.status === 'pending'
                                          ? 'text-amber-600 font-medium'
                                          : 'text-emerald-600 font-medium'
                                      }
                                    >
                                      {statusLabel}
                                    </span>
                                  </p>
                                </div>
                                <Link
                                  to={productLink}
                                  className="text-sm text-blue-600 hover:underline font-medium"
                                >
                                  Ver anúncio
                                </Link>
                              </div>

                            <div className="sales-requests__order-meta grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                              <p>
                                <strong className="text-gray-700">Comprador:</strong> {buyerName}
                              </p>
                              {order.buyer_email && (
                                <p className="sales-requests__contact">
                                  <strong className="text-gray-700">Contato:</strong> {order.buyer_email}
                                </p>
                              )}
                                <p>
                                  <strong className="text-gray-700">Valor:</strong> {priceDisplay}
                                </p>
                                {createdAt && (
                                  <p>
                                    <strong className="text-gray-700">Solicitado em:</strong>{' '}
                                    {createdAt.toLocaleString()}
                                  </p>
                                )}
                                {updatedAt && order.status !== 'pending' && (
                                  <p>
                                    <strong className="text-gray-700">Atualizado em:</strong>{' '}
                                    {updatedAt.toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              to={messageLink}
                              onClick={() => {
                                if (typeof window === 'undefined') return;
                                const forced = {
                                  productId: order.product_id,
                                  counterpartId: order.buyer_id,
                                  counterpartName: buyerName,
                                  productTitle: order.product_title,
                                  productImage,
                                  productPrice: priceDisplay,
                                  productLocation: locationLabel
                                };
                                window.sessionStorage.setItem(
                                  'templesale:forced-chat',
                                  JSON.stringify(forced)
                                );
                              }}
                              className="px-4 py-2 rounded-lg border border-blue-200 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition"
                            >
                              Falar com o comprador
                            </Link>
                            {order.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => confirmOrder(order.id)}
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                                disabled={confirming === order.id}
                              >
                                {confirming === order.id ? 'Confirmando...' : 'Confirmar venda'}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div
            className={`sales-requests__panel ${
              activeMobileTab === 'purchases' ? 'is-active' : ''
            }`}
          >
            <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-lg">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Compras</p>
                <h2 className="text-xl font-semibold text-slate-900">Compras confirmadas</h2>
                <p className="text-sm text-slate-500">
                  Confira produtos confirmados e avalie o vendedor assim que receber.
                </p>
              </div>

              <div className="mt-4">
                {buyerOrders.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">
                    Assim que uma compra for confirmada pelo vendedor, você verá o produto aqui e poderá acompanhar o contato.
                  </p>
                ) : (
                  <div className="space-y-4">
                  <BuyerOrdersList
                    orders={orderedBuyerOrders}
                    highlightIds={newBuyerOrderIds}
                    showDate
                    onViewProduct={handleBuyerOrderAction}
                    onRateSeller={handleBuyerOrderAction}
                    onMessageSeller={handleBuyerOrderAction}
                  />
                </div>
              )}
            </div>
          </section>
          </div>
        </div>
      </div>
    </section>
  );
}
