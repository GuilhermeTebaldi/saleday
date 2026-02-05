// frontend/src/pages/Home.jsx
// Página inicial com destaques, busca e feed de produtos.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBar from '../components/SearchBar.jsx';
import MapSearch from '../components/MapSearch.jsx';
import ProductCardHome from '../components/ProductCardHome.jsx';
import { buildProductImageEntries, getPrimaryImageEntry } from '../utils/images.js';
import { IMAGE_KIND, IMAGE_KIND_BADGE_LABEL } from '../utils/imageKinds.js';

import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext.jsx';
import GeoContext from '../context/GeoContext.jsx';
import { LocaleContext } from '../context/LocaleContext.jsx';
import { getProductPriceLabel, isProductFree } from '../utils/product.js';
import { getCountryLabel, normalizeCountryCode } from '../data/countries.js';
import { getProductKey, mergeProductLists } from '../utils/productCollections.js';
import usePreventDrag from '../hooks/usePreventDrag.js';
import BuyerOrdersList from '../components/BuyerOrdersList.jsx';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';
import useLoginPrompt from '../hooks/useLoginPrompt.js';
import { getCurrentPath } from '../components/ScrollRestoration.jsx';
import LoadingBar from '../components/LoadingBar.jsx';
import { PRODUCT_CATEGORIES } from '../data/productCategories.js';

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

const QUICK_CATEGORY_SHORTCUTS = [
  { id: 'imoveis', label: 'Imóveis', icon: 'home' },
  { id: 'terreno', label: 'Terreno', icon: 'leaf' },
  { id: 'aluguel', label: 'Aluguel', icon: 'rent' },
  { id: 'veiculos', label: 'Veículos', icon: 'car' },
  { id: 'eletronicos', label: 'Eletrônicos e Celulares', icon: 'device' },
  { id: 'informatica', label: 'Informática e Games', icon: 'game' },
  { id: 'casa', label: 'Casa, Móveis e Decoração', icon: 'sofa' },
  { id: 'eletro', label: 'Eletrodomésticos', icon: 'fridge' },
  { id: 'moda', label: 'Moda e Acessórios', icon: 'hanger' },
  { id: 'beleza', label: 'Beleza e Saúde', icon: 'sparkle' },
  { id: 'bebes', label: 'Bebês e Crianças', icon: 'baby' },
  { id: 'esportes', label: 'Esportes e Lazer', icon: 'ball' },
  { id: 'hobbies', label: 'Hobbies e Colecionáveis', icon: 'star' },
  { id: 'antiguidades', label: 'Antiguidades', icon: 'antique' },
  { id: 'livros', label: 'Livros, Papelaria e Cursos', icon: 'book' },
  { id: 'instrumentos', label: 'Instrumentos Musicais', icon: 'music' },
  { id: 'ferramentas', label: 'Ferramentas e Construção', icon: 'tools' },
  { id: 'jardim', label: 'Jardim e Pet', icon: 'paw' },
  { id: 'servicos', label: 'Serviços', icon: 'briefcase' },
  { id: 'empregos', label: 'Empregos', icon: 'id' },
  { id: 'outros', label: 'Outros', icon: 'dots' }
];

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
const FAVORITE_FIELDS = ['likes_count', 'likes', 'favorites_count'];
const BOOST_PLAN_LABELS = {
  ruby: 'Ruby',
  diamond: 'Diamante',
  esmerald: 'Esmeralda'
};
const BOOST_PLAN_ICONS = {
  ruby: '/pagamntoporgemas/ruby1.png',
  diamond: '/pagamntoporgemas/diamante2.png',
  esmerald: '/pagamntoporgemas/esmeralda3.png'
};

const HOME_SNAPSHOT_KEY = 'templesale:home-snapshot';
const HOME_RESTORE_KEY = 'templesale:home-restore';

const readHomeSnapshot = () => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(HOME_SNAPSHOT_KEY) || 'null');
  } catch {
    return null;
  }
};

const writeHomeSnapshot = (payload) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(HOME_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

const clearHomeSnapshot = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(HOME_SNAPSHOT_KEY);
  } catch {
    // ignore storage failures
  }
};

const readHomeRestore = () => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(HOME_RESTORE_KEY) || 'null');
  } catch {
    return null;
  }
};

