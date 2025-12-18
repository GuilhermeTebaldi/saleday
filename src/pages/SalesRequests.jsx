// frontend/src/pages/SalesRequests.jsx
// Página para acompanhar e confirmar solicitações de compra.
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { getProductPriceLabel } from '../utils/product.js';
import { parseImageList, toAbsoluteImageUrl } from '../utils/images.js';
import { getUnseenSellerOrderIds, markSellerOrdersSeen } from '../utils/orders.js';

const STATUS_LABEL = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado'
};

export default function SalesRequests() {
  const { token, user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [newOrderIds, setNewOrderIds] = useState([]);
  const [soldProductIds, setSoldProductIds] = useState([]);

  const fetchOrders = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token, user?.id]);

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
    window.sessionStorage.setItem('saleday:forced-chat', JSON.stringify(forced));
  };

  const buyerNameForOrder = (order) => order.buyer_name || 'Comprador';

  return (
    <section className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Solicitações de compra</h1>
          <p className="text-sm text-gray-500">
            Acompanhe pedidos recebidos e confirme vendas quando estiver tudo certo.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          disabled={loading}
        >
          Atualizar lista
        </button>
      </header>

      {newOrderIds.length > 0 && (
        <div className="sales-requests__alert">
          Você possui {newOrderIds.length}{' '}
          {newOrderIds.length === 1 ? 'nova solicitação de compra' : 'novas solicitações de compra'}.
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center text-gray-500">
          Carregando pedidos...
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
          {pendingCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Você tem {pendingCount} pedido(s) pendente(s) de confirmação.
            </div>
          )}
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
              window.sessionStorage.setItem('saleday:forced-chat', JSON.stringify(forced));
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                      <p>
                        <strong className="text-gray-700">Comprador:</strong> {buyerName}
                      </p>
                      {order.buyer_email && (
                        <p>
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
                        'saleday:forced-chat',
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
    </section>
  );
}
