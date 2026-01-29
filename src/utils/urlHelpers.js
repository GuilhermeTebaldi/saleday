import api from '../api/api.js';

export function makeAbsolute(urlLike) {
  if (!urlLike) return '';
  const trimmed = String(urlLike).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image/')) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const preferWindowForPublic =
    typeof window !== 'undefined' && path.startsWith('/modelosdecapa/');
  const base = preferWindowForPublic
    ? `${window.location.protocol}//${window.location.host}`
    : api.defaults?.baseURL ||
      import.meta.env.VITE_API_BASE_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : '');
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}
