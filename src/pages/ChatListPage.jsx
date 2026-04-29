import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Trash2 } from 'lucide-react';
import { deleteConversation, getConversations, getToken, getStoredUser, invalidateConversationsCache } from '../lib/api';
import { getBottomNavPagePadding } from '../lib/bottomNavConfig';
import AvatarImg from '../components/AvatarImg';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { subscribeLocalConversationUpdates } from '../lib/localConversationEvents';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  // D1 stores UTC without Z suffix — append it so JS parses as UTC
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const diffMs = now - date;
  if (diffMs < 0) return 'ahora';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  const diffW = Math.floor(diffD / 7);
  return `${diffW}sem`;
}

const CONV_CACHE_KEY = 'mansion_conversations';
const CONV_CACHE_TTL_MS = 2 * 60_000;

function getCachedConversations() {
  try {
    const raw = sessionStorage.getItem(CONV_CACHE_KEY);
    if (!raw) return { conversations: [], timestamp: 0 };

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { conversations: parsed, timestamp: 0 };
    }

    return {
      conversations: Array.isArray(parsed?.conversations) ? parsed.conversations : [],
      timestamp: Number(parsed?.timestamp) || 0,
    };
  } catch { return { conversations: [], timestamp: 0 }; }
}

function setCachedConversations(convs) {
  try {
    sessionStorage.setItem(CONV_CACHE_KEY, JSON.stringify({
      conversations: convs,
      timestamp: Date.now(),
    }));
  } catch {}
}

function isConversationCacheFresh(timestamp) {
  return timestamp > 0 && Date.now() - timestamp < CONV_CACHE_TTL_MS;
}

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

function getGridColumns() {
  if (typeof window === 'undefined') return 2;
  const w = window.innerWidth;
  if (w >= 1536) return 6;
  if (w >= 1280) return 5;
  if (w >= 1024) return 4;
  if (w >= 768) return 3;
  return 2;
}

