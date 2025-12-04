// frontend/src/pages/Register.jsx
// Página de cadastro de novos usuários.
import { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api.js';
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
        acceptLegal: true
      });
  
      const logRes = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });
  
      const data = logRes.data?.data; // { user, token }
      if (!data?.token || !data?.user) {
        throw new Error('Resposta de login inválida.');
      }
  
      login(data);
      localStorage.setItem('saleday.locale', localeFromCountry(country)); // <- aqui
      navigate('/');                                                     // <- aqui
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível criar sua conta.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <section className="auth-page">
      <h1 className="page-title">Cadastre-se</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="username" className="block">
          Nome
          <div className="input-with-action">
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu nome"
              required
            />
          </div>
        </label>

        <label htmlFor="email" className="block">
          E-mail
          <div className="input-with-action">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
          </div>
        </label>

        <label htmlFor="password" className="block">
          Senha
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
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        <label htmlFor="country" className="block font-medium text-[15px] text-gray-900">
          País de origem
          <div className="select-wrapper" style={{ position: 'relative' }}>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-describedby="country-help"
              autoComplete="country-name"
              className="block w-full min-h-[44px] px-3 py-2 rounded-md border border-gray-500 bg-white text-gray-900 text-[15px] font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 hover:border-gray-600"
              required
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <small id="country-help" className="field-help block mt-1 text-[12px] text-gray-700">
            Selecione um país da lista.
          </small>
        </label>

        {error && <p className="form-error">{error}</p>}

        <label className="legal-consent block text-sm text-gray-800 border border-gray-300 rounded-md p-3 bg-gray-50">
          <div className="flex gap-3">
            <input
              type="checkbox"
              checked={acceptLegal}
              onChange={(e) => setAcceptLegal(e.target.checked)}
              required
              className="mt-1 h-4 w-4"
            />
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
              . Compreendo que o SaleDay não participa das negociações nem responde por golpes ou prejuízos causados
              por terceiros.
            </span>
          </div>
          <small className="mt-2 block text-xs text-gray-600">
            Vigência imediata · Última atualização: 27/10/2025
          </small>
        </label>

        <div className="auth-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Enviando...' : 'Criar conta'}
          </button>
        </div>
      </form>

      <p className="auth-extra">
        Já tem conta? <Link to="/login">Faça login</Link>
      </p>
    </section>
  );
}
