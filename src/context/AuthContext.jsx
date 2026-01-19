import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import api from '../api/api.js';
import { AUTH0_ENABLED, AUTH0_REDIRECT_URI } from '../config/auth0Config.js';
import { normalizeCountryCode } from '../data/countries.js';
import { detectCountryFromTimezone } from '../utils/timezoneCountry.js';

const REMEMBER_TOKEN_KEY = 'templesale.rememberToken';

export const AuthContext = createContext();

const sanitizeUser = (rawUser) => {
  if (!rawUser) return null;
  const { password, ...safeUser } = rawUser;
  return safeUser;
};

const isBlank = (value) => value === undefined || value === null || value === '';

const extractRegionFromLocale = (value) => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/[-_](\w{2})/);
  return match ? match[1].toUpperCase() : '';
};

const resolveCountryFromLocale = (value) => {
  if (!value) return '';
  const region = extractRegionFromLocale(value);
  if (region) return normalizeCountryCode(region);
  return normalizeCountryCode(value);
};

const resolveTimezoneCountry = () => {
  if (typeof window === 'undefined' || typeof Intl === 'undefined') return '';
  const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone;
  return normalizeCountryCode(detectCountryFromTimezone(timezone));
};

const buildAuth0FallbackUser = (claims) => ({
  id: claims?.sub,
  email: claims?.email,
  username: claims?.nickname || claims?.name || claims?.email,
  name: claims?.name || claims?.given_name,
  profile_image_url: typeof claims?.picture === 'string' ? claims.picture : undefined
});

const mergeAuth0Profile = (baseUser, fallbackUser, extras) => {
  if (!baseUser) return null;
  const next = { ...baseUser };
  let changed = false;

  const assignIfMissing = (key, value) => {
    if (isBlank(next[key]) && !isBlank(value)) {
      next[key] = value;
      changed = true;
    }
  };

  assignIfMissing('email', fallbackUser?.email);
  assignIfMissing('username', fallbackUser?.username);
  assignIfMissing('name', fallbackUser?.name);
  assignIfMissing('profile_image_url', extras?.profileImageUrl || fallbackUser?.profile_image_url);
  assignIfMissing('country', extras?.country);
  assignIfMissing('state', extras?.state);
  assignIfMissing('city', extras?.city);

  return changed ? next : null;
};

