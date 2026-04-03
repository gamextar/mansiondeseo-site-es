import { useEffect, useState } from 'react';
import { getApiDebugSummary, resetApiDebugRoute, resetApiDebugSession, setApiDebugEnabled, subscribeApiDebug } from '../lib/api';
import { estimateRealtimeLoad, getRealtimeDebugSummary, resetRealtimeDebug, subscribeRealtimeDebug } from '../lib/realtimeDebug';

export default function ApiDebugOverlay() {
  const [summary, setSummary] = useState(() => getApiDebugSummary());
  const [realtimeSummary, setRealtimeSummary] = useState(() => getRealtimeDebugSummary());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugParam = params.get('api_debug');

    if (debugParam === '1') {
      setSummary(setApiDebugEnabled(true));
    } else if (debugParam === '0') {
      setSummary(setApiDebugEnabled(false));
    } else {
      setSummary(getApiDebugSummary());
    }

    const unsubscribeApi = subscribeApiDebug((nextSummary) => {
      setSummary(nextSummary);
    });

    const unsubscribeRealtime = subscribeRealtimeDebug((nextSummary) => {
      setRealtimeSummary(nextSummary);
    });

    return () => {
      unsubscribeApi?.();
      unsubscribeRealtime?.();
    };
  }, []);

  if (!summary?.enabled) return null;

  const rows = summary.counts || [];
  const realtimeEstimate = estimateRealtimeLoad(realtimeSummary);
  const realtimeRows = [
    {
      key: 'notifications',
      label: 'Notificaciones',
      data: realtimeSummary?.channels?.notifications,
      estimate: realtimeEstimate?.channels?.notifications,
    },
    {
      key: 'chat',
      label: 'Chat',
      data: realtimeSummary?.channels?.chat,
      estimate: realtimeEstimate?.channels?.chat,
    },
  ];

  return (
    <div
      className="fixed right-3 bottom-3 z-[9999] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-mansion-gold/30 bg-black/85 text-white shadow-2xl backdrop-blur-md"
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mansion-gold/80">API Debug</p>
          <p className="text-xs text-white/70">{summary.currentRoute}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/80"
          >
            {collapsed ? 'Abrir' : 'Ocultar'}
          </button>
          <button
            type="button"
            onClick={() => setSummary(resetApiDebugRoute())}
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/80"
          >
            Reset
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-3 px-3 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-white/55">Requests</p>
              <p className="mt-1 text-lg font-semibold">{summary.totalRequests}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-white/55">Sesion</p>
              <p className="mt-1 text-lg font-semibold">{summary.sessionTotalRequests ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-white/55">Endpoints</p>
              <p className="mt-1 text-lg font-semibold">{rows.length}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-white/55">Endpoints sesion</p>
              <p className="mt-1 text-lg font-semibold">{summary.sessionCounts?.length ?? 0}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSummary(resetApiDebugRoute())}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80"
            >
              Reset ruta
            </button>
            <button
              type="button"
              onClick={() => setSummary(resetApiDebugSession())}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80"
            >
              Reset sesion
            </button>
          </div>

          <div className="rounded-xl border border-sky-500/20 overflow-hidden">
            <div className="flex items-center justify-between border-b border-sky-500/15 bg-sky-500/5 px-3 py-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-300/90">Realtime</p>
                <p className="text-[10px] text-white/55">
                  Sockets observados localmente · ventana {realtimeEstimate?.elapsedMinutes ?? 0} min
                </p>
                {realtimeEstimate?.sampleShort && (
                  <p className="text-[10px] text-amber-300/85">Muestra corta: la estimacion por hora se estabiliza tras 1 min.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRealtimeSummary(resetRealtimeDebug())}
                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/80"
              >
                Reset
              </button>
            </div>
            <div className="space-y-2 px-3 py-3">
              {realtimeRows.map((row) => (
                <div key={row.key} className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold text-white/90">{row.label}</p>
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                      activas {row.data?.activeConnections ?? 0}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-white/60">
                    <span>connects {row.data?.connectAttempts ?? 0}</span>
                    <span>opens {row.data?.opens ?? 0}</span>
                    <span>closes {row.data?.closes ?? 0}</span>
                    <span>reconnects {row.data?.reconnectsScheduled ?? 0}</span>
                    <span>pings {row.data?.pingsSent ?? 0}</span>
                    <span>pongs {row.data?.pongsReceived ?? 0}</span>
                    <span>in {row.data?.messagesReceived ?? 0}</span>
                    <span>out {row.data?.messagesSent ?? 0}</span>
                    <span>bg {row.data?.backgroundPauses ?? 0}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-sky-200/85">
                    <span>upgrades/h {row.estimate?.upgradeReqPerHour ?? 0}</span>
                    <span>DO eq/h {row.estimate?.approxDoEqReqPerHour ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10">
            {rows.length === 0 ? (
              <div className="px-3 py-4 text-xs text-white/60">
                Aun no hay requests en esta ruta.
              </div>
            ) : (
              rows.map((row) => (
                <div key={row.key} className="border-b border-white/10 px-3 py-2 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] leading-4 text-white/90">{row.key}</p>
                    <span className="rounded-full bg-mansion-gold/20 px-2 py-0.5 text-[10px] font-semibold text-mansion-gold">
                      {row.count}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-white/55">
                    <span>avg {row.avgMs}ms</span>
                    <span>ok {row.ok}</span>
                    <span>err {row.errors}</span>
                    <span>status {row.lastStatus ?? '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="pb-1 text-[10px] text-white/45">
            Activo por URL con <span className="text-white/75">?api_debug=1</span>
          </p>
        </div>
      )}
    </div>
  );
}
