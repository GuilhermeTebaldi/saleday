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

  return (
    <div className="admin-panel">
      <header className="admin-panel__header">
        <h1 className="admin-panel__title">Histórico de atividades</h1>
        <p className="admin-panel__subtitle">
          Registra vendas confirmadas e mensagens para auditoria.
        </p>
      </header>
      <form className="admin-panel__filters" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="ID do usuário"
          value={filters.userId}
          onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))}
        />
        <select
          value={filters.eventType}
          onChange={(event) => setFilters((prev) => ({ ...prev, eventType: event.target.value }))}
        >
          <option value="">Tipo de evento (todos)</option>
          {Object.entries(EVENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          title="A partir de"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          title="Até"
        />
        <input
          type="text"
          placeholder="Busca (nome, descrição)"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Buscando...' : 'Filtrar'}
        </button>
      </form>
      <div className="admin-panel__table-wrapper">
          <table className="admin-panel__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>Destino</th>
                <th>Evento</th>
                <th>Descrição</th>
                <th>Produto</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
              <tr>
                <td colSpan="6" className="admin-panel__empty">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {rows.map((log) => {
              const details =
                log.metadata?.content ||
                log.metadata?.productId ||
                log.metadata?.message ||
                JSON.stringify(log.metadata || {});
              return (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                <td>{log.user_name || `ID ${log.user_id ?? '—'}`}</td>
                <td>{log.target_user_name || `ID ${log.target_user_id ?? '—'}`}</td>
                <td>{EVENT_LABELS[log.event_type] || log.event_type}</td>
                <td>{log.description || '—'}</td>
                <td>{log.target_product_id || '—'}</td>
                <td className="whitespace-pre-wrap text-[0.725rem]">{details}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
