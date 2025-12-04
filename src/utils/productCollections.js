const getProductKey = (product) => {
  if (!product) return null;
  if (product.id) return `id:${product.id}`;
  if (product.product_id && product.title) {
    return `prod:${product.product_id}:${product.title}`;
  }
  if (product.product_id) {
    return `prod:${product.product_id}`;
  }
  if (product.title) {
    return `title:${product.title}`;
  }
  try {
    return JSON.stringify(product);
  } catch {
    return null;
  }
};

const mergeProductLists = (primary = [], secondary = []) => {
  const seen = new Set();
  const output = [];
  const pushAll = (list) => {
    for (const item of list || []) {
      if (!item) continue;
      const key = getProductKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
  };
  pushAll(primary);
  pushAll(secondary);
  return output;
};

export { getProductKey, mergeProductLists };
