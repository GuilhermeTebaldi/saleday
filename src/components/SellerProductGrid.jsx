import { Link } from 'react-router-dom';
import { isProductFree } from '../utils/product.js';

export default function SellerProductGrid({
  products = [],
  isSelf = false,
  catalogSelection = [],
  renderSelfAction,
  registerClick,
  handleOpenProductChat,
  linkState,
  layout = 'default'
}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const isCompact = layout === 'compact';
  const isStrip = layout === 'strip';

  const renderAction = (product, normalizedId) => {
    if (!isSelf) {
      if (!handleOpenProductChat) return null;
      return (
        <button
          type="button"
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleOpenProductChat(product);
          }}
        >
          Abrir conversa com o vendedor
        </button>
      );
    }
    if (typeof renderSelfAction === 'function') {
      const isSelected = normalizedId && catalogSelection.includes(normalizedId);
      return renderSelfAction({ product, isSelected });
    }
    return null;
  };

  const containerClass = isStrip
    ? 'flex flex-col gap-2'
    : isCompact
      ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
      : 'grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4';

  return (
    <div className={containerClass}>
      {safeProducts.map((product) => {
        const normalizedProductId = product?.id ? String(product.id) : '';
        const img = product.image_urls?.[0] || product.image_url || '';

        if (isStrip) {
          return (
            <Link
              to={`/product/${product.id}`}
              state={linkState}
              key={product.id}
              className="group flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition hover:shadow-md"
              onClick={() => registerClick?.(product.id)}
            >
              <div className="h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                {img ? (
                  <img
                    src={img}
                    alt={product.title || 'Produto'}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">
                    Sem imagem
                  </div>
                )}
              </div>
              <p className="flex-1 text-left text-xs font-semibold text-slate-900 line-clamp-2">
                {product.title || 'Produto'}
              </p>
              {renderAction(product, normalizedProductId)}
            </Link>
          );
        }

        if (isCompact) {
          return (
            <Link
              to={`/product/${product.id}`}
              state={linkState}
              key={product.id}
              className="group flex flex-col items-center gap-2 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center shadow-sm transition hover:shadow-md"
              onClick={() => registerClick?.(product.id)}
            >
              {img ? (
                <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={img}
                    alt={product.title || 'Produto'}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="aspect-[4/5] w-full rounded-xl bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                  Sem imagem
                </div>
              )}
              <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                {product.title || 'Produto'}
              </p>
              {renderAction(product, normalizedProductId)}
            </Link>
          );
        }

        return (
          <Link
            to={`/product/${product.id}`}
            state={linkState}
            key={product.id}
            className="group relative overflow-hidden rounded-xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            onClick={() => registerClick?.(product.id)}
          >
            {img ? (
              <div className="aspect-[4/5] w-full overflow-hidden bg-slate-100">
                <img
                  src={img}
                  alt={product.title || 'Produto'}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="aspect-[4/5] w-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                Sem imagem
              </div>
            )}
            <div className="px-2.5 py-2 space-y-1">
              <p className="text-xs font-medium text-slate-900 line-clamp-2">
                {product.title || 'Produto'}
              </p>
              <p className="text-xs font-semibold text-emerald-600">
                {product.price != null
                  ? Number(product.price).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })
                  : 'Preço a combinar'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {[product.city, product.state].filter(Boolean).join(' · ') || 'Local não informado'}
              </p>
              {renderAction(product, normalizedProductId)}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
