import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/api.js';

const REMEMBER_TOKEN_KEY = 'saleday.rememberToken';

export const AuthContext = createContext();

const sanitizeUser = (rawUser) => {
  if (!rawUser) return null;
  const { password, ...safeUser } = rawUser;
  return safeUser;
};

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
      setUser(sanitizeUser(data.user));
      setToken(data.token);
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
    localStorage.removeItem('saleday.locale');
    persistRememberToken(null);
    setRememberAttempted(false);
  }, [persistRememberToken]);

  useEffect(() => {
    if (user || typeof window === 'undefined') return undefined;
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
  }, [user, login, persistRememberToken]);

  useEffect(() => {
    if (user || !rememberAttempted || typeof window === 'undefined') return undefined;
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
  }, [user, login, rememberAttempted]);

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
