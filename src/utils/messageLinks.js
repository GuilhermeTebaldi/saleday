import { getProductPriceLabel } from './product.js';
import { getPrimaryImageEntry } from './images.js';

export const buildProductMessageParams = ({
  product,
  sellerId,
  sellerName,
  productTitle,
  productImage,
  productPrice,
  productLocation
} = {}) => {
  const params = new URLSearchParams();

  if (product?.id) params.set('product', String(product.id));
  if (sellerId) params.set('seller', String(sellerId));
  if (sellerName) params.set('sellerName', String(sellerName));

  const resolvedTitle = productTitle ?? product?.title;
  if (resolvedTitle) params.set('productTitle', String(resolvedTitle));

  const resolvedImage =
    productImage || getPrimaryImageEntry(product)?.url || '';
  if (resolvedImage) params.set('productImage', resolvedImage);

  const resolvedPrice =
    productPrice || (product ? getProductPriceLabel(product) : '');
  if (resolvedPrice) params.set('productPrice', resolvedPrice);

  const resolvedLocation =
    productLocation ||
    [product?.city, product?.state, product?.country].filter(Boolean).join(', ');
  if (resolvedLocation) params.set('productLocation', resolvedLocation);

  return params;
};

export const buildProductMessageLink = (options) => {
  const params = buildProductMessageParams(options);
  const query = params.toString();
  return query ? `/messages?${query}` : '/messages';
};

export default {
  buildProductMessageParams,
  buildProductMessageLink
};
