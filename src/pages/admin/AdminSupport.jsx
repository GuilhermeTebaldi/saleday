import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/api.js';
import LoadingBar from '../../components/LoadingBar.jsx';

const formatAdminTimestamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AdminSupport() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState('');
  const messageListRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const fetchMessages = useCallback(
    async (conversationId, { skipLoading = false } = {}) => {
      if (!conversationId) return;
      if (!skipLoading) setLoadingMessages(true);
      try {
        const { data } = await api.get(`/support/admin/conversations/${conversationId}/messages`);
        const payload = data?.data ?? {};
        setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      } catch (fetchError) {
        console.error('admin.support.fetchMessages', fetchError);
        toast.error('Erro ao carregar as mensagens do suporte.');
      } finally {
        if (!skipLoading) setLoadingMessages(false);
      }
    },
    []
  );

  const fetchConversations = useCallback(
    async ({ skipLoading = false } = {}) => {
      setError('');
      if (!skipLoading) {
        setLoadingConversations(true);
      }
      try {
        const { data } = await api.get('/support/admin/conversations');
        const list = Array.isArray(data?.data) ? data.data : [];
        setConversations(list);
        setSelectedConversationId((prev) => {
          if (prev && list.some((item) => item.id === prev)) {
            return prev;
          }
          return list[0]?.id ?? null;
        });
        const hasPending = list.some((conversation) => conversation.last_sender_type === 'user');
        window.dispatchEvent(
          new CustomEvent('templesale:support-status', {
            detail: { hasPendingMessages: hasPending }
          })
        );
      } catch (fetchError) {
        console.error('admin.support.fetchConversations', fetchError);
        setError('Não foi possível carregar as conversas.');
        toast.error('Não foi possível carregar o suporte agora.');
      } finally {
        if (!skipLoading) {
          setLoadingConversations(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const interval = setInterval(() => fetchConversations({ skipLoading: true }), 6000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedConversationId);
    const interval = setInterval(
      () => fetchMessages(selectedConversationId, { skipLoading: true }),
      5000
    );
    return () => clearInterval(interval);
  }, [selectedConversationId, fetchMessages]);

  useEffect(() => {
    const node = messageListRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  const handleSendReply = async (event) => {
    event.preventDefault();
    if (!selectedConversationId || sendingReply || !reply.trim()) return;
    setSendingReply(true);
    try {
      const { data } = await api.post(
        `/support/admin/conversations/${selectedConversationId}/messages`,
        { content: reply.trim() }
      );
      const responseData = data?.data ?? {};
      setMessages(Array.isArray(responseData.messages) ? responseData.messages : []);
      if (responseData.conversation) {
        setConversations((prev) => {
          const filtered = prev.filter((item) => item.id !== responseData.conversation.id);
          return [responseData.conversation, ...filtered];
        });
      }
      setReply('');
    } catch (sendError) {
      console.error('admin.support.sendReply', sendError);
      toast.error('Não foi possível enviar a resposta.');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Suporte</p>
            <h2 className="text-xl font-semibold text-white">Conversas privadas</h2>
          </div>
          <button
            type="button"
            onClick={fetchConversations}
            className="rounded-2xl border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/50 hover:text-white"
          >
            Atualizar
          </button>
        </div>
        <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/40">
          {loadingConversations ? (
            <LoadingBar message="Carregando conversas..." className="text-sm text-slate-400" size="sm" />
          ) : conversations.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma conversa registrada ainda.</p>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === selectedConversationId;
              return (
                <button
                  type="button"
                  key={conversation.id}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-emerald-400/70 bg-emerald-500/5 shadow-[0_10px_40px_rgba(16,185,129,0.2)]'
                      : 'border-white/10 bg-slate-950/50 hover:border-white/30'
                  }`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {conversation.username || conversation.email}
                      </p>
                      <p className="text-xs text-slate-400">{conversation.email}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                      {formatAdminTimestamp(conversation.updated_at || conversation.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    {conversation.subject || 'Assunto não definido'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {conversation.last_message || 'Sem mensagens recentes.'}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex h-[85vh] flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-white shadow-xl shadow-black/40">
        {error && (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        <header className="border-b border-white/10 pb-3">
          <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Chat privado</p>
          {activeConversation ? (
            <>
              <h3 className="text-2xl font-semibold">{activeConversation.username || activeConversation.email}</h3>
              <p className="text-sm text-slate-400">
                {activeConversation.subject || 'Assunto não informado'}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Selecione uma conversa para abrir o histórico.
            </p>
          )}
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            ref={messageListRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-1"
          >
            {loadingMessages ? (
              <LoadingBar message="Carregando mensagens..." className="text-sm text-slate-400" size="sm" />
            ) : !activeConversation ? (
              <p className="text-sm text-slate-500">Nenhuma conversa ativa no momento.</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-400">
                A conversa ainda não tem nenhuma mensagem registrada.
              </p>
            ) : (
              messages.map((message) => {
                const isSupportMessage = message.sender_type === 'admin';
                return (
                  <div
                    key={message.id}
                    className={`flex ${isSupportMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isSupportMessage
                          ? 'bg-blue-600 text-white shadow-[0_3px_6px_rgba(15,23,42,0.18)]'
                          : 'bg-slate-100 text-slate-900 shadow-inner'
                      }`}
                    >
                      <span
                        className={`text-[10px] uppercase tracking-[0.4em] ${
                          isSupportMessage ? 'text-white/70' : 'text-slate-400'
                        }`}
                      >
                        {isSupportMessage ? 'Suporte' : 'Usuário'}
                      </span>
                      <p className="mt-1 whitespace-pre-line">{message.content}</p>
                      <span
                        className={`mt-2 block text-[11px] ${
                          isSupportMessage ? 'text-white/60' : 'text-slate-400'
                        }`}
                      >
                        {formatAdminTimestamp(message.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <form onSubmit={handleSendReply} className="space-y-3">
          <textarea
            rows={3}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            disabled={!activeConversation || sendingReply}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            placeholder={
              activeConversation
                ? 'Envie uma resposta oficial para o usuário...'
                : 'Selecione uma conversa primeiro'
            }
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              {activeConversation ? 'Resposta imediata' : 'Selecione uma conversa ativa'}
            </span>
            <button
              type="submit"
              disabled={!activeConversation || sendingReply || !reply.trim()}
              className="rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:shadow-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingReply ? 'Enviando...' : 'Responder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
