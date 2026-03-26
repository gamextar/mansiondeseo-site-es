import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MessageCircle } from 'lucide-react';
import { getConversations, getToken, getStoredUser } from '../lib/api';
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

export default function ChatListPage() {
  const cached = getCachedConversations();
  const [conversations, setConversations] = useState(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [typingChats, setTypingChats] = useState({});
  const typingTimersRef = useRef({});
  const navigate = useNavigate();
  const { refresh: refreshUnread, subscribe } = useUnreadMessages();

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
        fetchConversations();
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
  }, [navigate, fetchConversations, refreshUnread, subscribe]);
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
          <motion.div
            key={conv.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link
              to={`/mensajes/${conv.profileId}`}
              className="flex items-center gap-3.5 px-3 py-4 rounded-xl hover:bg-mansion-card/50 transition-all group"
            >
              {/* Avatar */}
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

              {/* Content */}
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
                    typingChats[conv.profileId] 
                      ? 'text-mansion-gold italic' 
                      : conv.unread > 0 ? 'text-text-primary font-medium' : 'text-text-dim'
                  }`}>
                    {typingChats[conv.profileId] ? 'escribiendo...' : conv.lastMessage}
                  </p>
                  {conv.unread > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mansion-crimson text-white text-[10px] font-bold flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))
        )}
      </div>
    </div>
  );
}
