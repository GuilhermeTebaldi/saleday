import { Link } from 'react-router-dom';
import { parseImageList, toAbsoluteImageUrl } from '../utils/images.js';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';

const buildMessageLink = (order) => {
  if (!order?.product_id) return '/messages';
  const sellerId = order?.seller_id;
  const sellerName = order?.seller_name;
  const query = [];
  query.push(`product=${order.product_id}`);
  if (sellerId) query.push(`seller=${sellerId}`);
  if (sellerName) {
    query.push(`sellerName=${encodeURIComponent(sellerName)}`);
  }
  return `/messages?${query.join('&')}`;
};

const BuyerOrdersList = ({
  orders = [],
  onViewProduct,
  onRateSeller,
  onMessageSeller,
  onClose
}) => {
  const safeOnClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <>
      {orders.map((order) => {
        const orderId = order.id;
        if (!orderId) return null;
        const imageList = parseImageList(order.image_urls);
        const productImage =
          imageList[0] ||
          toAbsoluteImageUrl(order.image_url) ||
          IMG_PLACEHOLDER;
        const productTitle =
          order.product_title || order.product?.title || `Produto #${order.product_id || orderId}`;
        const productLink = `/product/${order.product_id}`;
        const messageLink = buildMessageLink(order);

        return (
          <article key={orderId} className="home-orders-card">
            <div className="home-orders-card__imgwrap">
              <img
                src={productImage}
                alt={productTitle}
                className="home-orders-card__img"
                onError={(event) => {
                  event.currentTarget.src = IMG_PLACEHOLDER;
                  event.currentTarget.onerror = null;
                }}
              />
            </div>
            <div className="home-orders-card__body">
              <p className="home-orders-card__title">{productTitle}</p>
              <div className="home-orders-card__actions">
                <Link
                  to={productLink}
                  className="home-orders-btn home-orders-btn--view"
                  onClick={() => {
                    onViewProduct?.(order);
                    safeOnClose();
                  }}
                >
                  Ver produto
                </Link>
                {order.seller_id ? (
                  <Link
                    to={`/users/${order.seller_id}`}
                    className="home-orders-btn home-orders-btn--rate"
                    onClick={() => {
                      onRateSeller?.(order);
                      safeOnClose();
                    }}
                  >
                    Avaliar vendedor
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="home-orders-btn home-orders-btn--rate home-orders-btn--disabled"
                    disabled
                  >
                    Avaliar vendedor
                  </button>
                )}
                <Link
                  to={messageLink}
                  className="home-orders-btn home-orders-btn--chat"
                  onClick={() => {
                    onMessageSeller?.(order);
                    safeOnClose();
                  }}
                >
                  Falar com o vendedor
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
};

export default BuyerOrdersList;
