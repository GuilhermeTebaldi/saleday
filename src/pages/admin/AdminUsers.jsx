// frontend/src/pages/admin/AdminUsers.jsx
// Tela administrativa para listar, banir ou excluir usuários.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/api.js';
import LoadingBar from '../../components/LoadingBar.jsx';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [processingIds, setProcessingIds] = useState({});
  const [passwordEdits, setPasswordEdits] = useState({});
  const [passwordVisibility, setPasswordVisibility] = useState({});
  const [passwordSaving, setPasswordSaving] = useState({});
  const [banNotes, setBanNotes] = useState({});
  const [pendingBan, setPendingBan] = useState(null);

  useEffect(() => {
    loadUsers(submittedSearch);
  }, [submittedSearch]);

  async function loadUsers(q = '') {
    setLoading(true);
    try {
      const query = q ? `?q=${encodeURIComponent(q)}` : '';
      const { data } = await api.get(`/admin/users${query}`);
      setUsers(data?.data ?? []);
    } catch (err) {
      console.error('admin.users load error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function startBanReview(user) {
    const action = user.is_banned ? 'unban' : 'ban';
    setBanNotes((state) => ({
      ...state,
      [user.id]:
        state[user.id] ??
        (action === 'ban'
          ? 'Usuário banido — explique por que a conta foi bloqueada.'
          : 'Conta banida — informe por que o banimento deverá ser removido.')
    }));
    setPendingBan({ userId: user.id, action });
  }

  function cancelBanReview(user) {
    if (pendingBan?.userId === user.id) {
      setPendingBan(null);
    }
  }

  async function confirmBanAction(user) {
    if (!pendingBan || pendingBan.userId !== user.id) return;
    const nextIsBanned = pendingBan.action === 'ban';
    setProcessingIds((state) => ({ ...state, [user.id]: true }));
    try {
      const trimmedNote = (banNotes[user.id] || '').trim();
      if (pendingBan.action === 'ban' && !trimmedNote) {
        toast.error('Informe o motivo do banimento antes de confirmar.');
        setProcessingIds((state) => {
          const { [user.id]: _ignore, ...rest } = state;
          return rest;
        });
        return;
      }
      const payload = { isBanned: nextIsBanned };
      if (trimmedNote) payload.banReason = trimmedNote;

      const { data } = await api.patch(`/admin/users/${user.id}/ban`, payload);
      const updated = data?.data;
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, is_banned: updated?.is_banned ?? nextIsBanned } : item
        )
      );
      toast.success(nextIsBanned ? 'Usuário banido.' : 'Usuário liberado.');
      if (!nextIsBanned) {
        setBanNotes((state) => {
          const { [user.id]: _ignore, ...rest } = state;
          return rest;
        });
      }
    } catch (err) {
      console.error('admin.users toggleBan error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao atualizar usuário');
    } finally {
      setProcessingIds((state) => {
        const { [user.id]: _ignore, ...rest } = state;
        return rest;
      });
      setPendingBan(null);
    }
  }

  const handleBanNoteChange = (userId, value) => {
    setBanNotes((state) => ({ ...state, [userId]: value }));
  };

  async function deleteUser(user) {
    if (!window.confirm(`Excluir permanentemente ${user.username}?`)) {
      return;
    }
    setProcessingIds((state) => ({ ...state, [user.id]: true }));
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      toast.success('Usuário excluído.');
    } catch (err) {
      console.error('admin.users delete error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao excluir usuário');
    } finally {
      setProcessingIds((state) => {
        const { [user.id]: _ignore, ...rest } = state;
        return rest;
      });
    }
  }

  const handlePasswordInput = (userId, value) => {
    setPasswordEdits((state) => ({ ...state, [userId]: value }));
  };

  const togglePasswordVisibility = (userId) => {
    setPasswordVisibility((state) => ({ ...state, [userId]: !state[userId] }));
  };

  async function updateUserPassword(user) {
    const userId = user.id;
    const nextPassword = (passwordEdits[userId] || '').trim();
    if (!nextPassword) {
      toast.error('Informe a nova senha.');
      return;
    }

    setPasswordSaving((state) => ({ ...state, [userId]: true }));
    try {
      await api.patch(`/admin/users/${userId}/password`, { password: nextPassword });
      toast.success('Senha atualizada.');
      setPasswordEdits((state) => {
        const { [userId]: _ignore, ...rest } = state;
        return rest;
      });
    } catch (err) {
      console.error('admin.users password error:', err);
      toast.error(err?.response?.data?.message ?? 'Erro ao atualizar senha');
    } finally {
      setPasswordSaving((state) => {
        const { [userId]: _ignore, ...rest } = state;
        return rest;
      });
    }
  }

  const summary = useMemo(() => {
    const total = users.length;
    const banned = users.filter((u) => u.is_banned).length;
    const active = total - banned;
    const conversion =
      total > 0
        ? Math.round(((total - banned) / (total || 1)) * 100)
        : 0;
    return { total, active, banned, conversion };
  }, [users]);

  return (
    <div className="space-y-6 text-white">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UserStat label="Usuários totais" value={summary.total} accent="from-slate-100/20 to-slate-400/40" />
        <UserStat label="Ativos" value={summary.active} detail="+5 nas últimas horas" accent="from-emerald-200/30 to-emerald-500/60" />
        <UserStat label="Banidos" value={summary.banned} detail="por equipe de suporte" accent="from-rose-200/30 to-rose-500/50" />
        <UserStat label="Taxa ativa" value={`${summary.conversion}%`} detail="usuários aptos" accent="from-indigo-200/30 to-indigo-500/60" />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Filtro rápido</p>
            <input
              type="search"
              placeholder="Buscar por nome, e-mail ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-sm placeholder:text-slate-500 focus:border-white/40"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow shadow-indigo-500/30 transition hover:-translate-y-0.5"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSubmittedSearch('');
              }}
              className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
            >
              Limpar
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <LoadingBar message="Carregando usuários..." className="text-sm text-slate-300" size="sm" />
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/40">
          <table className="min-w-full divide-y divide-white/5 text-sm">
            <thead className="bg-white/5 text-left text-[11px] uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Identidade</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Localização</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Senha (hash)</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-white/5">
              {users.map((user) => {
                const busy = Boolean(processingIds[user.id]);
                const hashVisible = passwordVisibility[user.id];
                const savingPassword = Boolean(passwordSaving[user.id]);
                const passwordValue = passwordEdits[user.id] ?? '';
                const hash = user.password_hash || '';

                return (
                  <Fragment key={user.id}>
                    <tr className="align-top text-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">#{user.id}</td>
                      <td className="px-4 py-3">
                      <div className="font-semibold">{user.username || 'Sem nome'}</div>
                      <div className="text-xs text-slate-500">
                        {user.created_at ? formatDate(user.created_at) : '—'}
                        </div>
                      </td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${user.email}`} className="text-indigo-300 underline">
                        {user.email}
                      </a>
                      {user.phone && <div className="text-xs text-slate-400">{user.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {[user.city, user.state, user.country].filter(Boolean).join(' • ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          user.is_banned
                            ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                            : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                        }`}
                      >
                        {user.is_banned ? 'Banido' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {hash ? (
                        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                            <span>Hash</span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-indigo-300 hover:underline"
                            >
                              {hashVisible ? 'Ocultar' : 'Mostrar'}
                            </button>
                          </div>
                          <p className="font-mono break-all rounded-xl bg-black/40 px-3 py-2 text-[11px] text-white">
                            {hashVisible ? hash : '••••••••••••••••••••'}
                          </p>
                          <div className="space-y-1">
                            <label className="block text-[10px] uppercase tracking-widest text-slate-500">
                              Redefinir senha
                            </label>
                            <input
                              type="text"
                              value={passwordValue}
                              onChange={(e) => handlePasswordInput(user.id, e.target.value)}
                              placeholder="Nova senha"
                              className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs focus:border-white/40"
                            />
                            <button
                              type="button"
                              onClick={() => updateUserPassword(user)}
                              disabled={savingPassword}
                              className="w-full rounded-xl border border-indigo-400/50 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingPassword ? 'Salvando...' : 'Salvar nova senha'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Hash indisponível</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startBanReview(user)}
                          disabled={busy}
                          className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {user.is_banned ? 'Desbanir' : 'Banir'}
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          disabled={busy}
                          className="rounded-xl border border-rose-400/60 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                  {(user.is_banned || pendingBan?.userId === user.id) && (
                    <tr key={`${user.id}-ban-note`}>
                      <td colSpan={7} className="px-4 sm:px-6 py-2">
                        <div className="rounded-2xl border border-rose-400/40 bg-rose-900/70 p-4 text-xs text-rose-50 shadow-lg shadow-black/40">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-rose-200">
                              Conta banida
                            </p>
                            <span className="text-[10px] text-rose-100/70">Apenas administradores veem esta barra</span>
                          </div>
                          <p className="mt-2 text-[11px] text-rose-100/80">
                            {pendingBan?.userId === user.id && pendingBan.action === 'ban'
                              ? 'Digite a justificativa antes de confirmar o banimento.'
                              : pendingBan?.userId === user.id && pendingBan.action === 'unban'
                                ? 'Confirme o desbanimento ou ajuste a nota antes de liberar a conta.'
                                : banNotes[user.id] ||
                                  'Use a caixa abaixo para explicar o motivo e orientar a equipe.'}
                          </p>
                          <textarea
                            value={banNotes[user.id] ?? ''}
                            onChange={(e) => handleBanNoteChange(user.id, e.target.value)}
                            placeholder="Digite um aviso (ex.: 'Usuário repetiu anúncios falsos')"
                            className="mt-3 w-full rounded-xl border border-rose-400/60 bg-transparent px-3 py-2 text-[10px] text-rose-100 placeholder:text-rose-300 focus:border-rose-200/60 focus:outline-none"
                          />
                          {pendingBan?.userId === user.id && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => confirmBanAction(user)}
                                disabled={Boolean(processingIds[user.id])}
                                className="rounded-xl bg-rose-500/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white transition hover:bg-rose-500/100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {pendingBan.action === 'ban' ? 'Confirmar banimento' : 'Confirmar desbanimento'}
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelBanReview(user)}
                                className="rounded-xl border border-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/80 transition hover:border-white/40"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserStat({ label, value, detail, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-40 blur-3xl`} />
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {detail && <p className="text-xs text-slate-300">{detail}</p>}
    </div>
  );
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
