import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/api.js';
import { normalizeCountryCode } from '../data/countries.js';
import { AuthContext } from './AuthContext.jsx';

const GEO_STORAGE_KEY = 'templesale.geo.location';
const MARKET_STORAGE_KEY = 'templesale.marketCountry';
const DEFAULT_MARKET_COUNTRY = 'BR';

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
    const stored = window.localStorage.getItem(GEO_STORAGE_KEY);
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

const readStoredMarketCountry = () => {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeCountryCode(window.localStorage.getItem(MARKET_STORAGE_KEY));
  } catch {
    return '';
  }
};

const GeoContext = createContext({
  marketCountry: null,
  setMarketCountry: () => {},
  country: null,
  locale: null,
  ready: false,
  error: null
});

export function GeoProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [state, setState] = useState(() => ({
    ...readStoredGeo(),
    error: null
  }));
  const [marketCountry, setMarketCountryState] = useState(() => readStoredMarketCountry());

  const setMarketCountry = useCallback((value) => {
    const normalized = normalizeCountryCode(value);
    setMarketCountryState((current) => {
      if (normalized && normalized !== current) return normalized;
      if (!normalized && current) return '';
      return current;
    });
  }, []);

  useEffect(() => {
    if (!user?.country) return;
    const stored = readStoredMarketCountry();
    if (stored) return;
    const normalizedUser = normalizeCountryCode(user.country);
    if (!normalizedUser) return;
    setMarketCountryState(normalizedUser);
  }, [user?.country]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (marketCountry) {
        window.localStorage.setItem(MARKET_STORAGE_KEY, marketCountry);
      } else {
        window.localStorage.removeItem(MARKET_STORAGE_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, [marketCountry]);

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
          window.localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(persistedGeo));
        }
        setState(nextState);
        const storedMarket = readStoredMarketCountry();
        if (!storedMarket && !user?.country) {
          const suggestedMarket =
            normalizeCountryCode(persistedGeo.country) || DEFAULT_MARKET_COUNTRY;
          if (suggestedMarket) {
            setMarketCountryState(suggestedMarket);
          }
        }
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
  }, [user?.country]);

  const value = useMemo(
    () => ({
      marketCountry: marketCountry || null,
      setMarketCountry,
      country: state.country,
      locale: state.locale,
      lat: state.lat,
      lng: state.lng,
      ready: state.ready,
      error: state.error
    }),
    [marketCountry, setMarketCountry, state]
  );

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export default GeoContext;
