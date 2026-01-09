// frontend/src/pages/DashboardBoost.jsx
// Experiência “Impulsiona” com visual dark, pedras flutuantes e valores em destaque.
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import formatProductPrice, {
  convertCurrency,
  formatCurrency,
  resolveCurrencyFromCountry
} from '../utils/currency.js';
import { isProductFree } from '../utils/product.js';

const GEMSTONE_TIER = [
  {
    id: 1,
    name: 'Ruby',
    description: 'Produto no topo do feed, foco total na sua publicação.',
    price: 137.5,
    badge: 'Top do feed',
    image: '/pagamntoporgemas/ruby1.png',
    planKey: 'ruby'
  },
  {
    id: 2,
    name: 'Diamante',
    description: 'Impulso premium que destaca o anúncio nos primeiros cards.',
    price: 55,
    badge: 'Prioridade alta',
    image: '/pagamntoporgemas/diamante2.png',
    planKey: 'diamond'
  },
  {
    id: 3,
    name: 'Esmeralda',
    description: 'Visibilidade vibrante nas coleções mais procuradas.',
    price: 27.5,
    badge: 'Destaque verde',
    image: '/pagamntoporgemas/esmeralda3.png',
    planKey: 'esmerald'
  }
];

const PLAN_BASE_CURRENCY = 'BRL';

const CURRENCY_DISPLAY_NAMES = {
  BRL: 'Reais',
  USD: 'Dólares',
  EUR: 'Euros'
};

const BOOST_PLAN_LABELS = {
  ruby: 'Ruby',
  diamond: 'Diamante',
  esmerald: 'Esmeralda'
};

const normalizePlanKey = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

const floatingAnimationStyle = (delay = 0) => ({
  animation: `floatStone 6s ease-in-out ${delay}s infinite`
});

const FLOAT_ANIMATION_STYLES = `
@keyframes floatStone {
  0% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-16px) scale(1.03); }
  100% { transform: translateY(0) scale(1); }
}
`;

