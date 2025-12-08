// frontend/src/pages/Home.jsx
// Página inicial com destaques, busca e feed de produtos.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBar from '../components/SearchBar.jsx';
import MapSearch from '../components/MapSearch.jsx';
import { parseImageList, toAbsoluteImageUrl } from '../utils/images.js';

import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext.jsx';
import GeoContext from '../context/GeoContext.jsx';
import formatProductPrice from '../utils/currency.js';
import { isProductFree } from '../utils/product.js';
import { getCountryLabel, normalizeCountryCode } from '../data/countries.js';
import { getProductKey, mergeProductLists } from '../utils/productCollections.js';

const regionDisplay =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['pt-BR', 'en'], { type: 'region' })
    : null;

const FLAG_BASE_URL = 'https://flagcdn.com';
const getFlagUrl = (code) => {
  if (!code) return null;
  return `${FLAG_BASE_URL}/w20/${String(code).trim().toLowerCase()}.png`;
};

const COUNTRY_THEMES = {
  BR: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-900' },
  US: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900' },
  IT: { border: 'border-rose-500', bg: 'bg-rose-50', text: 'text-rose-900' }
};

const getCountryTheme = (code) => {
  const normalized = String(code || '').trim().toUpperCase();
  return COUNTRY_THEMES[normalized] ?? {
    border: 'border-gray-200',
    bg: 'bg-white',
    text: 'text-gray-700'
  };
};

const resolveCountryName = (code) => {
  if (!code) return '';
  const normalized = String(code).trim().toUpperCase();
  return getCountryLabel(normalized) || regionDisplay?.of(normalized) || normalized;
};
const isActive = (p) => (p?.status || 'active') !== 'sold';
const IMG_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const FAVORITE_FIELDS = ['likes_count', 'likes', 'favorites_count'];

const getProductLikes = (product) => {
  if (!product) return 0;
  const raw = Number(
    product.likes_count ?? product.likes ?? product.favorites_count ?? 0
  );
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
};

const applyLikeDelta = (product, delta = 0) => {
  if (!product || !delta) return product;
  const nextValue = Math.max(0, getProductLikes(product) + delta);
  const existingField = FAVORITE_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(product, field)
  );
  const field = existingField || FAVORITE_FIELDS[0];
  return { ...product, [field]: nextValue };
};

const prioritizeProducts = (list, priorityKeys = []) => {
  if (!priorityKeys || !Array.isArray(priorityKeys) || !priorityKeys.length) {
    return list;
  }
  const keys = new Set(priorityKeys);
  const prioritized = [];
  const other = [];
  for (const item of list || []) {
    const key = getProductKey(item);
    if (key && keys.has(key)) {
      prioritized.push(item);
      keys.delete(key);
      continue;
    }
    other.push(item);
  }
  return [...prioritized, ...other];
};

const DEFAULT_COUNTRY = 'BR';
const MOBILE_BREAKPOINT = 768;

const extractRegionFromLocale = (value) => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/[-_](\w{2})/);
  return match ? match[1] : '';
};

