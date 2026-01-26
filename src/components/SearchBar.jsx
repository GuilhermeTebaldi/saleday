// frontend/src/components/SearchBar.jsx
//aqui é a barra com icones ! baixo da barra de logo
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { Search, MapPin, Crosshair, RotateCw, Map as MapIcon, X, User, Globe, Filter } from 'lucide-react';
import { getCountryLabel } from '../data/countries.js';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';
import LoadingBar from './LoadingBar.jsx';

const regionDisplay =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['pt-BR', 'en'], { type: 'region' })
    : null;

const normalizeText = (value) =>
  (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value) => {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
};

const levenshteinDistance = (a = '', b = '') => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(0));
  for (let i = 0; i <= b.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= a.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      const indicator = a[j - 1] === b[i - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + indicator
      );
    }
  }
  return dp[b.length][a.length];
};

const tokenMatches = (candidate, queryToken) => {
  if (!candidate || !queryToken) return false;
  if (candidate.includes(queryToken) || queryToken.includes(candidate)) return true;
  const tolerance = queryToken.length <= 4 ? 1 : 2;
  return levenshteinDistance(candidate, queryToken) <= tolerance;
};

const matchesProductQuery = (product, queryTokens) => {
  if (!product || !queryTokens.length) return false;
  const searchable = [
    product.title,
    product.description,
    product.category,
    product.tags?.join?.(' '),
    product.city,
    product.state,
    product.country,
    product.seller_name,
    product.subtitle,
    product.brand,
    product.model,
    product.color,
    product.propertyType,
    product.property_type,
    product.serviceType,
    product.service_type,
    product.serviceDuration,
    product.service_duration,
    product.serviceRate,
    product.service_rate,
    product.serviceLocation,
    product.service_location,
    product.area,
    product.bedrooms,
    product.bathrooms,
    product.parking,
    product.rentType,
    product.rent_type,
    product.jobTitle,
    product.job_title,
    product.jobType,
    product.job_type,
    product.jobSalary,
    product.job_salary,
    product.jobRequirements,
    product.job_requirements,
    product.neighborhood,
    product.zip
  ]
    .filter(Boolean)
    .join(' ');
  const productTokens = tokenize(searchable);
  if (!productTokens.length) return false;
  return queryTokens.every((token) =>
    productTokens.some((candidate) => tokenMatches(candidate, token))
  );
};

const filterProductsByQuery = (products, query) => {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  return products.filter((product) => matchesProductQuery(product, tokens));
};