export default function DashboardBoost() {
  const { token } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingProductId, setCancellingProductId] = useState(null);
  const [confirmListCancelId, setConfirmListCancelId] = useState(null);

  const onlineProducts = useMemo(
    () => products.filter((product) => (product?.status || 'active') !== 'sold'),
    [products]
  );

  const fetchProducts = useCallback(
    async (signal = null) => {
      if (signal && signal.current === false) return;
      setLoading(true);
      try {
        const res = await api.get('/products/my', { headers: { Authorization: `Bearer ${token}` } });
        if (signal && signal.current === false) return;
        const items = Array.isArray(res.data?.data) ? res.data.data.slice() : [];
        setProducts(items);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao carregar seus anúncios.');
        setProducts([]);
      } finally {
        if (!signal || signal.current !== false) {
          setLoading(false);
        }
      }
    },
    [token]
  );

  const handleCancelBoostFromList = async (productId, label = 'Impulsionamento') => {
    if (!productId) return;
    setCancellingProductId(productId);
    setConfirmListCancelId(null);
    try {
      await api.post(`/products/${productId}/ranking/cancel`);
      toast.success(`${label} cancelado.`);
      fetchProducts();
    } catch (err) {
      const message =
        err?.response?.data?.message || 'Não foi possível cancelar o impulsionamento.';
      toast.error(message);
    } finally {
      setCancellingProductId(null);
    }
  };

  useEffect(() => {
    const signal = { current: true };
    fetchProducts(signal);
    return () => {
      signal.current = false;
    };
  }, [fetchProducts]);

  if (loading) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-center text-gray-500 text-sm tracking-[0.25em] uppercase">
          Carregando seus anúncios...
        </p>
      </section>
    );
  }

  if (!products.length) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-black">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-black p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.9)]">
          <h1 className="text-2xl font-semibold mb-2 text-white">Impulsiona</h1>
          <p className="text-gray-400 text-sm">
            Você ainda não publicou produtos. Publique seu primeiro anúncio para liberar os impulsos
            visuais do TempleSale.
          </p>
        </div>
      </section>
    );
  }

  if (!onlineProducts.length) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-black">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-black p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.9)]">
          <h1 className="text-2xl font-semibold mb-2 text-white">Impulsiona</h1>
          <p className="text-gray-400 text-sm">
            Nenhum anúncio online disponível no momento. Ative seus anúncios para poder impulsionar.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <style>{FLOAT_ANIMATION_STYLES}</style>
      <section
        className="dashboard-boost min-h-screen px-4 py-10 text-slate-50 relative overflow-hidden"
        style={{
          background: '#000000'
        }}
      >
        {/* Glow de fundo */}
        <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen">
          <div className="absolute -top-40 -left-32 w-72 h-72 bg-pink-900/25 blur-3xl rounded-full" />
          <div className="absolute -top-24 right-0 w-80 h-80 bg-sky-900/25 blur-3xl rounded-full" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full" />
        </div>

        <div className="relative mx-auto max-w-6xl space-y-8 rounded-[32px] bg-black/75 p-6 md:p-8 backdrop-blur-3xl border border-white/100 shadow-[0_40px_120px_rgba(0,0,0,0.9)]">
          {/* Cabeçalho */}
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                TempleSale • Impulsiona
              </p>
              <h1 className="mt-1 text-3xl md:text-4xl font-semibold">
                Aumente o brilho dos seus anúncios
              </h1>
              <p className="mt-2 text-xs md:text-sm text-slate-400 max-w-xl">
                Somente anúncios online aparecem aqui. Escolha qual produto receberá mais foco no
                feed da TempleSale.
              </p>
            </div>
            <div className="inline-flex items-center gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-xs md:text-sm">
              <div className="flex flex-col">
                <span className="text-slate-400 uppercase tracking-[0.25em] text-[10px]">
                  Ativos
                </span>
                <span className="text-lg font-semibold">
                  {onlineProducts.length.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="h-10 w-px bg-slate-700/80" />
              <div className="flex flex-col">
                <span className="text-slate-400 uppercase tracking-[0.25em] text-[10px]">
                  Total
                </span>
                <span className="text-lg font-semibold">
                  {products.length.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </header>

          {/* Lista de produtos online */}
          <div
  className="space-y-5 rounded-3xl overflow-hidden"
  style={{
    backgroundImage:
      'url(https://i.pinimg.com/1200x/4f/ab/61/4fab61aa5d25ad137acf361bd5a88fe3.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '30px 20px'
  }}
>

            {onlineProducts.map((product) => {
              const mainImage = product.image_urls?.[0] || product.image_url;
              const priceLabel = isProductFree(product)
                ? 'Grátis'
                : formatProductPrice(product.price, product.country);
              const planKey = normalizePlanKey(product.manual_rank_plan);
              const planLabel = BOOST_PLAN_LABELS[planKey] || planKey;
              const isAlreadyBoosted = Boolean(product.manual_rank_plan);
              const cancelingThis = cancellingProductId === product.id;
              const confirmingCancel = confirmListCancelId === product.id;

            return (
              <article
                key={product.id}
                  className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_35px_90px_rgba(0,0,0,0.9)]"
                  style={{
                    backgroundImage:
                      'url(https://i.pinimg.com/1200x/4f/ab/61/4fab61aa5d25ad137acf361bd5a88fe3.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                    >
                  {/* Auras / brilhos */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(circle at 0% 0%, rgba(248,113,113,0.25), transparent 55%), radial-gradient(circle at 100% 0%, rgba(59,130,246,0.25), transparent 55%)',
                      mixBlendMode: 'screen'
                    }}
                  />

                  <div className="relative z-10 flex flex-col gap-6 p-5 md:p-6 lg:p-7 md:flex-row md:items-center">
                    {/* Imagem / Pedra flutuante */}
                    <div
                      className="w-28 h-28 md:w-32 md:h-32 rounded-3xl border border-white/15 bg-slate-950/80 shadow-[0_24px_70px_rgba(15,23,42,0.95)] relative z-20 overflow-hidden"
                      style={floatingAnimationStyle(product.id * 0.17)}
                    >
                      {mainImage ? (
                        <img
                          src={mainImage}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                          Sem imagem
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-transparent to-transparent mix-blend-screen pointer-events-none" />
                    </div>

                    {/* Conteúdo principal */}
                    <div className="flex-1 flex flex-col gap-3 text-slate-50 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="min-w-0">
                          <h2 className="text-lg md:text-2xl font-semibold truncate">
                            {product.title}
                          </h2>
                          <p className="text-xs md:text-sm text-slate-400">
                            {product.category || 'Categoria não informada'}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full border border-emerald-400/50 bg-emerald-500/10 text-[10px] md:text-[11px] text-emerald-200 uppercase tracking-[0.32em]">
                          Online
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] md:text-xs text-slate-400">
                        {product.city && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 border border-slate-700/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {product.city}
                          </span>
                        )}
                        {product.state && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 border border-slate-800/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            {product.state}
                          </span>
                        )}
                        {product.country && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 border border-slate-800/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-900" />
                            {product.country}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <Link
                          to={`/edit-product/${product.id}`}
                          className="inline-flex items-center gap-1 text-slate-300 hover:text-white underline-offset-4 hover:underline"
                        >
                          Editar anúncio
                        </Link>
                      </div>
                    </div>

                    {/* Painel de preço / CTA */}
                    <div className="flex flex-col items-end gap-2 text-right min-w-[160px]">
                      <span className="text-[10px] tracking-[0.35em] text-slate-500 uppercase">
                        Valor atual
                      </span>
                      <p className="text-2xl md:text-3xl font-bold text-amber-200 drop-shadow-[0_0_25px_rgba(251,191,36,0.25)]">
                        {priceLabel}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Impulsione este anúncio para subir no ranking do feed.
                      </p>
                      {isAlreadyBoosted ? (
                        <>
                          <button
                            type="button"
                            disabled
                            className="mt-1 inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-slate-800 text-[11px] md:text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 border border-slate-700 cursor-not-allowed"
                          >
                            Impulsionado ({planLabel})
                          </button>
                          {confirmingCancel ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleCancelBoostFromList(product.id, planLabel)}
                                disabled={cancelingThis}
                                className="flex-1 rounded-full border border-rose-400/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white bg-rose-500/90 hover:bg-rose-400 transition disabled:cursor-wait disabled:opacity-60"
                              >
                                {cancelingThis ? 'Cancelando...' : 'Confirmar cancelamento'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmListCancelId(null)}
                                className="flex-1 rounded-full border border-slate-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 hover:border-slate-400 transition"
                              >
                                Voltar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmListCancelId(product.id)}
                              className="mt-2 w-full rounded-full border border-white/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-rose-300 hover:border-rose-300 transition"
                            >
                              Cancelar impulsionamento {planLabel}
                            </button>
                          )}
                        </>
                      ) : (
                        <Link
                          to={`/dashboard/impulsiona/${product.id}`}
                          state={{ product }}
                          className="mt-1 inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-[11px] md:text-xs font-semibold uppercase tracking-[0.28em] shadow-[0_18px_55px_rgba(236,72,153,0.6)] transition hover:opacity-95 active:translate-y-[1px]"
                        >
                          Impulsionar agora
                        </Link>
                      )}
                      {isAlreadyBoosted && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Esse anúncio já está impulsionado (plano {planLabel}). Ajustes ficam no ranking manual.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

export function DashboardBoostPlan() {
  const { productId } = useParams();
  const location = useLocation();
  const { token } = useContext(AuthContext);
  const [product, setProduct] = useState(location.state?.product ?? null);
  const [loading, setLoading] = useState(!product);
  const [confirmPlanCancel, setConfirmPlanCancel] = useState(false);
  const [cancelingBoost, setCancelingBoost] = useState(false);
  const [boostingTierId, setBoostingTierId] = useState(null);

  useEffect(() => {
    if (product) return;
    let active = true;
    setLoading(true);
    api
      .get(`/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;
        const fetched = res.data?.data || null;
        setProduct(fetched);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        toast.error('Não foi possível carregar o anúncio.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId, product, token]);

  const productCurrency = product?.country
    ? resolveCurrencyFromCountry(product.country)
    : 'BRL';
  const currencyDisplayName =
    CURRENCY_DISPLAY_NAMES[productCurrency] || productCurrency;
  const productPlanKey = normalizePlanKey(product?.manual_rank_plan);
  const productPlanLabel = BOOST_PLAN_LABELS[productPlanKey] || productPlanKey || 'impulsionamento';
  const productIsBoostActive = Boolean(product?.manual_rank_plan);

  const handleTierSelect = async (tier, priceLabel) => {
    if (!product || boostingTierId) return;
    if (productIsBoostActive) {
      toast.error(
        `Este anúncio já está impulsionado com o plano ${productPlanLabel}. Cancele o boost antes de mudar.`
      );
      return;
    }
    setBoostingTierId(tier.id);
    try {
      await api.post(`/products/${product.id}/ranking/boost`, {
        tier: tier.planKey
      });
      toast.success(
        `Impulsionando "${product.title}" com o plano ${tier.name} por ${priceLabel}.`
      );
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        'Não foi possível impulsionar este anúncio agora.';
      toast.error(message);
    } finally {
      setBoostingTierId(null);
    }
  };

  const handleCancelBoostFromPlan = async () => {
    if (!product) return;
    setCancelingBoost(true);
    try {
      await api.post(`/products/${product.id}/ranking/cancel`);
      toast.success('Impulsionamento cancelado.');
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              manual_rank_active: false,
              manual_rank_plan: null,
              manual_rank_position: null,
              manual_rank_started_at: null,
              manual_rank_expires_at: null,
              manual_rank_remaining_ms: 0
            }
          : prev
      );
    } catch (err) {
      const message =
        err?.response?.data?.message || 'Não foi possível cancelar o impulsionamento.';
      toast.error(message);
    } finally {
      setCancelingBoost(false);
      setConfirmPlanCancel(false);
    }
  };

  if (loading || !product) {
    return (
      <section className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-sm tracking-[0.25em] uppercase">
          Carregando anúncio selecionado...
        </p>
      </section>
    );
  }

  const priceLabel = isProductFree(product)
    ? 'Grátis'
    : formatProductPrice(product.price, product.country, {
        overrideCurrency: productCurrency
      });

  return (
    <section
  className="min-h-screen text-slate-50 px-4 py-8 relative overflow-hidden"
  style={{
    backgroundImage: 'url(https://i.pinimg.com/1200x/4f/ab/61/4fab61aa5d25ad137acf361bd5a88fe3.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  }}
>

      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen">
        <div className="absolute -top-24 left-10 w-72 h-72 bg-sky-500/30 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/20 blur-3xl rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto space-y-7 relative z-10">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">
              TempleSale • Impulsiona
            </p>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold">{product.title}</h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              {product.category || 'Categoria não informada'}
            </p>
          </div>
          <Link
            to="/dashboard/impulsiona"
            className="text-[11px] md:text-xs uppercase tracking-[0.3em] text-slate-300 hover:text-white border border-slate-600 rounded-full px-4 py-2 bg-slate-900/60 backdrop-blur"
          >
            Voltar ao Impulsiona
          </Link>
        </div>

        {/* Card principal do produto */}
        <article className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-5 md:p-6 shadow-[0_32px_90px_rgba(0,0,0,0.95)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div
              className="w-full md:w-48 h-48 rounded-3xl border border-white/15 overflow-hidden shadow-[0_28px_80px_rgba(0,0,0,0.95)] bg-slate-950/80"
              style={floatingAnimationStyle(0.3)}
            >
              {product.image_urls?.[0] || product.image_url ? (
                <img
                  src={product.image_urls?.[0] || product.image_url}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                  Sem imagem
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                  Valor atual
                </p>
                <p className="mt-1 text-3xl md:text-4xl font-bold text-amber-300 drop-shadow-[0_0_25px_rgba(251,191,36,0.35)]">
                  {priceLabel}
                </p>
              </div>
              <p className="text-xs md:text-sm text-slate-400 max-w-xl">
                Escolha um plano de gema para destacar seu anúncio por tempo limitado nos feeds
                mais disputados do TempleSale.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                {product.city && (
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70">
                    {product.city}
                  </span>
                )}
                {product.state && (
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70">
                    {product.state}
                  </span>
                )}
                {product.country && (
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70">
                    {product.country}
                  </span>
                )}
              </div>
            </div>
          </div>
        </article>

        {productIsBoostActive && (
          <div className="rounded-[28px] border border-rose-500/30 bg-rose-900/20 p-4 text-sm text-rose-100 shadow-[0_18px_55px_rgba(244,63,94,0.35)]">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-[0.4em] text-rose-200">Impulsionamento ativo</p>
              <p className="text-base font-semibold">
                Plano {productPlanLabel} definido até{' '}
                {product?.manual_rank_expires_at ? formatDate(product.manual_rank_expires_at) : '—'}.
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-rose-100/80">
                Apenas o cancelamento libera novas escolhas de gema. Isso mantém o topo intacto.
              </p>
              {confirmPlanCancel ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCancelBoostFromPlan}
                    disabled={cancelingBoost}
                    className="flex-1 rounded-full border border-rose-400/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white bg-rose-500/90 hover:bg-rose-400 transition disabled:cursor-wait disabled:opacity-70"
                  >
                    {cancelingBoost ? 'Cancelando...' : 'Confirmar cancelamento'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPlanCancel(false)}
                    className="flex-1 rounded-full border border-slate-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-100 hover:border-slate-400 transition"
                  >
                    Manter plano
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPlanCancel(true)}
                  disabled={cancelingBoost}
                  className="self-start rounded-full bg-rose-500/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white shadow-[0_12px_40px_rgba(248,113,113,0.45)] transition disabled:cursor-wait disabled:opacity-70"
                >
                  {cancelingBoost ? 'Cancelando...' : 'Cancelar impulsionamento'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Planos de gemas */}
        <div
          className="space-y-4 relative rounded-3xl overflow-hidden"
          style={{
            backgroundImage:
              'url(https://i.pinimg.com/1200x/4f/ab/61/4fab61aa5d25ad137acf361bd5a88fe3.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            padding: '40px 20px'
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">
            Valores exibidos em {currencyDisplayName}
          </p>

          {GEMSTONE_TIER.map((tier, index) => {
            const tierPriceInCurrency = convertCurrency(
              tier.price,
              PLAN_BASE_CURRENCY,
              productCurrency
            );
            const tierPriceLabel = formatCurrency(tierPriceInCurrency, productCurrency);

            return (
              <article
                key={tier.id}
                className="flex flex-col gap-4 rounded-3xl border border-white/12 bg-slate-950/90 p-5 md:p-6 backdrop-blur shadow-[0_26px_80px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">
                      {tier.badge}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <h3 className="text-xl md:text-2xl font-semibold">{tier.name}</h3>
                      {tier.image && (
                        <div
                          className="w-8 h-8 md:w-10 md:h-10 rounded-2xl border border-white/15 overflow-hidden bg-slate-900/90"
                          style={floatingAnimationStyle(0.2 + index * 0.3)}
                        >
                          <img
                            src={tier.image}
                            alt={tier.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-4xl md:text-5xl font-bold text-emerald-300 drop-shadow-[0_0_25px_rgba(16,185,129,0.45)]">
                    {tierPriceLabel}
                  </span>
                </div>

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">{tier.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {tier.id === 1 && 'Máximo destaque imediato, ideal para produtos muito disputados.'}
                      {tier.id === 2 && 'Impulso de alta prioridade, perfeito para subir rapidamente no topo.'}
                      {tier.id === 3 && 'Visibilidade vibrante e contínua nas buscas mais competitivas.'}
                    </p>
                    <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
                      {tier.id === 1 && (
                        <>
                          <li>• Prioridade máxima no topo do feed por um 45 dias!</li>
                          <li>• Maior taxa de cliques e visualizações</li>
                          <li>• Ideal para anúncios de alta competição</li>
                        </>
                      )}

                      {tier.id === 2 && (
                        <>
                          <li>• Destaque premium nos primeiros cards por 15 dias</li>
                          <li>• Forte visibilidade em pesquisas</li>
                          <li>• Excelente custo-benefício</li>
                        </>
                      )}

                      {tier.id === 3 && (
                        <>
                          <li>• Mais visibilidade contínua por 5 dias</li>
                          <li>• Indicado para anúncios novos ou medianos</li>
                          <li>• Perfeito para coleções mais buscadas</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="md:w-48 md:flex md:flex-col md:items-end">
                    <button
                      type="button"
                      onClick={() => handleTierSelect(tier, tierPriceLabel)}
                      disabled={boostingTierId === tier.id || productIsBoostActive}
                      className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-orange-500 to-amber-400 px-4 py-3 text-[11px] md:text-xs font-semibold uppercase tracking-[0.35em] shadow-[0_24px_55px_rgba(236,72,153,0.55)] transition hover:opacity-95 active:translate-y-[1px] disabled:cursor-wait disabled:opacity-80"
                    >
                      {boostingTierId === tier.id
                        ? 'Impulsionando...'
                        : productIsBoostActive
                        ? 'Impulsionamento ativo'
                        : `Impulsionar com ${tier.name}`}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
