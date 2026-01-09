// frontend/src/pages/admin/AdminLayout.jsx
// Layout principal das rotas administrativas e sua navegação.
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../api/api.js';

const links = [
  {
    to: '/admin',
    label: 'Visão geral',
    end: true,
    description: 'Indicadores e desempenho do marketplace',
    icon: DashboardIcon
  },
  {
    to: '/admin/users',
    label: 'Usuários',
    description: 'Contas, bans, redefinições de senha',
    icon: UsersIcon
  },
  {
    to: '/admin/ranking',
    label: 'Ranking',
    description: 'Impulsionamento manual por país',
    icon: RankingIcon
  },
  {
    to: '/admin/products',
    label: 'Produtos',
    description: 'Ranking, engajamento e curadoria',
    icon: ProductsIcon
  }
  ,
  {
    to: '/admin/history',
    label: 'Histórico',
    description: 'Lista completa de eventos críticos',
    icon: HistoryIcon
  }
  ,
  {
    to: '/admin/support',
    label: 'Suporte',
    description: 'Chat privado entre usuário e equipe',
    icon: SupportIcon
  }
];

export default function AdminLayout() {
  const location = useLocation();
  const [hasSupportAlert, setHasSupportAlert] = useState(false);

  function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  }

  useEffect(() => {
    let active = true;
    const refreshIndicator = async () => {
      try {
        const { data } = await api.get('/support/admin/conversations');
        if (!active) return;
        const list = Array.isArray(data?.data) ? data.data : [];
        const hasPending = list.some((conversation) => conversation.last_sender_type === 'user');
        setHasSupportAlert(hasPending);
      } catch (error) {
        console.error('support.indicator error:', error);
      }
    };
    refreshIndicator();
    const listener = (event) => {
      const detail = event?.detail;
      if (detail?.hasPendingMessages !== undefined) {
        setHasSupportAlert(Boolean(detail.hasPendingMessages));
      }
    };
    window.addEventListener('templesale:support-status', listener);
    const interval = setInterval(refreshIndicator, 15000);
    return () => {
      active = false;
      window.removeEventListener('templesale:support-status', listener);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-500/30 via-slate-900 to-slate-950 blur-3xl" />
        <div className="relative z-10 mx-auto flex max-w-[2000px] flex-col gap-8 px-6 pb-16 pt-12 sm:px-10 lg:px-16 xl:px-94">
          <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-indigo-300">TempleSale Admin</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Central de Operações
                </h1>
                <p className="mt-2 max-w-xl text-sm text-slate-300">
                  Visão consolidada de tudo que acontece no marketplace. Supervisione métricas críticas,
                  cuide dos usuários e mantenha o catálogo sob controle em um só lugar.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => window.dispatchEvent(new Event('templesale:admin-refresh'))}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10"
                >
                  Sincronizar
                </button>
                <button
                  onClick={logout}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5"
                >
                  Sair
                </button>
              </div>
            </div>

            <nav className="grid gap-3 md:grid-cols-3">
              {links.map((item) => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={`group flex flex-col rounded-2xl border px-4 py-4 transition ${
                      isActive
                        ? 'border-indigo-400/70 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
                      <span className="inline-flex rounded-xl bg-white/10 p-2 text-indigo-200">
                        <Icon size={18} />
                      </span>
                      <span className="relative inline-flex items-center gap-2">
                        {item.label}
                        {item.to === '/admin/support' && hasSupportAlert && (
                          <span className="absolute -top-1 right-[-0.35rem] h-2 w-2 rounded-full bg-emerald-400 shadow-xl shadow-emerald-400/60" />
                        )}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">{item.description}</p>
                  </NavLink>
                );
              })}
            </nav>
          </header>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/20 backdrop-blur">
            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}

function DashboardIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 12h7V4H3zM14 20h7V10h-7zM14 4h7M14 8h7M3 20h7v-6H3z" />
    </svg>
  );
}

function UsersIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="3.5" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.87M17 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProductsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 7h18M3 12h18M3 17h12" />
    </svg>
  );
}

function RankingIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 17h4V7H5zM10 17h4V4h-4zM15 17h4V10h-4z" />
    </svg>
  );
}

function HistoryIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 6v6h4" />
      <path d="M4 6a8 8 0 1 1 8 8" />
    </svg>
  );
}

function SupportIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 18h5l3 3 3-3h5v-9a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5z" />
      <path d="M8 11h8M8 15h6" />
    </svg>
  );
}
