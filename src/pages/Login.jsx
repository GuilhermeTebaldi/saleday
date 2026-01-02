// frontend/src/pages/Login.jsx
// Página de autenticação de usuários.
import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../api/api.js';
import Auth0LoginActions from '../components/Auth0LoginActions.jsx';
import { AUTH0_ENABLED } from '../config/auth0Config.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { localeFromCountry } from '../i18n/localeMap.js';
import { sanitizeNextPath } from '../utils/authRedirect.js';

export default function Login() {
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('saleday.loginEmail') ?? '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return sanitizeNextPath(params.get('next'));
  }, [location.search]);

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
    navigate(nextPath, { replace: true });
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

  const hasError = Boolean(error);

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <h1 className="page-title">Login</h1>
          <p className="auth-card__subtitle">Acesse sua conta e acompanhe suas negociações em segundos.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
              className={`form-control ${hasError ? 'form-control--error' : ''}`}
            />
          </div>

          <div className="auth-form__group">
            <label htmlFor="password">Senha</label>
            <div className="input-with-action">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
                className={`form-control ${hasError ? 'form-control--error' : ''} form-control--with-action`}
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <label className="auth-form__remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Lembrar meus dados neste dispositivo</span>
          </label>

          {error && (
            <p className="form-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <div className="auth-actions">
            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={loading}
              data-loading={loading ? 'true' : 'false'}
              aria-busy={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>

        {AUTH0_ENABLED && (
          <div className="auth0-placeholder" aria-hidden="true">
            <Auth0LoginActions onLoginSuccess={handleLoginSuccess} onLoginError={setError} />
          </div>
        )}

        <p className="auth-card__footer">
          Ainda não tem conta? <Link to="/register">Cadastre-se</Link>
        </p>
      </div>
    </section>
  );
}
