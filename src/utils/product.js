export const isProductFree = (product) => {
  if (!product) return false;
  if (product.is_free) return true;

  const price = product.price;
  if (price === null || price === undefined) return true;

  if (typeof price === 'string') {
    if (price.trim() === '') return true;
    const numeric = Number(price);
    return Number.isFinite(numeric) && numeric === 0;
  }

  if (typeof price === 'number') {
    return Number.isFinite(price) && price === 0;
  }

  const numeric = Number(price);
  return Number.isFinite(numeric) && numeric === 0;
};

export default {
  isProductFree
};
