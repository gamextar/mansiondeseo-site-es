import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, RefreshCw, Search, Trash2 } from 'lucide-react';
import { adminDeleteErrorLog, adminGetErrorLogs } from '../../lib/api';

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

function JsonBlock({ value }) {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) return null;
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl border border-mansion-border/20 bg-black/25 p-3 text-[11px] leading-5 text-text-dim">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdminErrorLogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');

  const fetchLogs = useCallback(async (nextPage = page, nextQuery = query, nextSource = sourceFilter, nextLevel = levelFilter) => {
    setLoading(true);
    try {
      const data = await adminGetErrorLogs({
        page: nextPage,
        limit: 25,
        q: nextQuery,
        source: nextSource === 'all' ? '' : nextSource,
        level: nextLevel === 'all' ? '' : nextLevel,
      });
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setPage(Number(data.page) || 1);
      setPages(Math.max(1, Number(data.pages) || 1));
      setTotal(Number(data.total) || 0);
    } catch (err) {
      alert(err.message || 'Error al cargar logs');
    } finally {
      setLoading(false);
    }
  }, [levelFilter, page, query, sourceFilter]);

  useEffect(() => {
    fetchLogs(1, query, sourceFilter, levelFilter);
  }, [fetchLogs, levelFilter, query, sourceFilter]);

  const handleSearch = (event) => {
    event.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleDelete = async (logId) => {
    if (!confirm('¿Eliminar este error del registro?')) return;
    setDeletingId(logId);
    try {
      await adminDeleteErrorLog(logId);
      const nextCount = Math.max(0, total - 1);
      setTotal(nextCount);
      if (logs.length === 1 && page > 1) {
        await fetchLogs(page - 1, query, sourceFilter, levelFilter);
      } else {
        await fetchLogs(page, query, sourceFilter, levelFilter);
      }
    } catch (err) {
      alert(err.message || 'No se pudo borrar el log');
    } finally {
      setDeletingId('');
    }
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
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 rounded-3xl border border-mansion-border/30 bg-mansion-card/60 p-5 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/12 text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-text-primary">Registro de Errores</h1>
                <p className="text-sm text-text-dim">Backend + frontend centralizados en el Admin CP</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-mansion-border/20 bg-black/20 px-4 py-3 text-sm text-text-muted">
            {total} registros
          </div>
        </div>

        <div className="rounded-3xl border border-mansion-border/30 bg-mansion-card/50 p-4 backdrop-blur-xl">
          <form onSubmit={handleSearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-mansion-border/30 bg-black/20 px-4 py-3">
              <Search className="h-4 w-4 text-text-dim" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por mensaje, ruta, user_id o request id"
                className="w-full border-0 bg-transparent p-0 text-sm focus:ring-0"
              />
            </label>

            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-2xl">
              <option value="all">Todas las fuentes</option>
              <option value="worker">Backend</option>
              <option value="client">Frontend</option>
            </select>

            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="rounded-2xl">
              <option value="all">Todos los niveles</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
            </select>

            <button type="submit" className="btn-gold justify-center">
              Buscar
            </button>

            <button type="button" onClick={() => fetchLogs(page, query, sourceFilter, levelFilter)} className="btn-ghost flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {loading && (
            <div className="rounded-3xl border border-mansion-border/20 bg-mansion-card/40 p-8 text-center text-text-dim">
              Cargando logs...
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="rounded-3xl border border-mansion-border/20 bg-mansion-card/40 p-8 text-center text-text-dim">
              No hay errores registrados con esos filtros.
            </div>
          )}

          {!loading && logs.map((entry) => {
            const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
            return (
              <article key={entry.id} className="rounded-3xl border border-mansion-border/30 bg-mansion-card/45 p-5 backdrop-blur-xl">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        entry.source === 'worker'
                          ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                          : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                      }`}>
                        {entry.source === 'worker' ? 'Backend' : 'Frontend'}
                      </span>
                      <span className="rounded-full border border-mansion-border/20 bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                        {entry.level || 'error'}
                      </span>
                      {entry.status_code ? (
                        <span className="rounded-full border border-mansion-border/20 bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                          HTTP {entry.status_code}
                        </span>
                      ) : null}
                      <span className="text-xs text-text-dim">{formatDateTime(entry.created_at)}</span>
                    </div>

                    <h2 className="mt-3 break-words text-base font-semibold text-text-primary">
                      {entry.message}
                    </h2>

                    <div className="mt-3 grid gap-2 text-xs text-text-dim lg:grid-cols-2">
                      <div>Ruta: <span className="text-text-primary">{entry.route || '-'}</span></div>
                      <div>Método: <span className="text-text-primary">{entry.method || '-'}</span></div>
                      <div>User ID: <span className="text-text-primary">{entry.user_id || '-'}</span></div>
                      <div>Request ID: <span className="text-text-primary">{entry.request_id || '-'}</span></div>
                    </div>
                  </div>

                  <div className="flex flex-row gap-2 lg:flex-col">
                    <button type="button" onClick={() => handleCopy(entry)} className="btn-ghost flex items-center justify-center gap-2 px-4 py-2.5 text-xs">
                      <Copy className="h-4 w-4" />
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === entry.id ? 'Borrando...' : 'Borrar'}
                    </button>
                  </div>
                </div>

                {entry.stack ? (
                  <details className="mt-4 rounded-2xl border border-mansion-border/20 bg-black/20 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-text-muted">Stack trace</summary>
                    <pre className="mt-3 overflow-x-auto text-[11px] leading-5 text-text-dim">{entry.stack}</pre>
                  </details>
                ) : null}

                <JsonBlock value={meta} />
              </article>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-3xl border border-mansion-border/20 bg-mansion-card/35 px-4 py-3 text-sm text-text-muted">
          <span>Página {page} de {pages}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fetchLogs(page - 1, query, sourceFilter, levelFilter)} disabled={page <= 1 || loading} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">
              Anterior
            </button>
            <button type="button" onClick={() => fetchLogs(page + 1, query, sourceFilter, levelFilter)} disabled={page >= pages || loading} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
