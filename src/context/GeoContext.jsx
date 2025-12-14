import { createContext, useEffect, useMemo, useState } from 'react';
import api from '../api/api.js';

const STORAGE_KEY = 'saleday.geo.location';

const toNumberIfFinite = (value) => {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readStoredGeo = () => {
  if (typeof window === 'undefined') {
    return { country: null, locale: null, lat: null, lng: null, ready: false };
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { country: null, locale: null, lat: null, lng: null, ready: false };
    }
    const parsed = JSON.parse(stored);
    const lat = toNumberIfFinite(parsed.lat);
    const lng = toNumberIfFinite(parsed.lng);
    return {
      country: parsed.country || null,
      locale: parsed.locale || null,
      lat,
      lng,
      ready: Boolean(parsed.country || parsed.locale || lat !== null || lng !== null)
    };
  } catch {
    return { country: null, locale: null, lat: null, lng: null, ready: false };
  }
};

const GeoContext = createContext({
  country: null,
  locale: null,
  ready: false,
  error: null
});

export function GeoProvider({ children }) {
  const [state, setState] = useState(() => ({
    ...readStoredGeo(),
    error: null
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let active = true;
    const fetchGeo = async () => {
      try {
        const response = await api.get('/geo/ip');
        if (!active) return;
        const payload = response.data?.data || {};
        const persistedGeo = {
          country: payload.country || null,
          locale: payload.locale || null,
          lat: toNumberIfFinite(payload.lat),
          lng: toNumberIfFinite(payload.lng)
        };
        const nextState = {
          ...persistedGeo,
          ready: true,
          error: null
        };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedGeo));
        }
        setState(nextState);
      } catch (error) {
        if (!active) return;
        console.error('GeoContext fetchGeo erro:', error);
        setState((prev) => ({ ...prev, ready: true, error: 'Não foi possível detectar sua localização.' }));
      }
    };

    fetchGeo();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      country: state.country,
      locale: state.locale,
      lat: state.lat,
      lng: state.lng,
      ready: state.ready,
      error: state.error
    }),
    [state]
  );

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export default GeoContext;
