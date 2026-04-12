import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiDebugSummary, resetApiDebugRoute, resetApiDebugSession, setApiDebugEnabled, subscribeApiDebug } from '../lib/api';
import { estimateRealtimeLoad, getRealtimeDebugSummary, resetRealtimeDebug, subscribeRealtimeDebug } from '../lib/realtimeDebug';
import { getLivefeedDebugSummary, resetLivefeedDebug, subscribeLivefeedDebug } from '../lib/livefeedDebug';
import { getMediaDebugSummary, inspectVisibleMedia, resetMediaDebug, subscribeMediaDebug } from '../lib/mediaDebug';
import { getDebugPanelPrefs, setDebugPanelPref, subscribeDebugPanelPrefs } from '../lib/debugPanelPrefs';
import { getD1DebugSummary, resetD1Debug, subscribeD1Debug } from '../lib/d1Debug';

function TogglePill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
        active
          ? 'border-mansion-gold/30 bg-mansion-gold/20 text-mansion-gold'
          : 'border-white/10 bg-white/5 text-white/55'
      }`}
    >
      {children}
    </button>
  );
}

function MediaFamilyTable({ title, data }) {
  const rows = [
    ['profiles', 'Profiles'],
    ['stories', 'Stories'],
    ['livefeed', 'Livefeed'],
    ['assets', 'Assets'],
    ['other', 'Otros'],
  ];

  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/45">{title}</p>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {rows.map(([key, label]) => {
          const entry = data?.[key] || {};
          return (
            <div key={key} className="grid grid-cols-[1.2fr,0.8fr,0.8fr,0.8fr] items-center gap-2 border-b border-white/10 px-3 py-2 text-[10px] last:border-b-0">
              <p className="text-white/85">{label}</p>
              <span className="text-white/60">tot {entry.total ?? 0}</span>
              <span className="text-emerald-200/80">hit {entry.hit ?? 0}</span>
              <span className="text-amber-200/80">miss {entry.miss ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ApiDebugOverlay() {
  const location = useLocation();
  const [summary, setSummary] = useState(() => getApiDebugSummary());
  const [realtimeSummary, setRealtimeSummary] = useState(() => getRealtimeDebugSummary());
  const [livefeedSummary, setLivefeedSummary] = useState(() => getLivefeedDebugSummary());
  const [d1Summary, setD1Summary] = useState(() => getD1DebugSummary());
  const [mediaSummary, setMediaSummary] = useState(() => getMediaDebugSummary());
  const [panelPrefs, setPanelPrefs] = useState(() => getDebugPanelPrefs());
  const [collapsed, setCollapsed] = useState(false);
  const mediaAutoTimerRef = useRef(null);
  const lastMediaAutoKeyRef = useRef('');

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

    const unsubscribeLivefeed = subscribeLivefeedDebug((nextSummary) => {
      setLivefeedSummary(nextSummary);
    });

    const unsubscribeMedia = subscribeMediaDebug((nextSummary) => {
      setMediaSummary(nextSummary);
    });

    const unsubscribeD1 = subscribeD1Debug((nextSummary) => {
      setD1Summary(nextSummary);
    });

    const unsubscribePrefs = subscribeDebugPanelPrefs((nextPrefs) => {
      setPanelPrefs(nextPrefs);
    });

    return () => {
      unsubscribeApi?.();
      unsubscribeRealtime?.();
      unsubscribeLivefeed?.();
      unsubscribeMedia?.();
      unsubscribeD1?.();
      unsubscribePrefs?.();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRealtimeSummary(getRealtimeDebugSummary());
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!panelPrefs.media || collapsed) {
      if (mediaAutoTimerRef.current) {
        window.clearTimeout(mediaAutoTimerRef.current);
        mediaAutoTimerRef.current = null;
      }
      lastMediaAutoKeyRef.current = '';
      return undefined;
    }

    const routeKey = `${location.pathname}${location.search}`;
    if (lastMediaAutoKeyRef.current === routeKey) return undefined;

    mediaAutoTimerRef.current = window.setTimeout(async () => {
      lastMediaAutoKeyRef.current = routeKey;
      setMediaSummary((prev) => ({ ...(prev || {}), loading: true }));
      const next = await inspectVisibleMedia({ limit: 24 });
      setMediaSummary(next);
      mediaAutoTimerRef.current = null;
    }, 900);

    return () => {
      if (mediaAutoTimerRef.current) {
        window.clearTimeout(mediaAutoTimerRef.current);
        mediaAutoTimerRef.current = null;
      }
    };
  }, [collapsed, location.pathname, location.search, panelPrefs.media]);

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
  const d1Rows = [
    { key: 'chat_message_ws', label: 'Chat msg WS', data: d1Summary?.actions?.chat_message_ws },
    { key: 'chat_message_http', label: 'Chat msg HTTP', data: d1Summary?.actions?.chat_message_http },
    { key: 'chat_read', label: 'Read receipts', data: d1Summary?.actions?.chat_read },
    { key: 'chat_delete', label: 'Delete conv', data: d1Summary?.actions?.chat_delete },
  ];
  const activePanels = [
    panelPrefs.api,
    panelPrefs.realtime,
    panelPrefs.livefeed,
    panelPrefs.d1 !== false,
    panelPrefs.media,
  ].filter(Boolean).length;
  const useDesktopGrid = activePanels > 1;

  return (
    <div
      className="fixed right-3 bottom-3 z-[9999] w-[min(760px,calc(100vw-24px))] rounded-2xl border border-mansion-gold/30 bg-black/85 text-white shadow-2xl backdrop-blur-md"
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mansion-gold/80">API Debug</p>
          <p className="text-xs text-white/70">{summary.currentRoute}</p>
        </div>
        <div className="flex items-center gap-2">
          <TogglePill active={panelPrefs.api} onClick={() => setPanelPrefs(setDebugPanelPref('api', !panelPrefs.api))}>
            API
          </TogglePill>
          <TogglePill active={panelPrefs.realtime} onClick={() => setPanelPrefs(setDebugPanelPref('realtime', !panelPrefs.realtime))}>
            WS
          </TogglePill>
          <TogglePill active={panelPrefs.livefeed} onClick={() => setPanelPrefs(setDebugPanelPref('livefeed', !panelPrefs.livefeed))}>
            Livefeed
          </TogglePill>
          <TogglePill active={panelPrefs.d1 !== false} onClick={() => setPanelPrefs(setDebugPanelPref('d1', panelPrefs.d1 === false))}>
            D1
          </TogglePill>
          <TogglePill active={panelPrefs.media} onClick={() => setPanelPrefs(setDebugPanelPref('media', !panelPrefs.media))}>
            Media
          </TogglePill>
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
        <div className={`px-3 pt-3 ${useDesktopGrid ? 'grid gap-3 md:grid-cols-2 md:items-start' : 'space-y-3'}`}>
          {panelPrefs.api && (
            <section className="space-y-3">
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
            </section>
          )}

          {panelPrefs.realtime && (
            <section className="space-y-3">
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
            </section>
          )}

          {panelPrefs.livefeed && (
            <section className="rounded-xl border border-fuchsia-500/20 overflow-hidden">
              <div className="flex items-center justify-between border-b border-fuchsia-500/15 bg-fuchsia-500/5 px-3 py-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-fuchsia-300/90">Livefeed</p>
                  <p className="text-[10px] text-white/55">Mide si el snapshot sale de memoria, red o deduplicacion del request actual.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLivefeedSummary(resetLivefeedDebug())}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/80"
                >
                  Reset
                </button>
              </div>
              <div className="space-y-2 px-3 py-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Current network</p>
                    <p className="mt-1 text-lg font-semibold">{livefeedSummary?.totals?.currentNetwork ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Current memory</p>
                    <p className="mt-1 text-lg font-semibold">{livefeedSummary?.totals?.currentMemory ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Current deduped</p>
                    <p className="mt-1 text-lg font-semibold">{livefeedSummary?.totals?.currentDeduped ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Payload network</p>
                    <p className="mt-1 text-lg font-semibold">{livefeedSummary?.totals?.payloadNetwork ?? 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Ultimo current</p>
                    <p className="mt-1 text-sm font-semibold text-white">{livefeedSummary?.lastCurrent?.source || '-'}</p>
                    <p className="mt-1 text-[10px] text-white/55">{livefeedSummary?.lastCurrent?.version || '-'}</p>
                    <p className="mt-1 text-[10px] text-white/45">{livefeedSummary?.lastCurrent?.fetchedAt || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Ultimo payload</p>
                    <p className="mt-1 text-sm font-semibold text-white">{livefeedSummary?.lastPayload?.version || '-'}</p>
                    <p className="mt-1 text-[10px] text-white/55 break-all">{livefeedSummary?.lastPayload?.url || '-'}</p>
                    <p className="mt-1 text-[10px] text-white/45">{livefeedSummary?.lastPayload?.fetchedAt || '-'}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-white/55">Errores</p>
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                      {livefeedSummary?.totals?.errors ?? 0}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-rose-200/85">{livefeedSummary?.lastError || 'Sin errores'}</p>
                </div>
              </div>
            </section>
          )}

          {panelPrefs.d1 !== false && (
            <section className="rounded-xl border border-emerald-500/20 overflow-hidden">
              <div className="flex items-center justify-between border-b border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">D1 estimado</p>
                  <p className="text-[10px] text-white/55">Estimacion base en frontend por accion de chat. El backend real puede escribir menos por coalescing.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setD1Summary(resetD1Debug())}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/80"
                >
                  Reset
                </button>
              </div>
              <div className="space-y-2 px-3 py-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Writes base sesion</p>
                    <p className="mt-1 text-lg font-semibold">{d1Summary?.totals?.estimatedWrites ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/55">Acciones</p>
                    <p className="mt-1 text-lg font-semibold">
                      {d1Rows.reduce((sum, row) => sum + Number(row.data?.count || 0), 0)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  {d1Rows.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-[11px] last:border-b-0">
                      <div>
                        <p className="text-white/90">{row.label}</p>
                        <p className="text-[10px] text-white/55">acciones {row.data?.count ?? 0}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        base {row.data?.estimatedWrites ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {panelPrefs.media && (
            <section className={`rounded-xl border border-emerald-500/20 overflow-hidden ${useDesktopGrid ? 'md:col-span-2' : ''}`}>
              <div className="flex items-center justify-between border-b border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">Media Cache</p>
                  <p className="text-[10px] text-white/55">Inspeccion puntual de media visible para estimar HIT/MISS y posibles Class B.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      lastMediaAutoKeyRef.current = '';
                      setMediaSummary(resetMediaDebug());
                    }}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/80"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMediaSummary((prev) => ({ ...(prev || {}), loading: true }));
                      const next = await inspectVisibleMedia({ limit: 24 });
                      lastMediaAutoKeyRef.current = `${location.pathname}${location.search}`;
                      setMediaSummary(next);
                    }}
                    className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-200"
                  >
                    {mediaSummary?.loading ? 'Midiendo...' : 'Actualizar'}
                  </button>
                </div>
              </div>
              <div className="space-y-2 px-3 py-3">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/45">Ruta actual</p>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="rounded-lg bg-white/5 px-2 py-2">
                      <p className="text-white/50">total</p>
                      <p className="mt-1 text-base font-semibold text-white">{mediaSummary?.summary?.total ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 px-2 py-2">
                      <p className="text-emerald-200/70">HIT</p>
                      <p className="mt-1 text-base font-semibold text-emerald-200">{mediaSummary?.summary?.hit ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 px-2 py-2">
                      <p className="text-amber-200/70">MISS</p>
                      <p className="mt-1 text-base font-semibold text-amber-200">{mediaSummary?.summary?.miss ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 px-2 py-2">
                      <p className="text-rose-200/70">err</p>
                      <p className="mt-1 text-base font-semibold text-rose-200">{mediaSummary?.summary?.errors ?? 0}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/45">Sesion</p>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="rounded-lg bg-white/5 px-2 py-2">
                      <p className="text-white/50">total</p>
                      <p className="mt-1 text-base font-semibold text-white">{mediaSummary?.sessionSummary?.total ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 px-2 py-2">
                      <p className="text-emerald-200/70">HIT</p>
                      <p className="mt-1 text-base font-semibold text-emerald-200">{mediaSummary?.sessionSummary?.hit ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 px-2 py-2">
                      <p className="text-amber-200/70">MISS</p>
                      <p className="mt-1 text-base font-semibold text-amber-200">{mediaSummary?.sessionSummary?.miss ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 px-2 py-2">
                      <p className="text-rose-200/70">err</p>
                      <p className="mt-1 text-base font-semibold text-rose-200">{mediaSummary?.sessionSummary?.errors ?? 0}</p>
                    </div>
                  </div>
                </div>
                <MediaFamilyTable title="Ruta por familia" data={mediaSummary?.familySummary} />
                <MediaFamilyTable title="Sesion por familia" data={mediaSummary?.sessionFamilySummary} />
                {mediaSummary?.error ? (
                  <p className="text-[11px] text-rose-300">{mediaSummary.error}</p>
                ) : null}
                <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10">
                  {(mediaSummary?.entries || []).length === 0 ? (
                  <div className="px-3 py-4 text-xs text-white/60">Todavia no se inspecciono media en esta ruta.</div>
                ) : (
                    (mediaSummary?.entries || []).map((entry) => (
                      <div key={entry.url} className="border-b border-white/10 px-3 py-2 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[11px] leading-4 text-white/85 break-all">{entry.url}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            entry.cacheStatus === 'HIT'
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : entry.cacheStatus === 'MISS'
                                ? 'bg-amber-500/15 text-amber-200'
                                : 'bg-white/10 text-white/70'
                          }`}>
                            {entry.cacheStatus || (entry.error ? 'ERR' : '-')}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/55">
                          <span>status {entry.status ?? '-'}</span>
                          <span>age {entry.age || '-'}</span>
                          <span>type {entry.contentType || '-'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          <p className={`pb-1 text-[10px] text-white/45 ${useDesktopGrid ? 'md:col-span-2' : ''}`}>
            Activo por URL con <span className="text-white/75">?api_debug=1</span>
          </p>
        </div>
      )}
    </div>
  );
}
