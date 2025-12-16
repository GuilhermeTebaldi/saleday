// frontend/src/pages/Home.jsx
// Página inicial com destaques, busca e feed de produtos.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBar from '../components/SearchBar.jsx';
import MapSearch from '../components/MapSearch.jsx';
import { parseImageList, toAbsoluteImageUrl } from '../utils/images.js';

import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext.jsx';
import GeoContext from '../context/GeoContext.jsx';
import formatProductPrice from '../utils/currency.js';
import { detectCountryFromTimezone } from '../utils/timezoneCountry.js';
import { localeFromCountry } from '../i18n/localeMap.js';
import { isProductFree } from '../utils/product.js';
import { getCountryLabel, normalizeCountryCode } from '../data/countries.js';
import { getProductKey, mergeProductLists } from '../utils/productCollections.js';
import usePreventDrag from '../hooks/usePreventDrag.js';
import BuyerOrdersList from '../components/BuyerOrdersList.jsx';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';

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
const formatPostDate = (value, locale = 'pt-BR') => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    locale,
    day: '2-digit',
    month: 'short',
  }).format(date);
};
const isActive = (p) => (p?.status || 'active') !== 'sold';
const FAVORITE_FIELDS = ['likes_count', 'likes', 'favorites_count'];

const normalizeId = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num;
};


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
      const storedPref = normalizeCountryCode(
        window.localStorage.getItem('saleday.preferredCountry')
      );
      if (storedPref) return storedPref;

      const candidates = [];

      const storedLocale = window.localStorage.getItem('saleday.locale');
      if (storedLocale) candidates.push(storedLocale);

      if (typeof window.navigator !== 'undefined') {
        if (window.navigator.language) candidates.push(window.navigator.language);
        if (Array.isArray(window.navigator.languages)) {
          candidates.push(...window.navigator.languages);
        }
      }

      if (
        typeof window.Intl !== 'undefined' &&
        typeof window.Intl.DateTimeFormat === 'function'
      ) {
        const intlLocale = window.Intl.DateTimeFormat().resolvedOptions?.().locale;
        if (intlLocale) candidates.push(intlLocale);
      }

      for (const candidate of candidates) {
        const region = extractRegionFromLocale(candidate);
        const normalizedRegion = normalizeCountryCode(region);
        if (normalizedRegion) return normalizedRegion;
      }
      const timezone =
        typeof window.Intl !== 'undefined'
          ? window.Intl.DateTimeFormat().resolvedOptions?.().timeZone
          : null;
      const timezoneCountry = detectCountryFromTimezone(timezone);
      if (timezoneCountry) return timezoneCountry;
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_COUNTRY;
};

const MAP_CENTER_KEY = 'saleday.map.center';
const readStoredMapCenter = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MAP_CENTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    const zoom = Number(parsed?.zoom);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat,
        lng,
        zoom: Number.isFinite(zoom) ? zoom : null
      };
    }
    return null;
  } catch {
    return null;
  }
};

