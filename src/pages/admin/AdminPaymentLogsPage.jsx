import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, CreditCard, RefreshCw, Search, XCircle } from 'lucide-react';
import { adminGetSubscriptionPaymentLogs } from '../../lib/api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'En curso' },
  { value: 'abandoned', label: 'Sin completar' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'failed', label: 'Fallidos' },
];

const GATEWAY_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'uala_bis', label: 'Uala Bis' },
];

const ACTIVE_STATUSES = new Set(['started', 'gateway_request', 'checkout_created', 'pending']);
const FAILED_STATUSES = new Set(['gateway_error', 'failed_return', 'cancelled', 'rejected', 'failure', 'failed', 'confirm_error', 'activation_error', 'ownership_error']);

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  const normalized = value.endsWith('Z') ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function planLabel(planId) {
  const labels = {
    premium_mensual: 'VIP 1 mes',
    premium_3meses: 'VIP 3 meses',
    premium_6meses: 'VIP 6 meses',
  };
  return labels[planId] || planId || 'Plan desconocido';
}

function gatewayLabel(gateway) {
  if (gateway === 'mercadopago') return 'Mercado Pago';
  if (gateway === 'uala_bis') return 'Uala Bis';
  return gateway || 'Sin pasarela';
}

function sourceLabel(source, sourcePath) {
  if (source === 'vip_extend_page') return 'Extender VIP';
  if (source === 'vip_page') return sourcePath && sourcePath !== '/vip' ? `VIP desde ${sourcePath}` : 'Página VIP';
  return source || sourcePath || 'Sin origen';
}

function getStatusMeta(entry) {
  const status = entry.computed_status || entry.status || '';
  if (status === 'approved') {
    return {
      label: 'Aprobado',
      icon: CheckCircle2,
      className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    };
  }
  if (status === 'abandoned') {
    return {
      label: 'Sin completar',
      icon: Clock3,
      className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    };
  }
  if (ACTIVE_STATUSES.has(status)) {
    return {
      label: 'En curso',
      icon: Clock3,
      className: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    };
  }
  if (FAILED_STATUSES.has(status)) {
    return {
      label: 'Fallido',
      icon: XCircle,
      className: 'border-red-400/25 bg-red-400/10 text-red-300',
    };
  }
  return {
    label: status || 'Sin estado',
    icon: Clock3,
    className: 'border-mansion-border/25 bg-black/25 text-text-dim',
  };
}

function Detail({ label, value, mono = false }) {
  return (
    <div className="min-w-0 rounded-2xl border border-mansion-border/15 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">{label}</p>
      <p className={`mt-1 truncate text-sm text-text-primary ${mono ? 'font-mono text-[12px]' : ''}`}>{value || '-'}</p>
    </div>
  );
}

