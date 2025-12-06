// frontend/src/pages/AdminLogin.jsx
// Página de login dos administradores.

import { useState } from 'react';
import api from '../api/api.js';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await api.post('/admin/login', { email, password });
      localStorage.setItem('adminToken', data?.data?.token);
      navigate('/admin');
    } catch (e2) {
      setErr(e2?.response?.data?.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 overflow-hidden">

      {/* Fundo: SALE DAY gigante desfocado */}
      <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none opacity-[0.05]">
        <h1 className="text-[18rem] md:text-[22rem] font-black uppercase tracking-tight text-white blur-3xl">
          SaleDay
        </h1>
      </div>

      {/* Conteúdo principal */}
      <div className="relative w-full max-w-md z-10">
        {/* Cabeçalho */}
        <div className="mb-6 text-center">
          <p className="text-[11px] font-semibold tracking-[0.35em] uppercase text-emerald-400">
            SaleDay
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">
            Área administrativa
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Acesse o painel interno e gerencie a plataforma com segurança.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-sm p-6 md:p-7 space-y-4">

          {err && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                E-mail administrativo
              </label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="admin@saleday.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                Senha
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2.5 pr-20 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500 transition"
                  placeholder="Digite sua senha"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 inline-flex items-center text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            <button
              className="w-full inline-flex items-center justify-center rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold py-2.5 mt-1 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-500/25"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center pt-1">
            Acesso restrito à equipe autorizada SaleDay.
          </p>
        </div>
      </div>
    </section>
  );
}