const writeStoredMapCenter = (center) => {
  if (!center || typeof window === 'undefined') return;
  try {
    const payload = {
      lat: center.lat,
      lng: center.lng,
      zoom: center.zoom ?? null
    };
    window.localStorage.setItem(MAP_CENTER_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const buildProductImageSources = (product) => {
  const normalized = [];
  const seen = new Set();
  const pushImage = (value) => {
    const resolved = toAbsoluteImageUrl(value);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      normalized.push(resolved);
    }
  };

  if (product?.image_url) {
    pushImage(product.image_url);
  }

  const parsed = parseImageList(product?.image_urls);
  for (const entry of parsed) {
    pushImage(entry);
  }

  return normalized.length ? normalized : [IMG_PLACEHOLDER];
};

const formatNumberLabel = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
};

const pickProductFacts = (product) => {
  if (!product) return [];
  const factPool = [];
  const addFact = (text) => {
    if (text) {
      const normalized = String(text).trim();
      if (!normalized) return;
      if (!factPool.includes(normalized)) {
        factPool.push(normalized);
      }
    }
  };
  const category = (product.category || '').toLowerCase();
  const addCategory = () => {
    if (!product.category) return;
    addFact(product.category);
  };

  addCategory();
  const serviceType = product.service_type || product.serviceType;
  const serviceDuration = product.service_duration || product.serviceDuration;
  const serviceRate = product.service_rate || product.serviceRate;
  const serviceLocation = product.service_location || product.serviceLocation;

  if (serviceType) addFact(`Serviço: ${serviceType}`);
  if (serviceDuration) addFact(`Duração: ${serviceDuration}`);
  if (serviceRate) addFact(`Valor/h: ${serviceRate}`);
  if (serviceLocation) addFact(`Local: ${serviceLocation}`);

  const jobTitle = product.job_title || product.jobTitle;
  const jobType = product.job_type || product.jobType;
  const jobSalary = product.job_salary || product.jobSalary;
  const jobRequirements = product.job_requirements || product.jobRequirements;

  if (jobTitle) addFact(`Cargo: ${jobTitle}`);
  if (jobType) addFact(`Vaga: ${jobType}`);
  if (jobSalary) addFact(`Salário: ${jobSalary}`);
  if (jobRequirements) addFact(`Requisitos: ${jobRequirements}`);

  const estateKeywords = [
    'apto',
    'apartamento',
    'imóvel',
    'imóveis',
    'imoveis',
    'casas',
    'casa',
    'aluguel',
    'flat',
    'kitnet',
    'terreno',
    'quarto',
    'quartos',
    'temporada',
    'ape',
    'apê'
  ];
  const fashionKeywords = [
    'moda',
    'roupa',
    'vestuário',
    'vestidos',
    'fashion',
    'camisa',
    'jeans',
    'saia',
    'terno',
    'acessório',
    'acessorio',
    'acessórios',
    'acessorios'
  ];
  const isEstate =
    estateKeywords.some((keyword) => category.includes(keyword)) ||
    Boolean(product.property_type || product.surface_area || product.bedrooms || product.bathrooms || product.parking || product.rent_type);
  const isFashion = fashionKeywords.some((keyword) => category.includes(keyword));

  const parking = formatNumberLabel(product.parking);
  const parkingLabel = parking !== null ? `${parking} vaga${parking > 1 ? 's' : ''}` : null;

  if (isEstate) {
    const area = formatNumberLabel(product.surface_area);
    if (area !== null) addFact(`${area} m²`);
    const bedrooms = formatNumberLabel(product.bedrooms);
    if (bedrooms !== null) addFact(`${bedrooms} quarto${bedrooms > 1 ? 's' : ''}`);
    const bathrooms = formatNumberLabel(product.bathrooms);
    if (bathrooms !== null) addFact(`${bathrooms} banheiro${bathrooms > 1 ? 's' : ''}`);
    if (parkingLabel) addFact(parkingLabel);
  } else if (isFashion) {
    if (product.brand) addFact(`Marca: ${product.brand}`);
    if (product.model) addFact(`Modelo: ${product.model}`);
    if (product.color) addFact(`Cor: ${product.color}`);
    if (!product.brand && !product.model && !product.color && product.year) {
      addFact(`Ano: ${product.year}`);
    }
  } else {
    if (product.brand) addFact(`Marca: ${product.brand}`);
    if (product.model) addFact(`Modelo: ${product.model}`);
    if (product.year) addFact(`Ano: ${product.year}`);
    if (product.color && factPool.length < 3) addFact(`Cor: ${product.color}`);
  }

  if (!isEstate && parkingLabel) {
    if (factPool.length < 3) {
      addFact(parkingLabel);
    } else if (!factPool.includes(parkingLabel)) {
      factPool[factPool.length - 1] = parkingLabel;
    }
  }

  const maxFacts = 5;
  return factPool.slice(0, maxFacts);
};

const ProductImageGallery = ({ images = [], alt = '', productId, galleryKey }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pointerStartX = useRef(null);
  const clickBlocked = useRef(false);

  const imageSources = images.length ? images : [IMG_PLACEHOLDER];
  const totalImages = imageSources.length;
  const currentImage = imageSources[currentIndex] ?? IMG_PLACEHOLDER;

  useEffect(() => {
    setCurrentIndex(0);
  }, [productId, galleryKey]);

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, totalImages - 1));
  }, [totalImages]);

  const wrapIndex = useCallback(
    (value) => {
      if (!totalImages) return 0;
      const next = value % totalImages;
      return next < 0 ? next + totalImages : next;
    },
    [totalImages]
  );

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => wrapIndex(prev + 1));
  }, [wrapIndex]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => wrapIndex(prev - 1));
  }, [wrapIndex]);

  const captureStart = useCallback((clientX) => {
    if (clientX === null || clientX === undefined) return;
    pointerStartX.current = clientX;
  }, []);

  const handleSwipeEnd = useCallback(
    (clientX) => {
      if (pointerStartX.current === null || clientX === null || clientX === undefined) {
        return;
      }
      const delta = clientX - pointerStartX.current;
      pointerStartX.current = null;
      if (Math.abs(delta) < 25) return;
      clickBlocked.current = true;
      if (delta < 0) {
        goNext();
      } else {
        goPrev();
      }
    },
    [goNext, goPrev]
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (event?.pointerType === 'mouse' || event?.pointerType === 'pen') {
        event.preventDefault();
      }
      captureStart(event.clientX);
    },
    [captureStart]
  );

  const handlePointerUp = useCallback(
    (event) => {
      handleSwipeEnd(event.clientX);
    },
    [handleSwipeEnd]
  );

  const handleTouchStart = useCallback(
    (event) => {
      const touch = event.touches?.[0];
      if (touch) {
        captureStart(touch.clientX);
      }
    },
    [captureStart]
  );

  const handleTouchEnd = useCallback(
    (event) => {
      const touch = event.changedTouches?.[0];
      if (touch) {
        handleSwipeEnd(touch.clientX);
      }
    },
    [handleSwipeEnd]
  );

  const handlePointerLeave = useCallback(() => {
    pointerStartX.current = null;
  }, []);

  const handleClick = useCallback((event) => {
    if (!clickBlocked.current) return;
    event.preventDefault();
    event.stopPropagation();
    clickBlocked.current = false;
  }, []);

  return (
    <div
      className="home-card__media-gallery prevent-drag"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div
        key={currentImage}
        role="img"
        aria-label={alt || 'Foto do anúncio'}
        className="home-card__image w-full h-full object-cover home-card__image-bg"
        style={{
          backgroundImage: `url(${JSON.stringify(currentImage)})`
        }}
      />

      {totalImages > 1 && (
        <>
          <button
            type="button"
            className="home-card__media-arrow home-card__media-arrow--left"
            aria-label="Foto anterior"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goPrev();
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="home-card__media-arrow home-card__media-arrow--right"
            aria-label="Próxima foto"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goNext();
            }}
          >
            ›
          </button>
          <div className="home-card__media-indicator" aria-hidden="true">
            {imageSources.map((_, index) => (
              <span
                key={index}
                className={`home-card__media-indicator-dot ${
                  index === currentIndex ? 'is-active' : ''
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const normalizeCenter = (candidate) => {
  if (!candidate) return null;
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const zoomValue = Number(candidate.zoom);
  return {
    lat,
    lng,
    zoom: Number.isFinite(zoomValue) ? zoomValue : null
  };
};

const boundsAreValid = (bounds) => {
  if (!bounds) return false;
  return ['minLat', 'maxLat', 'minLng', 'maxLng'].every((key) =>
    Number.isFinite(Number(bounds[key]))
  );
};

const deriveCenterFromBounds = (bounds) => {
  if (!bounds) return null;
  const minLat = Number(bounds.minLat);
  const maxLat = Number(bounds.maxLat);
  const minLng = Number(bounds.minLng);
  const maxLng = Number(bounds.maxLng);
  if (
    Number.isFinite(minLat) &&
    Number.isFinite(maxLat) &&
    Number.isFinite(minLng) &&
    Number.isFinite(maxLng)
  ) {
    return {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2
    };
  }
  return null;
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
  const targetId = normalizeId(productId);
  return collection.map((item) =>
    normalizeId(item.id) === targetId ? applyLikeDelta(item, delta) : item
  );
};


export default function Home() {
  const { token, user } = useContext(AuthContext);
  const {
    country: detectedCountry,
    lat: detectedLat,
    lng: detectedLng,
    locale: detectedLocale
  } = useContext(GeoContext);
  const navigate = useNavigate();
  const location = useLocation();
  const preferredCountry = useMemo(
    () => detectPreferredCountry(user?.country, detectedCountry),
    [user?.country, detectedCountry]
  );
  const homeLocale = useMemo(() => {
    const userLocale = user?.country ? localeFromCountry(user.country) : null;
    return userLocale || detectedLocale || 'pt-BR';
  }, [detectedLocale, user?.country]);
  const [geoScope, setGeoScope] = useState(() => ({ type: 'country', country: preferredCountry }));

  // produtos / favoritos (já existia)
  const [products, setProducts] = useState([]);
  const [lastMapCenter, setLastMapCenter] = useState(() => readStoredMapCenter());
  const productsRef = useRef([]);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'free'
  const [favoriteIds, setFavoriteIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem('favorites');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeId) : [];
    } catch {
      return [];
    }
  });
  
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [pendingFavorite, setPendingFavorite] = useState(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState('favorites'); // 'favorites' | 'orders'

  const {
    orders: buyerOrders,
    hasUnseenOrders,
    unseenCount,
    markOrdersSeen
  } = usePurchaseNotifications();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const drawerParam = params.get('drawer');
    if (drawerParam !== 'favorites' && drawerParam !== 'orders') return;
    setDrawerTab(drawerParam);
    setActiveDrawer(true);
    if (drawerParam === 'orders') {
      markOrdersSeen?.();
    }
    params.delete('drawer');
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : ''
      },
      { replace: true }
    );
  }, [location.search, location.pathname, navigate, markOrdersSeen]);
  const drawerRef = useRef(null);
  const handlePersistMapCenter = useCallback((center) => {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
    setLastMapCenter(center);
    writeStoredMapCenter(center);
  }, []);
  const mapOpenRef = useRef(null);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const [pulseTarget, setPulseTarget] = useState(null);
  const pulseTimerRef = useRef(null);

  // pedidos confirmados do comprador
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

  // controle de interseção de view
  const observedRef = useRef(new Set());
  // menu do avatar
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // botão "voltar ao topo"
  const [showTop, setShowTop] = useState(false);
  usePreventDrag(['.home-card__media-gallery']);

  useEffect(() => {
    // Reload automático desativado para evitar loop/tela branca em produção
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
    if (!preferredCountry || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('saleday.preferredCountry', preferredCountry);
    } catch {
      // ignora falha de storage (modo privado, quota, etc.)
    }
  }, [preferredCountry, handlePersistMapCenter]);

  useEffect(() => {
    setGeoScope((current) => {
      if (!preferredCountry) return current;
      if (current?.type !== 'country') return current;
      if (current.country === preferredCountry) return current;
      return { type: 'country', country: preferredCountry };
    });
  }, [preferredCountry, handlePersistMapCenter]);
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
        setFavoriteIds((prev) => {
          const valid = prev.filter((id) =>
            allProducts.some((p) => normalizeId(p.id) === id)
          );
          if (valid.length !== prev.length && typeof window !== 'undefined') {
            try {
              window.localStorage.setItem('favorites', JSON.stringify(valid));
            } catch {
              // ignora erro de storage
            }
          }
          return valid;
        });
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
      let ids = [];
      if (typeof window !== 'undefined') {
        try {
          const saved = window.localStorage.getItem('favorites');
          ids = saved ? JSON.parse(saved) : [];
        } catch {
          ids = [];
        }
      }
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
    setFavoriteIds(
      items.map((item) =>
        normalizeId(item.product_id ?? item.id)
      )
    );
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

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  // NOVO: carregar pedidos confirmados do comprador
  const openFavoritesDrawer = useCallback(() => {
    setDrawerTab('favorites');
    setActiveDrawer(true);
  }, []);

  // registrar click e view
  const registerClick = useCallback((productId) => {
    if (!productId) return;
    api.put(`/products/${productId}/click`).catch(() => {});
  }, []);

  const registerView = useCallback(async (productId) => {
    if (!productId) return;
    const key = `viewed:${productId}`;

    let storage = null;
    if (typeof window !== 'undefined') {
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }
    }

    if (storage && storage.getItem(key)) return;

    try {
      await api.put(`/products/${productId}/view`);
      if (storage) {
        storage.setItem(key, '1');
      }
    } catch {
      // ignore
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
      const persistedCenter = normalizeCenter(details);
      if (persistedCenter) {
        handlePersistMapCenter(persistedCenter);
      }
      if (derivedBounds) {
        setGeoScope({ type: 'bbox', bounds: derivedBounds });
      } else {
        setGeoScope({ type: 'country', country: preferredCountry });
      }
      setLocationSummary(label);
      setLocationCountry(null);
      return;
    }
  }, [preferredCountry, handlePersistMapCenter]);

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
    const hasBounds = boundsAreValid(bounds);
    if (hasBounds) {
      setGeoScope({ type: 'bbox', bounds, country: details.country || preferredCountry });
    }
    const boundsCenter = hasBounds ? deriveCenterFromBounds(bounds) : null;
    const centerFromDetails = normalizeCenter(details.center);
    const centerToPersist = centerFromDetails || boundsCenter;
    if (centerToPersist) {
      handlePersistMapCenter(centerToPersist);
    }
    const label = typeof details.label === 'string' && details.label.trim()
      ? details.label.trim()
      : 'Região selecionada no mapa';
    setLocationSummary(label);
    setLocationCountry(details.country ? String(details.country).toUpperCase() : null);
  }, [preferredCountry, handlePersistMapCenter]);

  const mapInitialCenter = useMemo(() => {
    if (lastMapCenter) return lastMapCenter;
    if (geoScope?.type === 'bbox' && boundsAreValid(geoScope.bounds)) {
      const center = deriveCenterFromBounds(geoScope.bounds);
      if (center) return center;
    }
    if (Number.isFinite(detectedLat) && Number.isFinite(detectedLng)) {
      return { lat: detectedLat, lng: detectedLng };
    }
    return null;
  }, [lastMapCenter, geoScope, detectedLat, detectedLng]);

  const handleRegisterMapOpener = useCallback((handler) => {
    mapOpenRef.current =
      typeof handler === 'function' ? handler : null;
  }, []);

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
    setFavoriteItems(
      products.filter((p) => favoriteIds.includes(normalizeId(p.id)))
    );
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

  const triggerFavoritePulse = useCallback((id) => {
    if (!id) return;
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
    }
    setPulseTarget(id);
    pulseTimerRef.current = setTimeout(() => {
      setPulseTarget(null);
      pulseTimerRef.current = null;
    }, 520);
  }, []);

  function toggleFavorite(id) {
    if (!id) return;
    if (!token) {
    setFavoriteIds((prev) => {
      const targetId = normalizeId(id);
      const exists = prev.includes(targetId);
        const updated = exists
          ? prev.filter((f) => f !== targetId)
          : [...prev, targetId];
    
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('favorites', JSON.stringify(updated));
          } catch {
            // ignora erro de storage
          }
        }
    
        setFavoriteItems(
          products.filter((p) => updated.includes(normalizeId(p.id)))
        );
        return updated;
      });
      triggerFavoritePulse(normalizeId(id));
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
      const targetId = normalizeId(id);
    
      setFavoriteIds((prev) => {
        if (willFavorite) {
          if (prev.includes(targetId)) return prev;
          return [...prev, targetId];
        }
        return prev.filter((favId) => favId !== targetId);
      });
    
      setFavoriteItems((prev) => {
        const updatedPrev = updateLikesInCollection(prev, targetId, delta);
        if (willFavorite) {
          if (prev.some((item) => normalizeId(item.id) === targetId)) {
            return updatedPrev;
          }
          const product = products.find(
            (p) => normalizeId(p.id) === targetId
          );
          return product
            ? [applyLikeDelta(product, delta), ...updatedPrev]
            : updatedPrev;
        }
        return updatedPrev.filter(
          (item) => normalizeId(item.id) !== targetId
        );
      });
    
        setProducts((prev) => updateLikesInCollection(prev, targetId, delta));

        toast.success(
          willFavorite
            ? 'Produto adicionado aos favoritos.'
            : 'Produto removido dos favoritos.'
        );
        triggerFavoritePulse(targetId);
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
    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      return;
    }

    const observer = new window.IntersectionObserver(
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

  let content;

  try {
    content = (
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
      e.currentTarget.src = IMG_PLACEHOLDER;
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
      e.currentTarget.src = IMG_PLACEHOLDER;
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
 
</div>

  </div>
      </section>
      <MapSearch
        onProductsLoaded={handleProductsLoaded}
        onRegionApplied={handleRegionApplied}
        resetSignal={externalResetToken}
        onRegisterOpenMap={handleRegisterMapOpener}
        initialCenter={mapInitialCenter}
        initialZoom={mapInitialCenter?.zoom ?? undefined}
        onLocateUser={handlePersistMapCenter}
      />

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
                      <span className="home-country-shortcuts__label text-[6px] leading-none">
                        {label}
                      </span>
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
      <section className="home-grid-section mt-2 px-0 sm:px-0">

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
          <div className="home-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px sm:gap-1 w-full">
            {displayedProducts.map((product) => {
              const productImages = buildProductImageSources(product);
              const galleryKey = productImages.join('|');
              const freeTag = isProductFree(product);
              const productId = normalizeId(product.id);
              const isFavorited = favoriteSet.has(productId);
              const isPulsed = pulseTarget === productId;
              const likeCount = getProductLikes(product);
              const countryLabel = resolveCountryName(product.country);
              const locationParts = [product.city, countryLabel].filter(Boolean);
              const cardFacts = pickProductFacts(product);
              const postTimestamp =
                product.posted_at ||
                product.postedAt ||
                product.postedAtDate ||
                product.created_at ||
                product.updated_at ||
                '';
              const postedAtLabel = formatPostDate(postTimestamp, homeLocale);
              

              return (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    data-product-id={product.id}
                    onClick={() => registerClick(product.id)}
                    draggable="false"
                    onDragStart={(event) => event.preventDefault()}
                    className="home-card block relative w-full h-full group overflow-hidden"
>
                    <div className="home-card__media w-full aspect-square relative overflow-hidden">
                      <ProductImageGallery
                        images={productImages}
                        alt={product.title}
                        productId={product.id}
                        galleryKey={galleryKey}
                      />

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
                      } ${isFavorited ? 'is-active' : ''} ${isPulsed ? 'is-pulsed' : ''}`}
                    >
                      <span className="home-card__favorite-icon" aria-hidden="true">
                        ♥
                      </span>
                    </button>
                    <div className="home-card__likes-badge">
                      <span className="home-card__likes-icon" aria-hidden="true">♥</span>
                      <span className="home-card__metric-value">{likeCount}</span>
                    </div>
                  </div>

                    <div className="home-card__content">
                      <div className="home-card__title-bar" aria-label="Nome do produto">
                        <p className="home-card__title text-sm font-semibold text-gray-800 line-clamp-2">
                          {product.title}
                        </p>
                      </div>
                      <p
                        className={`home-card__price text-base font-bold ${
                          freeTag ? 'text-green-600' : 'text-gray-900'
                        }`}
                      >
                        {freeTag
                          ? 'Grátis'
                          : formatProductPrice(product.price, product.country)}
                      </p>
                      {cardFacts.length > 0 && (
                      <div className="home-card__facts">
                        {cardFacts.map((fact, index) => (
                          <span key={`${fact}-${index}`} className="home-card__fact-pill">
                            {fact}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="home-card__meta-row">
                      <p className="home-card__location text-xs text-gray-500">
                        {locationParts.join(' • ')}
                      </p>
                      {postedAtLabel && (
                        <span className="home-card__date-label text-xs font-semibold text-gray-400">
                          {postedAtLabel}
                        </span>
                      )}
                    </div>
                   

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
                    {hasUnseenOrders && (
                      <span className="home-drawer__badge">+{unseenCount}</span>
                    )}
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
                      <BuyerOrdersList
                        orders={buyerOrders}
                        onViewProduct={(order) => {
                          if (order?.product_id) {
                            registerClick(order.product_id);
                          }
                        }}
                        onClose={() => setActiveDrawer(false)}
                      />
                    )}
                  </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {token && (
        <Link
          to="/new-product"
          className="home-new-product-fab"
          aria-label="Publicar novo produto"
        >
          <span className="home-new-product-fab__icon" aria-hidden="true">
            +
          </span>
          <span className="home-new-product-fab__label">Nova publicação</span>
        </Link>
      )}
    </div>
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Erro ao renderizar Home:', err);
    content = (
      <div className="home-page">
        <section className="home-hero">
          <div className="home-empty-state">
            <h2>Erro ao carregar a página inicial</h2>
            <p>Tente recarregar a página ou voltar novamente em instantes.</p>
          </div>
        </section>
      </div>
    );
  }

  return content;
}
