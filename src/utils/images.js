import api from '../api/api.js';

const API_BASE_URL = (() => {
  const base = api?.defaults?.baseURL || '';
  if (!base) return '';
  return base.replace(/\/api\/?$/, '');
})();

export const toAbsoluteImageUrl = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('/uploads/')) {
    if (API_BASE_URL) return `${API_BASE_URL}${raw}`;
    if (typeof window !== 'undefined') return `${window.location.origin}${raw}`;
    return raw;
  }
  if (raw.startsWith('uploads/')) {
    const normalized = `/${raw.replace(/^\/+/, '')}`;
    if (API_BASE_URL) return `${API_BASE_URL}${normalized}`;
    if (typeof window !== 'undefined') return `${window.location.origin}${normalized}`;
    return normalized;
  }
  return raw;
};

const mapToAbsoluteUrl = (item) => {
  if (typeof item === 'string') return toAbsoluteImageUrl(item);
  if (item && typeof item === 'object') {
    const candidate = item.url || item.path || item.src;
    return candidate ? toAbsoluteImageUrl(candidate) : null;
  }
  return null;
};

const normalizeImageKind = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (
    ['illustrative', 'ilustrativa', 'ilustrativo', 'illustration', 'illustrated'].includes(
      normalized
    )
  ) {
    return 'illustrative';
  }
  if (['real', 'realistic'].includes(normalized)) return 'real';
  return null;
};

const parseImageKindList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(normalizeImageKind);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(normalizeImageKind);
    } catch {
      return value
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map((item) => item.replace(/^"+|"+$/g, '').trim())
        .map(normalizeImageKind);
    }
  }
  return [];
};

export const parseImageList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(mapToAbsoluteUrl).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(mapToAbsoluteUrl).filter(Boolean);
      }
    } catch {
      const cleaned = value
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map((item) => item.replace(/^"+|"+$/g, '').trim())
        .filter(Boolean);
      if (cleaned.length) {
        return cleaned.map((item) => toAbsoluteImageUrl(item)).filter(Boolean);
      }
    }
  }
  return [];
};

export const parseImageEntries = (value) => {
  if (!value) return [];

  const entries = [];
  const pushEntry = (item) => {
    if (!item) return;
    if (typeof item === 'string') {
      const url = mapToAbsoluteUrl(item);
      if (url) entries.push({ url, kind: null });
      return;
    }
    if (item && typeof item === 'object') {
      const url = mapToAbsoluteUrl(item);
      if (!url) return;
      const kind = normalizeImageKind(
        item.kind ??
          item.image_kind ??
          item.imageKind ??
          (item.is_illustrative ? 'illustrative' : null) ??
          (item.is_real ? 'real' : null)
      );
      entries.push({ url, kind });
    }
  };

  if (Array.isArray(value)) {
    value.forEach(pushEntry);
    return entries;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        parsed.forEach(pushEntry);
        return entries;
      }
    } catch {
      const cleaned = value
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map((item) => item.replace(/^"+|"+$/g, '').trim())
        .filter(Boolean);
      cleaned.forEach(pushEntry);
      return entries;
    }
  }

  return entries;
};

export const buildProductImageEntries = (product) => {
  if (!product) return [];
  const merged = [];
  const indexByUrl = new Map();
  const pushEntry = (entry) => {
    if (!entry?.url) return;
    const existingIndex = indexByUrl.get(entry.url);
    if (existingIndex !== undefined) {
      if (!merged[existingIndex].kind && entry.kind) {
        merged[existingIndex].kind = entry.kind;
      }
      return;
    }
    merged.push({ url: entry.url, kind: entry.kind ?? null });
    indexByUrl.set(entry.url, merged.length - 1);
  };

  if (product.image_url) {
    const url = toAbsoluteImageUrl(product.image_url);
    if (url) {
      const kind = normalizeImageKind(
        product.image_kind ??
          product.imageKind ??
          product.image_type ??
          product.imageType
      );
      pushEntry({ url, kind });
    }
  }

  const kindList = parseImageKindList(product.image_kinds ?? product.imageKinds);
  const parsedEntries = parseImageEntries(product.image_urls);
  parsedEntries.forEach((entry, index) => {
    if (!entry.kind && kindList[index]) {
      entry.kind = kindList[index];
    }
    pushEntry(entry);
  });

  return merged;
};

export const getPrimaryImageEntry = (product) => {
  const entries = buildProductImageEntries(product);
  return entries.length ? entries[0] : null;
};

export default {
  toAbsoluteImageUrl,
  parseImageList,
  parseImageEntries,
  buildProductImageEntries,
  getPrimaryImageEntry
};
