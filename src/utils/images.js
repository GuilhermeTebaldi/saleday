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

export default {
  toAbsoluteImageUrl,
  parseImageList
};
