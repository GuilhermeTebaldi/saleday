// frontend/src/pages/Dashboard.jsx
// Página de painel com resumo e atalhos do usuário.

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { getUnseenSellerOrderIds } from '../utils/orders.js';
import { toast } from 'react-hot-toast';

const getInitial = (value) => {
  if (!value) return 'S';
  const letter = value.trim().charAt(0);
  return letter ? letter.toUpperCase() : 'S';
};

const getInitialSecurityPasswords = () => ({
  current: '',
  next: '',
  confirm: ''
});

const formatSupportTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatLegalDate = (timestamp) => {
  if (!timestamp) return 'Não informado';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function Dashboard() {
  const { user, token, logout } = useContext(AuthContext);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [passwords, setPasswords] = useState(getInitialSecurityPasswords);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSecuritySaving, setIsSecuritySaving] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportConversation, setSupportConversation] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportConversationList, setSupportConversationList] = useState([]);
  const [supportAlert, setSupportAlert] = useState(null);
  const supportListRef = useRef(null);
  const supportNotificationRef = useRef(0);
  const [isTermsPanelOpen, setIsTermsPanelOpen] = useState(false);
  const [isPrivacyPanelOpen, setIsPrivacyPanelOpen] = useState(false);

  const [orderSummary, setOrderSummary] = useState({
    total: 0,
    pending: 0,
    confirmed: 0
  });

  const [newOrderIds, setNewOrderIds] = useState([]);

  const userId = user?.id;
  const userAvatar = user?.profile_image_url ?? '';

  const userInitial = useMemo(
    () => getInitial(user?.username || user?.email || 'SaleDay'),
    [user?.username, user?.email]
  );

  const legalEntries = useMemo(() => {
    if (!user) return [];
    return [
      {
        label: 'Termos de Uso',
        version: user.accepted_terms_version,
        date: user.accepted_terms_at
      },
      {
        label: 'Política de Privacidade',
        version: user.accepted_privacy_version,
        date: user.accepted_privacy_at
      },
      {
        label: 'Diretrizes da Comunidade',
        version: user.accepted_community_version,
        date: user.accepted_community_at
      }
    ];
  }, [user]);

  useEffect(() => {
    if (!token) {
      setOrderSummary({ total: 0, pending: 0, confirmed: 0 });
      setNewOrderIds([]);
      return;
    }

    let active = true;

    api
      .get('/orders/seller', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!active) return;

        const orders = Array.isArray(res.data?.data) ? res.data.data : [];

        const pending = orders.filter((o) => o.status === 'pending').length;
        const confirmed = orders.filter((o) => o.status === 'confirmed').length;

        setOrderSummary({
          total: orders.length,
          pending,
          confirmed
        });

        const fresh = getUnseenSellerOrderIds(userId, orders);
        setNewOrderIds(fresh);
      })
      .catch(() => {
        if (!active) return;
        setOrderSummary({ total: 0, pending: 0, confirmed: 0 });
      });

    return () => {
      active = false;
    };
  }, [token, userId]);

  const fetchSupportMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const { data } = await api.get(`/support/conversations/${conversationId}/messages`);
      const payload = data?.data ?? {};
      setSupportConversation((prev) => (payload.conversation ? payload.conversation : prev));
      setSupportMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (error) {
      console.error('support.fetchSupportMessages', error);
    }
  }, []);

  const supportConversationRef = useRef(null);

  useEffect(() => {
    supportConversationRef.current = supportConversation;
  }, [supportConversation]);

  const updateSupportNotification = useCallback((conversations) => {
    if (!Array.isArray(conversations) || conversations.length === 0) return;
    const latestAdminId = conversations.reduce(
      (max, conversation) => Math.max(max, conversation.last_admin_message_id ?? 0),
      0
    );
    if (latestAdminId <= supportNotificationRef.current) return;
    const targetConversation = conversations.find(
      (conversation) =>
        (conversation.last_admin_message_id ?? 0) > (conversation.user_last_seen_message_id ?? 0)
    );
    if (targetConversation) {
      setSupportAlert({
        conversationId: targetConversation.id,
        message: targetConversation.last_message || 'Suporte respondeu!'
      });
    }
    supportNotificationRef.current = latestAdminId;
  }, []);

  const loadSupportConversations = useCallback(
    async ({ focusId, skipLoading = false } = {}) => {
      if (!skipLoading) {
        setSupportLoading(true);
      }
      try {
        const { data } = await api.get('/support/conversations');
        const list = Array.isArray(data?.data) ? data.data : [];
        setSupportConversationList(list);
        updateSupportNotification(list);
        let nextConversation = null;
        if (focusId) {
          nextConversation = list.find((conversation) => conversation.id === focusId) ?? null;
        } else if (isSupportModalOpen && supportConversationRef.current) {
          const activeConversation = list.find(
            (conversation) => conversation.id === supportConversationRef.current.id
          );
          nextConversation = activeConversation ?? supportConversationRef.current;
        } else {
          nextConversation = list[0] ?? null;
        }
        setSupportConversation(nextConversation);
        setSupportSubject(nextConversation?.subject ?? '');
        if (!nextConversation) {
          setSupportMessages([]);
        }
      } catch (error) {
        console.error('support.loadConversations', error);
        toast.error('Não foi possível carregar o suporte no momento.');
      } finally {
        if (!skipLoading) {
          setSupportLoading(false);
        }
      }
    },
    [isSupportModalOpen, updateSupportNotification]
  );

  const handleSupportSubmit = async (event) => {
    event.preventDefault();
    if (supportSending || !supportInput.trim()) return;
    setSupportSending(true);
    const trimmedContent = supportInput.trim();
    const trimmedSubject = supportSubject.trim();
    const hasExistingConversation = Boolean(supportConversation?.id);
    const payloadBody = { content: trimmedContent };
    if (!supportConversation?.subject && trimmedSubject) {
      payloadBody.subject = trimmedSubject;
    } else if (!hasExistingConversation && trimmedSubject) {
      payloadBody.subject = trimmedSubject;
    }
    try {
      const url = hasExistingConversation
        ? `/support/conversations/${supportConversation.id}/messages`
        : '/support/conversations';
      const { data } = await api.post(url, payloadBody);
      const responseData = data?.data ?? {};
      if (responseData.conversation) {
        setSupportConversation(responseData.conversation);
        setSupportSubject(responseData.conversation.subject ?? trimmedSubject);
      }
      if (Array.isArray(responseData.messages)) {
        setSupportMessages(responseData.messages);
      } else if (responseData.conversation?.id) {
        await fetchSupportMessages(responseData.conversation.id);
      }
      setSupportInput('');
    } catch (error) {
      console.error('support.handleSubmit', error);
      toast.error('Falha ao enviar sua mensagem.');
    } finally {
      setSupportSending(false);
    }
  };

  const openSupportChat = (conversationId) => {
    setSupportAlert(null);
    setIsSupportModalOpen(true);
    loadSupportConversations({ focusId: conversationId });
  };

  useEffect(() => {
    loadSupportConversations();
  }, [loadSupportConversations]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSupportConversations({ skipLoading: true });
    }, 6000);
    return () => clearInterval(interval);
  }, [loadSupportConversations]);

  useEffect(() => {
    if (!isSupportModalOpen || !supportConversation?.id) return undefined;
    fetchSupportMessages(supportConversation.id);
    const interval = setInterval(() => {
      fetchSupportMessages(supportConversation.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [isSupportModalOpen, supportConversation?.id, fetchSupportMessages]);

  useEffect(() => {
    if (!isSupportModalOpen) return;
    setSupportAlert(null);
    const latestAdminId = supportConversationList.reduce(
      (max, conversation) => Math.max(max, conversation.last_admin_message_id ?? 0),
      0
    );
    supportNotificationRef.current = Math.max(supportNotificationRef.current, latestAdminId);
  }, [isSupportModalOpen, supportConversationList]);

  const handleSecurityChange = (event) => {
    const { name, value } = event.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
  };

  const handleSecuritySubmit = async (event) => {
    event.preventDefault();
    if (isSecuritySaving) return;

    if (!passwords.current || !passwords.next) {
      toast.error('Preencha a senha atual e a nova senha.');
      return;
    }

    if (passwords.next.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (passwords.next !== passwords.confirm) {
      toast.error('A confirmação da senha não confere.');
      return;
    }

    setIsSecuritySaving(true);
    try {
      const payload = new FormData();
      payload.append('currentPassword', passwords.current);
      payload.append('newPassword', passwords.next);

      await api.put('/auth/update', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Senha alterada com sucesso!');
      setPasswords(getInitialSecurityPasswords());
      setIsSecurityModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atualizar a senha.');
    } finally {
      setIsSecuritySaving(false);
    }
  };

  useEffect(() => {
    if (!isSupportModalOpen) return undefined;
    loadSupportConversations();
    const interval = setInterval(() => {
      if (supportConversation?.id) {
        fetchSupportMessages(supportConversation.id);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isSupportModalOpen, loadSupportConversations, fetchSupportMessages, supportConversation?.id]);

  useEffect(() => {
    if (!isSupportModalOpen) return;
    const node = supportListRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [supportMessages, isSupportModalOpen]);


  return (
    <section className="dashboard p-4 sm:p-6 md:p-8">

      {/* ALERTA DE NOVOS PEDIDOS */}
      {newOrderIds.length > 0 && (
        <div className="dashboard-alert bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-xl shadow-sm mb-4 text-sm">
          Você recebeu {newOrderIds.length}{' '}
          {newOrderIds.length === 1 ? 'nova solicitação de compra' : 'novas solicitações de compra'}.
          Confira em <strong>Gerenciar pedidos</strong>.
        </div>
      )}
      {supportAlert?.conversationId && !isSupportModalOpen && (
        <div
          className="dashboard-alert bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl shadow-sm mb-4 text-sm flex items-center justify-between gap-3"
          role="status"
        >
          <div>
            <p className="font-semibold text-emerald-800">Suporte respondeu!</p>
            <p className="text-xs text-emerald-700">{supportAlert.message}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 transition"
            onClick={() => openSupportChat(supportAlert.conversationId)}
          >
            Abrir chat
          </button>
        </div>
      )}

      {/* CABEÇALHO DO USUÁRIO */}
      <header className="dashboard-header w-full bg-white/80 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl px-5 sm:px-7 py-5 mb-8 flex flex-wrap items-center justify-between gap-5">

        <Link
          to={userId ? `/users/${userId}` : '/edit-profile'}
          className="flex items-center gap-4 min-w-0 flex-1 hover:opacity-90 transition"
        >
          <div className="dashboard-header__avatar w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-lg font-semibold text-gray-600 shadow-inner">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt="Foto do perfil"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{userInitial}</span>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-sm text-gray-500 leading-none mb-1">Painel do usuário</span>
            <h1 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
              {user?.username || user?.email}
            </h1>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </Link>

        <Link
          to="/edit-profile"
          className="dashboard-header__edit bg-blue-600/90 backdrop-blur-sm text-white font-medium text-sm py-2.5 px-5 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.97] transition"
        >
          Editar Perfil
        </Link>
        <Link
          to="#configuracoes"
          onClick={(event) => {
            event.preventDefault();
            setIsConfigPanelOpen((state) => !state);
          }}
          className="dashboard-header__edit bg-slate-200 text-slate-700 font-medium text-sm py-2.5 px-5 rounded-xl shadow-sm hover:bg-slate-300 active:scale-[0.97] transition"
        >
          Configurações
        </Link>
      </header>

      {/* RESUMO DE PEDIDOS */}
      <div className="dashboard-order-summary grid grid-cols-3 gap-4 bg-white/70 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-4 mb-8">

        <div className="dashboard-order-summary__stat text-center">
          <span className="label text-xs text-gray-500 block">Pedidos totais</span>
          <span className="value text-lg font-bold text-gray-800 block">
            {orderSummary.total}
          </span>
        </div>

        <div className="dashboard-order-summary__stat text-center">
          <span className="label text-xs text-gray-500 block">Pendentes</span>
          <span className="value pending text-lg font-bold text-gray-800 block">
            {orderSummary.pending}
          </span>
        </div>

        <div className="dashboard-order-summary__stat text-center">
          <span className="label text-xs text-gray-500 block">Confirmados</span>
          <span className="value confirmed text-lg font-bold text-gray-800 block">
            {orderSummary.confirmed}
          </span>
        </div>

        {/* BOTÃO GERENCIAR PEDIDOS */}
        <Link
          to="/sales-requests"
          className={`mx-auto mt-3 w-fit flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-xl text-blue-700 text-sm font-semibold shadow-sm hover:shadow transition ${
            newOrderIds.length ? 'ring-2 ring-blue-300' : ''
          }`}
        >
          Gerenciar pedidos
          {newOrderIds.length > 0 && (
            <span className="dashboard-order-summary__badge bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full shadow">
              +{newOrderIds.length}
            </span>
          )}
        </Link>
      </div>

      {/* MENU PRINCIPAL */}
      <div className="dashboard-actions grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-8">

        <Link
          className="dashboard-button bg-gradient-to-b from-white to-gray-50 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-center shadow-md hover:shadow-lg active:scale-[0.97] transition"
          to="/my-products"
        >
          Meus Anúncios
        </Link>

        <Link
          className="dashboard-button bg-fuchsia-300/80 hover:bg-fuchsia-400 text-gray-900 font-semibold py-3 rounded-lg text-center shadow-md transition-all"
          to="/dashboard/impulsiona"
        >
          Impulsionar
        </Link>

        <Link
          className="dashboard-button bg-blue-300/80 hover:bg-blue-400 text-gray-900 font-semibold py-3 rounded-lg text-center shadow-md transition-all"
          to="/new-product"
        >
          Novo Produto
        </Link>

        <Link
          className="dashboard-button bg-sky-300/80 hover:bg-sky-400 text-gray-900 font-semibold py-3 rounded-lg text-center shadow-md transition-all"
          to="/messages"
        >
          Mensagens
        </Link>

        <button
          onClick={logout}
          className="dashboard-button bg-gradient-to-b from-red-50 to-red-100 border border-red-200 text-red-700 font-semibold py-3 rounded-xl text-center shadow-md hover:shadow-lg active:scale-[0.97] transition"
        >
          Sair
        </button>

      </div>

      {/* TEXTO FINAL */}
      <p className="text-gray-400 text-center mt-8 text-xs">
        Aqui você poderá gerenciar seus produtos e acompanhar suas vendas.
      </p>

      {/* PAINEL DE CONFIGURAÇÕES */}
      <div
        className={`fixed inset-0 z-40 transition duration-300 ${
          isConfigPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!isConfigPanelOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            isConfigPanelOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsConfigPanelOpen(false)}
        />
        <aside
          className={`fixed top-0 right-0 h-full w-full max-w-xs bg-white shadow-2xl border-l border-gray-100 transition-transform duration-300 ${
            isConfigPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Configurações</p>
              <p className="text-base font-semibold text-gray-800">Ajustes rápidos</p>
            </div>
            <button
              type="button"
              onClick={() => setIsConfigPanelOpen(false)}
              className="text-gray-500 hover:text-gray-700 transition"
              aria-label="Fechar painel"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                setIsSecurityModalOpen(true);
                setPasswords(getInitialSecurityPasswords());
              }}
            >
              <p className="font-semibold text-gray-800">Segurança</p>
              <p className="text-sm text-gray-500 mt-1">
                Alterar senha ou revisar como mantém sua conta protegida.
              </p>
            </button>

            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                setIsTermsPanelOpen(true);
              }}
            >
              <p className="font-semibold text-gray-800">Termos e Política</p>
              <p className="text-sm text-gray-500 mt-1">Diretrizes da plataforma e obrigações do usuário.</p>
            </button>

            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                openSupportChat();
              }}
            >
              <p className="font-semibold text-gray-800">Suporte</p>
              <p className="text-sm text-gray-500 mt-1">
                Precisa de ajuda? Abra um chamado com nossa equipe de suporte.
              </p>
            </button>

            <button
              type="button"
              className="text-left rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm hover:bg-gray-100 transition"
              onClick={() => {
                setIsConfigPanelOpen(false);
                setIsPrivacyPanelOpen(true);
              }}
            >
              <p className="font-semibold text-gray-800">Central de Privacidade</p>
              <p className="text-sm text-gray-500 mt-1">
                Saiba como tratamos seus dados, seus direitos e opções de controle.
              </p>
            </button>
          </div>
        </aside>
      </div>
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!isSecuritySaving) {
                setIsSecurityModalOpen(false);
              }
            }}
          />
          <form
            onSubmit={handleSecuritySubmit}
            className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-gray-400">Segurança</p>
                <h3 className="text-2xl font-semibold text-gray-900">Trocar senha</h3>
                <p className="text-sm text-gray-500">
                  Atualize sua senha com uma nova combinação forte e segura.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-500 transition hover:text-gray-700"
                onClick={() => {
                  if (!isSecuritySaving) {
                    setIsSecurityModalOpen(false);
                  }
                }}
                aria-label="Fechar modal de segurança"
              >
                ✕
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="flex flex-col text-sm text-gray-600">
                Senha atual
                <input
                  type="password"
                  name="current"
                  value={passwords.current}
                  onChange={handleSecurityChange}
                  placeholder="Digite a senha atual"
                  className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSecuritySaving}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Nova senha
                <input
                  type="password"
                  name="next"
                  value={passwords.next}
                  onChange={handleSecurityChange}
                  placeholder="No mínimo 6 caracteres"
                  className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSecuritySaving}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                Confirmar nova senha
                <input
                  type="password"
                  name="confirm"
                  value={passwords.confirm}
                  onChange={handleSecurityChange}
                  placeholder="Repita a nova senha"
                  className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSecuritySaving}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                className="shrink-0 rounded-2xl border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
                onClick={() => {
                  setPasswords(getInitialSecurityPasswords());
                  if (!isSecuritySaving) {
                    setIsSecurityModalOpen(false);
                  }
                }}
                disabled={isSecuritySaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="shrink-0 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:bg-blue-400"
                disabled={isSecuritySaving}
              >
                {isSecuritySaving ? 'Salvando...' : 'Trocar senha'}
              </button>
            </div>
          </form>
        </div>
      )}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!supportSending) {
                setIsSupportModalOpen(false);
              }
            }}
          />
          <form
            onSubmit={handleSupportSubmit}
            className="relative z-10 flex h-[85vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-black/10"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Suporte</p>
                <h3 className="text-2xl font-semibold text-slate-900">Fale com o time operacional</h3>
                <p className="text-sm text-slate-500">
                  Compartilhe o que precisa e acompanhe as respostas em tempo real.
                </p>
              </div>
              <button
                type="button"
                className="text-slate-500 transition hover:text-slate-700"
                onClick={() => {
                  if (!supportSending) {
                    setIsSupportModalOpen(false);
                  }
                }}
                aria-label="Fechar chat de suporte"
              >
                ✕
              </button>
            </header>

            <div
              ref={supportListRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
            >
              {supportLoading ? (
                <p className="text-sm text-slate-500">Carregando a conversa...</p>
              ) : supportMessages.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Aqui vão aparecer as mensagens trocadas com o suporte. Envie a primeira agora!
                </p>
              ) : (
                supportMessages.map((message) => {
                  const isUserMessage = message.sender_type === 'user';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUserMessage
                            ? 'bg-blue-600 text-white shadow-[0_3px_6px_rgba(15,23,42,0.2)]'
                            : 'bg-slate-100 text-slate-900 shadow-inner'
                        }`}
                      >
                        <span
                          className={`text-[10px] uppercase tracking-[0.4em] ${
                            isUserMessage ? 'text-white/70' : 'text-slate-400'
                          }`}
                        >
                          {isUserMessage ? 'Você' : 'Suporte'}
                        </span>
                        <p className="mt-1 whitespace-pre-line break-words">{message.content}</p>
                        <span
                          className={`mt-2 block text-[11px] ${
                            isUserMessage ? 'text-white/60' : 'text-slate-400'
                          }`}
                        >
                          {formatSupportTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-5">
              {(!supportConversation?.subject || supportConversation?.subject === '') && (
                <label className="block text-[11px] font-semibold uppercase tracking-[0.38em] text-slate-500">
                  Assunto
                  <input
                    type="text"
                    value={supportSubject}
                    onChange={(event) => setSupportSubject(event.target.value)}
                    disabled={supportSending}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Assunto opcional da conversa"
                  />
                  <span className="mt-1 text-[11px] font-normal text-slate-400">
                    Ajuda o time a entender o que precisa.
                  </span>
                </label>
              )}
              {supportConversation?.subject && (
                <p className="text-xs text-slate-500">
                  Assunto atual:{' '}
                  <span className="font-semibold text-slate-900">{supportConversation.subject}</span>
                </p>
              )}

              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Escreva sua mensagem
                <textarea
                  rows={4}
                  value={supportInput}
                  onChange={(event) => setSupportInput(event.target.value)}
                  disabled={supportSending}
                  placeholder="Descreva o que aconteceu, compartilhe prints ou o que for importante."
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {supportConversation?.id ? 'Conversa conectada' : 'Nova conversa'}
                </span>
                <button
                  type="submit"
                  className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={supportSending || !supportInput.trim()}
                >
                  {supportSending ? 'Enviando...' : 'Enviar para o suporte'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {isTermsPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsTermsPanelOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Termos e Política</p>
                <h3 className="text-2xl font-semibold text-gray-900">Documentos aceitos</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Aqui estão as versões e datas que você validou para continuar usando a plataforma.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar termos"
                onClick={() => setIsTermsPanelOpen(false)}
                className="text-gray-500 transition hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {legalEntries.map((entry) => (
                <article key={entry.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                  <header className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-900">{entry.label}</h4>
                    <span className="rounded-full bg-white px-3 py-0.5 text-[11px] uppercase tracking-[0.3em] text-gray-500">
                      {entry.version ?? 'Versão desconhecida'}
                    </span>
                  </header>
                  <p className="mt-1 text-xs text-gray-500">Atualizado em {formatLegalDate(entry.date)}</p>
                </article>
              ))}
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-4 text-sm text-gray-600">
                <p className="font-semibold text-gray-800">Compromisso de uso responsável</p>
                <p className="mt-2">
                  Mantenha seus dados atualizados e leia as alterações sempre que forem publicadas. Ao continuar
                  usando a SaleDay, você confirma que entende e aceita essas diretrizes.
                </p>
              </div>
            </div>

            <section className="mt-6 rounded-2xl border border-gray-100 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">Garantia</p>
              <p className="mt-2 text-sm">
                Esses documentos são regulamentados pela nossa equipe de compliance. Caso surjam dúvidas ou
                divergências, entre em contato com o suporte e solicite revisão oficial do termo.
              </p>
              <p className="mt-3 text-xs text-white/70">Atualizado automaticamente conforme nossa base de legalidade.</p>
              <a
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-white"
                href="/politica-de-privacidade"
                target="_blank"
                rel="noreferrer"
              >
                Ler termos completo
              </a>
            </section>
          </aside>
        </div>
      )}
      {isPrivacyPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsPrivacyPanelOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Central de Privacidade</p>
                <h3 className="text-2xl font-semibold text-gray-900">Você no controle dos dados</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Consolidamos abaixo tudo que a SaleDay faz com suas informações e como você pode agir sobre cada parte.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar central de privacidade"
                onClick={() => setIsPrivacyPanelOpen(false)}
                className="text-gray-500 transition hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                <h4 className="text-xs uppercase tracking-[0.4em] text-gray-400">Como usamos</h4>
                <p className="mt-2 text-sm text-gray-700">
                  Suas informações identificam você para compradores e vendedores, autenticações e relatórios fiscais.
                  Garantimos acesso seguro, criptografado e auditado em todas as camadas.
                </p>
              </article>
              <article className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                <h4 className="text-xs uppercase tracking-[0.4em] text-gray-400">Bases legais</h4>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  <li>· Execução de contrato (compra, venda e entrega).</li>
                  <li>· Consentimento para combinações comerciais e marketing.</li>
                  <li>· Obrigações legais e prevenção a fraudes.</li>
                </ul>
              </article>
              <article className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                <h4 className="text-xs uppercase tracking-[0.4em] text-gray-400">Seus direitos</h4>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  <li>· Acessar, corrigir ou excluir seus dados.</li>
                  <li>· Solicitar portabilidade ou oposição ao tratamento.</li>
                  <li>· Revogar o consentimento a qualquer momento.</li>
                </ul>
              </article>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-800">Gerencie o que compartilha</p>
              <p className="mt-2">
                Acesse o perfil para revisar seus dados, desabilitar comunicações promocionais ou enviar documentos
                para atualização. A transparência começa por aqui.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Cookies são usados somente para manter sessão, melhorar recomendações e proteger contra abusos.
              </p>
            </div>

            <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-xl">
              <div>
                <h5 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">Precisa de ajuda?</h5>
                <p className="mt-2 text-sm text-white/90">
                  Fale com nosso encarregado de privacidade e receba o dossiê completo dos registros tratados.
                </p>
              </div>
              <a
                href="mailto:privacidade@saleday.com"
                className="rounded-2xl border border-white/30 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-black/20 transition hover:bg-white"
              >
                Enviar solicitação
              </a>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
