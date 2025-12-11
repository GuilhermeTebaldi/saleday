// frontend/src/pages/Login.jsx
// Página de autenticação de usuários.
import { useContext, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api.js';
import Auth0LoginActions from '../components/Auth0LoginActions.jsx';
import { AUTH0_ENABLED } from '../config/auth0Config.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { localeFromCountry } from '../i18n/localeMap.js';

export default function Login() {
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('saleday.loginEmail') ?? '';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (email) {
      localStorage.setItem('saleday.loginEmail', email);
    } else {
      localStorage.removeItem('saleday.loginEmail');
    }
  }, [email]);

  const handleLoginSuccess = (payload) => {
    login(payload);
    const userCountry = payload?.user?.country;
    if (userCountry) {
      localStorage.setItem('saleday.locale', localeFromCountry(userCountry));
    }
    navigate('/');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!rememberMe && typeof window !== 'undefined') {
        window.localStorage.removeItem('saleday.rememberToken');
      }
      const res = await api.post('/auth/login', { email, password, rememberMe });
      handleLoginSuccess(res.data.data);
    } catch (err) {
      const message = err.response?.data?.message ?? 'E-mail ou senha inválidos.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <h1 className="page-title">Login</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu@email.com"
          required
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Digite sua senha"
          required
        />

        <label className="auth-form__remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Lembrar meus dados neste dispositivo
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
       <p className="auth-extra">
        Ainda não tem conta? <Link to="/register">Cadastre-se</Link>
      </p>
    </section>
  );
}
