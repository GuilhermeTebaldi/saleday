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
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const lastDisplayedId = useRef(null);
  const handleMinimize = useCallback(() => {
    markOrdersSeen?.();
    setIsMinimized(true);
  }, [markOrdersSeen]);
  const handleClose = useCallback(() => {
    markOrdersSeen?.();
    setIsMinimized(false);
    setIsVisible(false);
  }, [markOrdersSeen]);
  const handleExpand = useCallback(() => {
    setIsMinimized(false);
  }, []);
  useEffect(() => {
    if (!latestUnseenOrder) return;
    if (lastDisplayedId.current === latestUnseenOrder.id) return;
    lastDisplayedId.current = latestUnseenOrder.id;
    setActiveOrder(latestUnseenOrder);
    setIsVisible(true);
    setIsMinimized(false);
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
  return (
    <div
      className={`purchase-notification-banner ${isMinimized ? 'is-minimized' : ''}`.trim()}
      role="status"
      aria-live="polite"
      tabIndex={isMinimized ? 0 : -1}
      aria-label={isMinimized ? 'Abrir notificacao de compra confirmada' : undefined}
      onClick={isMinimized ? handleExpand : undefined}
      onKeyDown={
        isMinimized
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleExpand();
              }
            }
          : undefined
      }
    >
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
        <p className="purchase-notification-banner__title">{productTitle}</p>
        {!isMinimized && priceLabel && (
          <p className="purchase-notification-banner__price">{priceLabel}</p>
        )}
        {!isMinimized && (
          <p className="purchase-notification-banner__subtitle">Frete e avaliação liberados.</p>
        )}
        {!isMinimized && (
          <button
            type="button"
            className="purchase-notification-banner__close"
            onClick={handleMinimize}
            aria-label="Minimizar notificação"
          >
            ×
          </button>
        )}
        {!isMinimized && (
          <div className="purchase-notification-banner__actions">
            <Link
              to="/sales-requests"
              className="purchase-notification-banner__btn purchase-notification-banner__btn--primary"
              onClick={handleClose}
            >
              Ver compras
            </Link>
            <button
              type="button"
              className="purchase-notification-banner__btn purchase-notification-banner__btn--ghost"
              onClick={handleClose}
            >
              Ok
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseNotificationBanner;
