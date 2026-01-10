// frontend/src/components/ScrollRestoration.jsx
// Restaura a posição de rolagem por entrada do histórico.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SCROLL_KEY = 'templesale:scroll-positions';
const RETURN_KEY = 'templesale:return-target';
const HOME_RESTORE_KEY = 'templesale:home-restore';
const LAST_PATH_KEY = 'templesale:last-path';

export const getCurrentPath = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const readScrollMap = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(SCROLL_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeScrollMap = (map) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map));
  } catch {
    // ignore storage failures
  }
};

const readReturnTarget = () => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(RETURN_KEY) || 'null');
  } catch {
    return null;
  }
};

const writeReturnTarget = (payload) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RETURN_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

const writeHomeRestore = (payload) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(HOME_RESTORE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

const writeLastPath = (value) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LAST_PATH_KEY, value);
  } catch {
    // ignore storage failures
  }
};

const clearReturnTarget = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // ignore storage failures
  }
};

const MAX_RESTORE_ATTEMPTS = 120;
const RESTORE_RETRY_MS = 50;

const restoreScrollPosition = (targetY, attempt = 0) => {
  if (typeof window === 'undefined') return;
  const doc = document.documentElement;
  const scrollHeight = doc?.scrollHeight || document.body?.scrollHeight || 0;
  const maxScrollY = Math.max(0, scrollHeight - window.innerHeight);
  const nextY = Math.min(targetY, maxScrollY);
  window.scrollTo(0, nextY);
  if (nextY >= targetY || attempt >= MAX_RESTORE_ATTEMPTS) return;
  window.setTimeout(() => restoreScrollPosition(targetY, attempt + 1), RESTORE_RETRY_MS);
};

export default function ScrollRestoration() {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (!target) return;
      const anchor = target.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      let url;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith('/product/')) return;
      const path = getCurrentPath();
      writeReturnTarget({ path, y: window.scrollY || 0 });
      writeHomeRestore({ path, at: Date.now() });
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const saveScroll = () => {
      const map = readScrollMap();
      map[location.key] = window.scrollY || 0;
      writeScrollMap(map);
    };
    window.addEventListener('beforeunload', saveScroll);
    return () => {
      window.removeEventListener('beforeunload', saveScroll);
      saveScroll();
    };
  }, [location.key]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = getCurrentPath();
    writeLastPath(currentPath);
    const returnTarget = readReturnTarget();
    if (returnTarget?.path === currentPath) {
      restoreScrollPosition(returnTarget.y || 0);
      clearReturnTarget();
      return;
    }
    const map = readScrollMap();
    const y = map[location.key];
    if (typeof y === 'number') {
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key]);

  return null;
}