const detectPreferredCountry = (userCountry, geoCountry) => {
  const normalizedUser = normalizeCountryCode(userCountry);
  if (normalizedUser) return normalizedUser;
  const normalizedGeo = normalizeCountryCode(geoCountry);
  if (normalizedGeo) return normalizedGeo;
  if (typeof window !== 'undefined') {
    try {
      const storedPref = normalizeCountryCode(localStorage.getItem('saleday.preferredCountry'));
      if (storedPref) return storedPref;
      const candidates = [];
      const storedLocale = localStorage.getItem('saleday.locale');
      if (storedLocale) candidates.push(storedLocale);
      if (typeof navigator !== 'undefined') {
        if (navigator.language) candidates.push(navigator.language);
        if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
      }
      if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
        const intlLocale = Intl.DateTimeFormat().resolvedOptions?.().locale;
        if (intlLocale) candidates.push(intlLocale);
      }
      for (const candidate of candidates) {
        const region = extractRegionFromLocale(candidate);
        const normalizedRegion = normalizeCountryCode(region);
        if (normalizedRegion) return normalizedRegion;
      }
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_COUNTRY;
};

const boundsAreValid = (bounds) => {
  if (!bounds) return false;
  return ['minLat', 'maxLat', 'minLng', 'maxLng'].every((key) =>
    Number.isFinite(bounds[key])
  );
};

const geoScopeToParams = (scope, fallbackCountry = DEFAULT_COUNTRY) => {
  if (scope?.type === 'bbox' && boundsAreValid(scope.bounds)) {
    return { ...scope.bounds };
  }
  const country = scope?.country || fallbackCountry;
  return country ? { country } : {};
};

const buildBoundsFromPoint = (lat, lng, delta = 0.05) => {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  return {
    minLat: latNum - delta,
    maxLat: latNum + delta,
    minLng: lngNum - delta,
    maxLng: lngNum + delta,
  };
};

const updateLikesInCollection = (collection, productId, delta) => {
  if (!Array.isArray(collection) || !productId || !delta) return collection;
  return collection.map((item) =>
    item.id === productId ? applyLikeDelta(item, delta) : item
  );
};

export default function Home() {
  const { token, user } = useContext(AuthContext);
  const { country: detectedCountry } = useContext(GeoContext);
  const navigate = useNavigate();
  const preferredCountry = useMemo(
    () => detectPreferredCountry(user?.country, detectedCountry),
    [user?.country, detectedCountry]
  );
  const [geoScope, setGeoScope] = useState(() => ({ type: 'country', country: preferredCountry }));

  // produtos / favoritos (já existia)
  const [products, setProducts] = useState([]);
  const productsRef = useRef([]);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'free'
  const [favoriteIds, setFavoriteIds] = useState(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [pendingFavorite, setPendingFavorite] = useState(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState('favorites'); // 'favorites' | 'orders'
  const drawerRef = useRef(null);
  const mapOpenRef = useRef(null);

  // pedidos confirmados do comprador
  const [buyerOrders, setBuyerOrders] = useState([]); // só pedidos confirmados
  // flag "tem novidade" antes de abrir
  // chave por usuário para não repetir badge depois que abriu
  const buyerNotifKey = user?.id ? `buyerOrdersSeen:${user.id}` : null;
  const [hasNewConfirmed, setHasNewConfirmed] = useState(false);
  const [searchSummary, setSearchSummary] = useState(null);
  const [locationSummary, setLocationSummary] = useState(null);
  const [locationCountry, setLocationCountry] = useState(null);
  const [externalResetToken, setExternalResetToken] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [countryShortcuts, setCountryShortcuts] = useState([]);
  const [countryShortcutsLoading, setCountryShortcutsLoading] = useState(false);
  const [countryShortcutApplying, setCountryShortcutApplying] = useState(false);
  const [showConfirmedAttention, setShowConfirmedAttention] = useState(false);

  // controle de interseção de view
  const observedRef = useRef(new Set());
  // menu do avatar
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // botão "voltar ao topo"
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refreshKey = 'saleday.home_mobile_refresh';
    const getStorage = () => {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    };
    const hasRefreshed = () => getStorage()?.getItem(refreshKey) === '1';
    const markRefreshed = () => getStorage()?.setItem(refreshKey, '1');
    const clearRefreshed = () => getStorage()?.removeItem(refreshKey);
    const isMobileViewport = () => window.innerWidth <= MOBILE_BREAKPOINT;

    let lastWasMobile = isMobileViewport();

    const reloadForMobile = () => {
      if (hasRefreshed()) return;
      markRefreshed();
      window.location.reload();
    };

    if (lastWasMobile) {
      reloadForMobile();
      return undefined;
    }

    const handleResize = () => {
      const currentlyMobile = isMobileViewport();
      if (currentlyMobile && !lastWasMobile) {
        reloadForMobile();
        return;
      }
      lastWasMobile = currentlyMobile;
      if (!currentlyMobile && hasRefreshed()) {
        clearRefreshed();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const deriveCategoryOptions = useCallback((list = []) => {
    const counts = new Map();
    list.forEach((item) => {
      const label = item?.category ? String(item.category).trim() : '';
      if (!label) return;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count }));
  }, []);

  const handleProductsLoaded = useCallback(
    (list, options = {}) => {
      const {
        preserveCategories = false,
        keepExisting = false,
        priorityKeys = []
      } = options;
      const incoming = (Array.isArray(list) ? list : []).filter(isActive);
      const merged = keepExisting
        ? mergeProductLists(incoming, productsRef.current)
        : incoming;
      const prioritized = prioritizeProducts(merged, priorityKeys);
      observedRef.current.clear();
      setProducts(prioritized);
      setViewMode('all');
      if (!preserveCategories) {
        setCategoryFilter(null);
        setCategoryOptions(deriveCategoryOptions(prioritized));
      }
      return prioritized;
    },
    [deriveCategoryOptions]
  );

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    if (preferredCountry && typeof window !== 'undefined') {
      localStorage.setItem('saleday.preferredCountry', preferredCountry);
    }
  }, [preferredCountry]);

  useEffect(() => {
    setGeoScope((current) => {
      if (!preferredCountry) return current;
      if (current?.type !== 'country') return current;
      if (current.country === preferredCountry) return current;
      return { type: 'country', country: preferredCountry };
    });
  }, [preferredCountry]);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    setCountryShortcutsLoading(true);
    api
      .get('/products/countries')
      .then((res) => {
        if (!active) return;
        const normalized = Array.isArray(res.data?.data) ? res.data.data : [];
        const deduped = [];
        const seen = new Set();
        for (const item of normalized) {
          const code = String(item.country || '').trim().toUpperCase();
          if (!code || seen.has(code)) continue;
          seen.add(code);
          deduped.push({ country: code, total: Number(item.total) || 0 });
        }
        setCountryShortcuts(deduped);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setCountryShortcuts([]);
      })
      .finally(() => {
        if (active) setCountryShortcutsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadDefaultProducts = useCallback(async () => {
    const scope = { type: 'country', country: preferredCountry };
    try {
      const { data } = await api.get('/products', {
        params: { sort: 'rank', ...geoScopeToParams(scope, preferredCountry) }
      });
      if (data.success) {
        const allProducts = handleProductsLoaded(data.data);
      }
    } catch {
      /* silencioso */
    }
  }, [preferredCountry, handleProductsLoaded]);

  // carregar produtos iniciais
  useEffect(() => {
    loadDefaultProducts();
  }, [loadDefaultProducts]);

  // carregar favoritos
  useEffect(() => {
    if (!token) {
      const saved = localStorage.getItem('favorites');
      const ids = saved ? JSON.parse(saved) : [];
      setFavoriteIds(ids);
      setFavoriteLoading(false);
      return;
    }
    let active = true;
    setFavoriteLoading(true);
    api
      .get('/favorites')
      .then((res) => {
        if (!active) return;
        const items = res.data?.data ?? [];
        setFavoriteItems(items);
        setFavoriteIds(items.map((item) => item.id));
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        toast.error('Não foi possível carregar seus favoritos.');
        setFavoriteItems([]);
        setFavoriteIds([]);
      })
      .finally(() => {
        if (active) setFavoriteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // NOVO: carregar pedidos confirmados do comprador
  useEffect(() => {
    if (!token || !user?.id) {
      setBuyerOrders([]);
      setHasNewConfirmed(false);
      return;
    }
    let active = true;
    api
      .get('/orders/buyer', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        // só confirmados
        const confirmed = list.filter((o) => o.status === 'confirmed');
        setBuyerOrders(confirmed);

        // detectar novidade pra badge verde
        if (buyerNotifKey) {
          const seenRaw = localStorage.getItem(buyerNotifKey);
          const seenIds = seenRaw ? JSON.parse(seenRaw) : [];
          const confirmedIds = confirmed.map((o) => o.id);
          const unseen = confirmedIds.filter((id) => !seenIds.includes(id));
          setHasNewConfirmed(unseen.length > 0);
        }
      })
      .catch((err) => {
        console.error(err);
        // não mostra toast aqui para não poluir a home
      });
    return () => {
      active = false;
    };
  }, [token, user?.id, buyerNotifKey]);

  useEffect(() => {
    if (!hasNewConfirmed) {
      setShowConfirmedAttention(false);
      return;
    }
    setShowConfirmedAttention(true);
    const timer = setTimeout(() => setShowConfirmedAttention(false), 2800);
    return () => clearTimeout(timer);
  }, [hasNewConfirmed]);

  const openFavoritesDrawer = useCallback(() => {
    setDrawerTab('favorites');
    setActiveDrawer(true);
  }, []);

  const openOrdersDrawer = useCallback(() => {
    setDrawerTab('orders');
    setActiveDrawer(true);
    if (buyerNotifKey && buyerOrders.length) {
      const ids = buyerOrders.map((o) => o.id);
      localStorage.setItem(buyerNotifKey, JSON.stringify(ids));
      setHasNewConfirmed(false);
    }
  }, [buyerNotifKey, buyerOrders]);

  // registrar click e view
  const registerClick = useCallback((productId) => {
    if (!productId) return;
    api.put(`/products/${productId}/click`).catch(() => {});
  }, []);

  const registerView = useCallback(async (productId) => {
    if (!productId) return;
    const key = `viewed:${productId}`;
    if (sessionStorage.getItem(key)) return;
    try {
      await api.put(`/products/${productId}/view`);
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const handleSearchFilters = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'reset') {
      setSearchSummary(null);
      setLocationSummary(null);
      setLocationCountry(null);
      setCategoryFilter(null);
      setGeoScope({ type: 'country', country: preferredCountry });
      return;
    }
    if (payload.type === 'search') {
      const value = String(payload.value || '').trim();
      setSearchSummary(value || null);
      return;
    }
    if (payload.type === 'country') {
      const details = payload.value || {};
      const countryCode = (details.country || preferredCountry || 'BR').toString().toUpperCase();
      const label = String(details.label || countryCode).trim();
      setGeoScope({ type: 'country', country: countryCode });
      setLocationSummary(label || countryCode);
      setLocationCountry(countryCode);
      return;
    }
    if (payload.type === 'address') {
      const details = payload.value || {};
      const parts = [details.city, details.state, details.country]
        .map((part) => (part || '').toString().trim())
        .filter(Boolean);
      const label = details.label
        ? String(details.label).trim()
        : parts.length
          ? parts.join(' • ')
          : 'Localização personalizada';
      const derivedBounds =
        (details.bounds && boundsAreValid(details.bounds) && details.bounds) ||
        buildBoundsFromPoint(details.lat, details.lng);
      if (derivedBounds) {
        setGeoScope({ type: 'bbox', bounds: derivedBounds });
      } else {
        setGeoScope({ type: 'country', country: preferredCountry });
      }
      setLocationSummary(label);
      setLocationCountry(null);
      return;
    }
  }, [preferredCountry]);

  const handleCategoryFilter = useCallback(
    async (label) => {
      if (categoryLoading) return;
      if (!label) {
        if (!categoryFilter) return;
        label = categoryFilter;
      }
      const normalized = String(label).trim();
      if (!normalized) return;
      const isRemoving = categoryFilter && categoryFilter === normalized;
      setCategoryLoading(true);
      try {
        const params = {
          sort: 'rank',
          ...geoScopeToParams(geoScope, preferredCountry)
        };
        if (searchSummary) {
          params.q = searchSummary;
        }
        if (!isRemoving) {
          params.category = normalized;
        }
        const { data } = await api.get('/products', { params });
        if (data.success) {
          handleProductsLoaded(data.data, { preserveCategories: !isRemoving });
          if (isRemoving) {
            setCategoryFilter(null);
            toast.success('Filtro de categoria removido.');
          } else {
            setCategoryFilter(normalized);
            toast.success(`Filtrando por ${normalized}.`);
          }
        } else {
          toast.error(isRemoving ? 'Não foi possível recarregar os produtos.' : 'Nenhum produto nesta categoria.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Erro ao filtrar por categoria.');
      } finally {
        setCategoryLoading(false);
      }
    },
    [categoryFilter, categoryLoading, geoScope, preferredCountry, handleProductsLoaded, searchSummary]
  );

  const handleCountryShortcut = useCallback(
    async (code) => {
      const normalized = String(code || '').trim().toUpperCase();
      if (!normalized) return;
      setCountryShortcutApplying(true);
      try {
        const { data } = await api.get('/products', {
          params: { sort: 'rank', country: normalized }
        });
        if (data.success) {
          handleProductsLoaded(data.data);
          const label = resolveCountryName(normalized);
          setGeoScope({ type: 'country', country: normalized });
          setLocationSummary(label);
          setLocationCountry(normalized);
          toast.success(`Filtrando por ${label}.`);
        } else {
          toast.error('Nenhum produto encontrado neste país.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Erro ao filtrar por país.');
      } finally {
        setCountryShortcutApplying(false);
      }
    },
    [handleProductsLoaded]
  );

  const handleRegionApplied = useCallback((details) => {
    if (!details) return;
    const bounds = details.bounds || details;
    if (boundsAreValid(bounds)) {
      setGeoScope({ type: 'bbox', bounds, country: details.country || preferredCountry });
    }
    const label = typeof details.label === 'string' && details.label.trim()
      ? details.label.trim()
      : 'Região selecionada no mapa';
    setLocationSummary(label);
    setLocationCountry(details.country ? String(details.country).toUpperCase() : null);
  }, [preferredCountry]);

  const handleClearAllFilters = useCallback(() => {
    setSearchSummary(null);
    setLocationSummary(null);
    setLocationCountry(null);
    setCategoryFilter(null);
    setViewMode('all');
    setGeoScope({ type: 'country', country: preferredCountry });
    setExternalResetToken((token) => token + 1);
    loadDefaultProducts();
  }, [loadDefaultProducts, preferredCountry]);

  // sincronizar favoritos offline quando não logado
  useEffect(() => {
    if (token) return;
    if (!favoriteIds.length) {
      setFavoriteItems([]);
      return;
    }
    setFavoriteItems(products.filter((p) => favoriteIds.includes(p.id)));
  }, [token, products, favoriteIds]);

  const freeProducts = products.filter((p) => isProductFree(p));
  const displayedProducts = viewMode === 'free' ? freeProducts : products;
  const activeFilters = [];
  if (searchSummary) {
    activeFilters.push({ id: 'search', label: `Busca: ${searchSummary}` });
  }
  if (locationSummary && !locationCountry) {
    activeFilters.push({
      id: 'location',
      label: locationSummary,
      flag: null,
      theme: null
    });
  }
  if (categoryFilter) {
    activeFilters.push({ id: 'category', label: `Categoria: ${categoryFilter}` });
  }

  if (viewMode === 'free') {
    activeFilters.push({ id: 'free', label: 'Somente gratuitos' });
  }

  function toggleFavorite(id) {
    if (!id) return;
    if (!token) {
      setFavoriteIds((prev) => {
        const exists = prev.includes(id);
        const updated = exists ? prev.filter((f) => f !== id) : [...prev, id];
        localStorage.setItem('favorites', JSON.stringify(updated));
        setFavoriteItems(products.filter((p) => updated.includes(p.id)));
        return updated;
      });
      return;
    }
    if (favoriteLoading || pendingFavorite === id) return;
    const willFavorite = !favoriteIds.includes(id);
    setPendingFavorite(id);
    const request = willFavorite
      ? api.post('/favorites', { product_id: id })
      : api.delete(`/favorites/${id}`);
    request
      .then(() => {
        const delta = willFavorite ? 1 : -1;
        setFavoriteIds((prev) =>
          willFavorite ? [...prev, id] : prev.filter((favId) => favId !== id)
        );
        setFavoriteItems((prev) => {
          const updatedPrev = updateLikesInCollection(prev, id, delta);
          if (willFavorite) {
            if (prev.some((item) => item.id === id)) return updatedPrev;
            const product = products.find((p) => p.id === id);
            return product
              ? [applyLikeDelta(product, delta), ...updatedPrev]
              : updatedPrev;
          }
          return updatedPrev.filter((item) => item.id !== id);
        });
        setProducts((prev) => updateLikesInCollection(prev, id, delta));
        toast.success(
          willFavorite
            ? 'Produto adicionado aos favoritos.'
            : 'Produto removido dos favoritos.'
        );
      })
      .catch((err) => {
        console.error(err);
        toast.error('Não foi possível atualizar seus favoritos.');
      })
      .finally(() => setPendingFavorite(null));
  }

  // observar produtos visíveis para contar view
  useEffect(() => {
    if (!products.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const attr = entry.target.getAttribute('data-product-id');
          const id = Number(attr);
          if (!id || observedRef.current.has(id)) return;
          observedRef.current.add(id);
          registerView(id);
        });
      },
      { threshold: 0.4 }
    );

    const nodes = document.querySelectorAll('[data-product-id]');
    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [products, viewMode, registerView]);

  // fechar drawers clicando fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setActiveDrawer(false);
      }
    }
    if (activeDrawer) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDrawer]);

  // fechar menu do perfil clicando fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const heroSubtitle = token
    ? '.'
    : 'Crie sua conta para favoritar produtos, falar com vendedores e confirmar compras.';

  const sellerAlertLabel =
    token && buyerOrders.length
      ? `${buyerOrders.length} compra${buyerOrders.length > 1 ? 's' : ''} confirmada${buyerOrders.length > 1 ? 's' : ''
        }`
      : '';

  const favoriteCountLabel =
    favoriteIds.length === 1
      ? '1 favorito'
      : `${favoriteIds.length} favoritos`;

  const hasProfile = Boolean(token);
  const searchRowStyle = {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem'
  };
  const searchWrapperStyle = {
    position: 'relative',
    paddingRight: hasProfile ? '72px' : 0
  };

  return (
    <div className="home-page">
      <section className="home-hero">

        <div className="home-hero__tools">
          <div className="home-hero__searchrow" style={searchRowStyle}>
            {/* bloco SearchBar existente */}
            <div className="home-hero__search" style={searchWrapperStyle}>
              <SearchBar
                onProductsLoaded={handleProductsLoaded}
                onFiltersChange={handleSearchFilters}
                resetSignal={externalResetToken}
                onOpenMap={() => mapOpenRef.current?.()}
                geoScope={geoScope}
                originCountry={preferredCountry}
                categoryOptions={categoryOptions}
                categoryFilter={categoryFilter}
                categoryLoading={categoryLoading}
                onCategorySelect={handleCategoryFilter}
                locationSummary={locationSummary}
              />
              {token && (
                <div className="home-profile home-profile--inline" ref={profileMenuRef}>
                  <button
                    type="button"
                    className="home-profile__avatarbtn"
                    onClick={() => setShowProfileMenu((v) => !v)}
                    aria-label="Abrir menu do perfil"
                  >
                    {user?.profile_image_url ? (
                      <img
                        src={user.profile_image_url}
                        alt={user.username || 'Perfil'}
                        className="home-profile__avatarimg"
                        onError={(e) => {
                          e.currentTarget.src = '';
                          e.currentTarget.classList.add('home-profile__avatarimg--fallback');
                        }}
                      />
                    ) : (
                      <span className="home-profile__avatarfallback">
                        {(user?.username || 'U')
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </button>

                  {showProfileMenu && (
                    <div className="home-profile__menu">
                      <div className="home-profile__menu-header">
                        <div className="home-profile__menu-avatar">
                          {user?.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt={user.username || 'Perfil'}
                              className="home-profile__menu-avatarimg"
                              onError={(e) => {
                                e.currentTarget.src = '';
                                e.currentTarget.classList.add('home-profile__menu-avatarimg--fallback');
                              }}
                            />
                          ) : (
                            <span className="home-profile__menu-avatarfallback">
                              {(user?.username || 'U')
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="home-profile__menu-info">
                          <p className="home-profile__menu-name">{user?.username || 'Usuário'}</p>
                          {user?.city ? (
                            <p className="home-profile__menu-meta">{user.city}</p>
                          ) : (
                            <p className="home-profile__menu-meta">Perfil incompleto</p>
                          )}
                        </div>
                      </div>

                      <Link
                        to="/edit-profile"
                        className="home-profile__menu-item"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        Editar perfil
                      </Link>
                 
                     
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="home-hero__toolbar">
  <div className="home-hero__row-scroll">
    {/* Grupo ESQUERDA: Todos / Gratuitos */}
    <div className="home-hero__group home-hero__group--left">
      <button
        type="button"
        onClick={() => setViewMode('all')}
        className={`home-hero__pill ${viewMode === 'all' ? 'is-active' : ''}`}
      >
        <span>Todos</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode('free')}
        disabled={!freeProducts.length}
        className={`home-hero__pill ${viewMode === 'free' ? 'is-active' : ''} ${!freeProducts.length ? 'is-disabled' : ''}`}
      >
        <span>Gratuitos</span>
        {Boolean(freeProducts.length) && (
          <span className="home-hero__pill-badge">{freeProducts.length}</span>
        )}
      </button>
    </div>

    {/* Grupo DIREITA: Favoritos / Confirmados */}
    <div className="home-hero__group home-hero__group--right">
      {/* Favoritos */}
      <button
        type="button"
        onClick={openFavoritesDrawer}
        className="home-hero__iconchip"
        aria-label="Abrir favoritos"
      >
        <span className="home-hero__iconchip-icon">♥</span>
        <span className="home-hero__iconchip-label">{favoriteIds.length}</span>
      </button>

      {/* Confirmados */}
      {token && (
        <button
          type="button"
          onClick={openOrdersDrawer}
          className={`home-hero__iconchip ${hasNewConfirmed ? 'has-new' : ''} ${
            showConfirmedAttention ? 'is-attention' : ''
          }`}
          aria-label="Abrir compras confirmadas"
        >
          <span className="home-hero__iconchip-icon">✔</span>
          <span className="home-hero__iconchip-label">
            {hasNewConfirmed ? 'Novo!' : buyerOrders.length || '0'}
          </span>
          <AnimatePresence>
            {hasNewConfirmed && (
              <motion.span
                className="home-hero__confirmed-note"
                key="confirmed-note"
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 6 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                aria-live="polite"
              >
                Pedido confirmado!
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}
    </div>

    {/* MapSearch continua depois dos grupos */}
    <div className="home-hero__map-inline">
      <MapSearch
        onProductsLoaded={handleProductsLoaded}
        onRegionApplied={handleRegionApplied}
        resetSignal={externalResetToken}
        onRegisterOpenMap={(fn) => {
          mapOpenRef.current = fn;
        }}
      />
    </div>
  </div>
</div>

  </div>
      </section>

      {(activeFilters.length > 0 || countryShortcuts.length > 0) && (
        <section className="home-active-filters mb-0">

          
          {activeFilters.length > 0 && (
            <div className="home-active-filters__chips">
              {activeFilters.map((filter) => (
                <span
                  key={filter.id}
                  className={`home-active-filters__chip ${
                    filter.theme ? `${filter.theme.border} ${filter.theme.bg} ${filter.theme.text}` : ''
                  }`}
                >
                  {filter.flag && (
                    <img
                      src={filter.flag}
                      alt={filter.label}
                      className="w-5 h-5 rounded-sm object-cover mr-1.5 border border-white/50"
                      loading="lazy"
                    />
                  )}
                  {filter.label}
                </span>
              ))}
            </div>
          )}

          {/*
{countryShortcuts.length > 0 && (
  <div className="home-country-shortcuts">
    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
      Países com anúncios
    </p>
    <div className="home-country-shortcuts__scroll gap-1">
      {countryShortcuts.map((item) => {
        const flag = getFlagUrl(item.country);
        const label = resolveCountryName(item.country);
        const theme = getCountryTheme(item.country);
        const isActive = locationCountry === item.country;
        return (
          <button
            key={item.country}
            type="button"
            onClick={() => handleCountryShortcut(item.country)}
            disabled={countryShortcutApplying}
            className={`home-country-shortcuts__chip px-1.5 py-[3px] rounded-md gap-1 ${
              isActive
                ? `${theme.border} ${theme.bg} ${theme.text}`
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            } transition-colors duration-150 ease-in-out ${
              countryShortcutApplying ? 'opacity-70' : ''
            }`}
            title={`${label} (${item.total} anúncios)`}
          >
            {flag ? (
              <img
                src={flag}
                alt={label}
                className="home-country-shortcuts__flag w-2 h-2"
                loading="lazy"
              />
            ) : (
              <span className="home-country-shortcuts__flag home-country-shortcuts__flag--fallback">
                {item.country}
              </span>
            )}
            <span className="home-country-shortcuts__label text-[6px] leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  </div>
)}
*/}
</section>
      )}

      {/* grade de produtos pública */}
      <section className="home-grid-section mt-2">

        {displayedProducts.length === 0 ? (
          <div className="home-empty-state">
            <h2>
              {viewMode === 'free'
                ? 'Nenhum anúncio gratuito encontrado.'
                : 'Nenhum produto encontrado.'}
            </h2>
            <p>Experimente ajustar os filtros ou explorar outras localidades no mapa.</p>
          </div>
        ) : (
          <div className="home-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 p-1">
            {displayedProducts.map((product) => {
              const mainImage = product.image_urls?.[0] || product.image_url;
              const freeTag = isProductFree(product);
              const isFavorited = favoriteIds.includes(product.id);
              const likeCount = getProductLikes(product);

              return (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    data-product-id={product.id}
                    onClick={() => registerClick(product.id)}
                    className="home-card group bg-white border border-gray-100 rounded-xl shadow-sm transition hover:shadow-2xl relative overflow-hidden"
                  >
                  <div className="home-card__media relative w-full h-36 sm:h-40 lg:h-52 xl:h-56 overflow-hidden rounded-t-xl">
                    <div className="home-card__slideshow absolute inset-0 w-full h-full overflow-hidden">
                      <img
                        src={mainImage || IMG_PLACEHOLDER}
                        alt={product.title}
                        className="home-card__image w-full h-full object-cover transition-opacity duration-300"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          e.currentTarget.src = IMG_PLACEHOLDER;
                          e.currentTarget.onerror = null;
                        }}
                      />

                      {Array.isArray(product.image_urls) && product.image_urls.length > 1 && (
                        <img
                          src={product.image_urls[1] || IMG_PLACEHOLDER}
                          alt=""
                          className="home-card__image2 w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            e.currentTarget.src = IMG_PLACEHOLDER;
                            e.currentTarget.onerror = null;
                          }}
                        />
                      )}
                    </div>
                    {freeTag && (
                      <span className="home-card__badge absolute top-2 left-2 bg-green-600 text-white text-[11px] px-2 py-[2px] rounded-md shadow">
                        Grátis
                      </span>
                    )}

                    <button
                      type="button"
                      aria-label={
                        isFavorited
                          ? 'Remover dos favoritos'
                          : 'Adicionar aos favoritos'
                      }
                      aria-pressed={isFavorited}
                      disabled={pendingFavorite === product.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      className={`home-card__favorite absolute top-2 right-2 bg-white/80 border border-gray-200 w-8 h-8 flex items-center justify-center rounded-full shadow-sm hover:shadow transition ${
                        pendingFavorite === product.id ? 'is-loading' : ''
                      } ${isFavorited ? 'is-active' : ''}`}
                    >
                      ♥
                    </button>
                  </div>

                  <div className="home-card__content p-3 flex flex-col gap-1.5"> <div
                      className="home-card__metrics flex items-center gap-2 text-gray-500 text-xs mt-1"
                      aria-label="Curtidas"
                    >
                      
                        <span className="home-card__metric-icon text-red-500">♥</span>
                        <span className="home-card__metric-value">{likeCount}</span>
                       
                    
                    </div>
                    <p className="home-card__title text-sm font-semibold text-gray-800 line-clamp-2">
                      {product.title}
                    </p>
                    <p
                      className={`home-card__price text-base font-bold ${
                        freeTag ? 'text-green-600' : 'text-gray-900'
                      }`}
                    >
                      {freeTag
                        ? 'Grátis'
                        : formatProductPrice(product.price, product.country)}
                    </p>
                    <p className="home-card__location text-xs text-gray-500">
                      {product.city}
                    </p>
                   

                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      

      <AnimatePresence>
        {activeDrawer && (
          <>
            <motion.div
              className="home-drawer__overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              ref={drawerRef}
              className="home-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            >
              <header className="home-drawer__header">
                <nav className="home-drawer__tabs" aria-label="Painéis da home">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('favorites')}
                    className={`home-drawer__tab ${drawerTab === 'favorites' ? 'is-active' : ''}`}
                  >
                    Favoritos <span>({favoriteIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('orders')}
                    className={`home-drawer__tab ${drawerTab === 'orders' ? 'is-active' : ''}`}
                  >
                    Compras <span>({buyerOrders.length})</span>
                  </button>
                </nav>
                <button
                  type="button"
                  className="home-drawer__close"
                  onClick={() => setActiveDrawer(false)}
                >
                  ✕
                </button>
              </header>

              <div className="home-drawer__body">
                {drawerTab === 'favorites' ? (
                  <div className="home-drawer__section">
                    <p className="home-drawer__eyebrow">Coleção pessoal</p>
                    <h2 className="home-drawer__title">
                      {favoriteIds.length
                        ? `Você tem ${favoriteIds.length} favorit${favoriteIds.length > 1 ? 'os' : 'o'}`
                        : 'Nenhum favorito salvo'}
                    </h2>

                    <div className="home-drawer__content">
                      {favoriteLoading ? (
                        <p className="home-drawer__empty">Carregando favoritos...</p>
                      ) : favoriteItems.length === 0 ? (
                        <p className="home-drawer__empty">
                          Marque produtos como favoritos para acessá-los rapidamente aqui.
                        </p>
                      ) : (
                        favoriteItems.map((product) => (
                          <Link
                            key={product.id}
                            to={`/product/${product.id}`}
                            className="home-fav-card"
                            onClick={() => {
                              registerClick(product.id);
                              setActiveDrawer(false);
                            }}
                          >
                            <div className="home-fav-card__image-wrapper">
                              <img
                                src={
                                  product.image_urls?.[0] ||
                                  product.image_url ||
                                  IMG_PLACEHOLDER
                                }
                                alt={product.title}
                                className="home-fav-card__image"
                                loading="eager"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  e.currentTarget.src = IMG_PLACEHOLDER;
                                  e.currentTarget.onerror = null;
                                }}
                              />
                            </div>
                            <div className="home-fav-card__details">
                              <p className="home-fav-card__title">{product.title}</p>
                              <p
                                className={`home-fav-card__price ${
                                  isProductFree(product) ? 'is-free' : ''
                                }`}
                              >
                                {isProductFree(product)
                                  ? 'Grátis'
                                  : formatProductPrice(product.price, product.country)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={pendingFavorite === product.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFavorite(product.id);
                              }}
                              className={`home-fav-card__favorite ${
                                pendingFavorite === product.id ? 'is-loading' : ''
                              }`}
                            >
                              ♥
                            </button>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="home-drawer__section">
                    <p className="home-drawer__eyebrow">Compras confirmadas</p>
                    <h2 className="home-drawer__title">
                      {buyerOrders.length
                        ? `Meus pedidos confirmados (${buyerOrders.length})`
                        : 'Nenhum pedido confirmado ainda'}
                    </h2>

                    <div className="home-drawer__content">
                      {buyerOrders.length === 0 ? (
                        <p className="home-drawer__empty">
                          Assim que um vendedor confirmar o seu pedido, ele aparece aqui.
                        </p>
                      ) : (
                        buyerOrders.map((order) => {
                          const imageList = parseImageList(order.image_urls);
                          const productImage =
                            imageList[0] ||
                            toAbsoluteImageUrl(order.image_url) ||
                            IMG_PLACEHOLDER;

                          const productTitle =
                            order.product_title ||
                            `Produto #${order.product_id || ''}`;
                          const productLink = `/product/${order.product_id}`;
                          const messageLink = `/messages?product=${
                            order.product_id
                          }${order.seller_id ? `&seller=${order.seller_id}` : ''}${
                            order.seller_name
                              ? `&sellerName=${encodeURIComponent(order.seller_name)}`
                              : ''
                          }`;

                          return (
                            <article key={order.id} className="home-orders-card">
                              <div className="home-orders-card__imgwrap">
                                <img
                                  src={productImage || IMG_PLACEHOLDER}
                                  alt={productTitle}
                                  className="home-orders-card__img"
                                  onError={(e) => {
                                    e.currentTarget.src = IMG_PLACEHOLDER;
                                    e.currentTarget.onerror = null;
                                  }}
                                />
                              </div>

                              <div className="home-orders-card__body">
                                <p className="home-orders-card__title">{productTitle}</p>

                                <div className="home-orders-card__actions">
                                  <Link
                                    to={productLink}
                                    className="home-orders-btn home-orders-btn--view"
                                    onClick={() => {
                                      if (order.product_id) registerClick(order.product_id);
                                      navigate(productLink);
                                      setActiveDrawer(false);
                                    }}
                                  >
                                    Ver produto
                                  </Link>

                                  {order.seller_id ? (
                                    <Link
                                      to={`/users/${order.seller_id}`}
                                      className="home-orders-btn home-orders-btn--rate"
                                      onClick={() => setActiveDrawer(false)}
                                    >
                                      Avaliar vendedor
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      className="home-orders-btn home-orders-btn--rate home-orders-btn--disabled"
                                      disabled
                                    >
                                      Avaliar vendedor
                                    </button>
                                  )}

                                  <Link
                                    to={messageLink}
                                    className="home-orders-btn home-orders-btn--chat"
                                    onClick={() => setActiveDrawer(false)}
                                  >
                                    Falar com o vendedor
                                  </Link>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
