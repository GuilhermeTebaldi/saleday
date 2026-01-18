// frontend/src/pages/admin/AdminRanking.jsx
// Painel dedicado para ranking manual com duração, filtrado por país.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/api.js';
import LoadingBar from '../../components/LoadingBar.jsx';

const DEFAULT_COUNTRY = '';
const LIMIT = 120;

const BOOST_PLAN_BADGES = {
  ruby: { label: 'Ruby', accent: 'from-pink-500 via-fuchsia-500 to-amber-400' },
  diamond: { label: 'Diamante', accent: 'from-sky-500 via-cyan-500 to-amber-400' },
  esmerald: { label: 'Esmeralda', accent: 'from-emerald-400 via-emerald-500 to-amber-300' }
};

const ADMIN_BOOST_PLANS = [
  { key: 'ruby', label: 'Ruby (45 dias)', description: 'Top do feed por 45 dias' },
  { key: 'diamond', label: 'Diamante (15 dias)', description: 'Prioridade alta por 15 dias' },
  { key: 'esmerald', label: 'Esmeralda (5 dias)', description: 'Visibilidade vibrante por 5 dias' }
];

const normalizePlanKey = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

export default function AdminRanking() {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [countries, setCountries] = useState([]);
  const [products, setProducts] = useState([]);
  const [manualBoard, setManualBoard] = useState([]);
  const [manualDurations, setManualDurations] = useState({});
  const [manualSelection, setManualSelection] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchSeller, setSearchSeller] = useState('');
  const [positionInput, setPositionInput] = useState({});
  const [loading, setLoading] = useState(true);
  const rankingContainerRef = useRef(null);
  const scrollSnapshotRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [resetOthers, setResetOthers] = useState(true);
  const [planSelection, setPlanSelection] = useState({});
  const [adminBoostLoadingId, setAdminBoostLoadingId] = useState(null);
  const [adminCancelLoadingId, setAdminCancelLoadingId] = useState(null);
  const [confirmAdminCancelId, setConfirmAdminCancelId] = useState(null);
  const [countriesReady, setCountriesReady] = useState(false);
  const autoRefreshRef = useRef(true);
  const autoRefreshTimerRef = useRef(null);

  const loadCountries = useCallback(async () => {
    try {
      const { data } = await api.get('/products/countries');
      const list = Array.isArray(data?.data) ? data.data : [];
      setCountries(list);
      if (!list.length) {
        setCountriesReady(true);
        return;
      }
      setCountry((prev) => prev || list[0].country || DEFAULT_COUNTRY);
      setCountriesReady(true);
    } catch (err) {
      console.error('admin.ranking countries error:', err);
      toast.error('Não foi possível carregar a lista de países.');
    }
  }, []);

  const loadRanking = useCallback(
    async (selectedCountry, { disableLoading = false } = {}) => {
      const previousScroll = rankingContainerRef.current?.scrollTop ?? 0;
      scrollSnapshotRef.current = previousScroll;
      if (!disableLoading) {
        setLoading(true);
      }
      try {
        const query = selectedCountry ? `&country=${encodeURIComponent(selectedCountry)}` : '';
        const { data } = await api.get(`/admin/products/ranking?limit=${LIMIT}${query}`);
        const list = Array.isArray(data?.data) ? data.data.slice() : [];
        setProducts(list);
        setManualBoard(list);
        const durations = {};
        const selection = {};
        const positions = {};
        list.forEach((p, idx) => {
          durations[p.id] = deriveDurationFromProduct(p);
          selection[p.id] = Boolean(p.manual_rank_position);
          positions[p.id] = idx + 1;
        });
        setManualDurations(durations);
        setManualSelection(selection);
        setPositionInput(positions);
        setExpandedId(null);
        window.requestAnimationFrame(() => {
          if (rankingContainerRef.current) {
            rankingContainerRef.current.scrollTop = scrollSnapshotRef.current;
          }
        });
      } catch (err) {
        console.error('admin.ranking load error:', err);
        toast.error(err?.response?.data?.message ?? 'Erro ao carregar ranking.');
      } finally {
        if (!disableLoading) {
          setLoading(false);
        }
      }
    },
    []
  );

  const pauseAutoRefresh = useCallback(() => {
    autoRefreshRef.current = false;
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
    }
    autoRefreshTimerRef.current = setTimeout(() => {
      autoRefreshRef.current = true;
      loadRanking(country, { disableLoading: true });
    }, 20000);
  }, [country, loadRanking]);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    if (!countriesReady) return;
    loadRanking(country);
  }, [country, loadRanking, countriesReady]);

  useEffect(() => {
    if (!countriesReady) return undefined;
    const interval = setInterval(() => {
      if (autoRefreshRef.current) {
        loadRanking(country, { disableLoading: true });
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [country, loadRanking, countriesReady]);

  useEffect(
    () => () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
      }
    },
    []
  );

  function handleDurationChange(productId, field, nextValue) {
    pauseAutoRefresh();
    setManualDurations((prev) => {
      const current = prev[productId] || { days: 0, hours: 1, minutes: 0 };
      const safeValue = Math.max(0, Math.floor(Number(nextValue) || 0));
      return { ...prev, [productId]: { ...current, [field]: safeValue } };
    });
  }

  function toggleSelection(productId) {
    pauseAutoRefresh();
    setManualSelection((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  function moveItem(productId, direction) {
    pauseAutoRefresh();
    setManualBoard((prev) => moveByDelta(prev, productId, direction));
  }

  function moveItemToPosition(productId, target) {
    pauseAutoRefresh();
    setManualBoard((prev) => moveToPosition(prev, productId, target));
  }

  function handlePositionChange(productId, value) {
    pauseAutoRefresh();
    setPositionInput((prev) => ({ ...prev, [productId]: value }));
  }

  async function disableManual(product) {
    try {
      await api.patch(`/admin/products/${product.id}/ranking/manual/disable`);
      toast.success(`Desabilitado para "${product.title}".`);
      await loadRanking(country);
    } catch (err) {
      console.error('admin.ranking disable error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao desabilitar.');
    }
  }

  const handlePlanSelectionChange = useCallback(
    (productId, planKey) => {
      pauseAutoRefresh();
      setPlanSelection((prev) => ({ ...prev, [productId]: planKey }));
    },
    [pauseAutoRefresh]
  );

  const handleAdminBoost = useCallback(
    async (product, planKey) => {
      pauseAutoRefresh();
      if (!product || !planKey) return;
      setAdminBoostLoadingId(product.id);
      try {
        await api.post(`/admin/products/${product.id}/ranking/boost`, { plan: planKey });
        toast.success(`Produto impulsionado com o plano ${planKey}.`);
        setPlanSelection((prev) => ({ ...prev, [product.id]: planKey }));
        await loadRanking(country);
      } catch (err) {
        console.error('admin.boost error:', err);
        toast.error(err?.response?.data?.message || 'Erro ao impulsionar produto.');
      } finally {
        setAdminBoostLoadingId(null);
      }
    },
    [country, loadRanking, pauseAutoRefresh]
  );

  const handleAdminCancel = useCallback(
    async (product) => {
      pauseAutoRefresh();
      if (!product) return;
      setAdminCancelLoadingId(product.id);
      try {
        await api.post(`/admin/products/${product.id}/ranking/cancel`);
        toast.success('Impulsionamento cancelado.');
        setConfirmAdminCancelId(null);
        await loadRanking(country);
      } catch (err) {
        console.error('admin.cancel error:', err);
        toast.error(err?.response?.data?.message || 'Erro ao cancelar impulsionamento.');
      } finally {
        setAdminCancelLoadingId(null);
      }
    },
    [country, loadRanking, pauseAutoRefresh]
  );

  async function saveManualOrder() {
    const selected = manualBoard.filter((p) => manualSelection[p.id]);
    if (!selected.length) {
      toast.error('Selecione produtos para impulsionar.');
      return;
    }

    const overrides = selected
      .map((product, index) => {
        const duration = normalizeDuration(manualDurations[product.id]);
        if (!duration.totalMinutes) return null;
        return {
          productId: product.id,
          position: index + 1,
          days: duration.days,
          hours: duration.hours,
          minutes: duration.minutes
        };
      })
      .filter(Boolean);

    if (!overrides.length) {
      toast.error('Defina um tempo de duração (>= 1 minuto).');
      return;
    }

    setSaving(true);
    try {
      await api.put('/admin/products/ranking/manual', { overrides, resetOthers });
      toast.success('Ranking manual salvo.');
      await loadRanking(country);
    } catch (err) {
      console.error('admin.ranking save error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao salvar ranking.');
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = useMemo(
    () => manualBoard.filter((item) => manualSelection[item.id]).length,
    [manualBoard, manualSelection]
  );

  const visibleBoard = useMemo(() => {
    const nameTerm = searchProduct.trim().toLowerCase();
    const sellerTerm = searchSeller.trim().toLowerCase();
    return manualBoard.filter((item) => {
      const matchesName =
        !nameTerm || String(item.title || '').toLowerCase().includes(nameTerm);
      const matchesSeller =
        !sellerTerm || String(item.seller_name || '').toLowerCase().includes(sellerTerm);
      return matchesName && matchesSeller;
    });
  }, [manualBoard, searchProduct, searchSeller]);

  useEffect(() => {
    const positions = {};
    manualBoard.forEach((p, idx) => {
      positions[p.id] = idx + 1;
    });
    setPositionInput(positions);
  }, [manualBoard]);

  return (
    <div className="space-y-5 text-slate-100">
      {/* TÍTULO / EXPLICAÇÃO RÁPIDA */}
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Ranking por país
        </p>
        <h2 className="text-xl md:text-2xl font-semibold text-white">
          Impulsionamento manual de produtos
        </h2>
        <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
          1) Escolha o país. 2) Marque os produtos que deseja impulsionar.
          3) Defina por quanto tempo cada um ficará em destaque. 4) Clique em
          <span className="font-semibold"> Salvar</span>.
        </p>
      </header>

      {/* CONTROLES PRINCIPAIS (PAÍS / SALVAR) */}
      <section className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 space-y-3 text-xs md:text-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-slate-100">Filtros do ranking</p>
            <p className="text-[11px] text-slate-400">
              Visualizando produtos com base no país selecionado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-300">País:</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
              >
                <option value="" className="bg-slate-900">
                  Todos os países
                </option>
                {countries.map((c) => (
                  <option key={c.country} value={c.country} className="bg-slate-900">
                    {c.country} ({c.total})
                  </option>
                ))}
                {!countries.length && <option value={country}>{country || '—'}</option>}
              </select>
            </div>

            <button
              type="button"
              onClick={() => loadRanking(country)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-400 transition"
            >
              Atualizar lista
            </button>
          </div>
        </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-t border-slate-700 pt-3">
          <label className="flex items-center gap-2 text-[11px] md:text-xs text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-500 bg-slate-950"
              checked={resetOthers}
              onChange={(e) => setResetOthers(e.target.checked)}
            />
            Limpar impulsionamentos que não estiverem na lista selecionada
          </label>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">
              Selecionados para ranking manual:{' '}
              <span className="font-semibold text-slate-100">{selectedCount}</span>
            </span>
            <button
              type="button"
              onClick={saveManualOrder}
              disabled={saving}
              className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70 transition"
            >
              {saving ? 'Salvando...' : 'Salvar ranking'}
            </button>
          </div>
        </div>
      </section>

      {/* BUSCA POR PRODUTO / VENDEDOR */}
      <section className="grid gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4 md:grid-cols-2">
        <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Produto</span>
          <input
            type="text"
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            placeholder="Buscar por nome do produto"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Vendedor</span>
          <input
            type="text"
            value={searchSeller}
            onChange={(e) => setSearchSeller(e.target.value)}
            placeholder="Buscar por nome de usuário"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
      </section>

      {/* LISTA DE PRODUTOS */}
      {loading ? (
        <LoadingBar message="Carregando ranking..." className="text-sm text-slate-200" size="sm" />
      ) : visibleBoard.length === 0 ? (
        <p className="text-sm text-slate-300">
          Nenhum produto encontrado para o país <span className="font-semibold">{country || '—'}</span>.
        </p>
        ) : (
        <div ref={rankingContainerRef} className="space-y-3">
          {/* Cabeçalho "tabela didática" */}
          <div className="hidden rounded-md border border-slate-700 bg-slate-900/70 px-4 py-2 text-[11px] text-slate-400 md:grid md:grid-cols-12">
            <div className="col-span-1">Posição</div>
            <div className="col-span-5">Produto</div>
            <div className="col-span-3">Status / Métricas</div>
            <div className="col-span-3 text-right">Ações rápidas</div>
          </div>

          {visibleBoard.map((product, index) => {
            const expanded = expandedId === product.id;
            const selected = Boolean(manualSelection[product.id]);
            const planKey = normalizePlanKey(product.manual_rank_plan);
            const planBadge = BOOST_PLAN_BADGES[planKey];
            const planChoice = planSelection[product.id] || planKey || 'ruby';
            const selectedPlanOption =
              ADMIN_BOOST_PLANS.find((option) => option.key === planChoice) || null;
            const selectedPlanLabel = selectedPlanOption?.label || 'plano';
            const duration = manualDurations[product.id] || { days: 0, hours: 1, minutes: 0 };
            const isActive = product.manual_rank_active;
            const isExpired = product.manual_rank_expired;
            const targetPosition = positionInput[product.id] ?? index + 1;
            const thumb = firstProductImage(product);

            return (
              <div
                key={product.id}
                className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-3 md:px-4 md:py-3 text-xs md:text-sm"
              >
                {/* LINHA RESUMO */}
                <div
                  className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : product.id)}
                >
                  {/* POSIÇÃO */}
                  <div className="flex items-center gap-2 md:col-span-1">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-100">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className={`hidden md:inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                        expanded ? 'bg-slate-700' : 'bg-slate-800'
                      }`}
                    >
                      {expanded ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* PRODUTO */}
                  <div className="md:col-span-5 space-y-1">
                    <div className="flex items-start gap-3">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={product.title || 'Produto'}
                          className="h-12 w-12 flex-shrink-0 rounded-md object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="h-12 w-12 flex-shrink-0 rounded-md border border-dashed border-slate-700 bg-slate-950 text-[10px] text-slate-500 flex items-center justify-center">
                          sem foto
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="font-medium text-slate-50 line-clamp-2">
                          {product.title}
                        </p>
                        {planBadge && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.25em] uppercase text-slate-900 bg-gradient-to-r ${planBadge.accent}`}
                          >
                            <span className="text-[11px] font-bold leading-none text-white">♦</span>
                            {planBadge.label}
                          </span>
                        )}
                        <p className="text-[11px] text-slate-400">
                          Vendedor: <span className="text-slate-200">{product.seller_name || '—'}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Criado em {formatDate(product.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* STATUS / MÉTRICAS */}
                  <div className="md:col-span-3 space-y-1">
                    <p className="text-[11px] text-slate-300">
                      {manualStatusText(product)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Cliques: <span className="text-slate-100">
                        {product.clicks_count ?? product.view_count ?? 0}
                      </span>{' '}
                      · Likes:{' '}
                      <span className="text-slate-100">
                        {product.likes ?? product.likes_count ?? product.favorites_count ?? 0}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Score:{' '}
                      <span className="text-slate-100">
                        {typeof product.score === 'number' ? product.score.toFixed(3) : '—'}
                      </span>{' '}
                      · Status:{' '}
                      <span className="text-slate-100">{product.status || '—'}</span>
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {isActive && (
                        <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                          Manual ativo
                        </span>
                      )}
                      {isExpired && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-100">
                          Manual expirado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AÇÕES RÁPIDAS */}
                  <div className="md:col-span-3 flex flex-wrap items-center justify-between md:justify-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(product.id);
                      }}
                      className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
                        selected
                          ? 'bg-emerald-500 text-slate-950'
                          : 'border border-slate-600 text-slate-100 hover:border-slate-400'
                      }`}
                    >
                      {selected ? 'No ranking manual' : 'Incluir no ranking'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActive) return;
                        setExpandedId(expanded ? null : product.id);
                      }}
                      disabled={isActive}
                      className="rounded-md border border-slate-600 px-3 py-1 text-[11px] text-slate-100 hover:border-slate-400 transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isActive ? 'Impulsionamento ativo' : expanded ? 'Fechar detalhes' : 'Ver detalhes'}
                    </button>
                  </div>
                </div>

                {/* ÁREA DETALHES / EDIÇÃO SIMPLIFICADA */}
                {expanded && (
                  <div className="mt-3 border-t border-slate-700 pt-3 space-y-3">
                    {/* DURAÇÃO */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-slate-200">
                        Duração do impulsionamento
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-200">
                          <span>Dias</span>
                          <input
                            type="number"
                            min="0"
                            value={duration.days}
                            onChange={(e) =>
                              handleDurationChange(product.id, 'days', e.target.value)
                            }
                            className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-200">
                          <span>Horas</span>
                          <input
                            type="number"
                            min="0"
                            value={duration.hours}
                            onChange={(e) =>
                              handleDurationChange(product.id, 'hours', e.target.value)
                            }
                            className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-200">
                          <span>Minutos</span>
                          <input
                            type="number"
                            min="0"
                            value={duration.minutes}
                            onChange={(e) =>
                              handleDurationChange(product.id, 'minutes', e.target.value)
                            }
                            className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
                          />
                        </label>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Dica: defina pelo menos 1 minuto para que o impulsionamento seja aplicado.
                      </p>
                    </div>
                    <div className="space-y-3 border-t border-slate-700/60 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-slate-200">
                          Impulsionamento rápido
                        </p>
                        <span className="text-[11px] text-slate-400">
                          Plano atual:{' '}
                          {BOOST_PLAN_BADGES[normalizePlanKey(product.manual_rank_plan)]?.label ||
                            'nenhum'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {ADMIN_BOOST_PLANS.map((option) => {
                          const selected = planChoice === option.key;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => handlePlanSelectionChange(product.id, option.key)}
                              className={`flex flex-col gap-1 rounded-2xl border px-3 py-2 text-left text-[11px] transition ${
                                selected
                                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                                  : 'border-slate-700 bg-slate-950 text-slate-200'
                              }`}
                            >
                              <span className="text-sm font-semibold">{option.label}</span>
                              <span className="text-[10px] text-slate-400">{option.description}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleAdminBoost(product, planChoice)}
                          disabled={adminBoostLoadingId === product.id}
                          className="w-full rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-950 shadow-[0_18px_55px_rgba(236,72,153,0.55)] transition disabled:cursor-wait disabled:opacity-60"
                        >
                          {adminBoostLoadingId === product.id
                            ? 'Impulsionando...'
                            : `Impulsionar com ${selectedPlanLabel}`}
                        </button>
                        {product.manual_rank_plan && (
                          <span className="text-[11px] text-slate-400">
                            Atualmente: {BOOST_PLAN_BADGES[normalizePlanKey(product.manual_rank_plan)]?.label || product.manual_rank_plan}
                          </span>
                        )}
                        {product.manual_rank_plan && (
                          <div className="w-full md:w-auto">
                            {confirmAdminCancelId === product.id ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAdminCancel(product)}
                                  disabled={adminCancelLoadingId === product.id}
                                  className="flex-1 rounded-full border border-rose-400/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white bg-rose-500/90 hover:bg-rose-400 transition disabled:cursor-wait disabled:opacity-60"
                                >
                                  {adminCancelLoadingId === product.id ? 'Cancelando...' : 'Confirmar cancelamento'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAdminCancelId(null)}
                                  className="flex-1 rounded-full border border-slate-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-200 hover:border-slate-400 transition"
                                >
                                  Voltar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmAdminCancelId(product.id)}
                                className="w-full rounded-full border border-rose-500/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-rose-200 hover:border-rose-300 transition"
                              >
                                Cancelar impulsionamento
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* POSIÇÃO / MOVIMENTAÇÃO / DESABILITAR */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(product.id, -1);
                        }}
                        className="rounded-md border border-slate-600 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-slate-400 transition"
                      >
                        Subir posição
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveItem(product.id, 1);
                        }}
                        className="rounded-md border border-slate-600 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-slate-400 transition"
                      >
                        Descer posição
                      </button>
                      <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                        <span className="text-[11px] text-slate-300">Ir para</span>
                        <input
                          type="number"
                          min="1"
                          max={manualBoard.length || 1}
                          value={targetPosition}
                          onChange={(e) => {
                            e.stopPropagation();
                            handlePositionChange(product.id, e.target.value);
                          }}
                          className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
                        />
                        <span className="text-[11px] text-slate-500">/ {manualBoard.length}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const parsed = Math.floor(Number(positionInput[product.id]));
                            if (!Number.isFinite(parsed) || parsed <= 0) {
                              toast.error('Informe uma posição válida (>= 1).');
                              return;
                            }
                            const safePosition = Math.min(Math.max(parsed, 1), manualBoard.length || 1);
                            moveItemToPosition(product.id, safePosition);
                          }}
                          className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-700 transition"
                        >
                          Aplicar
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          disableManual(product);
                        }}
                        className="rounded-md border border-red-500/60 px-3 py-1.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/10 transition"
                      >
                        Desabilitar impulsionamento deste produto
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function manualStatusText(product) {
  if (product.manual_rank_active && product.manual_rank_expires_at) {
    return `Impulsionado até ${formatDate(product.manual_rank_expires_at)}`;
  }
  if (product.manual_rank_expired && product.manual_rank_expires_at) {
    return `Expirou em ${formatDate(product.manual_rank_expires_at)}`;
  }
  return 'Ranking automático';
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function moveByDelta(list, productId, delta) {
  const current = Array.isArray(list) ? list.slice() : [];
  const from = current.findIndex((item) => item.id === productId);
  if (from === -1) return current;
  const to = Math.min(current.length - 1, Math.max(0, from + delta));
  if (from === to) return current;
  const [item] = current.splice(from, 1);
  current.splice(to, 0, item);
  return current;
}

function moveToPosition(list, productId, targetPosition) {
  const current = Array.isArray(list) ? list.slice() : [];
  const from = current.findIndex((item) => item.id === productId);
  if (from === -1) return current;
  const to = Math.min(current.length - 1, Math.max(0, Math.floor(targetPosition) - 1));
  if (from === to) return current;
  const [item] = current.splice(from, 1);
  current.splice(to, 0, item);
  return current;
}

function normalizeDuration(duration) {
  const base = {
    days: Math.max(0, Math.floor(Number(duration?.days) || 0)),
    hours: Math.max(0, Math.floor(Number(duration?.hours) || 0)),
    minutes: Math.max(0, Math.floor(Number(duration?.minutes) || 0))
  };
  const totalMinutes = base.days * 24 * 60 + base.hours * 60 + base.minutes;
  return { ...base, totalMinutes };
}

function deriveDurationFromProduct(product) {
  const remainingMs = Number(product?.manual_rank_remaining_ms ?? 0);
  if (remainingMs > 0) {
    const totalMinutes = Math.max(1, Math.round(remainingMs / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = Math.max(0, totalMinutes % 60);
    return { days, hours, minutes };
  }
  return { days: 0, hours: 1, minutes: 0 };
}

function firstProductImage(product) {
  if (!product) return null;
  if (product.image_url) return product.image_url;
  if (Array.isArray(product.image_urls) && product.image_urls.length) {
    return product.image_urls[0];
  }
  return null;
}
