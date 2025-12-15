// frontend/src/pages/MyProducts.jsx
// Página para o usuário gerenciar os próprios anúncios.
import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import SoldBadge from '../components/SoldBadge.jsx';
import formatProductPrice from '../utils/currency.js';
import { isProductFree } from '../utils/product.js';
import { buildProductSpecEntries } from '../utils/productSpecs.js';

export default function MyProducts() {
  const { token } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [buyers, setBuyers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
      api
        .get('/products/my', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;
        const items = Array.isArray(res.data?.data) ? res.data.data.slice() : [];
        setProducts(items);
      })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

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
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [products, buyers, token]);

  async function markAsSold(id) {
    try {
      await api.put(`/products/${id}/status`, { status: 'sold' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts((prev) => prev.map(p => p.id === id ? { ...p, status: 'sold' } : p));
      toast.success('Produto marcado como vendido.');
    } catch {
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
    } catch {
      toast.error('Falha ao remover o produto.');
    }
  }

  if (loading) return <p className="my-products-empty">Carregando seus anúncios...</p>;
  if (!products.length) return <p className="my-products-empty">Você ainda não publicou produtos.</p>;

  return (
    <div className="my-products-grid grid grid-cols-2 md:grid-cols-3 gap-3">
      {products.map((product) => {
        const isSold = product.status === 'sold';
        const mainImage = product.image_urls?.[0] || product.image_url;
        const freeTag = isProductFree(product);
        const specEntries = buildProductSpecEntries(product);
        const categoryLabel = product.category || 'Não informada';
        const locationLabel = [product.city, product.state, product.country]
          .filter(Boolean)
          .join(', ');
        return (
          <article key={product.id} className="my-product-card border rounded bg-white shadow-sm overflow-hidden">
            <div className="relative">
              {mainImage ? (
                <img src={mainImage} alt={product.title} className="my-product-card__image w-full h-44 object-cover" />
              ) : (
                <div className="my-product-card__placeholder w-full h-44 bg-gray-100 flex items-center justify-center text-gray-400">Sem imagem</div>
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
                {freeTag ? 'Grátis' : formatProductPrice(product.price, product.country)}
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
                  {buyers[product.id]?.id ? (
                    <Link className="text-rose-500 underline" to={`/users/${buyers[product.id].id}`}>
                      {buyers[product.id].name}
                    </Link>
                  ) : (
                    buyers[product.id]?.name || 'um comprador'
                  )}
                  .
                </p>
              )}
              <div className="flex items-center gap-2 pt-2">
                {!isSold ? (
                  <>
                    <Link
                      to={`/edit-product/${product.id}`}
                      className="my-product-card__edit px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                    >
                      Editar
                    </Link>
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
      })}
    </div>
  );
}
