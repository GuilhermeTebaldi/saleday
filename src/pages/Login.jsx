// frontend/src/pages/Login.jsx
// Página de autenticação de usuários.
import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../api/api.js';
import Auth0LoginActions from '../components/Auth0LoginActions.jsx';
import { AUTH0_CONNECTION_GOOGLE, AUTH0_ENABLED } from '../config/auth0Config.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { sanitizeNextPath } from '../utils/authRedirect.js';

const SHOW_SIGNUP_LINK = false; // Toggle to true if we want the signup CTA visible again.

const SOCIAL_PROVIDERS = [
  {
    key: 'google',
    label: 'Entrar com Google',
    connection: AUTH0_CONNECTION_GOOGLE || 'google-oauth2',
    Icon: function GoogleIcon() {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="#EA4335"
            d="M12.48 10.35v3.7h5.16c-.75 2.24-2.73 3.7-5.16 3.7-3.11 0-5.64-2.55-5.64-5.7s2.53-5.7 5.64-5.7c1.7 0 3.12.62 4.16 1.64l2.82-2.74C17.76 3.58 15.33 2.5 12.48 2.5 7.84 2.5 4.09 6.28 4.09 10.95s3.75 8.45 8.39 8.45c4.85 0 8.05-3.41 8.05-8.2 0-.56-.07-1.1-.17-1.61h-7.88z"
          />
          <path
            fill="#34A853"
            d="M5.3 7.26l3.1 2.27c.84-1.7 2.63-2.87 4.73-2.87 1.7 0 3.12.62 4.16 1.64l2.82-2.74C17.76 3.58 15.33 2.5 12.48 2.5c-3.23 0-6.02 1.72-7.18 4.76z"
          />
          <path
            fill="#FBBC05"
            d="M12.48 19.4c2.4 0 4.42-.8 5.9-2.16l-2.86-2.35c-.8.55-1.87.93-3.04.93-2.39 0-4.41-1.46-5.15-3.51l-3.1 2.39c1.15 3.07 3.95 4.7 8.25 4.7z"
          />
          <path
            fill="#4285F4"
            d="M20.53 11.2c0-.56-.07-1.1-.17-1.61h-7.88v3.7h5.16c-.33 1-1.03 1.85-1.98 2.43l2.86 2.35c1.67-1.55 2.61-3.85 2.61-6.87z"
          />
        </svg>
      );
    }
  }
];

export default function Login() {
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('templesale.loginEmail') ?? '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
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
      localStorage.setItem('templesale.loginEmail', email);
    } else {
      localStorage.removeItem('templesale.loginEmail');
    }
  }, [email]);

  const handleLoginSuccess = (payload) => {
    login(payload);
    navigate(nextPath, { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setEmailError('');
    setLoading(true);

    try {
      if (!rememberMe && typeof window !== 'undefined') {
        window.localStorage.removeItem('templesale.rememberToken');
      }
      const res = await api.post('/auth/login', { email, password, rememberMe });
      handleLoginSuccess(res.data.data);
    } catch (err) {
      const message = err.response?.data?.message ?? 'E-mail ou senha inválidos.';
      setEmailError(message);
    } finally {
      setLoading(false);
    }
  };

  const hasError = Boolean(emailError);

  return (
    <section className="auth-page auth-page--choice">
      <div className="auth-card auth-card--choice login-choice">
        <div className="login-choice__header">
          <h1 className="login-choice__title">
            Acesse ou <span>crie sua conta</span>
          </h1>
          <p className="login-choice__subtitle">
            Entre em sua conta através das suas redes sociais ou por email.
          </p>
        </div>

        {AUTH0_ENABLED && (
          <Auth0LoginActions
            onLoginSuccess={handleLoginSuccess}
            className="login-choice__auth0"
            renderButtons={({ onLogin, isBusy, errorMessage }) => (
              <>
                <div className="login-choice__social">
                  {SOCIAL_PROVIDERS.map(({ key, label, connection, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className={`login-choice__btn login-choice__btn--${key}`}
                      onClick={() => onLogin(connection)}
                      disabled={isBusy}
                      aria-busy={isBusy}
                    >
                      <span className="login-choice__icon">
                        <Icon />
                      </span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                {errorMessage && (
                  <p className="login-choice__error" role="alert" aria-live="polite">
                    {errorMessage}
                  </p>
                )}
              </>
            )}
          />
        )}

        {AUTH0_ENABLED && <div className="login-choice__divider">ou</div>}

        <div className="login-choice__email">
          <button
            type="button"
            className={`login-choice__email-trigger${showEmailForm ? ' is-open' : ''}`}
            onClick={() => setShowEmailForm(true)}
            aria-expanded={showEmailForm}
            aria-controls="email-login-form"
          >
            Entrar com email
          </button>

          {showEmailForm && (
            <form className="auth-form login-choice__form" onSubmit={handleSubmit} id="email-login-form">
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

              {emailError && (
                <p className="form-error" role="alert" aria-live="polite">
                  {emailError}
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
          )}
        </div>

        {SHOW_SIGNUP_LINK && (
          <p className="login-choice__signup">
            Não possui conta? <Link to="/register">Cadastre-se aqui</Link>
          </p>
        )}
        <p className="login-choice__terms">
          Ao logar, você afirma que leu e concorda com os nossos{' '}
          <Link to="/politica-de-privacidade#termos" target="_blank" rel="noreferrer">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link to="/politica-de-privacidade" target="_blank" rel="noreferrer">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
