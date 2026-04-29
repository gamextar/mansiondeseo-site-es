import { lazy, Suspense, useState, useEffect, useRef, createContext, useContext, useCallback, useMemo } from 'react';
import { endVideoCall, getUnreadCount, getToken, invalidateUnreadCache, joinVideoCall, peekUnreadCountCache, setUnreadCountCache } from '../lib/api';
import { recordRealtimeDebug, setRealtimeActiveConnections } from '../lib/realtimeDebug';
import { resolveWsBase } from '../lib/siteConfig';

const UnreadContext = createContext({
  unreadCount: 0,
  refresh: () => {},
  subscribe: () => () => {},
  setActiveChatId: () => {},
});

const WS_BASE = resolveWsBase();
const NOTIFICATION_BACKGROUND_GRACE_MS = Infinity; // never disconnect in background — DO hibernates anyway
const UNREAD_REFRESH_STALE_MS = 5 * 60_000; // 5 min — HTTP fallback if WS stale
const UNREAD_FETCH_DEBOUNCE_MS = 4_000;
const WS_MAX_RETRIES = 5; // backoff: 2,4,8,16,30 ≈ 60s then stop
const VideoCallModal = lazy(() => import('../components/VideoCallModal'));

function getGlobalVideoCallErrorMessage(error) {
  const code = error?.data?.code || '';
  if (code === 'VIDEO_CALL_ENDED') return 'La videollamada ya finalizó.';
  if (code === 'REALTIME_NOT_CONFIGURED') return 'La videollamada no está disponible temporalmente.';
  return error?.message || 'No se pudo procesar la videollamada.';
}

