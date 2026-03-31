import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { getUnreadCount, getToken } from '../lib/api';

const UnreadContext = createContext({
  unreadCount: 0,
  refresh: () => {},
  subscribe: () => () => {},
  setActiveChatId: () => {},
});

const WS_BASE = import.meta.env.PROD
  ? 'wss://mansion-deseo-api-production.green-silence-8594.workers.dev'
  : `ws://${window.location.hostname}:8787`;
const NOTIFICATION_PING_MS = 55_000;
const UNREAD_REFRESH_STALE_MS = 60_000;
const UNREAD_FETCH_DEBOUNCE_MS = 4_000;

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
  const unreadFetchRef = useRef(null);
  const lastUnreadFetchAtRef = useRef(0);
  const activeChatIdRef = useRef(null);

  const applyUnreadCount = useCallback((total, { showToast = false } = {}) => {
    const nextTotal = Math.max(0, Number(total) || 0);
    if (showToast && prevCountRef.current >= 0 && nextTotal > prevCountRef.current) {
      const diff = nextTotal - prevCountRef.current;
      setToast(`${diff} nuevo${diff > 1 ? 's' : ''} mensaje${diff > 1 ? 's' : ''}`);
      setTimeout(() => setToast(null), 4000);
    }
    prevCountRef.current = nextTotal;
    setUnreadCount(nextTotal);
  }, []);

  const stopPing = useCallback((socket = wsRef.current) => {
    if (!socket?._pingTimer) return;
    clearInterval(socket._pingTimer);
    socket._pingTimer = null;
  }, []);

  const startPing = useCallback((socket = wsRef.current) => {
    if (!socket || document.visibilityState !== 'visible') return;
    stopPing(socket);
    socket._pingTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (socket.readyState === WebSocket.OPEN) {
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

    const now = Date.now();
    if (unreadFetchRef.current) return unreadFetchRef.current;
    if (!force && lastUnreadFetchAtRef.current && now - lastUnreadFetchAtRef.current < UNREAD_FETCH_DEBOUNCE_MS) {
      return Promise.resolve({ unread: prevCountRef.current });
    }

    lastUnreadFetchAtRef.current = now;
    const request = getUnreadCount()
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
    if (!wsConnectedRef.current) return true;
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
    if (!ws) return;
    stopPing(ws);
    ws.onclose = null;
    ws.close();
    wsRef.current = null;
    wsConnectedRef.current = false;
  }, [stopPing]);

  const connectWs = useCallback(() => {
    const token = getToken();
    if (!token || wsClosedRef.current || wsPausedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = `${WS_BASE}/api/notifications/ws?token=${encodeURIComponent(token)}`;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        wsRetryRef.current = 0;
        wsConnectedRef.current = true;
        startPing(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected' || data.type === 'pong') {
            wsConnectedRef.current = true;
            return;
          }
          if (data.type === 'new_message') {
            const isActiveChat = !!activeChatIdRef.current && data.chatId === activeChatIdRef.current;
            if (typeof data.unreadCount === 'number') {
              applyUnreadCount(
                isActiveChat ? Math.max(0, data.unreadCount - 1) : data.unreadCount,
                { showToast: !isActiveChat }
              );
            } else if (!isActiveChat) {
              fetchUnread({ force: true }).catch(() => {});
            }
            notifyListeners(data);
          } else if (data.type === 'conversation_deleted') {
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
        if (!wsClosedRef.current && !wsPausedRef.current) {
          const delay = Math.min(1000 * Math.pow(2, wsRetryRef.current), 30_000);
          wsRetryRef.current++;
          setTimeout(connectWs, delay);
        }
      };

      ws.onerror = () => { /* onclose will fire */ };
    } catch {
      wsConnectedRef.current = false;
      const delay = Math.min(1000 * Math.pow(2, wsRetryRef.current), 30_000);
      wsRetryRef.current++;
      setTimeout(connectWs, delay);
    }
  }, [applyUnreadCount, fetchUnread, notifyListeners, startPing, stopPing]);

  // Initial fetch + WebSocket (no polling — real-time only)
  useEffect(() => {
    fetchUnread({ force: true }).catch(() => {});
    wsClosedRef.current = false;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        wsPausedRef.current = false;
        connectWs();
        if (shouldRefreshUnread()) fetchUnread({ force: true }).catch(() => {});
        else startPing();
      } else {
        wsPausedRef.current = true;
        disconnectWs();
      }
    };

    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      wsPausedRef.current = false;
      connectWs();
      if (shouldRefreshUnread()) fetchUnread({ force: true }).catch(() => {});
      else startPing();
    };

    if (document.visibilityState === 'visible') connectWs();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      wsClosedRef.current = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      disconnectWs();
    };
  }, [connectWs, disconnectWs, fetchUnread, shouldRefreshUnread, startPing]);

  const setActiveChatId = useCallback((chatId) => {
    activeChatIdRef.current = chatId || null;
  }, []);

  return (
    <UnreadContext.Provider value={{ unreadCount, refresh: () => fetchUnread({ force: true }), subscribe, setActiveChatId }}>
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
