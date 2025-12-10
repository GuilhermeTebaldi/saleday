// src/i18n/AutoI18n.jsx
import { useContext, useEffect, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import GeoContext from '../context/GeoContext.jsx';
import { localeFromCountry } from './localeMap.js';
import { DICTS } from './dictionaries.js';

function normalize(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function buildHelpers(dict) {
  const entries = Object.entries(dict || {}).filter(([key]) => key);
  const normalizedMap = new Map(entries.map(([key, value]) => [normalize(key), value]));
  // substituição parcial: ordenar por comprimento para evitar trocas incorretas
  const orderedEntries = entries.sort((a, b) => b[0].length - a[0].length);
  return { normalizedMap, orderedEntries };
}

function translateString(raw, helpers) {
  if (!raw) return raw;
  const { normalizedMap, orderedEntries } = helpers;
  const normalized = normalize(raw);
  if (normalizedMap.has(normalized)) {
    const translated = normalizedMap.get(normalized);
    const leading = raw.match(/^\s*/)?.[0] ?? '';
    const trailing = raw.match(/\s*$/)?.[0] ?? '';
    return `${leading}${translated}${trailing}`;
  }

  let output = raw;
  let changed = false;
  for (const [src, target] of orderedEntries) {
    if (!src) continue;
    if (output.includes(src)) {
      output = output.split(src).join(target);
      changed = true;
    }
  }
  return changed ? output : raw;
}

const originalTextMap = typeof WeakMap === 'function' ? new WeakMap() : null;

const DATASET_PREFIX = 'saledayI18nOriginal';
const TRACKED_ATTRS = ['placeholder', 'aria-label', 'title'];

const buildDatasetKey = (attr) => {
  const normalized = attr
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `${DATASET_PREFIX}${normalized}`;
};

const buildDataAttrName = (attr) => `data-saleday-i18n-original-${attr.toLowerCase()}`;
const SKIP_TEXT_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);

function rememberTextNode(node) {
  if (!originalTextMap || !node) return null;
  const current = node.nodeValue ?? '';
  let record = originalTextMap.get(node);
  if (!record) {
    record = { original: current, translated: current };
    originalTextMap.set(node, record);
    return record;
  }
  if (record.translated === current) {
    return record;
  }
  if (record.original !== current) {
    record.original = current;
  }
  return record;
}

function restoreTextNodes(root) {
  if (!root || !originalTextMap) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const record = originalTextMap.get(node);
    if (record && typeof record.original === 'string') {
      node.nodeValue = record.original;
      record.translated = record.original;
    }
  }
}

function rememberAttrValue(el, attr) {
  if (!el || typeof el.getAttribute !== 'function') return null;
  const current = el.getAttribute(attr);
  if (!el.dataset) return current;
  const key = buildDatasetKey(attr);
  if (el.dataset[key] == null && current != null) {
    el.dataset[key] = current;
  }
  return el.dataset[key] ?? current;
}

function restoreAttributes(root) {
  if (!root) return;
  const attrList = [...TRACKED_ATTRS, 'value'];
  for (const attr of attrList) {
    const selector = `[${buildDataAttrName(attr)}]`;
    root.querySelectorAll(selector).forEach((el) => {
      const key = buildDatasetKey(attr);
      if (!el.dataset || el.dataset[key] == null) return;
      if (attr === 'value' && el.tagName === 'INPUT') {
        el.value = el.dataset[key];
      } else {
        el.setAttribute(attr, el.dataset[key]);
      }
    });
  }
}

function resetTranslations(root) {
  restoreTextNodes(root);
  restoreAttributes(root);
}

function replaceTextNodes(root, dict) {
  if (!dict) return;
  const helpers = buildHelpers(dict);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const parentTag = node.parentElement?.tagName;
    if (parentTag && SKIP_TEXT_PARENTS.has(parentTag)) continue;
    const record = rememberTextNode(node);
    const source = record?.original ?? node.nodeValue ?? '';
    const translated = translateString(source, helpers);
    if (translated != null && node.nodeValue !== translated) {
      node.nodeValue = translated;
    }
    if (record) {
      record.translated = translated ?? source;
    }
  }
  const all = root.querySelectorAll('input[placeholder],textarea[placeholder],button,select,option,[aria-label]');
  for (const el of all) {
    const ph = rememberAttrValue(el, 'placeholder');
    if (ph != null) {
      const translated = translateString(ph, helpers);
      if (translated != null && el.getAttribute('placeholder') !== translated) {
        el.setAttribute('placeholder', translated);
      }
    }
    const aria = rememberAttrValue(el, 'aria-label');
    if (aria != null) {
      const translated = translateString(aria, helpers);
      if (translated != null && el.getAttribute('aria-label') !== translated) {
        el.setAttribute('aria-label', translated);
      }
    }
    if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
      const value = rememberAttrValue(el, 'value') ?? el.value;
      if (value != null) {
        const translated = translateString(value, helpers);
        if (translated != null) {
          if (el.value !== translated) el.value = translated;
          if (el.getAttribute('value') !== translated) el.setAttribute('value', translated);
        }
      }
    }
    const title = rememberAttrValue(el, 'title');
    if (title != null) {
      const translated = translateString(title, helpers);
      if (translated != null && el.getAttribute('title') !== translated) {
        el.setAttribute('title', translated);
      }
    }
  }
}

function matchSupportedLocale(value) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const locales = Object.keys(DICTS);
  if (normalized.startsWith('pt')) return 'pt-BR';
  return (
    locales.find((loc) => loc.toLowerCase() === normalized) ||
    locales.find((loc) => normalized.startsWith(loc.slice(0, 2).toLowerCase())) ||
    null
  );
}

export default function AutoI18n() {
  const { user } = useContext(AuthContext);
  const { locale: geoLocale } = useContext(GeoContext);

  // 1) Locale sempre derivado do país do usuário quando logado
  // 2) Fallback para PT-BR (idioma oficial)
  const locale = useMemo(() => {
    const byUser = user?.country ? localeFromCountry(user.country) : null;
    const byStorage =
      typeof window !== 'undefined' ? localStorage.getItem('saleday.locale') : null;
    const byBrowser =
      typeof navigator !== 'undefined'
        ? navigator.languages?.[0] || navigator.language
        : null;

    return (
      matchSupportedLocale(byUser) ||
      matchSupportedLocale(geoLocale) ||
      matchSupportedLocale(byBrowser) ||
      matchSupportedLocale(byStorage) ||
      'pt-BR'
    );
  }, [user, geoLocale]);

  useEffect(() => {
    if (!locale) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('saleday.locale', locale);
    }
    const previousLang = document.documentElement.lang;

    if (locale.startsWith('pt')) {
      resetTranslations(document.body);
      document.documentElement.lang = 'pt-BR';
      return () => {
        document.documentElement.lang = previousLang || 'pt-BR';
      };
    }

    const dict = DICTS[locale];
    if (!dict) {
      document.documentElement.lang = previousLang || 'pt-BR';
      return;
    }
    document.documentElement.lang = locale;

    resetTranslations(document.body);
    replaceTextNodes(document.body, dict);
    let scheduled = false;
    const scheduleTranslation = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        replaceTextNodes(document.body, dict);
      });
    };
    const obs = new MutationObserver(() => scheduleTranslation());
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      scheduled = false;
      document.documentElement.lang = previousLang || 'pt-BR';
    };
  }, [locale]);

  return null;
}
