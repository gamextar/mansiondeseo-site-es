import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Trash2 } from 'lucide-react';
import { deleteConversation, getConversations, getToken, getStoredUser } from '../lib/api';
import AvatarImg from '../components/AvatarImg';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

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

function getCachedConversations() {
  try {
    const raw = sessionStorage.getItem(CONV_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setCachedConversations(convs) {
  try { sessionStorage.setItem(CONV_CACHE_KEY, JSON.stringify(convs)); } catch {}
}

function ConversationRow({ conv, index, typing, onDelete, deleting }) {
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
    navigate(`/mensajes/${conv.profileId}`, {
      state: {
        partnerPreview: {
          id: conv.profileId,
          name: conv.name,
          avatar_url: conv.avatar,
          avatar_crop: conv.avatarCrop,
          photos: conv.avatar ? [conv.avatar] : [],
          online: conv.online,
        },
      },
    });
  }, [conv, deleting, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative overflow-hidden rounded-xl bg-mansion-base"
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
        drag="x"
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
          className="w-full text-left flex items-center gap-3.5 px-3 py-4 rounded-xl bg-mansion-base hover:bg-mansion-card/50 transition-all group"
        >
          <div className="relative flex-shrink-0">
            <div className={`w-[60px] h-[60px] rounded-full overflow-hidden ${
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
              <h3 className={`font-medium text-[15px] truncate ${
                conv.unread > 0 ? 'text-text-primary' : 'text-text-muted'
              }`}>
                {conv.name}
              </h3>
              <span className={`text-xs flex-shrink-0 ml-2 ${
                conv.unread > 0 ? 'text-mansion-gold' : 'text-text-dim'
              }`}>
                {timeAgo(conv.timestamp)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className={`text-[13px] truncate pr-2 ${
                typing
                  ? 'text-mansion-gold italic'
                  : conv.unread > 0 ? 'text-text-primary font-medium' : 'text-text-dim'
              }`}>
                {typing ? 'escribiendo...' : conv.lastMessage}
              </p>
              {conv.unread > 0 && (
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mansion-crimson text-white text-[10px] font-bold flex items-center justify-center">
                  {conv.unread}
                </span>
              )}
            </div>
          </div>
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function ChatListPage() {
  const cached = getCachedConversations();
  const [conversations, setConversations] = useState(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [deletingId, setDeletingId] = useState(null);
  const [typingChats, setTypingChats] = useState({});
  const typingTimersRef = useRef({});
  const navigate = useNavigate();
  const { refresh: refreshUnread, subscribe } = useUnreadMessages();

  const applyConversationUpdate = useCallback((event) => {
    const conversation = event?.conversation;
    if (!conversation?.profileId) return false;

    setConversations((prev) => {
      const existing = prev.find((item) => item.profileId === conversation.profileId);
      const nextConversation = existing
        ? {
            ...existing,
            ...conversation,
            unread: typeof conversation.unread === 'number' ? conversation.unread : existing.unread,
          }
        : {
            unread: 0,
            ...conversation,
          };

      const next = [
        nextConversation,
        ...prev.filter((item) => item.profileId !== nextConversation.profileId),
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
      })
      .catch((err) => {
        console.error('Conversations fetch error:', err);
      });
  }, []);

  const removeConversation = useCallback((partnerId) => {
    setConversations((prev) => {
      const next = prev.filter((item) => item.profileId !== partnerId);
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
    if (!cached.length) setLoading(true);
    getConversations()
      .then(data => {
        const convs = data.conversations || [];
        setConversations(convs);
        setCachedConversations(convs);
      })
      .catch((err) => {
        console.error('Initial conversations fetch error:', err);
      })
      .finally(() => setLoading(false));

    // Refresh when tab/window gets focus (e.g. returning from another app)
    const onFocus = () => { fetchConversations(); refreshUnread(); };
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

    return () => {
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, [navigate, fetchConversations, refreshUnread, subscribe, applyConversationUpdate]);
  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      {/* Header */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 pb-3">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-4">Mensajes</h1>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
          <input
            type="text"
            placeholder="Buscar conversación..."
            className="w-full pl-10 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="px-2 lg:px-6 lg:max-w-3xl">
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
        ) : (
        conversations.map((conv, index) => (
          <ConversationRow
            key={conv.id}
            conv={conv}
            index={index}
            typing={!!typingChats[conv.profileId]}
            deleting={deletingId === conv.id}
            onDelete={handleDeleteConversation}
          />
        ))
        )}
      </div>
    </div>
  );
}