const clearHomeRestore = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(HOME_RESTORE_KEY);
  } catch {
    // ignore storage failures
  }
};

const normalizeId = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num;
};

const normalizePlanKey = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

const getGridColumns = (width) => {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
};

const renderQuickCategoryIcon = (icon) => {
  switch (icon) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M3 11.5L12 4l9 7.5M5 10.5V20h14v-9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'rent':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="4"
            y="3.5"
            width="16"
            height="18"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 8h8M8 11.5h8M8 15h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'car':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M5 12.2l1.6-3.7c.3-.7 1-1.2 1.8-1.2h7.2c.8 0 1.5.5 1.8 1.2L19 12.2c.2.5.7.8 1.2.8h.3c.8 0 1.5.7 1.5 1.5V17c0 .8-.7 1.5-1.5 1.5H19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 18H3.5C2.7 18 2 17.3 2 16.5V14.5c0-.8.7-1.5 1.5-1.5h.3c.5 0 1-.3 1.2-.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7 12.2h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7.5" cy="18" r="1.5" fill="currentColor" />
          <circle cx="16.5" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'device':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="7"
            y="2.5"
            width="10"
            height="19"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="18.2" r="1" fill="currentColor" />
        </svg>
      );
    case 'game':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6.5 7h11a4 4 0 0 1 4 4v2.5a3.5 3.5 0 0 1-3.5 3.5H6a3.5 3.5 0 0 1-3.5-3.5V11a4 4 0 0 1 4-4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 12.5h3M9 11v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="16.2" cy="11.7" r="0.9" fill="currentColor" />
          <circle cx="18.3" cy="13.5" r="0.9" fill="currentColor" />
        </svg>
      );
    case 'sofa':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M4 12.5v3.5h16v-3.5a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M6 16v3M18 16v3M4 12.5V10a2 2 0 0 1 2-2h1M20 12.5V10a2 2 0 0 0-2-2h-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'fridge':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="6"
            y="2.5"
            width="12"
            height="19"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M6 10.5h12M9.5 6.5v2M9.5 13v2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'hanger':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 5a2.2 2.2 0 0 1 2.2 2.2c0 1-.6 1.7-1.4 2.2l-.8.5v1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M3.5 16l8.5-4.5L20.5 16a1.5 1.5 0 0 1-.7 2.8H4.2A1.5 1.5 0 0 1 3.5 16z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'sparkle':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 3l1.6 3.8L17 8.4l-3.4 1.6L12 14l-1.6-4L7 8.4l3.4-1.6L12 3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 15l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'baby':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle
            cx="12"
            cy="12"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="9.2" cy="11.5" r="0.8" fill="currentColor" />
          <circle cx="14.8" cy="11.5" r="0.8" fill="currentColor" />
          <path
            d="M9.5 14.5c1.2.9 3.8.9 5 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'ball':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M4 12h16M12 4a8 8 0 0 1 0 16M12 4a8 8 0 0 0 0 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 4l2.2 4.4 4.8.7-3.5 3.4.8 4.8L12 15.8 7.7 17.3l.8-4.8L5 9.1l4.8-.7L12 4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'antique':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M9 3h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M10 3v2c0 1-1 2-2 2v2c0 2 1.8 3.5 4 3.5s4-1.5 4-3.5V7c-1 0-2-1-2-2V3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 12h8l2 6H6l2-6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M7 20h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M5 5.5h8a3 3 0 0 1 3 3v10H8a3 3 0 0 0-3 3v-16z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M16 18.5h3V7.5a2 2 0 0 0-2-2h-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'music':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M16 4v10.5a2.5 2.5 0 1 1-1.5-2.3V7l6-1.5v5.8a2.5 2.5 0 1 1-1.5-2.3V4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'tools':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M14.5 5a4 4 0 0 0-5.3 5.3l-5.7 5.7a2 2 0 0 0 2.8 2.8l5.7-5.7A4 4 0 0 0 19 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16.2" cy="7.8" r="1" fill="currentColor" />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M3 18h18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M5 18l4-5 3 3 4-6 5 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16.5" cy="7.5" r="1.4" fill="currentColor" />
        </svg>
      );
    case 'paw':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="7.5" cy="9" r="1.6" fill="currentColor" />
          <circle cx="11" cy="7.5" r="1.6" fill="currentColor" />
          <circle cx="13.8" cy="9.2" r="1.5" fill="currentColor" />
          <circle cx="16.2" cy="11.4" r="1.4" fill="currentColor" />
          <path
            d="M7.2 15.2c0-2.2 2.2-3.6 4.6-3.6s4.6 1.4 4.6 3.6-2.1 4-4.6 4-4.6-1.8-4.6-4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'briefcase':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="3"
            y="7"
            width="18"
            height="12"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1M3 12h18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'id':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="9" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M6.8 16c.6-1.4 2-2.2 3.6-2.2s3 .8 3.6 2.2M14.5 9.2h4M14.5 12h4M14.5 14.8h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'dots':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="7" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="17" cy="12" r="1.6" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
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

