// frontend/src/pages/Home.jsx
// Página inicial com destaques, busca e feed de produtos.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, PhoneCall } from 'lucide-react';
import SearchBar from '../components/SearchBar.jsx';
import MapSearch from '../components/MapSearch.jsx';
import { buildProductImageEntries, getPrimaryImageEntry } from '../utils/images.js';
import { IMAGE_KIND, IMAGE_KIND_BADGE_LABEL } from '../utils/imageKinds.js';

import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext.jsx';
import GeoContext from '../context/GeoContext.jsx';
import { detectCountryFromTimezone } from '../utils/timezoneCountry.js';
import { localeFromCountry } from '../i18n/localeMap.js';
import { getProductPriceLabel, isProductFree } from '../utils/product.js';
import { getCountryLabel, normalizeCountryCode } from '../data/countries.js';
import { getProductKey, mergeProductLists } from '../utils/productCollections.js';
import usePreventDrag from '../hooks/usePreventDrag.js';
import BuyerOrdersList from '../components/BuyerOrdersList.jsx';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';
import { IMG_PLACEHOLDER } from '../utils/placeholders.js';
import useLoginPrompt from '../hooks/useLoginPrompt.js';
import { getCurrentPath } from '../components/ScrollRestoration.jsx';
import { getPhoneActions } from '../utils/phone.js';
import { buildProductMessageLink } from '../utils/messageLinks.js';

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
  { id: 'livros', label: 'Livros, Papelaria e Cursos', icon: 'book' },
  { id: 'instrumentos', label: 'Instrumentos Musicais', icon: 'music' },
  { id: 'ferramentas', label: 'Ferramentas e Construção', icon: 'tools' },
  { id: 'jardim', label: 'Jardim e Pet', icon: 'leaf' },
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
            d="M5 19c7 0 12-5 14-12-6 2-11 7-12 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7 17c3-1 6-4 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
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

const extractRegionFromLocale = (value) => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/[-_](\w{2})/);
  return match ? match[1] : '';
};

const readStoredPreferredCountry = () => {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeCountryCode(
      window.localStorage.getItem('templesale.preferredCountry')
    );
  } catch {
    return null;
  }
};

