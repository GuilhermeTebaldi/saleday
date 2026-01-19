// frontend/src/pages/Register.jsx
// Página de cadastro de novos usuários.
import { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import api from '../api/api.js';
import { AUTH0_ENABLED } from '../config/auth0Config.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { localeFromCountry } from '../i18n/localeMap.js';

// ISO-3166-1 alpha-2
const COUNTRY_OPTIONS = [
  { label: 'Brasil', value: 'BR' },
  { label: 'Estados Unidos', value: 'US' },
  { label: 'Itália', value: 'IT' },
  { label: 'Portugal', value: 'PT' },
  { label: 'Espanha', value: 'ES' },
  { label: 'França', value: 'FR' },
  { label: 'Alemanha', value: 'DE' },
  { label: 'Reino Unido', value: 'GB' },
  { label: 'Canadá', value: 'CA' },
  { label: 'México', value: 'MX' },
  { label: 'Argentina', value: 'AR' },
  { label: 'Chile', value: 'CL' },
  { label: 'Colômbia', value: 'CO' },
  { label: 'Peru', value: 'PE' },
  { label: 'Japão', value: 'JP' },
  { label: 'China', value: 'CN' },
  { label: 'Índia', value: 'IN' },
];

function Auth0SignupActions({ className = '' }) {
  const { loginWithRedirect, isLoading, error } = useAuth0();
  const [localError, setLocalError] = useState('');

  const handleAuth0Signup = () => {
    setLocalError('');
    loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } }).catch(() => {
      setLocalError('Não foi possível iniciar o cadastro pelo Auth0.');
    });
  };

  const errorMessage = localError || error?.message || '';

  //return (
    //<div className={`auth0-actions ${className}`.trim()}>
     // <button type="button" className="btn-secondary" onClick={handleAuth0Signup} disabled={isLoading}>
     //   {isLoading ? 'Abrindo...' : 'Criar conta com Auth0'}
    //  </button>
     // {errorMessage && (
     //   <p className="form-error" role="alert" aria-live="polite">
     //     {errorMessage}
     //   </p>
     // )}
    //</div>
  //);
}

export default function Register() {
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('BR');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!acceptLegal) {
      setError('Você precisa aceitar a Política de Privacidade, os Termos e as Diretrizes para continuar.');
      return;
    }

    setLoading(true);
  
    try {
      await api.post('/auth/register', {
        username: username.trim(),
        email: email.trim(),
        password,
        country,
        acceptLegal
      });
  
      const logRes = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });
  
      const data = logRes.data?.data; // { user, token }
      if (!data?.token || !data?.user) {
        throw new Error('Resposta de login inválida.');
      }

      if (acceptLegal) {
        try {
          await api.post(
            '/auth/accept-legal',
            { acceptLegal: true, source: 'register' },
            { headers: { Authorization: `Bearer ${data.token}` } }
          );
        } catch (acceptErr) {
          console.warn('Não foi possível registrar o aceite legal no cadastro.', acceptErr);
        }
      }

      login(data);
      localStorage.setItem('templesale.locale', localeFromCountry(country)); // <- aqui
      navigate('/');                                                     // <- aqui
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível criar sua conta.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const hasError = Boolean(error);

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <h1 className="page-title">Cadastre-se</h1>
          <p className="auth-card__subtitle">
            Crie sua conta para negociar com segurança e acompanhar suas operações em um só lugar.
          </p>
      </div>

      {AUTH0_ENABLED && <Auth0SignupActions className="auth-card__auth0" />}

      <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__group">
            <label htmlFor="username">Nome</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu nome"
              required
              className={`form-control ${hasError ? 'form-control--error' : ''}`}
            />
          </div>

          <div className="auth-form__group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crie uma senha"
                minLength={6}
                autoComplete="new-password"
                required
                className={`form-control ${hasError ? 'form-control--error' : ''} form-control--with-action`}
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className="auth-form__group">
            <label htmlFor="country">
              País de origem
              <small id="country-help" className="field-help">
                Selecione um país da lista.
              </small>
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-describedby="country-help"
              autoComplete="country-name"
              required
              className={`form-control ${hasError ? 'form-control--error' : ''}`}
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="form-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <label className="legal-consent">
            <input
              type="checkbox"
              checked={acceptLegal}
              onChange={(e) => setAcceptLegal(e.target.checked)}
              required
            />
            <div className="legal-consent__content">
              <span>
                Li e aceito a{' '}
                <Link to="/politica-de-privacidade" target="_blank" rel="noreferrer">
                  Política de Privacidade
                </Link>
                , os{' '}
                <Link to="/politica-de-privacidade#termos" target="_blank" rel="noreferrer">
                  Termos de Uso
                </Link>{' '}
                e as{' '}
                <Link to="/politica-de-privacidade#diretrizes" target="_blank" rel="noreferrer">
                  Diretrizes da Comunidade
                </Link>
                . Compreendo que o TempleSale não participa das negociações nem responde por golpes ou prejuízos causados
                por terceiros.
              </span>
              <small>Vigência imediata · Última atualização: 27/10/2025</small>
            </div>
          </label>

          <div className="auth-actions">
            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={loading}
              data-loading={loading ? 'true' : 'false'}
              aria-busy={loading}
            >
              {loading ? 'Enviando...' : 'Criar conta'}
            </button>
          </div>
        </form>

        <p className="auth-card__footer">
          Já tem conta? <Link to="/login">Faça login</Link>
        </p>
      </div>
    </section>
  );
}
