import { useState, useEffect, useRef, createContext, useContext, useCallback, useMemo } from 'react';
import { getAppBootstrap, getUnreadCount, getToken, invalidateUnreadCache, peekUnreadCountCache, setUnreadCountCache } from '../lib/api';
import { recordRealtimeDebug, setRealtimeActiveConnections } from '../lib/realtimeDebug';

const UnreadContext = createContext({
  unreadCount: 0,
  refresh: () => {},
  subscribe: () => () => {},
  setActiveChatId: () => {},
});

const LEGACY_PROD_WS_BASE = 'wss://mansion-deseo-api-production.green-silence-8594.workers.dev';

function resolveWsBase() {
  const explicitBase = String(import.meta.env.VITE_WS_BASE || '').trim();
  if (explicitBase) return explicitBase.replace(/\/$/, '');
  if (typeof window === 'undefined') return LEGACY_PROD_WS_BASE;
  if (!import.meta.env.PROD) return `ws://${window.location.hostname}:8787`;
  if (window.location.hostname.endsWith('.pages.dev')) return LEGACY_PROD_WS_BASE;
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
}

const WS_BASE = resolveWsBase();
const NOTIFICATION_PING_MS = 4 * 60_000; // 4 min — reduces DO wake-ups from hibernation
const NOTIFICATION_BACKGROUND_GRACE_MS = 60_000; // keep WS alive briefly across tab/app switches
const UNREAD_REFRESH_STALE_MS = 5 * 60_000; // 5 min — HTTP fallback if WS stale
const UNREAD_FETCH_DEBOUNCE_MS = 4_000;
const WS_MAX_RETRIES = 5; // backoff: 2,4,8,16,30 ≈ 60s then stop

