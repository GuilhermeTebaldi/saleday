import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import api from '../api/api.js';
import { AUTH0_ENABLED, AUTH0_REDIRECT_URI } from '../config/auth0Config.js';

const REMEMBER_TOKEN_KEY = 'templesale.rememberToken';

export const AuthContext = createContext();

const sanitizeUser = (rawUser) => {
  if (!rawUser) return null;
  const { password, ...safeUser } = rawUser;
  return safeUser;
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
    if (user && token) return;
    // Se Auth0 autenticou, não bloqueie a UI por depender do backend.
    // Preenche user/token diretamente do Auth0 e evita "voltar deslogado".

    let isActive = true;
    syncAttemptedRef.current = true;
    setLoading(true);

    const exchangeToken = async () => {
      try {
        const claims = await getIdTokenClaims();
        const idToken = claims?.__raw;
        if (!idToken) {
          throw new Error('Não foi possível recuperar o token do Auth0.');
        }
        if (!isActive) return;
        // Usa Auth0 como fonte principal. Mantém compatibilidade salvando algo em token.
        login({
          user: {
            id: claims?.sub,
            email: claims?.email,
            username: claims?.nickname || claims?.name || claims?.email,
            name: claims?.name
          },
          token: idToken
        });
      } catch (err) {
        if (isActive) {
          console.error('auth0 session sync failed:', err);
        }
      } finally {
        if (isActive) {
          setLoading(false);
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
