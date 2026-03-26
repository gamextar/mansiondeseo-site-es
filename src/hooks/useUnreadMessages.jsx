import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { getUnreadCount, getToken } from '../lib/api';

const UnreadContext = createContext({ unreadCount: 0, refresh: () => {} });

const POLL_INTERVAL = 30_000; // 30 seconds

export function UnreadProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const prevCountRef = useRef(-1); // -1 = not yet loaded
  const timerRef = useRef(null);

  const fetchUnread = useCallback(() => {
    const token = getToken();
    if (!token) {
      setUnreadCount(0);
      return;
    }
    getUnreadCount()
      .then((data) => {
        const total = data.unread || 0;
        // Show toast if count increased (skip first load)
        if (prevCountRef.current >= 0 && total > prevCountRef.current) {
          const diff = total - prevCountRef.current;
          setToast(`${diff} nuevo${diff > 1 ? 's' : ''} mensaje${diff > 1 ? 's' : ''}`);
          setTimeout(() => setToast(null), 4000);
        }
        prevCountRef.current = total;
        setUnreadCount(total);
      })
      .catch(() => {});
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchUnread();
    timerRef.current = setInterval(fetchUnread, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchUnread]);

  // Also refetch on window focus
  useEffect(() => {
    const onFocus = () => fetchUnread();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchUnread]);

  return (
    <UnreadContext.Provider value={{ unreadCount, refresh: fetchUnread }}>
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
