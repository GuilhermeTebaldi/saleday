
// Painel principal com métricas e insights do marketplace.
import { useEffect, useMemo, useState } from 'react';
import api from '../../api/api.js';

export default function AdminOverview() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/metrics');
        setMetrics(data?.data ?? null);
      } catch (err) {
        console.error('admin.metrics error:', err);
        setError('Erro ao carregar métricas em tempo real.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const syncListener = async () => {
      try {
        const { data } = await api.get('/admin/metrics');
        setMetrics(data?.data ?? null);
      } catch (err) {
        console.error('admin.metrics refresh error:', err);
        toastErrorOnce();
        setError('Erro ao sincronizar métricas.');
      }
    };
    window.addEventListener('saleday:admin-refresh', syncListener);
    return () => window.removeEventListener('saleday:admin-refresh', syncListener);
  }, []);

  const quickStats = useMemo(() => {
    if (!metrics?.summary) return [];
    return [
      {
        label: 'Usuários ativos',
        value: metrics.summary.users.total ?? 0,
        trend: `+${metrics.summary.users.last7Days ?? 0} novos`,
        sub: 'últimos 7 dias',
        accent: 'from-indigo-400/50 to-indigo-600/70'
      },
      {
        label: 'Produtos publicados',
        value: metrics.summary.products.total ?? 0,
        trend: `+${metrics.summary.products.last7Days ?? 0} lançados`,
        sub: 'variação semanal',
        accent: 'from-sky-400/40 to-sky-600/70'
      },
      {
        label: 'Mensagens trocadas',
        value: metrics.summary.messages.total ?? 0,
        trend: `+${metrics.summary.messages.last7Days ?? 0} novas`,
        sub: 'engajamento',
        accent: 'from-emerald-400/40 to-emerald-600/70'
      }
    ];
  }, [metrics]);

  const funnelSeries = useMemo(() => {
    const funnel = metrics?.funnel;
    if (!funnel) return [];
    return [
      { label: 'Visitas', value: Number(funnel.visits) || 0, color: 'from-slate-100 to-slate-200' },
      { label: 'Cliques', value: Number(funnel.clicks) || 0, color: 'from-indigo-200 to-indigo-300' },
      { label: 'Contatos', value: Number(funnel.contacts) || 0, color: 'from-indigo-300 to-indigo-500' },
      { label: 'Pedidos', value: Number(funnel.orders) || 0, color: 'from-emerald-400 to-emerald-500' }
    ];
  }, [metrics]);

  const channelBreakdown = useMemo(() => {
    const items = Array.isArray(metrics?.channels) ? metrics.channels : [];
    return items
      .filter((item) => Number.isFinite(Number(item.value)))
      .map((item, index) => ({
        label: item.label ?? `Canal ${index + 1}`,
        value: Number(item.value) || 0,
        color: item.color ?? ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-sky-400'][index % 4]
      }));
  }, [metrics]);

  const geoSpread = useMemo(() => {
    const countries = Array.isArray(metrics?.countries) ? metrics.countries : [];
    return countries
      .filter((c) => Number.isFinite(Number(c.value ?? c.total)))
      .map((c, i) => ({
        label: c.label ?? c.country ?? `País ${i + 1}`,
        value: Number(c.value ?? c.total) || 0
      }));
  }, [metrics]);

  const conversionRate = useMemo(() => {
    const visits = metrics?.funnel?.visits ?? 0;
    const orders = metrics?.funnel?.orders ?? 0;
    if (!visits) return 0;
    return Math.min((orders / visits) * 100, 100);
  }, [metrics]);

  const ordersStats = useMemo(() => {
    const stats = metrics?.ordersStats;
    return {
      total: Number(stats?.total) || 0,
      pending: Number(stats?.pending) || 0,
      confirmed: Number(stats?.confirmed) || 0,
      cancelled: Number(stats?.cancelled) || 0,
      revenueTotal: Number(stats?.revenueTotal) || 0,
      revenue30d: Number(stats?.revenue30d) || 0,
      revenueToday: Number(stats?.revenueToday) || 0,
      avgTicket30d: Number(stats?.avgTicket30d) || 0
    };
  }, [metrics]);

  const catalogHealth = useMemo(() => {
    const total = Number(metrics?.summary?.products?.total) || 0;
    const active = Number(metrics?.summary?.products?.active ?? metrics?.summary?.products?.total) || 0;
    const pending = Number(metrics?.alerts?.pendingProducts) || 0;
    const sold = Number(metrics?.summary?.products?.sold) || 0;
    return { total, active, pending, sold };
  }, [metrics]);

  const categoryMix = useMemo(() => {
    const cats = Array.isArray(metrics?.categories) ? metrics.categories : [];
    const palette = [
      'from-indigo-400/70 to-indigo-500/70',
      'from-rose-400/70 to-pink-500/70',
      'from-amber-400/70 to-orange-500/70',
      'from-emerald-400/70 to-teal-500/70',
      'from-slate-300/70 to-slate-400/70'
    ];
    return cats
      .filter((c) => Number.isFinite(Number(c.value ?? c.total)))
      .map((c, i) => ({
        name: c.name ?? c.label ?? `Categoria ${i + 1}`,
        value: Number(c.value ?? c.total) || 0,
        color: c.color ?? palette[i % palette.length]
      }));
  }, [metrics]);

  const alertItems = useMemo(() => {
    if (!metrics?.alerts) return [];
    const alerts = metrics.alerts;
    return [
      { label: 'Pedidos pendentes', value: `${alerts.pendingOrders ?? 0} abertos`, status: 'warning' },
      { label: 'Novos anúncios aguardando revisão', value: `${alerts.pendingProducts ?? 0} itens`, status: 'info' },
      { label: 'Contas banidas por suporte', value: `${alerts.bannedUsers ?? 0} contas`, status: 'critical' }
    ];
  }, [metrics]);

  const lastUpdatedText = formatRelativeTime(metrics?.generatedAt);
  const trafficData = Array.isArray(metrics?.trafficSeries)
    ? metrics.trafficSeries
        .map((point) => Number(point?.value) || 0)
        .filter((value) => Number.isFinite(value) && value >= 0)
    : [];
  const activities = metrics?.activities ?? [];

  if (loading) {
    return <p className="text-sm text-slate-300">Carregando métricas...</p>;
  }

  if (error && !metrics) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-6 text-white max-w-6xl mx-auto px-4 overflow-x-hidden">
      {error && metrics && (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error} Dados exibidos podem estar desatualizados.
        </div>
      )}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 shadow-2xl shadow-black/40">
        <div className="pointer-events-none absolute -left-10 top-0 h-48 w-48 rounded-full bg-indigo-400/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-indigo-200/70">Visão geral</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight">Saúde do marketplace em tempo real</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-200/80">
              Combine métricas operacionais, performance comercial e engajamento para enxergar gargalos antes que eles
              afetem o faturamento.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-300">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Monitoração ativa</span>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-1">
                Engajamento + Curadoria
              </span>
              <span className="rounded-full border border-indigo-300/40 bg-indigo-500/15 px-3 py-1">
                Atualizado {lastUpdatedText || 'agora'}
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
            {quickStats.map((item) => (
              <article
                key={item.label}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30"
              >
                <div className={`absolute inset-0 scale-150 bg-gradient-to-br ${item.accent} opacity-40 blur-2xl`} />
                <div className="relative">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/70">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{formatNumber(item.value)}</p>
                  <p className="text-xs text-white/70">{item.sub}</p>
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                    {item.trend}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {Boolean(trafficData.length || funnelSeries.length) && (
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 lg:col-span-3">
            <header className="flex items-center justify-between text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tráfego orgânico</p>
                <p className="text-lg font-semibold">Fluxo semanal</p>
              </div>
              <span className="text-xs text-slate-400">
                {lastUpdatedText ? `Atualizado ${lastUpdatedText}` : 'Atualizado agora'}
              </span>
            </header>
            <TrafficSparkline data={trafficData} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 lg:col-span-2">
            <header className="text-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Funil</p>
              <p className="text-lg font-semibold">Conversões por etapa</p>
            </header>
            <div className="mt-4 space-y-3">
              {funnelSeries.length === 0 ? (
                <p className="text-sm text-slate-400">Sem dados de funil.</p>
              ) : (
                funnelSeries.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>{row.label}</span>
                      <span className="font-semibold">{formatNumber(row.value)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${row.color}`}
                        style={{
                          width: `${Number(metrics?.funnel?.visits) > 0 ? Math.min((row.value / metrics.funnel.visits) * 100, 100) : 0}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {(ordersStats.total || ordersStats.revenueTotal || ordersStats.revenue30d) && (
        <section className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 lg:col-span-2">
            <header className="flex items-center justify-between text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Receita</p>
                <p className="text-lg font-semibold">Visão rápida</p>
              </div>
              <span className="text-xs text-slate-400">{formatNumber(ordersStats.total)} pedidos</span>
            </header>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ValueCard label="Receita total" value={formatCurrency(ordersStats.revenueTotal)} accent="from-emerald-400/40 to-emerald-600/70" />
              <ValueCard label="Receita 30d" value={formatCurrency(ordersStats.revenue30d)} accent="from-indigo-400/40 to-indigo-600/70" />
              <ValueCard label="Receita hoje" value={formatCurrency(ordersStats.revenueToday)} accent="from-sky-400/40 to-sky-600/70" />
              <ValueCard label="Ticket médio 30d" value={formatCurrency(ordersStats.avgTicket30d)} accent="from-amber-400/40 to-orange-500/70" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 lg:col-span-2">
            <header className="flex items-center justify-between text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Status de pedidos</p>
                <p className="text-lg font-semibold">Fila atual</p>
              </div>
            </header>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatusChip label="Pendentes" value={ordersStats.pending} color="bg-amber-400/20 text-amber-100" />
              <StatusChip label="Confirmados" value={ordersStats.confirmed} color="bg-emerald-400/20 text-emerald-100" />
              <StatusChip label="Cancelados" value={ordersStats.cancelled} color="bg-rose-400/20 text-rose-100" />
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-emerald-400/50"
                style={{
                  width: `${
                    ordersStats.total > 0
                      ? Math.min((ordersStats.confirmed / Math.max(ordersStats.total, 1)) * 100, 100)
                      : 0
                  }%`
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Percentual confirmado sobre total</p>
          </div>
        </section>
      )}

      {(conversionRate > 0 || channelBreakdown.length > 0) && (
      <section className="grid gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 xl:col-span-2">
          <header className="flex items-center justify-between text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Taxa de conversão</p>
              <p className="text-lg font-semibold">Pedidos / Visitas</p>
            </div>
            <span className="text-xs text-slate-400">{metrics?.funnel?.orders ?? 0} pedidos</span>
          </header>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <RadialGauge value={conversionRate} label="Conversão" />
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-3">
              {funnelSeries.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>{row.label}</span>
                    <span className="font-semibold">{formatNumber(row.value)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-indigo-400"
                      style={{
                        width: `${Number(funnelSeries[0]?.value) > 0 ? Math.min((row.value / funnelSeries[0].value) * 100, 100) : 0}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 xl:col-span-3">
          <header className="flex items-center justify-between text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Distribuição de canais</p>
              <p className="text-lg font-semibold">Origem das sessões</p>
            </div>
            <span className="text-xs text-slate-400">Top {channelBreakdown.length} canais</span>
          </header>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {channelBreakdown.length === 0 ? (
              <p className="col-span-2 text-sm text-slate-400">Sem dados de canais.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {channelBreakdown.map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>{row.label}</span>
                        <span className="font-semibold">{formatNumber(row.value)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{
                            width: `${channelBreakdown[0]?.value ? Math.min((row.value / channelBreakdown[0].value) * 100, 100) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <DonutChart
                    data={channelBreakdown}
                    totalLabel="Sessões"
                    totalValue={channelBreakdown.reduce((acc, item) => acc + (Number(item.value) || 0), 0)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      )}

      {(catalogHealth.total || categoryMix.length || geoSpread.length) && (
        <section className="grid gap-4 xl:grid-cols-3">
          {catalogHealth.total > 0 && (
            <Card title="Saúde do catálogo" subtitle="Ativos, pendentes e vendidos">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-center">
                  <StackGauge total={catalogHealth.total} active={catalogHealth.active} pending={catalogHealth.pending} sold={catalogHealth.sold} />
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Ativos
                    </span>
                    <span className="font-semibold text-emerald-200">{formatNumber(catalogHealth.active)}</span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Pendentes
                    </span>
                    <span className="font-semibold text-amber-200">{formatNumber(catalogHealth.pending)}</span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      Vendidos
                    </span>
                    <span className="font-semibold text-slate-200">{formatNumber(catalogHealth.sold)}</span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-300" />
                      Total
                    </span>
                    <span className="font-semibold text-indigo-100">{formatNumber(catalogHealth.total)}</span>
                  </li>
                </ul>
              </div>
            </Card>
          )}

          {categoryMix.length > 0 && (
            <Card title="Mix de categorias" subtitle="Participação no volume publicado">
              <div className="space-y-3">
                {categoryMix.map((cat) => (
                  <div key={cat.name} className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{cat.name}</span>
                      <span className="text-slate-300">{formatNumber(cat.value)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${cat.color}`}
                        style={{
                          width: `${categoryMix[0]?.value ? Math.min((cat.value / categoryMix[0].value) * 100, 100) : 0}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {geoSpread.length > 0 && (
            <Card title="Mapa geográfico" subtitle="Países com mais sessões">
              <div className="space-y-3">
                {geoSpread.map((row, index) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                          index === 0
                            ? 'bg-emerald-500/30 text-emerald-50'
                            : index === 1
                            ? 'bg-indigo-500/30 text-indigo-50'
                            : 'bg-slate-500/30 text-slate-100'
                        }`}
                      >
                        {index + 1}
                      </span>
                      {row.label}
                    </span>
                    <span className="font-semibold text-slate-100">{formatNumber(row.value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Alertas operacionais" subtitle="Eventos monitorados em tempo real">
          {alertItems.length === 0 ? (
            <p className="text-sm text-slate-400">Sem alertas ativos.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {alertItems.map((item) => (
                <AlertItem key={item.label} label={item.label} value={item.value} status={item.status} />
              ))}
            </ul>
          )}
        </Card>
        <Card title="Atividade recente" subtitle="Últimas ações capturadas pelo sistema">
          {activities.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma atividade registrada.</p>
          ) : (
            activities.map((activity, index) => (
              <ActivityItem key={`${activity.category}-${index}`} activity={activity} />
            ))
          )}
        </Card>
      </section>
    </div>
  );
}

function TrafficSparkline({ data }) {
  const safeData = data.length ? data : [];
  if (safeData.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">Sem dados de tráfego.</p>;
  }
  const max = Math.max(...safeData, 1);
  if (!Number.isFinite(max) || max <= 0) {
    return <p className="mt-4 text-sm text-slate-400">Sem dados de tráfego.</p>;
  }
  return (
    <div className="mt-6 h-40 w-full">
      <svg viewBox={`0 0 ${data.length * 40} 160`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={buildPath(safeData, max)}
          fill="url(#spark)"
          stroke="#818cf8"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function buildPath(data, max) {
  const height = 140;
  const step = 40;
  return data
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height + 10;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .concat(`L ${(data.length - 1) * step},150 L 0,150 Z`)
    .join(' ');
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
        <p className="text-sm text-slate-300">{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

function AlertItem({ label, value, status }) {
  const colors = {
    warning: 'bg-amber-500/20 text-amber-200',
    info: 'bg-sky-500/20 text-sky-200',
    critical: 'bg-rose-500/20 text-rose-200'
  };
  return (
    <li className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-slate-400">{value}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${colors[status]}`}>Monitorando</span>
    </li>
  );
}

function ActivityItem({ activity }) {
  const accentMap = {
    product: 'bg-sky-400',
    order: 'bg-emerald-400',
    message: 'bg-indigo-400'
  };
  const bubbleColor = accentMap[activity.category] || 'bg-white';
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm">
      <div className={`mt-1 h-2 w-2 rounded-full ${bubbleColor}`} />
      <div>
        <p className="text-sm">{activity.message}</p>
        <p className="text-xs text-slate-400">{formatRelativeTime(activity.timestamp)}</p>
      </div>
    </div>
  );
}

function RadialGauge({ value, label }) {
  const clamped = Math.min(Math.max(Number(value) || 0, 0), 100);
  const circumference = 2 * Math.PI * 36;
  const offset = ((100 - clamped) / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="36"
          fill="none"
          stroke="url(#gauge)"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <defs>
          <linearGradient id="gauge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-semibold">{clamped.toFixed(1)}%</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function DonutChart({ data, totalLabel, totalValue }) {
  const total = data.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  if (!total) {
    return <p className="text-sm text-slate-400">Sem dados.</p>;
  }
  let cumulative = 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const slices = data.map((item, index) => {
    const value = Number(item.value) || 0;
    const start = cumulative;
    const sliceLength = total ? (value / total) * circumference : 0;
    cumulative += sliceLength;
    const color = item.color?.replace('bg-', '').replace('/70', '') ?? ['indigo-400', 'emerald-400', 'amber-400', 'sky-400'][index % 4];
    return { start, sliceLength, color };
  });
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
        {slices.map((slice, index) => (
          <circle
            key={index}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={tailwindToRgb(slice.color)}
            strokeWidth="14"
            strokeDasharray={`${slice.sliceLength} ${circumference - slice.sliceLength}`}
            strokeDashoffset={-slice.start}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{totalLabel}</p>
        <p className="text-xl font-semibold text-white">{formatNumber(totalValue ?? total)}</p>
      </div>
    </div>
  );
}

function StackGauge({ total, active, pending, sold }) {
  const safeTotal = total || active + pending + sold || 1;
  const segments = [
    { label: 'Ativos', value: active, color: 'bg-emerald-400' },
    { label: 'Pendentes', value: pending, color: 'bg-amber-400' },
    { label: 'Vendidos', value: sold, color: 'bg-slate-400' }
  ];
  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="flex h-full w-full">
          {segments.map((seg) => (
            <span
              key={seg.label}
              className={`h-full ${seg.color}`}
              style={{ width: `${Math.max(0, (seg.value / safeTotal) * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-slate-400">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${seg.color}`} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function tailwindToRgb(colorToken) {
  const map = {
    'indigo-400': '#818cf8',
    'emerald-400': '#34d399',
    'amber-400': '#f59e0b',
    'sky-400': '#38bdf8',
    'rose-400': '#fb7185',
    'pink-500': '#ec4899'
  };
  return map[colorToken] || '#a5b4fc';
}

function ValueCard({ label, value, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-30 blur-2xl`} />
      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{label}</p>
        <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function StatusChip({ label, value, color }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm ${color}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">{label}</p>
      <p className="text-xl font-semibold text-white">{formatNumber(value)}</p>
    </div>
  );
}

function formatNumber(value) {
  if (Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR').format(Number(value));
}

function formatCurrency(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 'R$ 0';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

let toastShown = false;
function toastErrorOnce() {
  if (toastShown) return;
  toastShown = true;
  console.error('Falha ao sincronizar métricas.');
}

function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}
