import { createContext, useEffect, useMemo, useState } from 'react';

export const AuthContext = createContext();

const sanitizeUser = (rawUser) => {
  if (!rawUser) return null;
  const { password, ...safeUser } = rawUser;
  return safeUser;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(sanitizeUser(user)));
    else localStorage.removeItem('user');
  }, [user]);

  const login = (data) => {
    setUser(sanitizeUser(data.user));
    setToken(data.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('saleday.locale');
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
