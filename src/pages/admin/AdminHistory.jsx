import { useEffect, useMemo, useState } from 'react';
import api from '../../api/api.js';

const EVENT_LABELS = {
  product_sold: 'Produto vendido',
  message_sent: 'Mensagem enviada'
};

export default function AdminHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    userId: '',
    eventType: '',
    search: '',
    from: '',
    to: ''
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.eventType) params.set('eventType', filters.eventType);
      if (filters.search) params.set('search', filters.search);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const { data } = await api.get(`/admin/activity?limit=100&${params.toString()}`);
      setLogs(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error('admin.history load error:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchLogs();
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const rows = useMemo(() => logs, [logs]);
  const totalLabel = rows.length.toLocaleString('pt-BR');

  return (
    <div className="admin-panel admin-panel--ledger">
      <header className="admin-panel__header">
        <div className="admin-panel__headline">
          <span className="admin-panel__eyebrow">Painel de auditoria</span>
          <h1 className="admin-panel__title">Histórico de atividades</h1>
          <p className="admin-panel__subtitle">
            Registra vendas confirmadas e mensagens para auditoria.
          </p>
        </div>
        <div className="admin-panel__summary">
          <span className="admin-panel__summary-value">{totalLabel}</span>
          <span className="admin-panel__summary-label">registros</span>
          <span className={`admin-panel__summary-pill ${loading ? 'is-loading' : ''}`}>
            {loading ? 'Atualizando...' : 'Atualizado'}
          </span>
        </div>
      </header>
      <div className="admin-panel__layout">
        <form className="admin-panel__filters" onSubmit={handleSubmit}>
          <div className="admin-panel__filters-heading">
            <h2>Filtros</h2>
            <p>Refine o histórico por usuário, data ou tipo de evento.</p>
          </div>
          <div className="admin-panel__filters-grid">
            <label className="admin-panel__field">
              <span>Busca rápida</span>
              <input
                type="text"
                placeholder="Nome, descrição ou produto"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </label>
            <label className="admin-panel__field">
              <span>ID do usuário</span>
              <input
                type="text"
                placeholder="Ex: 1024"
                value={filters.userId}
                onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))}
              />
            </label>
            <label className="admin-panel__field">
              <span>Tipo de evento</span>
              <select
                value={filters.eventType}
                onChange={(event) => setFilters((prev) => ({ ...prev, eventType: event.target.value }))}
              >
                <option value="">Todos os eventos</option>
                {Object.entries(EVENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-panel__field">
              <span>A partir</span>
              <input
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              />
            </label>
            <label className="admin-panel__field">
              <span>Até</span>
              <input
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              />
            </label>
          </div>
          <div className="admin-panel__filters-actions">
            <button type="submit" className="admin-panel__filters-submit" disabled={loading}>
              {loading ? 'Buscando...' : 'Filtrar'}
            </button>
          </div>
        </form>
        <section className="admin-panel__feed" aria-live="polite">
          {rows.length === 0 && (
            <div className="admin-panel__empty">Nenhum registro encontrado.</div>
          )}
          {rows.map((log, index) => {
            const details =
              log.metadata?.content ||
              log.metadata?.productId ||
              log.metadata?.message ||
              JSON.stringify(log.metadata || {});
            const title =
              log.description || EVENT_LABELS[log.event_type] || 'Atividade registrada';
            return (
              <article
                key={log.id}
                className="admin-panel__entry"
                data-event={log.event_type}
                style={{ '--entry-delay': `${Math.min(index, 7) * 70}ms` }}
              >
                <div className="admin-panel__entry-card">
                  <div className="admin-panel__entry-header">
                    <span className="admin-panel__entry-date">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                    <span className="admin-panel__badge" data-event={log.event_type}>
                      {EVENT_LABELS[log.event_type] || log.event_type}
                    </span>
                  </div>
                  <h3 className="admin-panel__entry-title">{title}</h3>
                  <div className="admin-panel__entry-meta">
                    <span>
                      <strong>Usuário</strong>
                      {log.user_name || `ID ${log.user_id ?? '—'}`}
                    </span>
                    <span>
                      <strong>Destino</strong>
                      {log.target_user_name || `ID ${log.target_user_id ?? '—'}`}
                    </span>
                    <span>
                      <strong>Produto</strong>
                      {log.target_product_id || '—'}
                    </span>
                  </div>
                  <div className="admin-panel__details">{details}</div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