const mergeResults = (primary = [], secondary = []) => {
  const seen = new Set();
  const merged = [];
  const pushUnique = (list) => {
    for (const item of list) {
      if (!item) continue;
      const key = item.id ?? `${item.product_id}-${item.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  };
  pushUnique(primary);
  pushUnique(secondary);
  return merged;
};

const buildLocationLabel = (geo) => {
  if (!geo) return '';
  const parts = [];
  if (geo.city) parts.push(geo.city);
  if (geo.state && geo.state !== geo.city) parts.push(geo.state);
  if (geo.country) {
    const countryName = regionDisplay?.of(geo.country) || geo.country;
    parts.push(countryName);
  }
  return parts.filter(Boolean).join(', ');
};

const resolveCountryName = (code) => {
  if (!code) return '';
  const normalized = String(code).trim().toUpperCase();
  return getCountryLabel(normalized) || regionDisplay?.of(normalized) || normalized;
};

const FLAG_BASE_URL = 'https://flagcdn.com';
const getFlagUrl = (code) => {
  if (!code) return null;
  const normalized = String(code).trim().toLowerCase();
  return `${FLAG_BASE_URL}/w40/${normalized}.png`;
};

const COUNTRY_THEMES = {
  BR: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-900' },
  US: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900' },
  IT: { border: 'border-rose-500', bg: 'bg-rose-50', text: 'text-rose-900' }
};

const getCountryTheme = (code) => {
  const normalized = String(code || '').trim().toUpperCase();
  return COUNTRY_THEMES[normalized] ?? { border: 'border-gray-200', bg: 'bg-white', text: 'text-gray-700' };
};

const TOOLBAR_ICON_BTN =
  'home-search-toolbtn focus-visible:outline-none focus-visible:ring focus-visible:ring-amber-200';

export default function SearchBar({
  onProductsLoaded,
  onFiltersChange,
  resetSignal,
  onOpenMap,
  geoScope,
  originCountry,
  hasProfile,
  user,
  categoryOptions = [],
  categoryFilter,
  categoryLoading,
  onCategorySelect,
  locationSummary
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState(null); // 'address' | 'country' | null
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [countryPanelOpen, setCountryPanelOpen] = useState(false);
  const popRef = useRef(null);
  const fallbackCountry = (originCountry || 'BR').toString().trim().toUpperCase() || 'BR';
  const [countryOptions, setCountryOptions] = useState([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryApplying, setCountryApplying] = useState(false);
  const closeDropdowns = useCallback(() => {
    setPanel(null);
    setCategoryPanelOpen(false);
    setCountryPanelOpen(false);
  }, []);

  const activeCountry =
    geoScope?.type === 'country' && geoScope?.country
      ? String(geoScope.country).toUpperCase()
      : null;

  const hasCategoryOptions = Array.isArray(categoryOptions) && categoryOptions.length > 0;
  const toggleCategoryPanel = () => {
    if (!hasCategoryOptions) return;
    setCategoryPanelOpen((prev) => !prev);
    setCountryPanelOpen(false);
    setPanel(null);
  };
  const handleCategorySelection = (label) => {
    if (!label) return;
    if (typeof onCategorySelect === 'function') {
      onCategorySelect(label);
    }
    setCategoryPanelOpen(false);
  };

  const buildGeoParams = (scopeOverride) => {
    const scope = scopeOverride || geoScope;
    if (scope?.type === 'bbox') {
      const bounds = scope.bounds || scope;
      const { minLat, maxLat, minLng, maxLng } = bounds || {};
      if ([minLat, maxLat, minLng, maxLng].every((value) => Number.isFinite(value))) {
        return { minLat, maxLat, minLng, maxLng };
      }
    }
    const countryCode = scope?.country || fallbackCountry;
    return countryCode ? { country: countryCode } : {};
  };

  useEffect(() => {
    function onDocClick(e) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target)) {
        setPanel(null);
        setCategoryPanelOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (resetSignal === undefined) return;
    setQ('');
    setAddress('');
    setPanel(null);
  }, [resetSignal]);

  useEffect(() => {
    if (!hasCategoryOptions) {
      setCategoryPanelOpen(false);
    }
  }, [hasCategoryOptions]);

  const toggleCountryPanel = () => {
    setCountryPanelOpen((prev) => {
      const next = !prev;
      if (next && !countryOptions.length && !countryLoading) {
        loadCountryOptions();
      }
      return next;
    });
    setPanel(null);
    setCategoryPanelOpen(false);
  };

  async function loadCountryOptions() {
    setCountryLoading(true);
    try {
      const { data } = await api.get('/products/countries');
      if (data.success) {
        const normalized = Array.isArray(data.data) ? data.data : [];
        const deduped = [];
        const seen = new Set();
        for (const item of normalized) {
          const code = String(item.country || '').trim().toUpperCase();
          if (!code || seen.has(code)) continue;
          seen.add(code);
          deduped.push({ country: code, total: Number(item.total) || 0 });
        }
        setCountryOptions(deduped);
      } else {
        toast.error('Não foi possível carregar os países.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar países.');
    } finally {
      setCountryLoading(false);
    }
  }

  async function applyCountryFilter(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return;
    setCountryApplying(true);
    try {
      const { data } = await api.get('/products', {
        params: { sort: 'rank', country: normalized }
      });
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : [];
        onProductsLoaded?.(list);
        const label = resolveCountryName(normalized);
        onFiltersChange?.({ type: 'country', value: { country: normalized, label } });
        toast.success(`Filtrando por ${label}.`);
        setPanel(null);
      } else {
        toast.error('Nenhum produto encontrado neste país.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao filtrar por país.');
    } finally {
      setCountryApplying(false);
    }
  }

  async function searchText(rawQuery = q) {
    const trimmed = String(rawQuery).trim();
    if (!trimmed) {
      toast.error('Digite algo para buscar.');
      return;
    }
    const geoParams = buildGeoParams();
    try {
      const primary = await api.get('/products', {
        params: { q: trimmed, sort: 'rank', ...geoParams }
      });
      const primaryResults = primary.data?.success
        ? (Array.isArray(primary.data.data) ? primary.data.data : [])
        : [];
      let enriched = filterProductsByQuery(primaryResults, trimmed);

      if (!enriched.length) {
        const fallback = await api.get('/products', {
          params: { sort: 'rank', ...geoParams }
        });
        if (fallback.data?.success) {
          enriched = filterProductsByQuery(fallback.data.data ?? [], trimmed);
        }
      } else if (enriched.length < 6) {
        const fallback = await api.get('/products', {
          params: { sort: 'rank', ...geoParams }
        });
        if (fallback.data?.success) {
          const filteredFallback = filterProductsByQuery(fallback.data.data ?? [], trimmed);
          enriched = mergeResults(enriched, filteredFallback);
        }
      }

      if (enriched.length) {
        onProductsLoaded?.(enriched);
        onFiltersChange?.({ type: 'search', value: trimmed });
      } else {
        // Sem correspondências: mantém a grade atual e apenas alerta.
        toast.error('Nenhum produto corresponde à sua busca.');
      }
      setPanel(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar produtos.');
    }
  }

  async function applyAddress() {
    const raw = address.trim();
    if (!raw) return toast.error('Digite um endereço ou cidade.');
    setLoading(true);
    try {
      const { data } = await api.get('/geo/forward', { params: { q: raw } });
      if (!data.success || !data.data) {
        toast.error('Endereço não encontrado.');
        return;
      }
      const formattedLabel = buildLocationLabel(data.data);
      if (formattedLabel) {
        setAddress(formattedLabel);
      }
      const { lat, lng, city } = data.data;
      const params = { sort: 'rank' };
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        Object.assign(params, {
          minLat: lat - 0.05,
          maxLat: lat + 0.05,
          minLng: lng - 0.05,
          maxLng: lng + 0.05
        });
      }

      let products = [];
      const primary = await api.get('/products', { params });
      if (primary.data?.success) {
        products = primary.data.data ?? [];
      }

      if ((!products || products.length === 0) && city) {
        const fallback = await api.get('/products', {
          params: { sort: 'rank', city }
        });
        if (fallback.data?.success) {
          products = fallback.data.data ?? [];
        }
      }

      if ((!products || products.length === 0) && city) {
        const general = await api.get('/products', { params: { sort: 'rank' } });
        if (general.data?.success) {
          const normalizedTarget = normalizeText(city);
          products =
            general.data.data?.filter((product) => normalizeText(product.city) === normalizedTarget) ??
            [];
        }
      }

      if (products && products.length) {
        const payload = { ...data.data, label: formattedLabel || raw };
        onProductsLoaded?.(products);
        onFiltersChange?.({ type: 'address', value: payload });
        toast.success(`Região aplicada: ${payload.label}`);
      } else {
        toast.error('Nenhum produto encontrado nessa região.');
      }
      setPanel(null);
    } catch {
      toast.error('Erro ao aplicar endereço.');
    } finally {
      setLoading(false);
    }
  }

  async function useGPSQuick() {
    if (!navigator.geolocation) return toast.error('GPS indisponível.');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const lat = coords.latitude;
          const lng = coords.longitude;
          const bbox = {
            minLat: lat - 0.05,
            maxLat: lat + 0.05,
            minLng: lng - 0.05,
            maxLng: lng + 0.05
          };

          let locationDetails = null;
          try {
            const reverse = await api.get('/geo/reverse', {
              params: { lat, lng }
            });
            if (reverse.data?.success) {
              locationDetails = reverse.data.data || null;
            }
          } catch (reverseError) {
            console.error('reverse geocode failed', reverseError);
          }

          const fetchProducts = async (params) => {
            const response = await api.get('/products', { params });
            return response.data?.success ? response.data.data ?? [] : [];
          };

          let products = await fetchProducts({ sort: 'rank', ...bbox });

          if ((!products || products.length === 0) && locationDetails?.city) {
            const fallbackParams = {
              sort: 'rank',
              city: locationDetails.city
            };
            if (locationDetails.country) {
              fallbackParams.country = locationDetails.country;
            }
            products = await fetchProducts(fallbackParams);
          }

          if (products?.length) {
            const derivedLabel = buildLocationLabel({
              city: locationDetails?.city,
              state: locationDetails?.state,
              country: locationDetails?.country
            });
            const payload = {
              label: derivedLabel || (locationDetails?.city ? `Perto de ${locationDetails.city}` : 'Perto de você'),
              lat,
              lng,
              city: locationDetails?.city || null,
              state: locationDetails?.state || null,
              country: locationDetails?.country || null,
              bounds: bbox
            };
            onProductsLoaded?.(products);
            onFiltersChange?.({
              type: 'address',
              value: payload
            });
            toast.success('Produtos próximos.');
          } else {
            toast.error('Nenhum produto encontrado nos arredores.');
          }
        } catch {
          toast.error('Erro ao buscar próximos.');
        }
      },
      () => toast.error('Não foi possível obter o GPS.')
    );
  }

  async function resetAll() {
    try {
      const defaultParams = buildGeoParams({ type: 'country', country: fallbackCountry });
      const { data } = await api.get('/products', {
        params: { sort: 'rank', ...defaultParams }
      });
      if (data.success) onProductsLoaded?.(data.data);
      setAddress(''); setQ(''); setPanel(null);
      onFiltersChange?.({ type: 'reset' });
    } catch {
      toast.error('Erro ao resetar.');
    }
  }

  const handleSellerSearchOpen = useCallback(() => {
    closeDropdowns();
    navigate('/sellers/search');
  }, [closeDropdowns, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleTriggerSearch = (event) => {
      const nextValue = event?.detail?.value ?? q;
      searchText(nextValue);
    };
    window.addEventListener('templesale:trigger-search', handleTriggerSearch);
    return () =>
      window.removeEventListener('templesale:trigger-search', handleTriggerSearch);
  }, [q, geoScope]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleSetQuery = (event) => {
      const nextValue = event?.detail?.value ?? '';
      setQ(String(nextValue));
    };
    window.addEventListener('templesale:set-search-query', handleSetQuery);
    return () =>
      window.removeEventListener('templesale:set-search-query', handleSetQuery);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle(
      'templesale-dropdown-open',
      Boolean(panel || categoryPanelOpen || countryPanelOpen)
    );
    return () => document.body.classList.remove('templesale-dropdown-open');
  }, [panel, categoryPanelOpen, countryPanelOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!panel && !categoryPanelOpen && !countryPanelOpen) return undefined;
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (!target) return;
      if (target.closest('.home-search-toolbar')) return;
      if (target.closest('.home-search-toolbar__panel')) return;
      if (target.closest('.home-search-country-panel')) return;
      if (target.closest('.home-search-address-panel')) return;
      closeDropdowns();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [panel, categoryPanelOpen]);

  return (
    <div className="relative" ref={popRef}>
      <div className="home-search-top">
        {/* Barra de ícones */}
        <div
          className="home-search-toolbar"
          onClick={(event) => {
            const button = event.target.closest('.home-search-toolbtn');
            if (button && button.dataset.keepPanel !== 'true') {
              setTimeout(closeDropdowns, 0);
            }
          }}
        >
        <button
          type="button"
          className="home-search-toolbar__close"
          aria-label="Fechar menu de filtros"
          onClick={() => {
            closeDropdowns();
          }}
        >
          <X size={16} />
        </button>
        {user && (
          <div className="home-search-toolbar__profile">
            <div className="home-search-toolbar__avatar">
              {user?.profile_image_url ? (
                <img
                  src={user.profile_image_url}
                  alt={user.username || 'Perfil'}
                  onError={(e) => {
                    e.currentTarget.src = IMG_PLACEHOLDER;
                    e.currentTarget.classList.add('home-profile__avatarimg--fallback');
                  }}
                />
              ) : (
                <span>
                  {(user?.username || 'U')
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="home-search-toolbar__profile-info">
              <p className="home-search-toolbar__profile-name">
                {user?.username || 'Usuário'}
              </p>
              {user?.city ? (
                <p className="home-search-toolbar__profile-meta">{user.city}</p>
              ) : (
                <p className="home-search-toolbar__profile-meta">Perfil incompleto</p>
              )}
                <Link
                  to="/edit-profile"
                  className="home-search-toolbar__profile-link"
                  onClick={() => {
                    closeDropdowns();
                  }}
                >
                Editar perfil
              </Link>
            </div>
          </div>
        )}
        {hasCategoryOptions && (
          <div className="home-search-toolbar__dropdown home-search-toolbar__dropdown--filter">
            <button
              type="button"
              title="Filtrar categorias"
              onClick={toggleCategoryPanel}
              aria-haspopup="true"
              data-keep-panel="true"
              aria-expanded={categoryPanelOpen}
              className={`${TOOLBAR_ICON_BTN} relative ${categoryPanelOpen ? 'bg-white border-gray-200 shadow-md' : ''}`}
            >
              <Filter size={18} />
              <span className="home-search-toolbtn__label">Filtro</span>
              {categoryFilter && (
                <span className="pointer-events-none absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </button>
            {categoryPanelOpen && (
              <div className="home-search-toolbar__dropdown-panel home-search-filter-panel">
                <div className="home-search-toolbar__panel-header">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {locationSummary ? `Disponíveis em ${locationSummary}` : 'Categorias'}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {categoryFilter ? 'Filtre por categoria' : 'Selecione uma categoria'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategoryPanelOpen(false)}
                    className="text-gray-500 hover:underline"
                    aria-label="Fechar painel de categorias"
                  >
                    Fechar
                  </button>
                </div>
                <div className="home-search-toolbar__panel-body">
                  {categoryOptions.map(({ label, count }) => {
                    const active = categoryFilter === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleCategorySelection(label)}
                        disabled={categoryLoading}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition shadow-sm duration-150 ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-lg'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        } ${categoryLoading ? 'opacity-70 cursor-wait' : ''}`}
                      >
                        <span className="block text-sm font-semibold truncate">{label}</span>
                        <span className="text-xs text-gray-500">{count} anúncios</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        <div
          className={`home-search-toolbar__dropdown home-search-toolbar__dropdown--country${
            countryPanelOpen ? ' is-open' : ''
          }`}
        >
            <button
              type="button"
              title="Filtrar por países"
              onClick={toggleCountryPanel}
              data-keep-panel="true"
              className={`${TOOLBAR_ICON_BTN}`}
              aria-haspopup="dialog"
              aria-expanded={countryPanelOpen}
            >
              <Globe size={18} />
              <span className="home-search-toolbtn__label">Países</span>
            </button>
          {countryPanelOpen && (
            <div className="home-search-toolbar__panel home-search-toolbar__dropdown-panel home-search-country-panel">
              <div className="home-search-toolbar__panel-header">
              <div>
                <p className="text-sm font-semibold text-slate-900">Países</p>
                <p className="text-[11px] text-gray-400">
                  Somente países com anúncios ativos
                </p>
              </div>
                <button
                  type="button"
                  onClick={() => setCountryPanelOpen(false)}
                  className="text-gray-500 hover:underline"
                  aria-label="Fechar painel de países"
                >
                  Fechar
                </button>
              </div>
              <div className="home-search-toolbar__panel-body">
                {countryLoading ? (
                  <LoadingBar
                    message="Carregando países..."
                    size="sm"
                    className="text-sm text-gray-500 home-search-country-loading"
                  />
                ) : countryOptions.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum país com anúncios disponível.</p>
                ) : (
                  countryOptions.map((item) => {
                    const label = resolveCountryName(item.country);
                    const countLabel = item.total === 1 ? '1 anúncio' : `${item.total} anúncios`;
                    const isActive = activeCountry === item.country;
                    const flagUrl = getFlagUrl(item.country);
                    const theme = getCountryTheme(item.country);
                    return (
                      <button
                        key={item.country}
                        type="button"
                        disabled={countryApplying}
                        onClick={() => {
                          applyCountryFilter(item.country);
                          setCountryPanelOpen(false);
                        }}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition shadow-sm duration-150 ${
                          isActive
                            ? `${theme.border} ${theme.bg} ${theme.text} shadow-lg`
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        } ${countryLoading ? 'opacity-70 cursor-wait' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {flagUrl ? (
                              <img
                                src={flagUrl}
                                alt={label}
                                className="w-5 h-5 rounded-sm object-cover border border-white/60 shadow-inner"
                                loading="lazy"
                              />
                            ) : (
                              <span className="w-5 h-5 rounded-sm bg-gray-200 text-[10px] flex items-center justify-center text-gray-600">
                                {item.country}
                              </span>
                            )}
                            <p className="font-semibold text-sm truncate">{label}</p>
                          </div>
                          <p className="text-xs text-gray-500">{countLabel}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white/60 p-3 text-xs text-gray-500">
                {countryApplying
                  ? 'Aplicando filtro...'
                  : 'Escolha um país para ver todos os anúncios disponíveis.'}
              </div>
            </div>
          )}
        </div>
        {false && (
          <button
            type="button"
            title="Cidade, bairro ou endereço"
            onClick={() => setPanel((p) => (p === 'address' ? null : 'address'))}
            className={`${TOOLBAR_ICON_BTN}`}
            aria-haspopup="dialog"
            aria-expanded={panel === 'address'}
          >
            <MapPin size={18} />
          </button>
        )}
        
        <button
          type="button"
          title="Buscar produtos próximos"
          onClick={() => {
            closeDropdowns();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('templesale:close-hamburger'));
            }
            useGPSQuick();
          }}
          className={`${TOOLBAR_ICON_BTN}`}
        >
          <Crosshair size={18} />
          <span className="home-search-toolbtn__label">Próximos</span>
        </button>
        <button
          type="button"
          title="Reset"
          onClick={resetAll}
          className={`${TOOLBAR_ICON_BTN}`}
        >
          <RotateCw size={18} />
          <span className="home-search-toolbtn__label">Resetar</span>
        </button>
        <button
          type="button"
          title="Localizar no mapa"
          onClick={() => {
            let handled = false;
            if (typeof onOpenMap === 'function') {
              handled = onOpenMap() === true;
            }
            if (!handled) {
              window.dispatchEvent(new Event('templesale:open-map'));
            }
          }}
          className={`${TOOLBAR_ICON_BTN}`}
        >
          <MapIcon size={18} />
          <span className="home-search-toolbtn__label">Mapa</span>
        </button>
          <button
            type="button"
            title="Buscar vendedores"
            onClick={handleSellerSearchOpen}
            className={`${TOOLBAR_ICON_BTN}`}
            aria-haspopup="false"
            aria-expanded="false"
          >
          <User size={18} />
          <span className="home-search-toolbtn__label">Vendedor</span>
        </button>
        </div>
      </div>

      {/* Painéis */}

      {panel === 'address' && (
        <div className="home-search-address-panel absolute z-20 mt-2 w-full max-w-xl left-0 rounded-3xl border border-gray-200 bg-gradient-to-b from-white/90 to-white/70 shadow-[0_20px_45px_rgba(15,23,42,0.25)] p-4 flex flex-col gap-3 backdrop-blur-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Aplicar endereço</p>
            <p className="text-xs text-gray-400">Cidade, bairro ou endereço (ex: Chapecó)</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-inner">
            <MapPin size={16} className="text-gray-500" />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
              placeholder="Cidade, bairro ou endereço (ex: Chapecó)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyAddress()}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPanel(null)}
              className="px-4 py-2 rounded-2xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Fechar
            </button>
            <button
              onClick={applyAddress}
              disabled={loading}
              className="px-4 py-2 rounded-2xl bg-blue-600 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-60"
            >
              {loading ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
