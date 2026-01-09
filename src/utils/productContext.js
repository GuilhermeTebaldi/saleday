import { parseImageList, toAbsoluteImageUrl } from './images.js';
import formatProductPrice from './currency.js';

export const PRODUCT_CONTEXT_PREFIX = '__templesale_product_context__:';

export const buildProductContextPayload = (productId, meta = {}, productInfo = null) => {
  if (!productId) return null;
  const title =
    (productInfo?.title || meta.title || `Produto #${productId}`)?.trim() ||
    `Produto #${productId}`;
  const images = parseImageList(productInfo?.image_urls);
  const image =
    meta.image ||
    images?.[0] ||
    toAbsoluteImageUrl(productInfo?.image_url) ||
    '';
  const contextCountry = productInfo?.country || productInfo?.product_country || null;
  const price =
    meta.price ||
    (productInfo?.price != null && contextCountry
      ? formatProductPrice(productInfo.price, contextCountry)
      : null);
  const location =
    meta.location ||
    [productInfo?.city, productInfo?.state, productInfo?.country]
      .filter(Boolean)
      .join(', ') ||
    null;

  return {
    productId,
    title,
    image,
    price,
    location,
    timestamp: Date.now()
  };
};