function JsonBlock({ value }) {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) return null;
  return (
    <pre className="mt-3 overflow-x-auto rounded-2xl border border-mansion-border/20 bg-black/25 p-3 text-[11px] leading-5 text-text-dim">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdminPaymentLogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (
    nextPage = 1,
    nextQuery = query,
    nextStatus = statusFilter,
    nextGateway = gatewayFilter
  ) => {
    setLoading(true);
    try {
      const data = await adminGetSubscriptionPaymentLogs({
        page: nextPage,
        limit: 25,
        q: nextQuery,
        status: nextStatus === 'all' ? '' : nextStatus,
        gateway: nextGateway === 'all' ? '' : nextGateway,
      });
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setPage(Number(data.page) || 1);
      setPages(Math.max(1, Number(data.pages) || 1));
      setTotal(Number(data.total) || 0);
    } catch (err) {
      alert(err.message || 'Error al cargar logs de pagos');
    } finally {
      setLoading(false);
    }
  }, [gatewayFilter, query, statusFilter]);

  useEffect(() => {
    fetchLogs(1, query, statusFilter, gatewayFilter);
  }, [fetchLogs, gatewayFilter, query, statusFilter]);

  const statusCounts = useMemo(() => logs.reduce((acc, entry) => {
    const key = entry.computed_status || entry.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [logs]);

  const handleSearch = (event) => {
    event.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleCopy = async (entry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    } catch {
      alert('No se pudo copiar el log');
    }
  };

  return (
    <div className="min-h-screen bg-mansion-base px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 rounded-3xl border border-mansion-border/30 bg-mansion-card/60 p-5 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mansion-gold/12 text-mansion-gold">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Pagos VIP</h1>
              <p className="text-sm text-text-dim">Intentos, origen, plan y resultado de cada checkout</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs text-text-muted sm:min-w-[360px]">
            <div className="rounded-2xl border border-mansion-border/20 bg-black/20 px-3 py-2">
              <span className="block text-base font-semibold text-text-primary">{total}</span>
              total
            </div>
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
              <span className="block text-base font-semibold text-emerald-300">{statusCounts.approved || 0}</span>
              aprobados
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 px-3 py-2">
              <span className="block text-base font-semibold text-amber-300">{statusCounts.abandoned || 0}</span>
              sin completar
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-mansion-border/30 bg-mansion-card/50 p-4 backdrop-blur-xl">
          <form onSubmit={handleSearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_auto_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-mansion-border/30 bg-black/20 px-4 py-3">
              <Search className="h-4 w-4 text-text-dim" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar usuario, email, plan, pago u origen"
                className="w-full border-0 bg-transparent p-0 text-sm focus:ring-0"
              />
            </label>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select value={gatewayFilter} onChange={(event) => setGatewayFilter(event.target.value)} className="rounded-2xl">
              {GATEWAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <button type="submit" className="btn-gold justify-center">
              Buscar
            </button>

            <button type="button" onClick={() => fetchLogs(page, query, statusFilter, gatewayFilter)} className="btn-ghost flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {loading && (
            <div className="rounded-3xl border border-mansion-border/20 bg-mansion-card/40 p-8 text-center text-text-dim">
              Cargando pagos...
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="rounded-3xl border border-mansion-border/20 bg-mansion-card/40 p-8 text-center text-text-dim">
              No hay pagos registrados con esos filtros.
            </div>
          )}

          {!loading && logs.map((entry) => {
            const statusMeta = getStatusMeta(entry);
            const StatusIcon = statusMeta.icon;
            const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
            const userLabel = entry.username || entry.email || entry.user_id || 'Usuario eliminado';

            return (
              <article key={entry.id} className="rounded-3xl border border-mansion-border/30 bg-mansion-card/45 p-5 backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusMeta.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusMeta.label}
                      </span>
                      <span className="rounded-full border border-mansion-border/20 bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                        {gatewayLabel(entry.gateway)}
                      </span>
                      <span className="text-xs text-text-dim">{formatDateTime(entry.created_at)}</span>
                    </div>

                    <div>
                      <h2 className="break-words text-base font-semibold text-text-primary">{userLabel}</h2>
                      <p className="mt-1 text-sm text-text-dim">
                        {planLabel(entry.plan_id)} · {formatCurrency(entry.amount)} · {sourceLabel(entry.source, entry.source_path)}
                      </p>
                    </div>
                  </div>

                  <button type="button" onClick={() => handleCopy(entry)} className="btn-ghost flex items-center justify-center gap-2 px-4 py-2.5 text-xs">
                    <Copy className="h-4 w-4" />
                    Copiar
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Detail label="Usuario" value={entry.username ? `${entry.username} · ${entry.email || '-'}` : entry.email || entry.user_id} />
                  <Detail label="Origen" value={sourceLabel(entry.source, entry.source_path)} />
                  <Detail label="Pago" value={entry.payment_id || entry.preference_id || '-'} mono />
                  <Detail label="Referencia" value={entry.external_reference || '-'} mono />
                  <Detail label="Estado gateway" value={entry.gateway_status || entry.status || '-'} />
                  <Detail label="Actualizado" value={formatDateTime(entry.updated_at)} />
                  <Detail label="Completado" value={formatDateTime(entry.completed_at)} />
                  <Detail label="Ruta origen" value={entry.source_path || entry.referrer || '-'} />
                </div>

                {entry.result_message ? (
                  <div className="mt-3 rounded-2xl border border-mansion-border/15 bg-black/20 px-3 py-2 text-sm text-text-dim">
                    {entry.result_message}
                  </div>
                ) : null}

                <JsonBlock value={metadata} />
              </article>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-3xl border border-mansion-border/20 bg-mansion-card/35 px-4 py-3 text-sm text-text-muted">
          <span>Página {page} de {pages}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fetchLogs(page - 1, query, statusFilter, gatewayFilter)} disabled={page <= 1 || loading} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">
              Anterior
            </button>
            <button type="button" onClick={() => fetchLogs(page + 1, query, statusFilter, gatewayFilter)} disabled={page >= pages || loading} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
