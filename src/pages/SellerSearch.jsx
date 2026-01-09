// frontend/src/pages/SellerSearch.jsx
// Página de busca e filtro de vendedores cadastrados.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api.js';
import { asStars } from '../utils/rating.js';
import CloseBackButton from '../components/CloseBackButton.jsx';

const getInitial = (value) => {
  if (!value) return 'U';
  const first = value.trim().charAt(0);
  return first ? first.toUpperCase() : 'U';
};

export default function SellerSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const minRatingParam = params.get('minRating') ?? params.get('rating') ?? '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const minRating = useMemo(() => {
    const parsed = Number(minRatingParam);
    return Number.isNaN(parsed) ? '' : Math.min(Math.max(parsed, 0), 5);
  }, [minRatingParam]);

  useEffect(() => {
    if (!q && minRating === '') {
      setResults([]);
      setError('Informe um nome de vendedor ou uma nota mínima para pesquisar.');
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    const searchParams = {};
    if (q) searchParams.q = q;
    if (minRating !== '') searchParams.minRating = minRating;
    searchParams.limit = 60;

    api
      .get('/users', { params: searchParams })
      .then((res) => {
        if (!active) return;
        if (res.data?.success) {
          setResults(Array.isArray(res.data.data) ? res.data.data : []);
        } else {
          setError(res.data?.message || 'Não foi possível buscar vendedores.');
          setResults([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setError('Não foi possível buscar vendedores.');
        setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, minRating]);

  const handleNewSearch = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextParams = new URLSearchParams();
    const name = form.get('sellerName')?.toString().trim() ?? '';
    const rating = form.get('sellerRating')?.toString().trim() ?? '';

    if (!name && !rating) {
      setError('Informe um nome ou uma nota mínima.');
      return;
    }

    if (name) nextParams.set('q', name);
    if (rating) nextParams.set('minRating', rating);

    navigate(`/sellers/search?${nextParams.toString()}`);
  };

  return (
    <section className="sellersearch-wrapper p-4 sm:p-6 max-w-4xl mx-auto">
      <CloseBackButton />
<header className="sellersearch-header bg-white/80 backdrop-blur-md border border-gray-100 shadow-md rounded-2xl p-5 mb-6 flex flex-col gap-4">

        <div>
        <h1 className="sellersearch-title text-lg font-bold text-gray-800">Buscar vendedores</h1>

        <p className="sellersearch-subtitle text-sm text-gray-500">

            {q ? `Termo: "${q}"` : 'Sem termo'}
            {minRating !== '' ? ` • Nota mínima: ${minRating.toFixed(1)}` : ''}
          </p>
        </div>

        <form className="sellersearch-form flex flex-col sm:flex-row gap-3" onSubmit={handleNewSearch}>

          <input
            name="sellerName"
            defaultValue={q}
            placeholder="Nome do vendedor"
            className="sellersearch-input flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-300 outline-none"

          />
          <select
            name="sellerRating"
            defaultValue={minRating !== '' ? minRating : ''}
            className="sellersearch-select border border-gray-300 rounded-xl px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-300 outline-none"

          >
            <option value="">Qualquer nota</option>
            <option value="5">5 estrelas</option>
            <option value="4.5">4.5 ou mais</option>
            <option value="4">4 ou mais</option>
            <option value="3">3 ou mais</option>
          </select>
          <button type="submit" className="sellersearch-submit bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:bg-blue-700 transition active:scale-[0.97]"
          >
            Pesquisar
          </button>
        </form>
      </header>

      {loading ? (
        <div className="sellersearch-message text-center py-6 text-gray-600">
Carregando vendedores...</div>
      ) : error ? (
        <div className="sellersearch-message sellersearch-error text-center py-6 text-red-600 font-medium">
{error}</div>
      ) : results.length === 0 ? (
        <div className="sellersearch-message">Nenhum vendedor encontrado.</div>
      ) : (
        <ul className="sellersearch-grid grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">

          {results.map((seller) => {
            const ratingValue = Number(seller.rating_avg ?? 0);
            const ratingCount = Number(seller.rating_count ?? 0);
            const { full, half, empty } = asStars(ratingValue);
            const avatar = seller.profile_image_url || '';
            const initials = getInitial(seller.username || seller.email);
            const location = [seller.city, seller.state, seller.country]
              .filter(Boolean)
              .join(', ');

            return (
              <li
              key={seller.id}
              className="sellersearch-card bg-white/80 backdrop-blur-md border border-gray-100 shadow-md rounded-2xl p-4 flex gap-4 hover:shadow-lg transition"
            >
            
                <Link to={`/users/${seller.id}`} className="sellersearch-card-avatar w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-gray-200 text-gray-600 font-semibold text-lg shadow-inner"
                >
                  {avatar ? (
                    <img src={avatar} alt={seller.username || 'Vendedor'} loading="lazy" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </Link>
                <div className="sellersearch-card-body">
                  <Link to={`/users/${seller.id}`} className="sellersearch-card-name text-sm font-semibold text-gray-800 hover:underline"
                  >
                    {seller.username || seller.email}
                  </Link>
                  <p className="sellersearch-card-location text-xs text-gray-500"
                  >
                    {location || 'Local não informado'}
                  </p>
                  <div className="sellersearch-card-rating flex items-center gap-2 mt-1"
                  >
                    <span className="sellersearch-stars text-yellow-500 text-sm"
                    >
                      {'★'.repeat(full)}
                      {half ? '☆' : ''}
                      {'✩'.repeat(empty)}
                    </span>
                    <span className="sellersearch-score text-xs text-gray-500"
                    >
                      {ratingValue.toFixed(1)} / 5 ({ratingCount})
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
