import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SoldBadge from './SoldBadge.jsx';
import { isProductFree } from '../utils/product.js';
import { buildProductSpecEntries } from '../utils/productSpecs.js';

export default function ProductCard({
  product,
  buyerInfo,
  token,
  markAsSold,
  deleteProduct,
  isValidImageSource,
  getProductPriceLabel
}) {
  try {
    if (!product || typeof product !== 'object') {
      throw new Error('Produto inválido');
    }
    const isSold = product.status === 'sold';
    const mainImage = product.image_urls?.[0] || product.image_url;
    const freeTag = isProductFree(product);
    const specEntries = buildProductSpecEntries(product);
    const categoryLabel = product.category || 'Não informada';
    const locationLabel = [product.city, product.state, product.country].filter(Boolean).join(', ');
    const priceLabel = freeTag ? 'Grátis' : getProductPriceLabel(product);
    const imageSource = isValidImageSource(mainImage) ? mainImage : null;
    const hasToken = !!token;

    useEffect(() => {
      if (typeof window === 'undefined') return undefined;
      const timer = setTimeout(() => {
        window.logOverlayError?.({
          message: 'render trace',
          meta: {
            productId: product.id,
            title: product.title,
            mainImage,
            hasBuyer: !!buyerInfo,
            buyerId: buyerInfo?.id,
            formattedPrice: priceLabel
          }
        });
      }, 0);
      return () => clearTimeout(timer);
    }, [product.id, product.title, mainImage, priceLabel, buyerInfo?.id]);

    return (
      <article className="my-product-card border rounded bg-white shadow-sm overflow-hidden">
        <div className="relative">
          {imageSource ? (
            <img
              src={imageSource}
              alt={product.title || 'Produto'}
              className="my-product-card__image w-full h-44 object-cover"
              onError={(event) => {
                console.error('[ProductCard] image load error', imageSource);
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="my-product-card__placeholder w-full h-44 bg-gray-100 flex items-center justify-center text-gray-400">
              Sem imagem
            </div>
          )}
          {!!isSold && <SoldBadge className="absolute -top-1 -left-1" />}
          {!!freeTag && !isSold && (
            <span className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
              Grátis
            </span>
          )}
        </div>
        <div className="my-product-card__body p-3 space-y-1">
          <h3 className="font-semibold line-clamp-2">{product.title}</h3>
          <p className={`font-medium ${freeTag ? 'text-emerald-600' : 'text-green-600'}`}>
            {priceLabel}
          </p>
          <div className="text-xs text-gray-500 space-y-1 mt-1">
            <p>
              Categoria:{' '}
              <span className="text-gray-800">{categoryLabel}</span>
            </p>
            {!!locationLabel && (
              <p>
                Local:{' '}
                <span className="text-gray-800">{locationLabel}</span>
              </p>
            )}
          </div>
          {!!specEntries.length && (
            <div className="text-[11px] text-gray-600 grid grid-cols-2 gap-1">
              {specEntries.slice(0, 2).map((entry) => (
                <p key={entry.label}>
                  {entry.label}:{' '}
                  <span className="text-gray-800">{entry.value}</span>
                </p>
              ))}
            </div>
          )}
          {!!isSold && (
            <p className="text-xs text-rose-600">
              Esse produto foi comprado por{' '}
              {buyerInfo?.id ? (
                <Link className="text-rose-500 underline" to={`/users/${buyerInfo.id}`}>
                  {buyerInfo.name}
                </Link>
              ) : (
                buyerInfo?.name || 'um comprador'
              )}
              .
            </p>
          )}
          <div className="flex items-center gap-2 pt-2">
            {!isSold ? (
              <>
                {hasToken && product.id ? (
                  <Link
                    to={`/edit-product/${product.id}`}
                    className="my-product-card__edit px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                  >
                    Editar
                  </Link>
                ) : (
                  <span className="my-product-card__edit px-3 py-1.5 text-sm border rounded text-gray-500">
                    Editar
                  </span>
                )}
                <button
                  onClick={() => markAsSold?.(product.id)}
                  className="px-3 py-1.5 text-sm rounded bg-gray-800 text-white hover:bg-gray-900"
                  disabled={!hasToken}
                >
                  Marcar como vendido
                </button>
              </>
            ) : (
              <button
                onClick={() => deleteProduct?.(product.id)}
                className="px-3 py-1.5 text-sm rounded bg-rose-500 text-white hover:bg-rose-600"
                disabled={!hasToken}
              >
                Excluir produto
              </button>
            )}
          </div>
        </div>
      </article>
    );
  } catch (renderError) {
    console.error('[ProductCard] render error', product?.id, renderError);
    return (
      <article className="my-product-card border rounded bg-white shadow-sm overflow-hidden">
        <div className="h-44 bg-gray-100 flex items-center justify-center text-sm text-rose-500">
          Erro ao renderizar este produto.
        </div>
      </article>
    );
  }
}