export function UnreadProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null); // string or { text, icon }
  const prevCountRef = useRef(-1); // -1 = not yet loaded
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);
  const wsRetryRef = useRef(0);
  const wsClosedRef = useRef(false);
  const wsPausedRef = useRef(false);
  const wsConnectedRef = useRef(false);
  const wsBackgroundTimerRef = useRef(null);
  const unreadFetchRef = useRef(null);
  const lastUnreadFetchAtRef = useRef(0);
  const activeChatIdRef = useRef(null);
  const bootstrapSettledRef = useRef(false);

  useEffect(() => {
    const cachedUnread = peekUnreadCountCache();
    if (typeof cachedUnread?.unread === 'number') {
      lastUnreadFetchAtRef.current = Date.now();
      applyUnreadCount(cachedUnread.unread);
    }
  }, [applyUnreadCount]);

  const applyUnreadCount = useCallback((total, { showToast = false } = {}) => {
    const nextTotal = Math.max(0, Number(total) || 0);
    if (showToast && prevCountRef.current >= 0 && nextTotal > prevCountRef.current) {
      const diff = nextTotal - prevCountRef.current;
      setToast(`${diff} nuevo${diff > 1 ? 's' : ''} mensaje${diff > 1 ? 's' : ''}`);
      setTimeout(() => setToast(null), 4000);
    }
    prevCountRef.current = nextTotal;
    setUnreadCount(nextTotal);
    setUnreadCountCache({ unread: nextTotal });
  }, []);

  const stopPing = useCallback((socket = wsRef.current) => {
    if (!socket?._pingTimer) return;
    clearInterval(socket._pingTimer);
    socket._pingTimer = null;
  }, []);

  const clearBackgroundDisconnectTimer = useCallback(() => {
    if (!wsBackgroundTimerRef.current) return;
    clearTimeout(wsBackgroundTimerRef.current);
    wsBackgroundTimerRef.current = null;
  }, []);

  const startPing = useCallback((socket = wsRef.current) => {
    if (!socket || document.visibilityState !== 'visible') return;
    stopPing(socket);
    socket._pingTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (socket.readyState === WebSocket.OPEN) {
        recordRealtimeDebug('notifications', 'pingsSent');
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, NOTIFICATION_PING_MS);
  }, [stopPing]);

  const fetchUnread = useCallback(({ force = false } = {}) => {
    const token = getToken();
    if (!token) {
      prevCountRef.current = 0;
      setUnreadCount(0);
      return Promise.resolve({ unread: 0 });
    }

    // Always dedup: if a request is already in-flight, piggyback on it
    if (unreadFetchRef.current) return unreadFetchRef.current;

    const now = Date.now();
    if (!force && lastUnreadFetchAtRef.current && now - lastUnreadFetchAtRef.current < UNREAD_FETCH_DEBOUNCE_MS) {
      return Promise.resolve({ unread: prevCountRef.current });
    }

    lastUnreadFetchAtRef.current = now;
    const request = getUnreadCount({ force })
      .then((data) => {
        applyUnreadCount(data.unread || 0, { showToast: true });
        return data;
      })
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        if (unreadFetchRef.current === request) unreadFetchRef.current = null;
      });

    unreadFetchRef.current = request;
    return request;
  }, [applyUnreadCount]);

  const shouldRefreshUnread = useCallback(() => {
    if (!getToken()) return false;
    if (prevCountRef.current < 0) return true;
    if (!lastUnreadFetchAtRef.current) return true;
    return Date.now() - lastUnreadFetchAtRef.current > UNREAD_REFRESH_STALE_MS;
  }, []);

  // Notify all subscribers (e.g. ChatListPage) of a new event
  const notifyListeners = useCallback((event) => {
    listenersRef.current.forEach(cb => cb(event));
  }, []);

  // Subscribe to real-time notification events. Returns unsubscribe function.
  const subscribe = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  // Connect notification WebSocket
  const disconnectWs = useCallback(() => {
    const ws = wsRef.current;
    clearBackgroundDisconnectTimer();
    if (!ws) return;
    stopPing(ws);
    ws.onclose = null;
    ws.onerror = null;
    try { ws.close(1000, 'client-pause'); } catch { /* already closed */ }
    wsRef.current = null;
    wsConnectedRef.current = false;
    setRealtimeActiveConnections('notifications', 0);
  }, [clearBackgroundDisconnectTimer, stopPing]);

  const scheduleBackgroundDisconnect = useCallback(() => {
    clearBackgroundDisconnectTimer();
    wsBackgroundTimerRef.current = setTimeout(() => {
      if (document.visibilityState === 'visible') return;
      wsPausedRef.current = true;
      recordRealtimeDebug('notifications', 'backgroundPauses');
      disconnectWs();
    }, NOTIFICATION_BACKGROUND_GRACE_MS);
  }, [clearBackgroundDisconnectTimer, disconnectWs]);

  const connectWs = useCallback(() => {
    const token = getToken();
    if (!token || wsClosedRef.current || wsPausedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = `${WS_BASE}/api/notifications/ws?token=${encodeURIComponent(token)}`;
    try {
      recordRealtimeDebug('notifications', 'connectAttempts');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        wsRetryRef.current = 0;
        wsConnectedRef.current = true;
        recordRealtimeDebug('notifications', 'opens');
        setRealtimeActiveConnections('notifications', 1);
        startPing(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          recordRealtimeDebug('notifications', 'messagesReceived');
          if (data.type === 'connected' || data.type === 'pong') {
            wsConnectedRef.current = true;
            if (data.type === 'pong') recordRealtimeDebug('notifications', 'pongsReceived');
            return;
          }
          if (data.type === 'new_message') {
            const isActiveChat = !!activeChatIdRef.current && data.chatId === activeChatIdRef.current;
            if (typeof data.unreadCount === 'number') {
              applyUnreadCount(
                isActiveChat ? Math.max(0, data.unreadCount - 1) : data.unreadCount,
                { showToast: !isActiveChat }
              );
            } else if (typeof data.unreadDelta === 'number') {
              if (prevCountRef.current >= 0) {
                const nextCount = Math.max(0, prevCountRef.current + (isActiveChat ? 0 : data.unreadDelta));
                applyUnreadCount(nextCount, { showToast: !isActiveChat && data.unreadDelta > 0 });
              } else {
                fetchUnread({ force: true }).catch(() => {});
              }
            } else if (!isActiveChat) {
              fetchUnread({ force: true }).catch(() => {});
            }
            notifyListeners(data);
          } else if (data.type === 'conversation_deleted') {
            invalidateUnreadCache();
            if (typeof data.unreadCount === 'number') {
              applyUnreadCount(data.unreadCount);
            } else {
              fetchUnread({ force: true }).catch(() => {});
            }
            notifyListeners(data);
          } else if (data.type === 'typing') {
            notifyListeners(data);
          } else if (data.type === 'gift') {
            setToast({
              text: `${data.senderName || 'Alguien'} te envió ${data.giftName || 'un regalo'}`,
              emoji: data.giftEmoji || '🎁',
            });
            setTimeout(() => setToast(null), 5000);
            notifyListeners(data);
          } else if (data.type === 'story_like') {
            setToast({
              text: `A ${data.senderName || 'alguien'} le gustó tu video`,
              emoji: '❤️',
            });
            setTimeout(() => setToast(null), 4000);
            notifyListeners(data);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        stopPing(ws);
        if (wsRef.current === ws) wsRef.current = null;
        wsConnectedRef.current = false;
        recordRealtimeDebug('notifications', 'closes');
        setRealtimeActiveConnections('notifications', 0);
        if (!wsClosedRef.current && !wsPausedRef.current && wsRetryRef.current < WS_MAX_RETRIES) {
          const delay = Math.min(2000 * Math.pow(2, wsRetryRef.current), 30_000);
          wsRetryRef.current++;
          recordRealtimeDebug('notifications', 'reconnectsScheduled');
          setTimeout(connectWs, delay);
        }
      };

      ws.onerror = () => {
        recordRealtimeDebug('notifications', 'errors');
      };
    } catch {
      wsConnectedRef.current = false;
      recordRealtimeDebug('notifications', 'errors');
      if (wsRetryRef.current < WS_MAX_RETRIES) {
        const delay = Math.min(2000 * Math.pow(2, wsRetryRef.current), 30_000);
        wsRetryRef.current++;
        recordRealtimeDebug('notifications', 'reconnectsScheduled');
        setTimeout(connectWs, delay);
      }
    }
  }, [applyUnreadCount, fetchUnread, notifyListeners, startPing, stopPing]);

  // Initial fetch + WebSocket (no polling — real-time only)
  useEffect(() => {
    bootstrapSettledRef.current = false;

    if (getToken()) {
      getAppBootstrap()
        .then((data) => {
          if (typeof data?.unread === 'number') {
            lastUnreadFetchAtRef.current = Date.now();
            applyUnreadCount(data.unread);
            bootstrapSettledRef.current = true;
            return;
          }
          return fetchUnread({ force: true }).finally(() => {
            bootstrapSettledRef.current = true;
          });
        })
        .catch(() => {
          fetchUnread({ force: true }).catch(() => {}).finally(() => {
            bootstrapSettledRef.current = true;
          });
        });
    } else {
      applyUnreadCount(0);
      bootstrapSettledRef.current = true;
    }
    wsClosedRef.current = false;
    setRealtimeActiveConnections('notifications', wsRef.current?.readyState === WebSocket.OPEN ? 1 : 0);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearBackgroundDisconnectTimer();
        wsPausedRef.current = false;
        wsRetryRef.current = 0; // fresh retry budget on foreground
        connectWs();
        if (bootstrapSettledRef.current && shouldRefreshUnread()) fetchUnread({ force: true }).catch(() => {});
        else startPing();
      } else {
        scheduleBackgroundDisconnect();
      }
    };

    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      clearBackgroundDisconnectTimer();
      wsPausedRef.current = false;
      wsRetryRef.current = 0; // fresh retry budget on focus
      connectWs();
      if (bootstrapSettledRef.current && shouldRefreshUnread()) fetchUnread({ force: true }).catch(() => {});
      else startPing();
    };

    if (document.visibilityState === 'visible') connectWs();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      wsClosedRef.current = true;
      setRealtimeActiveConnections('notifications', 0);
      clearBackgroundDisconnectTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      disconnectWs();
    };
  }, [applyUnreadCount, clearBackgroundDisconnectTimer, connectWs, disconnectWs, fetchUnread, scheduleBackgroundDisconnect, shouldRefreshUnread, startPing]);

  const setActiveChatId = useCallback((chatId) => {
    activeChatIdRef.current = chatId || null;
  }, []);

  const refresh = useCallback(() => fetchUnread({ force: true }), [fetchUnread]);

  const ctxValue = useMemo(() => ({ unreadCount, refresh, subscribe, setActiveChatId }), [unreadCount, refresh, subscribe, setActiveChatId]);

  return (
    <UnreadContext.Provider value={ctxValue}>
      {children}
      {/* Toast notification */}
      {toast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in"
          onClick={() => setToast(null)}
        >
          <div className="bg-mansion-card border border-mansion-gold/30 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3">
            {typeof toast === 'object' && toast.emoji ? (
              <div className="w-8 h-8 rounded-full bg-mansion-gold/20 flex items-center justify-center">
                <span className="text-lg">{toast.emoji}</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-mansion-crimson/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-mansion-crimson" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            )}
            <span className="text-sm font-medium text-text-primary">{typeof toast === 'object' ? toast.text : toast}</span>
          </div>
        </div>
      )}
    </UnreadContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadContext);
}