const normalizeMarketCountry = (value) => normalizeCountryCode(value) || '';

const MAP_CENTER_KEY = 'templesale.map.center';
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

const normalizeLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const CATEGORY_LABEL_MAP = (() => {
  const map = new Map();
  PRODUCT_CATEGORIES.forEach((label) => {
    map.set(normalizeLabel(label), label);
  });
  return map;
})();

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

  const buildQuickCategoryCounts = (list = [], activeCountry) => {
    const counts = new Map();
    list.forEach((item) => {
      const itemCountry = normalizeCountryCode(item?.country);
      if (activeCountry && itemCountry && itemCountry !== activeCountry) {
        return;
      }
      const raw = item?.category ? String(item.category).trim() : '';
      if (!raw) return;
      const normalized = normalizeLabel(raw);
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return counts;
  };


export default function Home() {
  const { token, user } = useContext(AuthContext);
  const promptLogin = useLoginPrompt();
  const {
    lat: detectedLat,
    lng: detectedLng,
    marketCountry,
    setMarketCountry,
    ready: geoReady
  } = useContext(GeoContext);
  const { locale } = useContext(LocaleContext);
  const navigate = useNavigate();
  const location = useLocation();
  const initialHomeSnapshot = useMemo(() => {
    const restore = readHomeRestore();
    if (!restore) return null;
    const currentPath = getCurrentPath();
    if (restore.path !== currentPath) return null;
    const snapshot = readHomeSnapshot();
    if (!snapshot || snapshot.path !== currentPath || !snapshot.hasActiveFilters) {
      return null;
    }
    return snapshot;
  }, []);
  const normalizedMarketCountry = useMemo(
    () => normalizeMarketCountry(marketCountry),
    [marketCountry]
  );
  const preferredCountry = useMemo(
    () => normalizedMarketCountry || DEFAULT_COUNTRY,
    [normalizedMarketCountry]
  );
  const [geoScope, setGeoScope] = useState(() =>
    initialHomeSnapshot?.geoScope || { type: 'country', country: preferredCountry }
  );

  // produtos / favoritos (já existia)
  const [products, setProducts] = useState(() => initialHomeSnapshot?.products ?? []);
  const [productsLoading, setProductsLoading] = useState(() => !initialHomeSnapshot);
  const [lastMapCenter, setLastMapCenter] = useState(() => readStoredMapCenter());
  const productsRef = useRef([]);
  const sponsoredRowRefs = useRef({});
  const [gridColumns, setGridColumns] = useState(() => {
    if (typeof window === 'undefined') return 4;
    return getGridColumns(window.innerWidth);
  });
  const [viewMode, setViewMode] = useState(() => initialHomeSnapshot?.viewMode ?? 'all'); // 'all' | 'free'
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
  const lastHeaderQueryRef = useRef('');

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(location.search);
    const rawQuery = params.get('q') || '';
    const trimmed = rawQuery.trim();
    if (!trimmed || lastHeaderQueryRef.current === trimmed) return;
    lastHeaderQueryRef.current = trimmed;
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('templesale:set-search-query', {
          detail: { value: trimmed }
        })
      );
      window.dispatchEvent(
        new CustomEvent('templesale:trigger-search', {
          detail: { value: trimmed }
        })
      );
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [location.search]);
  useEffect(() => {
    const restore = readHomeRestore();
    if (!restore) return;
    clearHomeRestore();
    if (!initialHomeSnapshot?.searchSummary || typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('templesale:set-search-query', {
        detail: { value: initialHomeSnapshot.searchSummary }
      })
    );
  }, [initialHomeSnapshot]);
  const drawerRef = useRef(null);
  const handlePersistMapCenter = useCallback((center) => {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
    setLastMapCenter(center);
    writeStoredMapCenter(center);
  }, []);
  const mapOpenRef = useRef(null);

  // pedidos confirmados do comprador
  const [searchSummary, setSearchSummary] = useState(() => initialHomeSnapshot?.searchSummary ?? null);
  const [locationSummary, setLocationSummary] = useState(() => initialHomeSnapshot?.locationSummary ?? null);
  const [locationCountry, setLocationCountry] = useState(() => initialHomeSnapshot?.locationCountry ?? null);
  const [externalResetToken, setExternalResetToken] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState(() => initialHomeSnapshot?.categoryOptions ?? []);
  const [categoryFilter, setCategoryFilter] = useState(() => initialHomeSnapshot?.categoryFilter ?? null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [countryShortcuts, setCountryShortcuts] = useState([]);
  const [countryShortcutsLoading, setCountryShortcutsLoading] = useState(false);
  const [countryShortcutApplying, setCountryShortcutApplying] = useState(false);
  const [quickCategoryCache, setQuickCategoryCache] = useState({});

  // controle de interseção de view
  const observedRef = useRef(new Set());
  // menu do avatar

  // botão "voltar ao topo"
  const [showTop, setShowTop] = useState(false);
  usePreventDrag(['.home-card__media-gallery']);

  useEffect(() => {
    // Reload automático desativado para evitar loop/tela branca em produção
  }, []);

  const deriveCategoryOptions = useCallback((list = []) => {
    const counts = new Map();
    list.forEach((item) => {
      const raw = item?.category ? String(item.category).trim() : '';
      if (!raw) return;
      const normalized = normalizeLabel(raw);
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([normalized, count]) => ({
        label: CATEGORY_LABEL_MAP.get(normalized) || normalized,
        count
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
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
      setProductsLoading(false);
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
    setGeoScope((current) => {
      if (initialHomeSnapshot) return current;
      if (!preferredCountry) return current;
      if (current?.type !== 'country') return current;
      if (current.country === preferredCountry) return current;
      return { type: 'country', country: preferredCountry };
    });
  }, [preferredCountry, initialHomeSnapshot]);

  useEffect(() => {
    if (geoScope?.type !== 'country' || !geoScope?.country) return;
    setMarketCountry(geoScope.country);
  }, [geoScope?.country, geoScope?.type, setMarketCountry]);
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
    if (
      !token &&
      !geoReady &&
      !normalizedMarketCountry
    ) {
      // Aguarda detecção automática para evitar mostrar país errado a visitantes.
      return;
    }
    setProductsLoading(true);
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
    } finally {
      setProductsLoading(false);
    }
  }, [preferredCountry, handleProductsLoaded, geoReady, normalizedMarketCountry, token]);

  // carregar produtos iniciais
  useEffect(() => {
    if (initialHomeSnapshot) return;
    loadDefaultProducts();
  }, [loadDefaultProducts, initialHomeSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setGridColumns(getGridColumns(window.innerWidth));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const hasActiveFilters = Boolean(
      searchSummary ||
        locationSummary ||
        locationCountry ||
        categoryFilter ||
        geoScope?.type === 'bbox' ||
        viewMode === 'free'
    );
    if (!hasActiveFilters) {
      clearHomeSnapshot();
      return;
    }
    writeHomeSnapshot({
      path: getCurrentPath(),
      products,
      categoryOptions,
      categoryFilter,
      searchSummary,
      locationSummary,
      locationCountry,
      geoScope,
      viewMode,
      hasActiveFilters
    });
  }, [
    products,
    categoryOptions,
    categoryFilter,
    searchSummary,
    locationSummary,
    locationCountry,
    geoScope,
    viewMode
  ]);

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
        if (err?.code === 'ERR_NETWORK') {
          setFavoriteItems([]);
          setFavoriteIds([]);
          return;
        }
        const status = err?.response?.status;
        const message = String(err?.response?.data?.message || '').toLowerCase();
        const likelyTokenIssue =
          message.includes('token') || message.includes('sessão') || message.includes('autentica');
        if (status === 401 || status === 403) {
          if (!likelyTokenIssue) {
            toast.error('Sua sessão expirou. Faça login novamente para ver seus favoritos.');
          }
        } else {
          toast.error('Não foi possível carregar seus favoritos.');
        }
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
  const openFavoritesDrawer = useCallback(() => {
    setDrawerTab('favorites');
    setActiveDrawer(true);
  }, []);

  const openOrdersDrawer = useCallback(() => {
    setDrawerTab('orders');
    setActiveDrawer(true);
    markOrdersSeen?.();
  }, [markOrdersSeen]);

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

  const handleSponsoredMore = useCallback((groupKey) => {
    const row = sponsoredRowRefs.current[groupKey];
    if (!row) return;
    const cards = Array.from(row.children);
    if (!cards.length) return;
    const currentRight = row.scrollLeft + row.clientWidth + 4;
    const nextCard = cards.find(
      (card) => card.offsetLeft + card.offsetWidth > currentRight
    );
    const targetLeft = nextCard ? nextCard.offsetLeft : 0;
    row.scrollTo({ left: targetLeft, behavior: 'smooth' });
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
      setProductsLoading(true);
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
          const incoming = Array.isArray(data.data) ? data.data : [];
          if (incoming.length) {
            handleProductsLoaded(incoming, { preserveCategories: !isRemoving });
            if (isRemoving) {
              setCategoryFilter(null);
              toast.success('Filtro de categoria removido.');
            } else {
              setCategoryFilter(normalized);
              toast.success(`Filtrando por ${normalized}.`);
            }
            return;
          }

          const shouldFallbackToLocal =
            !isRemoving &&
            geoScope?.type === 'bbox' &&
            productsRef.current.length > 0;
          if (shouldFallbackToLocal) {
            const normalizedLabel = normalizeLabel(normalized);
            const localMatches = productsRef.current.filter(
              (product) => normalizeLabel(product?.category || '') === normalizedLabel
            );
            if (localMatches.length) {
              const priorityKeys = localMatches
                .map((item) => getProductKey(item))
                .filter(Boolean);
              handleProductsLoaded(localMatches, {
                preserveCategories: true,
                keepExisting: false,
                priorityKeys
              });
              setCategoryFilter(normalized);
              toast.success(`Filtrando por ${normalized}.`);
              return;
            }
          }

          toast.error(
            isRemoving
              ? 'Não foi possível recarregar os produtos.'
              : 'Nenhum produto nesta categoria.'
          );
        } else {
          toast.error(
            isRemoving
              ? 'Não foi possível recarregar os produtos.'
              : 'Nenhum produto nesta categoria.'
          );
        }
      } catch (err) {
        console.error(err);
        toast.error('Erro ao filtrar por categoria.');
      } finally {
        setCategoryLoading(false);
        setProductsLoading(false);
      }
    },
    [categoryFilter, categoryLoading, geoScope, preferredCountry, handleProductsLoaded, searchSummary]
  );

  const handleCountryShortcut = useCallback(
    async (code) => {
      const normalized = String(code || '').trim().toUpperCase();
      if (!normalized) return;
      setCountryShortcutApplying(true);
      setProductsLoading(true);
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
        setProductsLoading(false);
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
  const sponsoredProducts = useMemo(() => {
    if (!displayedProducts.length) return [];
    return displayedProducts.filter((product) => normalizePlanKey(product?.manual_rank_plan));
  }, [displayedProducts]);
  const showSponsored = gridColumns <= 2;
  const activeSponsoredProducts = showSponsored ? sponsoredProducts : [];
  useEffect(() => {
    const activeCountry =
      normalizeCountryCode(
        (geoScope?.type === 'country' ? geoScope.country : null) || preferredCountry
      );
    if (!activeCountry) return;
    const shouldUpdate =
      geoScope?.type === 'country' &&
      !searchSummary &&
      !categoryFilter &&
      viewMode === 'all';
    if (!shouldUpdate || !products.length) return;
    const counts = buildQuickCategoryCounts(products, activeCountry);
    if (!counts.size) return;
    setQuickCategoryCache((prev) => ({
      ...prev,
      [activeCountry]: Object.fromEntries(counts)
    }));
  }, [
    products,
    geoScope?.type,
    geoScope?.country,
    preferredCountry,
    searchSummary,
    categoryFilter,
    viewMode
  ]);
  const activeCountryForShortcuts = useMemo(() => {
    const activeCountry =
      locationCountry ||
      (geoScope?.type === 'country' ? geoScope.country : null) ||
      preferredCountry;
    return normalizeCountryCode(activeCountry);
  }, [locationCountry, geoScope?.type, geoScope?.country, preferredCountry]);
  const quickCategoryShortcuts = useMemo(() => {
    const cached = quickCategoryCache[activeCountryForShortcuts];
    const counts = cached
      ? new Map(
        Object.entries(cached).map(([label, total]) => [label, Number(total) || 0])
      )
      : buildQuickCategoryCounts(products, activeCountryForShortcuts);
    return QUICK_CATEGORY_SHORTCUTS
      .map((item) => ({
        ...item,
        total: counts.get(normalizeLabel(item.label)) || 0
      }))
      .filter((item) => item.total > 0);
  }, [quickCategoryCache, products, activeCountryForShortcuts]);
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
      promptLogin('Faça login para favoritar produtos.');
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

  const hasProfile = Boolean(token);

  let content;

  try {
    content = (
    <div className="home-page">
      {/* bloco SearchBar existente */}
      <div id="search">
        <SearchBar
          onProductsLoaded={handleProductsLoaded}
          onFiltersChange={handleSearchFilters}
          resetSignal={externalResetToken}
          onOpenMap={() => mapOpenRef.current?.()}
          onOpenFavorites={openFavoritesDrawer}
          onOpenOrders={openOrdersDrawer}
          geoScope={geoScope}
          originCountry={preferredCountry}
          hasProfile={hasProfile}
          user={user}
          categoryOptions={categoryOptions}
          categoryFilter={categoryFilter}
          categoryLoading={categoryLoading}
          onCategorySelect={handleCategoryFilter}
          locationSummary={locationSummary}
        />
      </div>
      <MapSearch
        onProductsLoaded={handleProductsLoaded}
        onRegionApplied={handleRegionApplied}
        resetSignal={externalResetToken}
        onRegisterOpenMap={handleRegisterMapOpener}
        initialCenter={mapInitialCenter}
        initialZoom={mapInitialCenter?.zoom ?? undefined}
        onLocateUser={handlePersistMapCenter}
      />

      {quickCategoryShortcuts.length > 0 && (
        <section className="home-quick-categories">
          <div className="home-quick-categories__scroll">
            {quickCategoryShortcuts.map((item) => {
              const isActiveCategory = categoryFilter === item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCategoryFilter(item.label)}
                  disabled={categoryLoading}
                  aria-pressed={isActiveCategory}
                  className={`home-quick-categories__chip ${
                    isActiveCategory ? 'is-active' : ''
                  } ${categoryLoading ? 'is-disabled' : ''}`}
                  title={`${item.label} (${item.total})`}
                >
                  <span className="home-quick-categories__icon">
                    {renderQuickCategoryIcon(item.icon)}
                  </span>
                  <span className="home-quick-categories__label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* grade de produtos pública */}
      <section id="feed" className="home-grid-section mt-2 px-0 sm:px-0">
        {productsLoading && displayedProducts.length === 0 ? (
          <div className="home-empty-state">
            <LoadingBar message="Carregando produtos..." />
            <p>Estamos preparando os melhores anúncios para você.</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="home-empty-state">
            <h2>
              {viewMode === 'free'
                ? 'Nenhum anúncio gratuito encontrado.'
                : 'Nenhum produto encontrado.'}
            </h2>
            <p>Experimente ajustar os filtros ou explorar outras localidades no mapa.</p>
          </div>
        ) : (
          <div className="home-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 w-full">
            {(() => {
              const items = [];
              const renderSponsoredBlock = (itemsList) => {
                const rowKey = 'all';
                return (
                <div key="home-sponsored-all" className="home-sponsored">
                  <div className="home-sponsored__group">
                    <div className="home-sponsored__header">
                      <div className="home-sponsored__title-wrap">
                        <span className="home-sponsored__title">Sugestões</span>
                        <span className="home-sponsored__sparkles" aria-hidden="true">
                          <span className="home-sponsored__sparkle home-sponsored__sparkle--one" />
                          <span className="home-sponsored__sparkle home-sponsored__sparkle--two" />
                          <span className="home-sponsored__sparkle home-sponsored__sparkle--three" />
                        </span>
                      </div>
                      <button
                        type="button"
                        className="home-sponsored__action"
                        onClick={() => handleSponsoredMore(rowKey)}
                      >
                        Mostrar mais →
                      </button>
                    </div>
                    <div
                      className={`home-sponsored__row ${
                        itemsList.length === 1 ? 'is-single' : ''
                      }`}
                      role="list"
                      ref={(node) => {
                        if (node) sponsoredRowRefs.current[rowKey] = node;
                      }}
                    >
                      {itemsList.map((product) => {
                        const planKey = normalizePlanKey(product?.manual_rank_plan);
                        const planLabel = BOOST_PLAN_LABELS[planKey] || planKey;
                        const entry = getPrimaryImageEntry(product);
                        const imageSrc = entry?.url || IMG_PLACEHOLDER;
                        const isIllustrative = entry?.kind === IMAGE_KIND.ILLUSTRATIVE;
                        const title = product?.title || 'Produto';
                        const countryLabel = resolveCountryName(product.country);
                        const locationParts = [product.city, countryLabel].filter(Boolean);
                        const priceLabel = getProductPriceLabel(product);
                        const locationLabel = locationParts.join(' • ');
                        const tierIcon = BOOST_PLAN_ICONS[planKey];

                        return (
                          <article
                            key={`sponsored-${planKey}-${product.id}`}
                            className="home-sponsored-card"
                            role="listitem"
                          >
                            <Link
                              to={`/product/${product.id}`}
                              className="home-sponsored-card__link"
                              onClick={() => registerClick(product.id)}
                            >
                              <div className="home-sponsored-card__media">
                                <img
                                  src={imageSrc}
                                  alt={title}
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    e.currentTarget.src = IMG_PLACEHOLDER;
                                    e.currentTarget.onerror = null;
                                  }}
                                />
                                {isIllustrative && (
                                  <span className="home-sponsored-card__badge">
                                    {IMAGE_KIND_BADGE_LABEL}
                                  </span>
                                )}
                                <span
                                  className={`home-sponsored-card__tier home-sponsored-card__tier--${planKey}`}
                                  aria-label={planLabel}
                                  title={planLabel}
                                >
                                  {tierIcon ? (
                                    <img
                                      src={tierIcon}
                                      alt={planLabel}
                                      className="home-sponsored-card__tier-icon"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : (
                                    <span className="home-sponsored-card__tier-text">
                                      {planLabel}
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="home-sponsored-card__body">
                                <p
                                  className={`home-sponsored-card__price ${
                                    isProductFree(product) ? 'is-free' : ''
                                  }`}
                                >
                                  {priceLabel}
                                </p>
                                {locationLabel && (
                                  <p className="home-sponsored-card__location">{locationLabel}</p>
                                )}
                                <p className="home-sponsored-card__title" title={title}>
                                  {title}
                                </p>
                              </div>
                            </Link>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
                );
              };

              const sponsoredBlocks = activeSponsoredProducts.length
                ? [renderSponsoredBlock(activeSponsoredProducts)]
                : [];
              if (!sponsoredBlocks.length) {
                return displayedProducts.map((product) => {
                  const productImageEntries = buildProductImageEntries(product);
                  const productImages = productImageEntries.length
                    ? productImageEntries.map((entry) => entry.url)
                    : [IMG_PLACEHOLDER];
                  const productImageKinds = productImageEntries.length
                    ? productImageEntries.map((entry) => entry.kind)
                    : [null];
                  const galleryKey = productImages.join('|');
                  const countryLabel = resolveCountryName(product.country);
                  const locationParts = [product.city, countryLabel].filter(Boolean);
                  const priceLabel = getProductPriceLabel(product);
                  const locationLabel = locationParts.join(' • ');

                  return (
                    <ProductCardHome
                      key={product.id}
                      product={product}
                      images={productImages}
                      imageKinds={productImageKinds}
                      galleryKey={galleryKey}
                      priceLabel={priceLabel}
                      locationLabel={locationLabel}
                      onClick={() => registerClick(product.id)}
                    />
                  );
                });
              }

              const normalCount = displayedProducts.length;
              const blockCount = sponsoredBlocks.length;
              const insertionPoints = [];
              const minGap = Math.max(1, gridColumns);
              const firstInsertFloor = Math.max(gridColumns, 2);
              let lastPos = -1;
              for (let i = 0; i < blockCount; i += 1) {
                let pos = Math.floor(((i + 1) * normalCount) / (blockCount + 1));
                pos = Math.max(pos, firstInsertFloor);
                pos = Math.ceil(pos / gridColumns) * gridColumns;
                if (pos <= lastPos + minGap) pos = lastPos + minGap;
                if (pos > normalCount) pos = normalCount;
                insertionPoints.push(pos);
                lastPos = pos;
              }

              let blockIndex = 0;
              displayedProducts.forEach((product, index) => {
                if (insertionPoints[blockIndex] === index) {
                  items.push(sponsoredBlocks[blockIndex]);
                  blockIndex += 1;
                }

                const productImageEntries = buildProductImageEntries(product);
                const productImages = productImageEntries.length
                  ? productImageEntries.map((entry) => entry.url)
                  : [IMG_PLACEHOLDER];
                const productImageKinds = productImageEntries.length
                  ? productImageEntries.map((entry) => entry.kind)
                  : [null];
                const galleryKey = productImages.join('|');
                const countryLabel = resolveCountryName(product.country);
                const locationParts = [product.city, countryLabel].filter(Boolean);
                const priceLabel = getProductPriceLabel(product);
                const locationLabel = locationParts.join(' • ');

                items.push(
                  <ProductCardHome
                    key={product.id}
                    product={product}
                    images={productImages}
                    imageKinds={productImageKinds}
                    galleryKey={galleryKey}
                    priceLabel={priceLabel}
                    locationLabel={locationLabel}
                    onClick={() => registerClick(product.id)}
                  />
                );
              });

              while (blockIndex < blockCount && insertionPoints[blockIndex] === normalCount) {
                items.push(sponsoredBlocks[blockIndex]);
                blockIndex += 1;
              }

              return items;
            })()}
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
                (x)
              </button>
              </header>

              <div className="home-drawer__body">
                {drawerTab === 'favorites' ? (
                  <div className="home-drawer__section">
                    <div className="home-drawer__eyebrow-row">
                      <p className="home-drawer__eyebrow">Coleção pessoal</p>
                      <span className="home-drawer__count">{favoriteIds.length}</span>
                    </div>
                    {!favoriteIds.length && (
                      <p className="home-drawer__title">Nenhum favorito salvo</p>
                    )}

                    <div className="home-drawer__content">
                      {favoriteLoading ? (
                        <LoadingBar
                          message="Carregando favoritos..."
                          className="home-drawer__empty"
                          size="sm"
                        />
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
                            <div className="home-fav-card__image-wrapper relative">
                              {(() => {
                                const entry = getPrimaryImageEntry(product);
                                const imageSrc = entry?.url || IMG_PLACEHOLDER;
                                const isIllustrative = entry?.kind === IMAGE_KIND.ILLUSTRATIVE;
                                return (
                                  <>
                                    <img
                                      src={imageSrc}
                                      alt={product.title}
                                      className="home-fav-card__image"
                                      loading="eager"
                                      decoding="async"
                                      onError={(e) => {
                                        e.currentTarget.src = IMG_PLACEHOLDER;
                                        e.currentTarget.onerror = null;
                                      }}
                                    />
                                    {isIllustrative && (
                                      <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
                                        {IMAGE_KIND_BADGE_LABEL}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="home-fav-card__details">
                              <p className="home-fav-card__title">{product.title}</p>
                              <p
                                className={`home-fav-card__price ${
                                  isProductFree(product) ? 'is-free' : ''
                                }`}
                              >
                                {getProductPriceLabel(product)}
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
                    <div className="home-drawer__eyebrow-row">
                      <p className="home-drawer__eyebrow">Compras confirmadas</p>
                      <span className="home-drawer__count">{buyerOrders.length}</span>
                    </div>

                  <div className="home-drawer__content">
                    {buyerOrders.length === 0 ? (
                      <p className="home-drawer__empty">
                        Assim que um vendedor confirmar o seu pedido, ele aparece aqui.
                      </p>
                    ) : (
                      <BuyerOrdersList
                        orders={buyerOrders}
                        showDate
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
          <span className="home-new-product-fab__label">Anuncie</span>
        </Link>
      )}
    </div>
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Erro ao renderizar Home:', err);
    content = (
      <div className="home-page">
        <section>
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
