// frontend/src/pages/MyProducts.jsx
// Página para o usuário gerenciar os próprios anúncios.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import SoldBadge from '../components/SoldBadge.jsx';
import formatProductPrice from '../utils/currency.js';
import { isProductFree } from '../utils/product.js';
import { buildProductSpecEntries } from '../utils/productSpecs.js';

export default function MyProducts() {
  const { token } = useContext(AuthContext);
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [buyers, setBuyers] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const refreshId = useMemo(() => location.state?.refreshId ?? 0, [location.state]);
  const abortFetchRef = useRef(() => {});
  const fetchInFlightRef = useRef(false);
  const logPrefix = '[MyProducts]';
  const safeProducts = Array.isArray(products) ? products : [];

  const isValidImageSource = (url) =>
    typeof url === 'string' &&
    url.trim().length > 0 &&
    /^(https?:\/\/|\/)/i.test(url.trim());

  const getProductPriceLabel = (product) => {
    try {
      return formatProductPrice(product?.price, product?.country);
    } catch (error) {
      console.error(`${logPrefix} price render failure`, product?.id, error);
      return 'Valor indisponível';
    }
  };

  const fetchProducts = useCallback(() => {
    if (!token) return;
    if (fetchInFlightRef.current) return;
    abortFetchRef.current?.();
    let active = true;
    abortFetchRef.current = () => {
      active = false;
    };
    setLoading(true);
    setFetchError('');
    fetchInFlightRef.current = true;

    api
      .get('/products/my', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res.data?.data) ? res.data.data.slice() : [];
        setProducts(items);
      })
      .catch((err) => {
        console.error(`${logPrefix} fetchProducts error`, err);
        if (active) {
          setFetchError(
            'Não foi possível carregar seus anúncios. Atualize a página para tentar novamente.'
          );
        }
      })
      .finally(() => {
        fetchInFlightRef.current = false;
        if (active) setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    fetchProducts();
    return () => {
      abortFetchRef.current?.();
    };
  }, [fetchProducts, location.pathname, token, refreshId]);

  useEffect(() => {
    if (!token || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }
    const refreshList = () => {
      fetchProducts();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchProducts();
      }
    };
    window.addEventListener('pageshow', refreshList);
    window.addEventListener('popstate', refreshList);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pageshow', refreshList);
      window.removeEventListener('popstate', refreshList);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchProducts, token]);

  useEffect(() => {
    if (!token) return undefined;
    const soldProducts = products.filter((product) => product.status === 'sold');
    if (!soldProducts.length) return undefined;
    let active = true;
    soldProducts.forEach((product) => {
      if (buyers[product.id]) return;
      api
        .get(`/orders/product/${product.id}/buyer`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (!active) return;
          const buyerName =
            res.data?.data?.buyer_name || res.data?.data?.buyerName || 'Um comprador';
          setBuyers((prev) => ({
            ...prev,
            [product.id]: { name: buyerName, id: res.data?.data?.buyer_id ?? null }
          }));
        })
        .catch((err) => {
          console.error(`${logPrefix} buyer fetch error`, err);
        });
    });
    return () => {
      active = false;
    };
  }, [buyers, products, token]);

  async function markAsSold(id) {
    try {
      await api.put(
        `/products/${id}/status`,
        { status: 'sold' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'sold' } : p)));
      toast.success('Produto marcado como vendido.');
    } catch (error) {
      console.error(`${logPrefix} markAsSold error`, error);
      toast.error('Falha ao marcar como vendido.');
    }
  }

  async function deleteProduct(id) {
    try {
      await api.delete(`/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts((prev) => prev.filter((product) => product.id !== id));
      setBuyers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success('Produto removido.');
    } catch (error) {
      console.error(`${logPrefix} deleteProduct error`, error);
      toast.error('Falha ao remover o produto.');
    }
  }

  if (loading) return <p className="my-products-empty">Carregando seus anúncios...</p>;
  if (fetchError) return <p className="my-products-empty text-rose-600">{fetchError}</p>;
  if (!safeProducts.length) return <p className="my-products-empty">Você ainda não publicou produtos.</p>;

  return (
    <div className="my-products-grid grid grid-cols-2 md:grid-cols-3 gap-3">
      {safeProducts.map((product, index) => {
        try {
          if (!product) {
            throw new Error('Produto inválido');
          }
          const isSold = product.status === 'sold';
          const mainImage = product.image_urls?.[0] || product.image_url;
          const freeTag = isProductFree(product);
          const specEntries = buildProductSpecEntries(product);
          const categoryLabel = product.category || 'Não informada';
          const locationLabel = [product.city, product.state, product.country]
            .filter(Boolean)
            .join(', ');
          const buyerInfo = buyers[product.id];
          const priceLabel = freeTag ? 'Grátis' : getProductPriceLabel(product);
          const imageSource = isValidImageSource(mainImage) ? mainImage : null;

          return (
            <article
              key={product.id ?? `product-${index}`}
              className="my-product-card border rounded bg-white shadow-sm overflow-hidden"
            >
              <div className="relative">
                {imageSource ? (
                  <img
                    src={imageSource}
                    alt={product.title || 'Produto'}
                    className="my-product-card__image w-full h-44 object-cover"
                    onError={(event) => {
                      console.error('[MyProducts] image load error', imageSource);
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="my-product-card__placeholder w-full h-44 bg-gray-100 flex items-center justify-center text-gray-400">
                    Sem imagem
                  </div>
                )}
                {isSold && <SoldBadge className="absolute -top-1 -left-1" />}
                {freeTag && !isSold && (
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
                  {locationLabel && (
                    <p>
                      Local:{' '}
                      <span className="text-gray-800">{locationLabel}</span>
                    </p>
                  )}
                </div>
                {specEntries.length > 0 && (
                  <div className="text-[11px] text-gray-600 grid grid-cols-2 gap-1">
                    {specEntries.slice(0, 2).map((entry) => (
                      <p key={entry.label}>
                        {entry.label}:{' '}
                        <span className="text-gray-800">{entry.value}</span>
                      </p>
                    ))}
                  </div>
                )}
                {isSold && (
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
                      {product.id ? (
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
                        onClick={() => markAsSold(product.id)}
                        className="px-3 py-1.5 text-sm rounded bg-gray-800 text-white hover:bg-gray-900"
                      >
                        Marcar como vendido
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="px-3 py-1.5 text-sm rounded bg-rose-500 text-white hover:bg-rose-600"
                    >
                      Excluir produto
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        } catch (renderError) {
          console.error(`${logPrefix} render error`, product?.id ?? index, renderError);
          return (
            <article
              key={`product-error-${product?.id ?? index}`}
              className="my-product-card border rounded bg-white shadow-sm overflow-hidden"
            >
              <div className="h-44 bg-gray-100 flex items-center justify-center text-sm text-rose-500">
                Erro ao renderizar este produto.
              </div>
            </article>
          );
        }
      })}
    </div>
  );
}