const detectPreferredCountry = (userCountry, geoCountry) => {
  const normalizedUser = normalizeCountryCode(userCountry);
  if (normalizedUser) return normalizedUser;
  const normalizedGeo = normalizeCountryCode(geoCountry);
  if (normalizedGeo) return normalizedGeo;
  if (typeof window !== 'undefined') {
    try {
      const storedPref = readStoredPreferredCountry();
      if (storedPref) return storedPref;

      const candidates = [];

      const storedLocale = window.localStorage.getItem('templesale.locale');
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

const buildProductImageSources = (product) => {
  const entries = buildProductImageEntries(product);
  if (!entries.length) return [IMG_PLACEHOLDER];
  return entries.map((entry) => entry.url);
};

const formatNumberLabel = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
};

const normalizeLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const ESTATE_KEYWORDS = [
  'apto',
  'apartamento',
  'imovel',
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
  'ape'
];

const FASHION_KEYWORDS = [
  'moda',
  'roupa',
  'vestuario',
  'vestidos',
  'fashion',
  'camisa',
  'jeans',
  'saia',
  'terno',
  'acessorio',
  'acessorios'
];

const isEstateCategory = (category) =>
  ESTATE_KEYWORDS.some((keyword) => normalizeLabel(category).includes(keyword));

const isFashionCategory = (category) =>
  FASHION_KEYWORDS.some((keyword) => normalizeLabel(category).includes(keyword));

const isEstateProduct = (product) =>
  isEstateCategory(product?.category || '') ||
  Boolean(
    product?.property_type ||
      product?.surface_area ||
      product?.bedrooms ||
      product?.bathrooms ||
      product?.parking ||
      product?.rent_type
  );

const isImovelLabel = (label) => ['imovel', 'imoveis'].includes(normalizeLabel(label));

const startsWithLabel = (label, prefix) => normalizeLabel(label).startsWith(prefix);
const includesLabel = (label, needle) => normalizeLabel(label).includes(needle);

const getFactIcon = (label, product) => {
  const normalized = normalizeLabel(label);
  const categoryLabel = normalizeLabel(product?.category || '');

  if (label.endsWith('m²')) return 'tape';
  if (isImovelLabel(label) && normalized === categoryLabel) return 'home';
  if (includesLabel(label, 'quarto')) return 'bed';
  if (includesLabel(label, 'banheiro')) return 'bath';
  if (includesLabel(label, 'vaga')) return 'car';
  if (startsWithLabel(label, 'marca:')) return 'tag';
  if (startsWithLabel(label, 'modelo:')) return 'box';
  if (startsWithLabel(label, 'ano:')) return 'calendar';
  if (startsWithLabel(label, 'cor:')) return 'palette';
  if (startsWithLabel(label, 'servico:')) return 'briefcase';
  if (startsWithLabel(label, 'duracao:')) return 'clock';
  if (startsWithLabel(label, 'valor/h:')) return 'money';
  if (startsWithLabel(label, 'local:')) return 'map';
  if (startsWithLabel(label, 'cargo:')) return 'briefcase';
  if (startsWithLabel(label, 'vaga:')) return 'briefcase';
  if (startsWithLabel(label, 'salario:')) return 'money';
  if (startsWithLabel(label, 'requisitos:')) return 'list';
  if (normalized === categoryLabel) return 'grid';
  return 'info';
};

// Map fact strings to visual metadata without changing existing fact selection logic.
const getFactPresentation = (fact, product) => {
  const label = String(fact || '').trim();
  if (!label) return { icon: 'info', label: '', ariaLabel: '' };

  return { icon: getFactIcon(label, product), label, ariaLabel: label };
};

const renderFactIcon = (type) => {
  switch (type) {
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
          <path
            d="M9 20v-5h6v5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'tag':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M7 4h6l5 5-7.8 7.8a2 2 0 0 1-2.8 0L4.2 13a2 2 0 0 1 0-2.8L7 4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="11" cy="8" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'tape':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6.5 7.5h7a4 4 0 0 1 4 4v6H6.5a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11 7.5v3m-2 0v-2m4 2v-2m4 9H9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'bed':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M4 11.5h16a3 3 0 0 1 3 3V19H1v-4.5a3 3 0 0 1 3-3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M4 11.5V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v4.5M14 11.5V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'bath':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M5 12h14a2 2 0 0 1 2 2v1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-1a2 2 0 0 1 2-2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M7 12V7a2.5 2.5 0 0 1 5 0v2"
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
    case 'briefcase':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M4 8h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M3 13h18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 3v4M16 3v4M3 10h18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'palette':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 3a9 9 0 1 0 0 18c1.7 0 2.5-.8 2.5-2 0-1.3-1.2-1.8-2.4-1.8h-1.2a2.3 2.3 0 0 1-2.3-2.3 2.3 2.3 0 0 1 2.3-2.3h6a4 4 0 0 0 0-8h-1.2A8.9 8.9 0 0 0 12 3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="8.5" cy="9" r="1" fill="currentColor" />
          <circle cx="12" cy="7.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="9.5" r="1" fill="currentColor" />
        </svg>
      );
    case 'box':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M4 7.5L12 4l8 3.5v9L12 20l-8-3.5v-9z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M4 7.5l8 3.5 8-3.5M12 11v9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 7v5l3 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'money':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="3"
            y="6.5"
            width="18"
            height="11"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M6 9.5h2M16 14.5h2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="11" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'list':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6 7h13M6 12h13M6 17h13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="3" cy="7" r="1" fill="currentColor" />
          <circle cx="3" cy="12" r="1" fill="currentColor" />
          <circle cx="3" cy="17" r="1" fill="currentColor" />
        </svg>
      );
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="4" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="14" y="4" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="4" y="14" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="14" y="14" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'info':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 10.5v6M12 7.5h.01"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
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

  const isEstate = isEstateProduct(product);
  const isFashion = isFashionCategory(category);

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

const ProductImageGallery = ({ images = [], imageKinds = [], alt = '', productId, galleryKey }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pointerStartX = useRef(null);
  const clickBlocked = useRef(false);

  const imageSources = images.length ? images : [IMG_PLACEHOLDER];
  const totalImages = imageSources.length;
  const currentImage = imageSources[currentIndex] ?? IMG_PLACEHOLDER;
  const currentKind = imageKinds[currentIndex] ?? null;

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
      {currentKind === IMAGE_KIND.ILLUSTRATIVE && (
        <span className="home-card__illustrative-badge">
          {IMAGE_KIND_BADGE_LABEL}
        </span>
      )}

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

const buildQuickCategoryCounts = (list = [], activeCountry) => {
  const counts = new Map();
  list.forEach((item) => {
    const itemCountry = normalizeCountryCode(item?.country);
    if (activeCountry && itemCountry && itemCountry !== activeCountry) {
      return;
    }
    const label = item?.category ? String(item.category).trim() : '';
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return counts;
};


export default function Home() {
  const { token, user } = useContext(AuthContext);
  const promptLogin = useLoginPrompt();
  const requireAuth = useCallback(
    (message) => {
      if (token) return true;
      return promptLogin(message);
    },
    [promptLogin, token]
  );
  const {
    country: detectedCountry,
    lat: detectedLat,
    lng: detectedLng,
    locale: detectedLocale,
    ready: geoReady
  } = useContext(GeoContext);
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
  const storedPreferredCountry = useMemo(() => readStoredPreferredCountry(), []);
  const preferredCountry = useMemo(
    () => detectPreferredCountry(user?.country, detectedCountry),
    [user?.country, detectedCountry]
  );
  const homeLocale = useMemo(() => {
    const userLocale = user?.country ? localeFromCountry(user.country) : null;
    return userLocale || detectedLocale || 'pt-BR';
  }, [detectedLocale, user?.country]);
  const [geoScope, setGeoScope] = useState(() =>
    initialHomeSnapshot?.geoScope || { type: 'country', country: preferredCountry }
  );

  // produtos / favoritos (já existia)
  const [products, setProducts] = useState(() => initialHomeSnapshot?.products ?? []);
  const [lastMapCenter, setLastMapCenter] = useState(() => readStoredMapCenter());
  const productsRef = useRef([]);
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
  const [activePhoneActions, setActivePhoneActions] = useState(null);

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
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const [pulseTarget, setPulseTarget] = useState(null);
  const pulseTimerRef = useRef(null);

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
      window.localStorage.setItem('templesale.preferredCountry', preferredCountry);
    } catch {
      // ignora falha de storage (modo privado, quota, etc.)
    }
  }, [preferredCountry, handlePersistMapCenter]);

  useEffect(() => {
    setGeoScope((current) => {
      if (initialHomeSnapshot) return current;
      if (!preferredCountry) return current;
      if (current?.type !== 'country') return current;
      if (current.country === preferredCountry) return current;
      return { type: 'country', country: preferredCountry };
    });
  }, [preferredCountry, handlePersistMapCenter, initialHomeSnapshot]);
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
      !storedPreferredCountry &&
      !user?.country
    ) {
      // Aguarda detecção automática para evitar mostrar país errado a visitantes.
      return;
    }
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
  }, [preferredCountry, handleProductsLoaded, geoReady, storedPreferredCountry, token, user?.country]);

  // carregar produtos iniciais
  useEffect(() => {
    if (initialHomeSnapshot) return;
    loadDefaultProducts();
  }, [loadDefaultProducts, initialHomeSnapshot]);

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

  const handleOpenConversation = useCallback(
    (event, product, chatMeta) => {
      event.preventDefault();
      event.stopPropagation();
      if (!product?.id) return;
      if (!requireAuth('Faça login para conversar com o vendedor.')) return;
      const sellerId = chatMeta?.sellerId;
      if (sellerId && user?.id && Number(user.id) === Number(sellerId)) {
        toast.error('Você é o vendedor deste anúncio.');
        return;
      }
      const messageLink = buildProductMessageLink({
        product,
        sellerId,
        sellerName: chatMeta?.sellerName,
        productImage: chatMeta?.productImage,
        productPrice: chatMeta?.productPrice,
        productLocation: chatMeta?.productLocation
      });
      navigate(messageLink);
    },
    [navigate, requireAuth, user?.id]
  );

  const handleOpenPhoneActions = useCallback((event, product, phoneActions) => {
    event.preventDefault();
    event.stopPropagation();
    if (!phoneActions || !product?.id) return;
    const productUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/product/${product.id}`
        : '';
    const title = product?.title || 'Produto TempleSale';
    const whatsappContactLink = `${phoneActions.whatsappHref}?text=${encodeURIComponent(
      `Olá! Tenho interesse no produto: ${title}${productUrl ? ` - ${productUrl}` : ''}`
    )}`;
    setActivePhoneActions({
      phoneActions,
      whatsappContactLink
    });
  }, []);

  const handleClosePhoneActions = useCallback(() => {
    setActivePhoneActions(null);
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
        total: counts.get(item.label) || 0
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
  const phoneActionsPortal =
    activePhoneActions && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 pt-10 md:items-center"
            onClick={handleClosePhoneActions}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Contato do vendedor
                  </p>
                  <p className="text-base font-semibold text-gray-900">
                    {activePhoneActions.phoneActions.display}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClosePhoneActions}
                  className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </header>

              <div className="mt-4 grid gap-2">
                <a
                  href={activePhoneActions.phoneActions.telHref}
                  className="flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  <PhoneCall size={18} /> Ligar agora
                </a>
                <a
                  href={activePhoneActions.whatsappContactLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <MessageCircle size={18} /> WhatsApp
                </a>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

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
              const productImageEntries = buildProductImageEntries(product);
              const productImages = productImageEntries.length
                ? productImageEntries.map((entry) => entry.url)
                : [IMG_PLACEHOLDER];
              const productImageKinds = productImageEntries.length
                ? productImageEntries.map((entry) => entry.kind)
                : [null];
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
              const priceLabel = getProductPriceLabel(product);
              const sellerId =
                product.user_id ?? product.userId ?? product.seller_id ?? product.sellerId;
              const sellerName =
                product.seller_name ?? product.sellerName ?? product.username ?? '';
              const phoneActions = getPhoneActions(
                product.seller_phone ?? product.sellerPhone ?? ''
              );
              const showChatAction = true;
              const showPhoneAction = Boolean(phoneActions);
              const showContactBar = showChatAction || showPhoneAction;
              const contactPriceLabel = getProductPriceLabel({
                price: product?.price,
                country: product?.country
              });
              const contactLocationLabel = [product.city, product.state, product.country]
                .filter(Boolean)
                .join(', ');
              const primaryImage = productImageEntries[0]?.url || product.image_url || '';
              const chatMeta = {
                sellerId,
                sellerName,
                productImage: primaryImage,
                productPrice: contactPriceLabel,
                productLocation: contactLocationLabel
              };
              

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
                        imageKinds={productImageKinds}
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
                      className={`home-card__likes-badge ${
                        pendingFavorite === product.id ? 'is-loading' : ''
                      } ${isFavorited ? 'is-active' : ''} ${isPulsed ? 'is-pulsed' : ''}`}
                    >
                      <span className="home-card__likes-icon" aria-hidden="true">♥</span>
                      <span className="home-card__metric-value">{likeCount}</span>
                    </button>
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
                        {priceLabel}
                      </p>
                      {product.description && (() => {
                        const description = String(product.description || '').trim();
                        if (!description) return null;
                        const showMore = description.length > 200;
                        return (
                          <p className="home-card__description home-card__description--clamped">
                            {description}
                            {showMore && (
                              <span className="home-card__description-more">... ver mais</span>
                            )}
                          </p>
                        );
                      })()}
                      {cardFacts.length > 0 && (
                        <div className="home-card__facts">
                          {cardFacts.map((fact, index) => {
                            const presentation = getFactPresentation(fact, product);
                            return (
                              <span
                                key={`${fact}-${index}`}
                                className="home-card__fact-pill"
                                title={presentation.ariaLabel || undefined}
                              >
                                {presentation.icon && (
                                  <span className="home-card__fact-icon" aria-hidden="true">
                                    {renderFactIcon(presentation.icon)}
                                  </span>
                                )}
                                <span className="home-card__fact-text">{presentation.label}</span>
                              </span>
                            );
                          })}
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
                    {showContactBar && (
                      <div className="home-card__contact" aria-label="Contato com vendedor">
                        {/* Contato rapido com vendedor */}
                        {showChatAction && (
                          <button
                            type="button"
                            className="home-card__contact-btn home-card__contact-btn--chat"
                            onClick={(event) =>
                              handleOpenConversation(event, product, chatMeta)
                            }
                          >
                            <MessageCircle size={14} /> Contatar
                          </button>
                        )}
                        {showPhoneAction && (
                          <button
                            type="button"
                            className="home-card__contact-btn home-card__contact-btn--phone"
                            onClick={(event) =>
                              handleOpenPhoneActions(event, product, phoneActions)
                            }
                          >
                            <PhoneCall size={14} /> Telefone
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {phoneActionsPortal}

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
