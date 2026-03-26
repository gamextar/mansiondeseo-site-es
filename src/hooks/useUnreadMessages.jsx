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

export function UnreadProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const prevCountRef = useRef(-1); // -1 = not yet loaded
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);
  const wsRetryRef = useRef(0);
  const wsClosedRef = useRef(false);
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

  const fetchUnread = useCallback(() => {
    const token = getToken();
    if (!token) {
      prevCountRef.current = 0;
      setUnreadCount(0);
      return;
    }
    getUnreadCount()
      .then((data) => {
        applyUnreadCount(data.unread || 0, { showToast: true });
      })
      .catch(() => {});
  }, [applyUnreadCount]);

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
  const connectWs = useCallback(() => {
    const token = getToken();
    if (!token || wsClosedRef.current) return;

    const url = `${WS_BASE}/api/notifications/ws?token=${encodeURIComponent(token)}`;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        wsRetryRef.current = 0;
        // Keep-alive ping every 25s
        ws._pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25_000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            const isActiveChat = !!activeChatIdRef.current && data.chatId === activeChatIdRef.current;
            if (typeof data.unreadCount === 'number') {
              applyUnreadCount(
                isActiveChat ? Math.max(0, data.unreadCount - 1) : data.unreadCount,
                { showToast: !isActiveChat }
              );
            } else if (!isActiveChat) {
              fetchUnread();
            }
            notifyListeners(data);
          } else if (data.type === 'conversation_deleted') {
            if (typeof data.unreadCount === 'number') {
              applyUnreadCount(data.unreadCount);
            } else {
              fetchUnread();
            }
            notifyListeners(data);
          } else if (data.type === 'typing') {
            notifyListeners(data);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        clearInterval(ws._pingTimer);
        if (!wsClosedRef.current) {
          const delay = Math.min(1000 * Math.pow(2, wsRetryRef.current), 30_000);
          wsRetryRef.current++;
          setTimeout(connectWs, delay);
        }
      };

      ws.onerror = () => { /* onclose will fire */ };
    } catch {
      const delay = Math.min(1000 * Math.pow(2, wsRetryRef.current), 30_000);
      wsRetryRef.current++;
      setTimeout(connectWs, delay);
    }
  }, [fetchUnread, notifyListeners]);

  // Initial fetch + WebSocket (no polling — real-time only)
  useEffect(() => {
    fetchUnread();
    wsClosedRef.current = false;
    connectWs();
    return () => {
      wsClosedRef.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [fetchUnread, connectWs]);

  // Also refetch on window focus
  useEffect(() => {
    const onFocus = () => fetchUnread();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchUnread]);

  const setActiveChatId = useCallback((chatId) => {
    activeChatIdRef.current = chatId || null;
  }, []);

  return (
    <UnreadContext.Provider value={{ unreadCount, refresh: fetchUnread, subscribe, setActiveChatId }}>
      {children}
      {/* Toast notification */}
      {toast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in"
          onClick={() => setToast(null)}
        >
          <div className="bg-mansion-card border border-mansion-gold/30 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-mansion-crimson/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-mansion-crimson" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-text-primary">{toast}</span>
          </div>
        </div>
      )}
    </UnreadContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadContext);
}