function useGridColumns() {
  const [cols, setCols] = useState(getGridColumns);
  useEffect(() => {
    const handler = () => setCols(getGridColumns());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return cols;
}

function ConversationRow({ conv, typing, onDelete, onRead, deleting, active = false, compact = false, onSelect }) {
  const navigate = useNavigate();
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const isDraggingRef = useRef(false);

  const closeActions = useCallback(() => {
    setDragX(0);
    setRevealed(false);
  }, []);

  const openActions = useCallback(() => {
    setDragX(-88);
    setRevealed(true);
  }, []);

  const handleNavigate = useCallback(() => {
    if (isDraggingRef.current || deleting) return;
    if (conv.unread > 0) onRead?.(conv.profileId, conv.unread);
    const partnerPreview = {
      id: conv.profileId,
      name: conv.name,
      avatar_url: conv.avatar,
      avatar_crop: conv.avatarCrop,
      photos: [],
      online: conv.online,
    };
    if (onSelect) {
      onSelect(conv, { partnerPreview });
      return;
    }
    navigate(`/mensajes/${conv.profileId}`, {
      state: {
        from: '/mensajes',
        partnerPreview,
      },
    });
  }, [conv, deleting, navigate, onRead, onSelect]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-colors ${
        active
          ? 'border-mansion-gold/35 bg-mansion-card/75'
          : 'border-transparent bg-mansion-base'
      }`}
    >
      <div className="absolute inset-y-0 right-0 z-0 flex items-center gap-2 pr-3">
        <button
          type="button"
          onClick={() => {
            if (confirm(`¿Borrar la conversación con ${conv.name}?`)) {
              onDelete(conv);
            } else {
              closeActions();
            }
          }}
          disabled={deleting}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-mansion-crimson text-white shadow-lg disabled:opacity-60"
          aria-label={`Borrar conversación con ${conv.name}`}
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <motion.div
        drag={compact ? false : 'x'}
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.04}
        dragMomentum={false}
        animate={{ x: dragX }}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={(_, info) => {
          const shouldOpen = info.offset.x < -48 || info.velocity.x < -250;
          if (shouldOpen) openActions();
          else closeActions();
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 0);
        }}
        className="touch-pan-y relative z-10 rounded-xl bg-mansion-base"
      >
        <button
          type="button"
          onClick={handleNavigate}
          className={`w-full text-left flex items-center gap-3.5 px-3 py-4 rounded-xl transition-all group ${
            active ? 'bg-mansion-card/70' : 'bg-mansion-base hover:bg-mansion-card/50'
          } ${compact ? 'lg:gap-3 lg:px-3 lg:py-3.5' : 'lg:gap-4 lg:px-4 lg:py-5'}`}
        >
          <div className="relative flex-shrink-0">
            <div className={`w-[60px] h-[60px] rounded-full overflow-hidden ${
              compact ? 'lg:w-[56px] lg:h-[56px]' : 'lg:w-[72px] lg:h-[72px]'
            } ${
              conv.unread > 0 ? 'ring-2 ring-mansion-gold/50' : ''
            }`}>
              <AvatarImg
                src={conv.avatar}
                crop={conv.avatarCrop}
                alt={conv.name}
                className="w-full h-full"
              />
            </div>
            {conv.online && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-mansion-base" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className={`font-medium text-[15px] truncate ${compact ? 'lg:text-[15px]' : 'lg:text-[18px]'} ${
                conv.unread > 0 ? 'text-text-primary' : 'text-text-muted'
              }`}>
                {conv.name}
              </h3>
              <span className={`text-xs flex-shrink-0 ml-2 ${compact ? 'lg:text-xs' : 'lg:text-sm'} ${
                conv.unread > 0 ? 'text-mansion-gold' : 'text-text-dim'
              }`}>
                {timeAgo(conv.timestamp)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className={`text-[13px] truncate pr-2 ${compact ? 'lg:text-[13px]' : 'lg:text-[15px]'} ${
                typing
                  ? 'text-mansion-gold italic'
                  : conv.unread > 0 ? 'text-text-primary font-medium' : 'text-text-dim'
              }`}>
                {typing ? 'escribiendo...' : conv.lastMessage}
              </p>
              {conv.unread > 0 && (
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mansion-crimson text-white text-[10px] font-bold flex items-center justify-center lg:w-6 lg:h-6 lg:text-xs">
                  {conv.unread}
                </span>
              )}
            </div>
          </div>
        </button>
      </motion.div>
    </div>
  );
}

export function ChatConversationsPanel({ embedded = false, activeProfileId = '', onSelect }) {
  const cachedState = getCachedConversations();
  const [conversations, setConversations] = useState(cachedState.conversations);
  const [loading, setLoading] = useState(cachedState.conversations.length === 0);
  const [deletingId, setDeletingId] = useState(null);
  const [typingChats, setTypingChats] = useState({});
  const [query, setQuery] = useState('');
  const typingTimersRef = useRef({});
  const lastSyncAtRef = useRef(cachedState.timestamp || 0);
  const navigate = useNavigate();
  const { refresh: refreshUnread, subscribe, decrementUnread } = useUnreadMessages();

  // Optimistically mark a conversation as read in local state + cache + global badge
  const markConversationRead = useCallback((profileId, unreadHint = 0) => {
    const pid = String(profileId);
    const currentUnread = Number(conversations.find(c => String(c.profileId) === pid)?.unread || unreadHint || 0);
    setConversations((prev) => {
      const idx = prev.findIndex(c => String(c.profileId) === pid);
      if (idx === -1 || prev[idx].unread === 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], unread: 0 };
      setCachedConversations(updated);
      return updated;
    });
    // Decrement global sidebar/bottomnav badge outside the state updater
    // so it's never skipped by React batching.
    if (currentUnread > 0) decrementUnread(currentUnread);
    // Invalidate API-level conversation cache so next fetch gets fresh data
    invalidateConversationsCache();
  }, [conversations, decrementUnread]);

  const applyConversationUpdate = useCallback((event) => {
    const conversation = event?.conversation;
    if (!conversation?.profileId) return false;
    const unreadDelta = Number(event?.conversationUnreadDelta || 0);

    setConversations((prev) => {
      const pid = String(conversation.profileId);
      const existing = prev.find((item) => String(item.profileId) === pid);
      const nextUnread = typeof conversation.unread === 'number'
        ? conversation.unread
        : Math.max(0, Number(existing?.unread || 0) + unreadDelta);
      const nextConversation = existing
        ? {
            ...existing,
            ...conversation,
            unread: nextUnread,
          }
        : {
            unread: nextUnread,
            ...conversation,
          };

      const next = [
        nextConversation,
        ...prev.filter((item) => String(item.profileId) !== String(nextConversation.profileId)),
      ];

      setCachedConversations(next);
      return next;
    });

    return true;
  }, []);

  const applyLocalConversationPreview = useCallback((event) => {
    const conversation = event?.conversation;
    if (!conversation?.profileId) return false;

    setConversations((prev) => {
      const nextConversation = {
        ...prev.find((item) => String(item.profileId) === String(conversation.profileId)),
        ...conversation,
        unread: 0,
      };
      const next = [
        nextConversation,
        ...prev.filter((item) => String(item.profileId) !== String(conversation.profileId)),
      ];
      setCachedConversations(next);
      return next;
    });

    return true;
  }, []);

  const fetchConversations = useCallback(() => {
    if (!getToken()) return;
    getConversations()
      .then(data => {
        const convs = data.conversations || [];
        setConversations(convs);
        setCachedConversations(convs);
        lastSyncAtRef.current = Date.now();
      })
      .catch((err) => {
        console.error('Conversations fetch error:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const removeConversation = useCallback((partnerId) => {
    const pid = String(partnerId);
    setConversations((prev) => {
      const next = prev.filter((item) => String(item.profileId) !== pid);
      setCachedConversations(next);
      return next;
    });
    setTypingChats((prev) => {
      if (!prev[partnerId]) return prev;
      const next = { ...prev };
      delete next[partnerId];
      return next;
    });
  }, []);

  const handleDeleteConversation = useCallback(async (conv) => {
    if (deletingId) return;
    setDeletingId(conv.id);
    removeConversation(conv.profileId);
    try {
      const data = await deleteConversation(conv.profileId);
      if (typeof data?.unreadCount === 'number') {
        refreshUnread();
      }
    } catch (err) {
      fetchConversations();
      alert(err.message || 'No se pudo borrar la conversación');
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, fetchConversations, refreshUnread, removeConversation]);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }

    // Re-read cache at mount time so stale component-level initial state is replaced
    const freshCache = getCachedConversations();
    if (freshCache.conversations.length > 0) {
      setConversations(freshCache.conversations);
    }
    lastSyncAtRef.current = freshCache.timestamp || 0;

    const hasFreshCache = isConversationCacheFresh(freshCache.timestamp);
    const hasCachedConversations = freshCache.conversations.length > 0;

    setLoading(!hasCachedConversations);

    if (hasFreshCache) {
      setLoading(false);
    } else {
      fetchConversations();
      if (hasCachedConversations) {
        setLoading(false);
      }
    }

    // Refresh when tab/window gets focus (e.g. returning from another app)
    const onFocus = () => {
      if (isConversationCacheFresh(lastSyncAtRef.current)) return;
      fetchConversations();
    };
    window.addEventListener('focus', onFocus);

    // Real-time: refresh when a new message arrives via notification WebSocket
    const myId = getStoredUser()?.id;
    const unsubscribe = subscribe((event) => {
      if (event?.type === 'new_message') {
        const updated = applyConversationUpdate(event);
        if (!updated) fetchConversations();
      } else if (event?.type === 'conversation_deleted' && event.partnerId) {
        removeConversation(event.partnerId);
      } else if (event?.type === 'typing' && event.chatId && myId) {
        // Derive partnerId from chatId: "uuid1-uuid2" sorted, each 36 chars
        const id1 = event.chatId.slice(0, 36);
        const id2 = event.chatId.slice(37);
        const partnerId = id1 !== String(myId) ? id1 : id2;
        // Show typing indicator for this conversation
        setTypingChats(prev => ({ ...prev, [partnerId]: true }));
        clearTimeout(typingTimersRef.current[partnerId]);
        typingTimersRef.current[partnerId] = setTimeout(() => {
          setTypingChats(prev => {
            const next = { ...prev };
            delete next[partnerId];
            return next;
          });
        }, 3000);
      }
    });

    const unsubscribeLocal = subscribeLocalConversationUpdates((event) => {
      if (event?.type === 'conversation_preview') {
        applyLocalConversationPreview(event);
      }
    });

    return () => {
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      unsubscribeLocal();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, fetchConversations, subscribe, applyConversationUpdate, applyLocalConversationPreview]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleConversations = normalizedQuery
    ? conversations.filter((conv) => (
        String(conv.name || '').toLowerCase().includes(normalizedQuery) ||
        String(conv.lastMessage || '').toLowerCase().includes(normalizedQuery)
      ))
    : conversations;

  return (
    <>
      {/* Header */}
      <motion.div
        className={embedded
          ? 'w-full px-4 pt-4 pb-3'
          : 'w-full max-w-[88rem] mx-auto px-[5vw] lg:px-[4vw] pt-0 lg:pt-6 pb-3'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <h1 className={`font-display font-bold text-text-primary ${embedded ? 'mb-3 text-2xl' : 'mb-4 text-2xl lg:text-3xl lg:mb-5'}`}>
          Mensajes
        </h1>

        {/* Search bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim lg:left-4 lg:w-5 lg:h-5" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conversación..."
            className={`w-full pl-10 py-2.5 text-sm lg:pl-12 ${embedded ? 'lg:py-3 lg:text-sm' : 'lg:py-3.5 lg:text-base'}`}
          />
        </div>
      </motion.div>

      {/* Conversation list */}
      <motion.div
        className={embedded
          ? 'min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4 [scrollbar-gutter:stable]'
          : 'w-full max-w-[88rem] mx-auto space-y-2 px-[5vw] lg:px-[4vw]'}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <MessageCircle className="w-12 h-12 text-text-dim mx-auto mb-4" />
            <p className="text-text-muted text-lg mb-2">Sin mensajes aún</p>
            <p className="text-text-dim text-sm">Explora perfiles y envía tu primer mensaje</p>
          </motion.div>
        ) : visibleConversations.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-14">
            <MessageCircle className="w-10 h-10 text-text-dim mx-auto mb-4" />
            <p className="text-text-muted text-sm">No hay conversaciones con ese nombre</p>
          </motion.div>
        ) : (
        visibleConversations.map((conv) => (
          <ConversationRow
            key={conv.id}
            conv={conv}
            typing={!!typingChats[conv.profileId]}
            deleting={deletingId === conv.id}
            onDelete={handleDeleteConversation}
            onRead={markConversationRead}
            active={String(activeProfileId || '') === String(conv.profileId)}
            compact={embedded}
            onSelect={onSelect}
          />
        ))
        )}
      </motion.div>
    </>
  );
}

export default function ChatListPage() {
  const cols = useGridColumns();
  const isDesktopViewport = cols >= 4;
  const isStandaloneMobileApp = detectStandaloneMobile();
  const navBottomOffset = getBottomNavPagePadding(isStandaloneMobileApp);

  return (
    <div
      className="min-h-0 min-h-[100dvh] bg-mansion-base lg:min-h-screen lg:pt-0 lg:pb-[84px]"
      style={{
        paddingTop: 'calc(var(--safe-top) + 20px)',
        paddingBottom: isDesktopViewport ? undefined : navBottomOffset,
      }}
    >
      <ChatConversationsPanel />
    </div>
  );
}