function Auth0SessionSync({
  user,
  token,
  login,
  setLoading,
  setAuth0Ready,
  setAuth0Authenticated,
  auth0StateRef
}) {
  const {
    isAuthenticated,
    isLoading: auth0Loading,
    getIdTokenClaims,
    logout: auth0Logout
  } = useAuth0();
  const syncAttemptedRef = useRef(false);

  useEffect(() => {
    auth0StateRef.current.isAuthenticated = isAuthenticated;
    auth0StateRef.current.logout = auth0Logout;
    setAuth0Ready(!auth0Loading);
    setAuth0Authenticated(isAuthenticated);
  }, [auth0Logout, auth0Loading, auth0StateRef, isAuthenticated, setAuth0Authenticated, setAuth0Ready]);

  useEffect(() => {
    if (!isAuthenticated) {
      syncAttemptedRef.current = false;
      return;
    }
    if (auth0Loading || syncAttemptedRef.current) return;
    const shouldBootstrap = !user || !token;

    let isActive = true;
    syncAttemptedRef.current = true;
    if (shouldBootstrap) {
      setLoading(true);
    }

    const exchangeToken = async () => {
      try {
        const claims = await getIdTokenClaims();
        const idToken = claims?.__raw;
        if (!idToken) {
          throw new Error('Não foi possível recuperar o token do Auth0.');
        }
        if (!isActive) return;
        const fallbackUser = buildAuth0FallbackUser(claims);
        if (shouldBootstrap) {
          login({ user: fallbackUser, token: idToken });
        }

        let provisionedUser = null;
        try {
          const response = await api.post(
            '/auth/auth0/provision',
            null,
            { headers: { Authorization: `Bearer ${idToken}` } }
          );
          if (!isActive) return;
          provisionedUser = response.data?.data || null;
          if (provisionedUser) {
            login({ user: provisionedUser, token: idToken });
          }
        } catch (provisionErr) {
          if (isActive) {
            console.warn('auth0 provision failed:', provisionErr);
          }
        }

        if (!isActive) return;

        const baseUser = provisionedUser || user || fallbackUser;
        const localeCountry = resolveCountryFromLocale(claims?.locale);
        const timezoneCountry = resolveTimezoneCountry();
        const missingCountry = isBlank(baseUser?.country);
        const missingState = isBlank(baseUser?.state);
        const missingCity = isBlank(baseUser?.city);
        let geo = null;
        const needsGeoLookup =
          missingCity || missingState || (missingCountry && !localeCountry && !timezoneCountry);
        if (needsGeoLookup) {
          try {
            const response = await api.get('/geo/ip');
            if (!isActive) return;
            geo = response.data?.data || null;
          } catch (geoErr) {
            if (isActive) {
              console.warn('auth0 geo lookup failed:', geoErr);
            }
          }
        }

        const geoCountry = normalizeCountryCode(geo?.country) || resolveCountryFromLocale(geo?.locale);
        const mergedUser = mergeAuth0Profile(baseUser, fallbackUser, {
          profileImageUrl: typeof claims?.picture === 'string' ? claims.picture : undefined,
          country: localeCountry || geoCountry || timezoneCountry,
          state: geo?.region,
          city: geo?.city
        });
        if (mergedUser) {
          login({ user: mergedUser, token: idToken });
        }
      } catch (err) {
        if (isActive) {
          console.error('auth0 session sync failed:', err);
        }
      } finally {
        if (isActive) {
          if (shouldBootstrap) {
            setLoading(false);
          }
        }
      }
    };

    exchangeToken();

    return () => {
      isActive = false;
    };
  }, [auth0Loading, getIdTokenClaims, isAuthenticated, login, setLoading, token, user]);

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    let initial = null;
    try {
      const raw = localStorage.getItem('user');
      initial = raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Erro ao parsear user do localStorage:', localStorage.getItem('user'));
      localStorage.removeItem('user');
      initial = null;
    }
    return initial;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [rememberAttempted, setRememberAttempted] = useState(false);
  const auth0StateRef = useRef({ isAuthenticated: false, logout: null });
  const [auth0Ready, setAuth0Ready] = useState(!AUTH0_ENABLED);
  const [auth0Authenticated, setAuth0Authenticated] = useState(false);

  const persistRememberToken = useCallback((value) => {
    if (typeof window === 'undefined') return;
    if (value) localStorage.setItem(REMEMBER_TOKEN_KEY, value);
    else localStorage.removeItem(REMEMBER_TOKEN_KEY);
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(sanitizeUser(user)));
    else localStorage.removeItem('user');
  }, [user]);

  const login = useCallback(
    (data) => {
      if (!data?.user) {
        setLoading(false);
        return;
      }
      setUser(sanitizeUser(data.user));
      setToken(data.token);
      if (data?.token) {
        api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      }
      if (data?.rememberToken) {
        persistRememberToken(data.rememberToken);
      }
      setLoading(false);
    },
    [persistRememberToken]
  );

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    setUser(null);
    setToken(null);
    setLoading(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('templesale.locale');
    delete api.defaults.headers.common.Authorization;
    persistRememberToken(null);
    setRememberAttempted(false);
    if (AUTH0_ENABLED && auth0StateRef.current.isAuthenticated && auth0StateRef.current.logout) {
      try {
        auth0StateRef.current.logout({ logoutParams: { returnTo: AUTH0_REDIRECT_URI } });
      } catch (error) {
        console.error('auth0 logout failed:', error);
      }
    }
  }, [persistRememberToken]);

  useEffect(() => {
    if (user || typeof window === 'undefined') return undefined;
    if (AUTH0_ENABLED && (!auth0Ready || auth0Authenticated)) return undefined;
    const rememberToken = localStorage.getItem(REMEMBER_TOKEN_KEY);
    if (!rememberToken) {
      setRememberAttempted(true);
      return undefined;
    }
    let isActive = true;
    setLoading(true);
    api
      .post('/auth/remember', { token: rememberToken })
      .then((response) => {
        if (!isActive) return;
        login(response.data?.data);
      })
      .catch((err) => {
        if (!isActive) return;
        console.error('remember login failed:', err);
        persistRememberToken(null);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
        setRememberAttempted(true);
      });
    return () => {
      isActive = false;
    };
  }, [auth0Authenticated, auth0Ready, login, persistRememberToken, user]);

  useEffect(() => {
    if (user || !rememberAttempted || typeof window === 'undefined') return undefined;
    if (AUTH0_ENABLED && auth0Authenticated) return undefined;
    let isActive = true;
    setLoading(true);
    api
      .get('/auth/session')
      .then((response) => {
        if (!isActive) return;
        login(response.data?.data);
      })
      .catch((err) => {
        if (!isActive) return;
        console.error('session refresh failed:', err);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [auth0Authenticated, login, rememberAttempted, user]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout
    }),
    [user, token, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {AUTH0_ENABLED && (
        <Auth0SessionSync
          user={user}
          token={token}
          login={login}
          setLoading={setLoading}
          setAuth0Ready={setAuth0Ready}
          setAuth0Authenticated={setAuth0Authenticated}
          auth0StateRef={auth0StateRef}
        />
      )}
      {children}
    </AuthContext.Provider>
  );
}
