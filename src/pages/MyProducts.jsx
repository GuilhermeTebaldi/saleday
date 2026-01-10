// frontend/src/pages/MyProducts.jsx
// Página para o usuário gerenciar os próprios anúncios.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CloseBackButton from '../components/CloseBackButton.jsx';
import { getProductPriceLabel } from '../utils/product.js';

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
  const safeProducts = Array.isArray(products)
    ? products.filter((product) => product && typeof product === 'object' && typeof product.title === 'string')
    : [];
  const [resetVisible, setResetVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, productId: null });

  const isValidImageSource = (url) =>
    typeof url === 'string' &&
    url.trim().length > 0 &&
    /^(https?:\/\/|\/)/i.test(url.trim());

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
    const soldProducts = products.filter(
      (product) => product.status === 'sold' && !product.hidden_by_seller
    );
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

  const requestDeleteProduct = (id) => {
    setDeleteConfirm({ open: true, productId: id });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, productId: null });
  };

  async function performDeleteProduct(id) {
    try {
      await api.delete(`/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts((prev) =>
        prev.map((product) =>
          product.id === id ? { ...product, hidden_by_seller: true } : product
        )
      );
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

  const confirmDeleteProduct = async () => {
    if (!deleteConfirm.productId) return;
    await performDeleteProduct(deleteConfirm.productId);
    closeDeleteConfirm();
  };

  useEffect(() => {
    if (!deleteConfirm.open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeDeleteConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirm.open]);

  const handleHardReset = () => {
    if (typeof window === 'undefined') return;
    window.logOverlayError?.({
      message: 'reset acionado',
      meta: {
        productsLength: safeProducts.length,
        buyersCount: Object.keys(buyers).length,
        tokenExistente: !!token
      }
    });
    localStorage.clear();
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
    window.location.reload();
  };

  useEffect(() => {
    window.logOverlayError?.({
      message: 'checagem MyProducts',
      meta: {
        productsCount: safeProducts.length,
        buyersCount: Object.keys(buyers).length,
        tokenExistente: !!token
      }
    });
  }, [safeProducts.length, buyers, token]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.showResetAppButton = () => setResetVisible(true);
    window.hideResetAppButton = () => setResetVisible(false);
    return () => {
      window.showResetAppButton = undefined;
      window.hideResetAppButton = undefined;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previousTranslate = document.documentElement.getAttribute('translate');
    document.documentElement.setAttribute('translate', 'no');
    return () => {
      if (previousTranslate == null) {
        document.documentElement.removeAttribute('translate');
      } else {
        document.documentElement.setAttribute('translate', previousTranslate);
      }
    };
  }, []);

  if (loading) {
    return (
      <>
        <CloseBackButton />
        <p className="my-products-empty">Carregando seus anúncios...</p>
      </>
    );
  }
  if (fetchError) {
    return (
      <>
        <CloseBackButton />
        <p className="my-products-empty text-rose-600">{fetchError}</p>
      </>
    );
  }
  if (!safeProducts.length) {
    return (
      <>
        <CloseBackButton />
        <p className="my-products-empty">Você ainda não publicou produtos.</p>
      </>
    );
  }

  const hasProductsList = safeProducts.length > 0;

  return (
    <>
      {resetVisible && (
        <button
          type="button"
          onClick={handleHardReset}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-red-600 text-white rounded shadow-lg"
        >
          Reset App
        </button>
      )}
      <CloseBackButton />
      {hasProductsList && (
        <section className="my-products-grid grid grid-cols-2 md:grid-cols-3 gap-3">
          {safeProducts.map((product, index) => (
            <ProductCard
              key={`product-${String(product.id ?? `idx-${index}`)}`}
              product={product}
              buyerInfo={buyers[product.id]}
              token={token}
              markAsSold={markAsSold}
              deleteProduct={requestDeleteProduct}
              isValidImageSource={isValidImageSource}
              getProductPriceLabel={getProductPriceLabel}
            />
          ))}
        </section>
      )}
      {deleteConfirm.open && (
        <div
          className="my-products-confirm"
          role="dialog"
          aria-modal="true"
          onClick={closeDeleteConfirm}
        >
          <div
            className="my-products-confirm__card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="my-products-confirm__title">Excluir produto?</h3>
            <p className="my-products-confirm__text">
              Tem certeza que deseja excluir este produto?
            </p>
            <div className="my-products-confirm__actions">
              <button
                type="button"
                className="my-products-confirm__btn my-products-confirm__btn--ghost"
                onClick={closeDeleteConfirm}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="my-products-confirm__btn my-products-confirm__btn--danger"
                onClick={confirmDeleteProduct}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
