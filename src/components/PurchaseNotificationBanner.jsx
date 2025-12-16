import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import formatProductPrice from '../utils/currency.js';
import { isProductFree } from '../utils/product.js';
import { parseImageList, toAbsoluteImageUrl } from '../utils/images.js';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';

const PurchaseNotificationBanner = () => {
  const { latestUnseenOrder, markOrdersSeen } = usePurchaseNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const lastDisplayedId = useRef(null);
  const handleDismiss = useCallback(
    ({ markSeen = false } = {}) => {
      if (markSeen) {
        markOrdersSeen?.();
      }
      setIsVisible(false);
    },
    [markOrdersSeen]
  );
  useEffect(() => {
    if (!latestUnseenOrder) return;
    if (lastDisplayedId.current === latestUnseenOrder.id) return;
    lastDisplayedId.current = latestUnseenOrder.id;
    setActiveOrder(latestUnseenOrder);
    setIsVisible(true);
  }, [latestUnseenOrder]);

  const productImage = useMemo(() => {
    if (!activeOrder) return IMG_PLACEHOLDER;
    const imageList = parseImageList(activeOrder.image_urls);
    return (
      imageList[0] ||
      toAbsoluteImageUrl(activeOrder.image_url) ||
      IMG_PLACEHOLDER
    );
  }, [activeOrder]);

  const priceLabel = useMemo(() => {
    if (!activeOrder) return '';
    const priceValue = activeOrder.total ?? activeOrder.price ?? activeOrder?.product?.price;
    return isProductFree(activeOrder) ? 'Grátis' : formatProductPrice(priceValue, activeOrder.product_country);
  }, [activeOrder]);

  if (!activeOrder || !isVisible) {
    return null;
  }

  const productTitle = activeOrder.product_title || activeOrder.product?.title || 'Produto comprado';
  const sellerName = activeOrder.seller_name || 'vendedor';

  return (
    <div className="purchase-notification-banner" role="status" aria-live="polite">
      <div className="purchase-notification-banner__thumb">
        <img
          src={productImage}
          alt={productTitle}
          className="purchase-notification-banner__thumb-img"
          loading="eager"
        />
      </div>
      <div className="purchase-notification-banner__content">
        <p className="purchase-notification-banner__eyebrow">Compra confirmada</p>
        <p className="purchase-notification-banner__title">Você comprou {productTitle}!</p>
        {priceLabel && (
          <p className="purchase-notification-banner__price">{priceLabel}</p>
        )}
        <p className="purchase-notification-banner__subtitle">
          Frete, mensagem e avaliação ficam disponíveis imediatamente.
        </p>
      <button
        type="button"
        className="purchase-notification-banner__close"
        onClick={() => handleDismiss()}
        aria-label="Fechar notificação"
      >
        ×
      </button>
      <div className="purchase-notification-banner__actions">
          <Link
            to="/buyer-purchases"
            className="purchase-notification-banner__btn purchase-notification-banner__btn--primary"
            onClick={() => handleDismiss({ markSeen: true })}
          >
          Ver compras
          </Link>
          {activeOrder.product_id && (
            <Link
              to={`/product/${activeOrder.product_id}`}
              className="purchase-notification-banner__btn purchase-notification-banner__btn--ghost"
              onClick={() => handleDismiss({ markSeen: true })}
            >
              Ver produto
            </Link>
          )}
          {activeOrder.seller_id && (
            <Link
              to={`/users/${activeOrder.seller_id}`}
              className="purchase-notification-banner__btn purchase-notification-banner__btn--ghost"
              onClick={() => handleDismiss({ markSeen: true })}
            >
              Avaliar {sellerName}
            </Link>
          )}
      </div>
      </div>
    </div>
  );
};

export default PurchaseNotificationBanner;
