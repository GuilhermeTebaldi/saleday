// frontend/src/pages/admin/AdminProducts.jsx
// Tela administrativa para monitorar e moderar produtos.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/api.js';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(10);
  const [mode, setMode] = useState('topClicked'); // 'topClicked' | 'ranking'
  const [country, setCountry] = useState('BR');
  const [countries, setCountries] = useState([]);
  const [processingIds, setProcessingIds] = useState({});

  useEffect(() => {
    loadProducts(limit, mode);
  }, [limit, mode]);

  useEffect(() => {
    if (mode === 'ranking') {
      loadProducts(limit, 'ranking', country);
    }
  }, [country, mode]);

  useEffect(() => {
    loadCountries();
  }, []);

  async function loadProducts(currentLimit = 10, currentMode = mode, currentCountry = country) {
    setLoading(true);
    try {
      const endpoint =
        currentMode === 'ranking'
          ? `/admin/products/ranking?limit=${currentLimit}${
              currentCountry ? `&country=${encodeURIComponent(currentCountry)}` : ''
            }`
          : `/admin/products/top-clicked?limit=${currentLimit}`;
      const { data } = await api.get(endpoint);
      const list = Array.isArray(data?.data) ? data.data.slice() : [];
      setProducts(list);
    } catch (err) {
      console.error('admin.products load error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }

  async function loadCountries() {
    try {
      const { data } = await api.get('/products/countries');
      const list = Array.isArray(data?.data) ? data.data : [];
      setCountries(list);
      if (!country && list.length) {
        setCountry(list[0].country);
      }
    } catch (err) {
      console.error('admin.products countries error:', err);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Excluir definitivamente "${product.title}"?`)) {
      return;
    }
    setProcessingIds((state) => ({ ...state, [product.id]: true }));
    try {
      await api.delete(`/admin/products/${product.id}`);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      toast.success('Produto excluído.');
    } catch (err) {
      console.error('admin.products delete error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao excluir produto');
    } finally {
      setProcessingIds((state) => {
        const { [product.id]: _ignore, ...rest } = state;
        return rest;
      });
    }
  }

  const isRankingMode = mode === 'ranking';
  const overview = useMemo(() => {
    if (!products.length) {
      return { total: 0, active: 0, pending: 0, avgClicks: 0 };
    }
    const total = products.length;
    const active = products.filter((p) => (p.status ?? 'active') === 'active').length;
    const pending = products.filter((p) => p.status === 'pending').length;
    const avgClicks =
      products.reduce((acc, item) => acc + (item.clicks_count ?? item.view_count ?? 0), 0) / total;
    return { total, active, pending, avgClicks: Math.round(avgClicks) };
  }, [products]);

  return (
    <div className="space-y-6 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 p-6 shadow-2xl shadow-black/40">
        <div className="absolute inset-0 opacity-40 mix-blend-screen">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/40 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-cyan-400/30 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Painel de Produtos</p>
            <h1 className="text-3xl font-semibold leading-tight">Moderador com visão panorâmica</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/80">
              Compare desempenho, ajuste critérios e publique decisões rápido. O quadro combina ranking inteligente,
              engajamento e status em um layout único.
            </p>
            {isRankingMode && (
              <p className="mt-1 text-[11px] text-slate-300">
                País selecionado: <span className="font-semibold text-white">{country || '—'}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
            <div className="inline-flex rounded-full border border-white/15 bg-black/30 p-1 text-xs font-semibold shadow-inner shadow-black/30">
              <TogglePill active={mode === 'topClicked'} onClick={() => setMode('topClicked')} label="Mais clicados" />
              <TogglePill active={mode === 'ranking'} onClick={() => setMode('ranking')} label="Ranking inteligente" />
            </div>
            {isRankingMode && (
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-2xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-semibold focus:border-white/50"
              >
                {countries.length === 0 && <option value="">Todos os países</option>}
                {countries.map((c) => (
                  <option key={c.country} value={c.country} className="bg-slate-900 text-sm">
                    {c.country} ({c.total})
                  </option>
                ))}
              </select>
            )}
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-2xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-semibold focus:border-white/50"
            >
              {[5, 10, 20, 50].map((value) => (
                <option key={value} value={value} className="bg-slate-900 text-sm">
                  {value} itens
                </option>
              ))}
            </select>
            <button
              onClick={() => loadProducts(limit, mode)}
              className="rounded-2xl border border-indigo-300/40 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:-translate-y-[1px] hover:border-indigo-200/70 hover:bg-indigo-500/30"
            >
              Atualizar
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3 grid gap-4 md:grid-cols-4">
          <ProductStat label="Itens monitorados" value={overview.total} detail="inventário ativo" accent="from-white/20 via-white/10 to-indigo-200/40" />
          <ProductStat label="Ativos" value={overview.active} detail="+8 esta semana" accent="from-emerald-300/30 to-emerald-500/60" />
          <ProductStat label="Pendentes" value={overview.pending} detail="aguardando revisão" accent="from-amber-200/40 to-rose-400/60" />
          <ProductStat label="Média de cliques" value={overview.avgClicks} detail="por anúncio" accent="from-sky-200/30 to-indigo-500/60" />
        </div>

        <div className="xl:col-span-2 grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Coleção ativa</p>
              <p className="text-lg font-semibold">
                {isRankingMode ? 'Ranking ponderado' : 'Top absoluto de cliques'}
              </p>
              <p className="text-xs text-slate-400">
                {isRankingMode ? 'Score balanceado por engajamento recente' : 'Volume bruto de interações'}
              </p>
            </div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              {products.length} itens exibidos
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 md:grid-cols-4">
            <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              Último refresh <strong className="block text-white">agora</strong>
            </span>
            <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              Limite <strong className="block text-white">{limit} itens</strong>
            </span>
            <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              País <strong className="block text-white">{isRankingMode ? country || 'Todos' : 'N/D'}</strong>
            </span>
            <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              Visão <strong className="block text-white">{isRankingMode ? 'Dinâmica' : 'Popularidade'}</strong>
            </span>
          </div>
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-slate-300">Carregando produtos...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum dado disponível.</p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.7)]">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 text-xs uppercase tracking-[0.2em] text-slate-400">
            <span>Mapa de desempenho</span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-indigo-100">
              {isRankingMode ? 'Engajamento + Score' : 'Cliques absolutos'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead className="bg-gradient-to-r from-white/5 via-white/5 to-transparent text-left text-[11px] uppercase tracking-[0.2em] text-slate-400 backdrop-blur">
                <tr>
                  <th className="px-4 py-3 w-16">#</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Vendedor</th>
                  {isRankingMode && <th className="px-4 py-3">Score</th>}
                  <th className="px-4 py-3">Cliques / Views</th>
                  {isRankingMode && <th className="px-4 py-3">Favoritos</th>}
                  {isRankingMode && <th className="px-4 py-3">Avaliação</th>}
                  {isRankingMode && <th className="px-4 py-3">Freshness</th>}
                  {isRankingMode && <th className="px-4 py-3">Cliques Rec.</th>}
                  {isRankingMode && <th className="px-4 py-3">Views Rec.</th>}
                  {isRankingMode && <th className="px-4 py-3">Atividade Vendedor</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.map((product, index) => {
                  const busy = Boolean(processingIds[product.id]);
                  const clicks = product.clicks_count ?? product.view_count ?? 0;
                  const views = product.views_count ?? product.view_count ?? 0;
                  const favorites =
                    product.likes ?? product.likes_count ?? product.favorites_count ?? 0;
                  const score = typeof product.score === 'number' ? product.score : null;
                  const sellerRating =
                    typeof product.seller_rating_avg === 'number' ? product.seller_rating_avg : null;
                  const sellerRatingCount = product.seller_rating_count ?? product.rating_count ?? 0;
                  const position = product.rank_position ?? product.position ?? index + 1;
                  const engagement = isRankingMode ? computeEngagement(product) : null;
                  return (
                    <tr key={product.id} className="bg-white/5 hover:bg-white/10 transition-colors">
                      <td className="px-4 py-4 text-xs font-semibold text-slate-500">
                        {String(position).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{product.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {product.created_at ? formatDate(product.created_at) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="font-medium text-slate-100">{product.seller_name || '—'}</div>
                        {product.seller_email && (
                          <a
                            href={`mailto:${product.seller_email}`}
                            className="text-[11px] text-indigo-300 underline"
                          >
                            {product.seller_email}
                          </a>
                        )}
                      </td>
                      {isRankingMode && (
                        <td className="px-4 py-4 text-sm font-semibold text-emerald-300">
                          {score !== null ? score.toFixed(3) : '—'}
                        </td>
                      )}
                      <td className="px-4 py-4 text-sm font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{clicks}</span>
                          <span className="rounded-full bg-indigo-400/15 px-2 py-[2px] text-[11px] text-indigo-100">
                            Views {views}
                          </span>
                        </div>
                      </td>
                      {isRankingMode && (
                        <td className="px-4 py-4 text-sm font-medium text-slate-200">{favorites}</td>
                      )}
                      {isRankingMode && (
                        <td className="px-4 py-4 text-xs text-slate-300">
                          {sellerRating !== null ? `${sellerRating.toFixed(2)} (${sellerRatingCount})` : '—'}
                        </td>
                      )}
                      {isRankingMode && engagement && (
                        <td className="px-4 py-4 text-[11px] text-slate-200">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-emerald-200">
                              {engagement.freshnessDays !== null ? `${engagement.freshnessDays}d` : '—'}
                            </div>
                            <div className="text-[11px] text-slate-400">Fator {formatFloat(engagement.freshness)}</div>
                          </div>
                        </td>
                      )}
                      {isRankingMode && engagement && (
                        <td className="px-4 py-4 text-[11px] text-slate-200">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-amber-200">
                              {engagement.lastClickDays !== null ? `${engagement.lastClickDays}d` : 'nunca'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Penalidade {formatFloat(engagement.recentClickFactor)}
                            </div>
                          </div>
                        </td>
                      )}
                      {isRankingMode && engagement && (
                        <td className="px-4 py-4 text-[11px] text-slate-200">
                          {engagement.lastViewDays !== null ? `${engagement.lastViewDays}d` : 'nunca'}
                        </td>
                      )}
                      {isRankingMode && engagement && (
                        <td className="px-4 py-4 text-[11px] text-slate-200">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-indigo-100">
                              Posts/mês {formatFloat(engagement.postsPerMonth)}
                            </div>
                            <div className="text-[11px] text-slate-400">Ativo {engagement.activeDays}d</div>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-4 text-xs uppercase">
                        <StatusPill status={product.status || '—'} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => deleteProduct(product)}
                          disabled={busy}
                          className="rounded-2xl border border-red-400/60 px-4 py-2 text-xs font-semibold text-red-200 transition hover:-translate-y-[1px] hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? 'Processando...' : 'Excluir'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductStat({ label, value, detail, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/40">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-30 blur-2xl`} />
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {detail && <p className="text-xs text-slate-300">{detail}</p>}
    </div>
  );
}

function TogglePill({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1 transition ${
        active ? 'bg-white text-slate-900 shadow' : 'text-white/70 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({ status }) {
  const normalized = (status || '').toLowerCase();
  const map = {
    active: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
    pending: 'bg-amber-400/20 text-amber-100 border border-amber-300/40',
    sold: 'bg-slate-500/30 text-slate-200 border border-slate-400/40'
  };
  const classes = map[normalized] || 'bg-white/10 text-white border border-white/10';
  return <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${classes}`}>{status}</span>;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function daysSince(date) {
  if (!date) return null;
  const ts = new Date(date).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function computeEngagement(product) {
  const createdDays = daysSince(product.created_at);
  const freshness = createdDays !== null ? Math.max(0, 1 - createdDays / 15) : 0;

  const lastClickSource =
    product.last_clicked_at ||
    null;
  const lastClickDays = daysSince(lastClickSource);
  const staleDays =
    lastClickDays === null ? null : Math.max(0, lastClickDays - 5);
  const recentClickFactor =
    staleDays === null ? 0 : Math.max(0, 1 - staleDays / 5);

  const lastViewDays = daysSince(product.last_viewed_at || null);

  const postsPerMonth = Number(product.seller_posts_per_month ?? 0) || 0;
  const activeDays = Number(product.seller_active_days ?? 0) || 0;

  return {
    freshness,
    freshnessDays: createdDays !== null ? createdDays : null,
    lastClickDays: lastClickDays !== null ? lastClickDays : null,
    recentClickFactor,
    lastViewDays: lastViewDays !== null ? lastViewDays : null,
    postsPerMonth,
    activeDays
  };
}

function formatFloat(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(digits);
}