export function UnreadProvider({ children, initialUnread = null, bootstrapResolved = false }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null); // string or { text, icon }
  const [incomingVideoCall, setIncomingVideoCall] = useState(null);
  const [activeVideoCall, setActiveVideoCall] = useState(null);
  const [videoCallLoading, setVideoCallLoading] = useState(false);
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
  const lastSyncedActiveChatRef = useRef(undefined);

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

  const clearBackgroundDisconnectTimer = useCallback(() => {
    if (!wsBackgroundTimerRef.current) return;
    clearTimeout(wsBackgroundTimerRef.current);
    wsBackgroundTimerRef.current = null;
  }, []);

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
    if (!bootstrapResolved) return false;
    // Suppress if a fetch was recently initiated (e.g. bootstrap in-flight).
    if (lastUnreadFetchAtRef.current && Date.now() - lastUnreadFetchAtRef.current < UNREAD_FETCH_DEBOUNCE_MS) return false;
    if (prevCountRef.current < 0) return true;
    if (!lastUnreadFetchAtRef.current) return true;
    // If WebSocket is connected, skip HTTP fallback — WS handles real-time updates
    if (wsConnectedRef.current) return false;
    return Date.now() - lastUnreadFetchAtRef.current > UNREAD_REFRESH_STALE_MS;
  }, [bootstrapResolved]);

  // Notify all subscribers (e.g. ChatListPage) of a new event
  const notifyListeners = useCallback((event) => {
    listenersRef.current.forEach(cb => cb(event));
  }, []);

  const shouldKeepRealtimeConnected = useCallback(() => {
    return !!getToken();
  }, []);

  const syncActiveChatToNotifications = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const nextChatId = activeChatIdRef.current || null;
    const prevChatId = lastSyncedActiveChatRef.current;
    if (prevChatId === nextChatId) return;
    if (nextChatId == null && prevChatId == null) return;
    try {
      ws.send(JSON.stringify({
        type: 'active_chat',
        chatId: nextChatId,
      }));
      lastSyncedActiveChatRef.current = nextChatId;
    } catch {
      // ignore sync failures
    }
  }, []);

  // Connect notification WebSocket
  const disconnectWs = useCallback(() => {
    const ws = wsRef.current;
    clearBackgroundDisconnectTimer();
    if (!ws) return;
    ws.onclose = null;
    ws.onerror = null;
    try { ws.close(1000, 'client-pause'); } catch { /* already closed */ }
    wsRef.current = null;
    lastSyncedActiveChatRef.current = undefined;
    wsConnectedRef.current = false;
    setRealtimeActiveConnections('notifications', 0);
  }, [clearBackgroundDisconnectTimer]);

  const scheduleBackgroundDisconnect = useCallback(() => {
    // No-op: keep WS alive in background. The DO hibernates anyway,
    // so an idle WebSocket costs nothing. Disconnecting only causes
    // expensive reconnect cycles when the tab regains focus.
  }, []);

  const connectWs = useCallback(() => {
    const token = getToken();
    if (!token || wsClosedRef.current || wsPausedRef.current || !bootstrapResolved || !shouldKeepRealtimeConnected()) return;
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
        lastSyncedActiveChatRef.current = undefined;
        recordRealtimeDebug('notifications', 'opens');
        setRealtimeActiveConnections('notifications', 1);
        syncActiveChatToNotifications();
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
                data.unreadCount,
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
            // Always keep sessionStorage conversation list in sync so ChatListPage
            // shows fresh data when it remounts (especially on mobile where it
            // unmounts when the user navigates to a chat).
            if (data.conversation?.profileId) {
              try {
                const CONV_KEY = 'mansion_conversations';
                const raw = sessionStorage.getItem(CONV_KEY);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  const convs = Array.isArray(parsed?.conversations) ? parsed.conversations : (Array.isArray(parsed) ? parsed : []);
                  const pid = String(data.conversation.profileId);
                  const existing = convs.find(c => String(c.profileId) === pid);
                  const unreadDelta = Number(data.conversationUnreadDelta || 0);
                  const nextUnread = typeof data.conversation.unread === 'number'
                    ? data.conversation.unread
                    : Math.max(0, Number(existing?.unread || 0) + (isActiveChat ? 0 : unreadDelta));
                  const updated = existing
                    ? { ...existing, ...data.conversation, unread: nextUnread }
                    : { unread: nextUnread, ...data.conversation };
                  const next = [updated, ...convs.filter(c => String(c.profileId) !== pid)];
                  sessionStorage.setItem(CONV_KEY, JSON.stringify({
                    conversations: next,
                    timestamp: Date.now(),
                  }));
                }
              } catch { /* ignore */ }
            }
            notifyListeners(data);
          } else if (data.type === 'unread_count') {
            invalidateUnreadCache();
            if (typeof data.unreadCount === 'number') {
              applyUnreadCount(data.unreadCount);
            } else {
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
          } else if (data.type === 'video_call') {
            const isActiveChat = !!activeChatIdRef.current && data.chatId === activeChatIdRef.current;
            if (data.event === 'invite' && !isActiveChat) {
              setIncomingVideoCall({
                ...(data.call || {}),
                partnerName: data.call?.initiatorName || 'Videollamada',
              });
              setToast(null);
            } else if (data.event === 'accepted') {
              const callId = String(data.call?.id || '');
              setIncomingVideoCall((current) => (String(current?.id || '') === callId ? null : current));
            } else if (data.event === 'ended') {
              const callId = String(data.call?.id || '');
              setIncomingVideoCall((current) => (String(current?.id || '') === callId ? null : current));
              setActiveVideoCall((current) => (String(current?.id || '') === callId ? null : current));
            }
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
  }, [applyUnreadCount, bootstrapResolved, fetchUnread, notifyListeners, shouldKeepRealtimeConnected, syncActiveChatToNotifications]);

  // Subscribe to real-time notification events. Returns unsubscribe function.
  const subscribe = useCallback((callback) => {
    listenersRef.current.add(callback);
    if (document.visibilityState === 'visible' && bootstrapResolved) {
      connectWs();
    }
    return () => {
      listenersRef.current.delete(callback);
      if (!shouldKeepRealtimeConnected()) {
        disconnectWs();
      }
    };
  }, [bootstrapResolved, connectWs, disconnectWs, shouldKeepRealtimeConnected]);

  // Hydrate unread count from app bootstrap/cache without duplicating bootstrap.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      applyUnreadCount(0);
      return;
    }

    if (!bootstrapResolved) return;

    if (typeof initialUnread === 'number') {
      lastUnreadFetchAtRef.current = Date.now();
      applyUnreadCount(initialUnread);
      return;
    }

    const cachedUnread = peekUnreadCountCache(60 * 60_000);
    if (typeof cachedUnread?.unread === 'number') {
      lastUnreadFetchAtRef.current = Date.now();
      applyUnreadCount(cachedUnread.unread);
      return;
    }

    if (prevCountRef.current < 0) {
      fetchUnread({ force: false }).catch(() => {});
    }
  }, [applyUnreadCount, bootstrapResolved, fetchUnread, initialUnread]);

  // Focus/visibility lifecycle for unread fallback + optional realtime socket.
  useEffect(() => {
    wsClosedRef.current = false;
    setRealtimeActiveConnections('notifications', wsRef.current?.readyState === WebSocket.OPEN ? 1 : 0);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearBackgroundDisconnectTimer();
        wsPausedRef.current = false;
        wsRetryRef.current = 0; // fresh retry budget on foreground
        if (shouldKeepRealtimeConnected()) connectWs();
        if (shouldRefreshUnread()) fetchUnread({ force: true }).catch(() => {});
      } else {
        scheduleBackgroundDisconnect();
      }
    };

    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      clearBackgroundDisconnectTimer();
      wsPausedRef.current = false;
      wsRetryRef.current = 0; // fresh retry budget on focus
      if (shouldKeepRealtimeConnected()) connectWs();
      if (shouldRefreshUnread()) fetchUnread({ force: true }).catch(() => {});
    };

    const onPageHide = () => {
      wsClosedRef.current = true;
      wsPausedRef.current = true;
      disconnectWs();
    };

    if (document.visibilityState === 'visible' && shouldKeepRealtimeConnected()) connectWs();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      wsClosedRef.current = true;
      setRealtimeActiveConnections('notifications', 0);
      clearBackgroundDisconnectTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onPageHide);
      disconnectWs();
    };
  }, [applyUnreadCount, clearBackgroundDisconnectTimer, connectWs, disconnectWs, fetchUnread, scheduleBackgroundDisconnect, shouldRefreshUnread]);

  const setActiveChatId = useCallback((chatId) => {
    activeChatIdRef.current = chatId || null;
    syncActiveChatToNotifications();
    if (document.visibilityState === 'visible' && shouldKeepRealtimeConnected()) {
      connectWs();
    }
  }, [connectWs, shouldKeepRealtimeConnected, syncActiveChatToNotifications]);

  // Immediately subtract `amount` from the global badge (optimistic).
  const decrementUnread = useCallback((amount) => {
    const delta = Math.max(0, Number(amount) || 0);
    if (delta === 0) return;
    const next = Math.max(0, prevCountRef.current - delta);
    applyUnreadCount(next);
  }, [applyUnreadCount]);

  const refresh = useCallback(() => fetchUnread({ force: true }), [fetchUnread]);

  const handleAcceptVideoCall = useCallback(async () => {
    const call = incomingVideoCall;
    if (!call?.id || videoCallLoading) return;

    setVideoCallLoading(true);
    try {
      const data = await joinVideoCall(call.id);
      setActiveVideoCall({
        ...(data.call || call),
        authToken: data.token,
        partnerName: call.partnerName || data.call?.initiatorName || 'Videollamada',
        direction: 'incoming',
      });
      setIncomingVideoCall(null);
      setToast(null);
    } catch (err) {
      setIncomingVideoCall(null);
      setToast({ text: getGlobalVideoCallErrorMessage(err) });
      setTimeout(() => setToast(null), 4500);
    } finally {
      setVideoCallLoading(false);
    }
  }, [incomingVideoCall, videoCallLoading]);

  const handleRejectVideoCall = useCallback(async () => {
    const callId = incomingVideoCall?.id;
    setIncomingVideoCall(null);
    if (!callId) return;
    try {
      await endVideoCall(callId);
    } catch {
      // Best-effort signalling cleanup.
    }
  }, [incomingVideoCall]);

  const handleCloseVideoCall = useCallback(async () => {
    const callId = activeVideoCall?.id;
    setActiveVideoCall(null);
    if (!callId) return;
    try {
      await endVideoCall(callId);
    } catch {
      // The local RealtimeKit leave already happened; backend cleanup is best-effort.
    }
  }, [activeVideoCall]);

  const handleVideoCallModalError = useCallback((err) => {
    setToast({ text: getGlobalVideoCallErrorMessage(err) });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const ctxValue = useMemo(() => ({ unreadCount, refresh, subscribe, setActiveChatId, decrementUnread }), [unreadCount, refresh, subscribe, setActiveChatId, decrementUnread]);

  return (
    <UnreadContext.Provider value={ctxValue}>
      {children}
      {incomingVideoCall && !activeVideoCall && (
        <div className="fixed inset-x-3 bottom-24 z-[10010] mx-auto max-w-md animate-fade-in lg:bottom-8">
          <div className="rounded-2xl border border-mansion-gold/25 bg-mansion-card/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mansion-gold/15 text-mansion-gold ring-2 ring-mansion-gold/25">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {incomingVideoCall.partnerName || 'Videollamada'}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">Videollamada entrante</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRejectVideoCall}
                className="rounded-xl border border-mansion-border/35 bg-mansion-elevated px-3 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={handleAcceptVideoCall}
                disabled={videoCallLoading}
                className="rounded-xl bg-mansion-gold px-3 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-mansion-gold-light disabled:opacity-70"
              >
                {videoCallLoading ? 'Conectando...' : 'Atender'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Suspense fallback={null}>
        {activeVideoCall && (
          <VideoCallModal
            call={activeVideoCall}
            partnerName={activeVideoCall.partnerName || 'Videollamada'}
            onClose={handleCloseVideoCall}
            onError={handleVideoCallModalError}
          />
        )}
      </Suspense>
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
