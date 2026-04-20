import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Lock, ImageIcon, Smile } from 'lucide-react';
import { useMessageLimit } from '../hooks/useMessageLimit';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import DesktopSidebar from '../components/DesktopSidebar';
import EmojiPicker from '../components/EmojiPicker';
import AvatarImg from '../components/AvatarImg';
import { getMessageLimit, getChatBootstrap, getToken, getStoredUser, getMessages as apiGetMessages, sendMessage as apiSendMessage, invalidateConversationsCache } from '../lib/api';
import { createChatSocket } from '../lib/chatSocket';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPrimaryProfileCrop, getPrimaryProfilePhoto } from '../lib/profileMedia';
import { publishLocalConversationUpdate } from '../lib/localConversationEvents';
import { recordD1WriteEstimate } from '../lib/d1Debug';

const CHAT_CACHE_PREFIX = 'mansion_chat_';
const CHAT_CACHE_TTL_MS = 10 * 60_000;
const CHAT_CACHE_MESSAGE_LIMIT = 60;
const INITIAL_CHAT_PAGE_SIZE = 30;
const OLDER_CHAT_PAGE_SIZE = 30;

function getChatCacheKey(partnerId) {
  return `${CHAT_CACHE_PREFIX}${partnerId}`;
}

function normalizeMessages(messages = []) {
  return messages.map((message) => ({
    ...message,
    createdAt: message.createdAt || message.created_at || null,
  }));
}

function readChatCache(partnerId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(getChatCacheKey(partnerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt) return null;
    // Use cache as placeholder even if slightly stale — WS history will replace it.
    // Only discard if very old (>30 min) to avoid showing wildly outdated data.
    if (Date.now() - parsed.cachedAt > 30 * 60_000) {
      sessionStorage.removeItem(getChatCacheKey(partnerId));
      return null;
    }
    return {
      ...parsed,
      messages: normalizeMessages(parsed.messages || []),
      isStale: Date.now() - parsed.cachedAt > CHAT_CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeChatCache(partnerId, payload) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(getChatCacheKey(partnerId), JSON.stringify({
      ...payload,
      messages: normalizeMessages(payload.messages || []).slice(-CHAT_CACHE_MESSAGE_LIMIT),
      cachedAt: Date.now(),
    }));
  } catch {
    // Silently fail
  }
}

function updateConversationPreviewCache(partnerId, partner, message) {
  if (typeof window === 'undefined' || !partnerId || !message?.text) return;

  try {
    const raw = sessionStorage.getItem('mansion_conversations');
    const parsed = raw ? JSON.parse(raw) : { conversations: [], timestamp: 0 };
    const conversations = Array.isArray(parsed?.conversations)
      ? parsed.conversations
      : (Array.isArray(parsed) ? parsed : []);

    const nextConversation = {
      id: `conv-${partnerId}`,
      profileId: partnerId,
      name: partner?.username || partner?.name || '',
      avatar: partner?.avatar_url || partner?.avatar || '',
      avatarCrop: partner?.avatar_crop ?? partner?.avatarCrop ?? null,
      lastMessage: String(message.text || '').slice(0, 50),
      timestamp: message.createdAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
      unread: 0,
      online: Boolean(partner?.online),
    };

    const next = [
      nextConversation,
      ...conversations.filter((item) => String(item.profileId) !== String(partnerId)),
    ];

    sessionStorage.setItem('mansion_conversations', JSON.stringify({
      conversations: next,
      timestamp: Date.now(),
    }));

    publishLocalConversationUpdate({
      type: 'conversation_preview',
      conversation: nextConversation,
    });
  } catch {
    // ignore cache sync failures
  }
}

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { remaining, canSend, sendMessage: localSendMessage, max } = useMessageLimit();
  const { setActiveChatId, refresh: refreshUnread, decrementUnread } = useUnreadMessages();
  const partnerId = id.startsWith('conv-') ? id.replace('conv-', '') : id;
  const cachedChat = readChatCache(partnerId);
  const partnerPreview = location.state?.partnerPreview || null;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(cachedChat?.messages || []);
  const [apiLimit, setApiLimit] = useState(cachedChat?.apiLimit || null);
  const [partner, setPartner] = useState(cachedChat?.partner || partnerPreview || null);
  const [loading, setLoading] = useState(!cachedChat && !partnerPreview);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(cachedChat?.hasOlderMessages || false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : null));
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const incomingMessageTimersRef = useRef(new Map());
  const lastTypingSentRef = useRef(0);
  const typingActiveRef = useRef(false);
  const typingIdleTimerRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const myUserIdRef = useRef(null);
  const pendingScrollBehaviorRef = useRef(null);
  const pendingScrollForceRef = useRef(false);
  const restoreScrollAfterPrependRef = useRef(null);
  const initialHistoryLoadedRef = useRef(false);
  const historyFallbackTimerRef = useRef(null);
  const suppressTypingUntilRef = useRef(0);
  const [poppedMessageIds, setPoppedMessageIds] = useState(() => new Set());
  const partnerPhoto = getPrimaryProfilePhoto(partner);
  const partnerPhotoCrop = getPrimaryProfileCrop(partner);
  const backTarget = location.state?.from || '/mensajes';
  const desktopProfileOverlayState = partner ? {
    backgroundLocation: location,
    backgroundScrollY: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
    modal: 'profile',
    from: `${location.pathname}${location.search}${location.hash}`,
    returnState: location.state || null,
    preview: {
      id: partnerId,
      name: partner.name,
      age: partner.age,
      city: partner.city,
      province: partner.province,
      locality: partner.locality,
      role: partner.role,
      photos: partner.photos || [],
      avatar_url: partner.avatar_url,
      avatar_crop: partner.avatar_crop || null,
      online: partner.online,
      premium: partner.premium,
      blurred: partner.blurred,
      visiblePhotos: partner.visiblePhotos,
    },
  } : null;

  // Format DO message to UI format
  function formatMsg(msg) {
    const myId = myUserIdRef.current;
    return {
      id: msg.id,
      senderId: msg.sender_id === myId ? 'me' : 'them',
      text: msg.content,
      timestamp: msg.created_at
        ? new Date(msg.created_at.endsWith('Z') ? msg.created_at : msg.created_at + 'Z')
            .toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        : '',
      createdAt: msg.created_at || null,
      is_read: msg.is_read,
    };
  }


  // Helper: is user at bottom?
  const isAtBottom = useCallback(() => {
    if (!scrollRef.current) return true;
    const el = scrollRef.current;
    // Allow 40px tolerance
    return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior });
      return;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: 'end', behavior });
      return;
    }
  }, []);

  const requestScrollToBottom = useCallback((behavior = 'auto', { force = true } = {}) => {
    pendingScrollBehaviorRef.current = behavior;
    pendingScrollForceRef.current = force;
  }, []);

  const markMessagePopped = useCallback((messageId) => {
    if (!messageId) return;
    setPoppedMessageIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
    const currentTimer = incomingMessageTimersRef.current.get(messageId);
    if (currentTimer) clearTimeout(currentTimer);
    const timer = setTimeout(() => {
      setPoppedMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      incomingMessageTimersRef.current.delete(messageId);
    }, 900);
    incomingMessageTimersRef.current.set(messageId, timer);
  }, []);

  const stopTypingSignal = useCallback(() => {
    clearTimeout(typingIdleTimerRef.current);
    if (!typingActiveRef.current) return;
    typingActiveRef.current = false;
  }, []);

  const scheduleTypingStop = useCallback(() => {
    clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(() => {
      stopTypingSignal();
    }, 3000);
  }, [stopTypingSignal]);

  const handleTypingInput = useCallback((nextValue) => {
    const hasContent = nextValue.trim().length > 0;
    if (!hasContent) {
      stopTypingSignal();
      return;
    }

    const now = Date.now();
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      lastTypingSentRef.current = now;
      chatRef.current?.sendTyping?.();
    } else if (now - lastTypingSentRef.current >= 5000) {
      lastTypingSentRef.current = now;
      chatRef.current?.sendTyping?.();
    }

    scheduleTypingStop();
  }, [scheduleTypingStop, stopTypingSignal]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewport = () => {
      const vv = window.visualViewport;
      setViewportHeight(Math.round(vv?.height || window.innerHeight));
    };

    updateViewport();

    const vv = window.visualViewport;
    window.addEventListener('resize', updateViewport);
    vv?.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      vv?.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) { navigate('/login'); return; }

    const nextCachedChat = readChatCache(partnerId);
    const nextPartnerPreview = partnerPreview;
    initialHistoryLoadedRef.current = false;
    clearTimeout(historyFallbackTimerRef.current);
    myUserIdRef.current = String(user.id);
    setActiveChatId([String(user.id), partnerId].sort().join('-'));

    // Optimistically clear the global badge for this conversation immediately.
    // Read the conversation list cache to find how many unreads this conversation had.
    try {
      const raw = sessionStorage.getItem('mansion_conversations');
      if (raw) {
        const parsed = JSON.parse(raw);
        const convs = Array.isArray(parsed?.conversations) ? parsed.conversations : (Array.isArray(parsed) ? parsed : []);
        const conv = convs.find(c => String(c.profileId) === String(partnerId));
        if (conv && conv.unread > 0) {
          decrementUnread(conv.unread);
          // Also zero it in the cache
          conv.unread = 0;
          const nextConvs = Array.isArray(parsed?.conversations)
            ? { ...parsed, conversations: convs }
            : convs;
          sessionStorage.setItem('mansion_conversations', JSON.stringify(Array.isArray(parsed?.conversations) ? nextConvs : { conversations: convs, timestamp: parsed?.timestamp || 0 }));
        }
      }
    } catch { /* ignore */ }

    setPartner(nextCachedChat?.partner || nextPartnerPreview || null);
    setMessages(nextCachedChat?.messages || []);
    setApiLimit(nextCachedChat?.apiLimit || null);
    setHasOlderMessages(nextCachedChat?.hasOlderMessages || false);
    setLoading(!nextCachedChat && !nextPartnerPreview);
    if ((nextCachedChat?.messages || []).length > 0) {
      wasAtBottomRef.current = true;
      requestScrollToBottom('auto');
    }

    let cancelled = false;
    getChatBootstrap(partnerId).then((data) => {
      if (cancelled) return;
      if (data?.partner) setPartner((prev) => ({ ...(prev || {}), ...data.partner }));
      if (data?.messageLimit) setApiLimit(data.messageLimit);
    }).catch(() => {}).finally(() => {
      if (!cancelled && nextCachedChat) setLoading(false);
    });

    // Open WebSocket connection for real-time messages
    chatRef.current = createChatSocket(String(user.id), partnerId, token, {
      onHistory(payload) {
        const historyRows = Array.isArray(payload) ? payload : (payload?.messages || []);
        const formattedHistory = normalizeMessages(historyRows.map((msg) => formatMsg(msg)));
        const unreadIds = historyRows
          .filter((msg) => msg.sender_id !== myUserIdRef.current && !msg.is_read)
          .map((msg) => msg.id);

        initialHistoryLoadedRef.current = true;
        clearTimeout(historyFallbackTimerRef.current);
        setMessages(formattedHistory);
        setHasOlderMessages(Array.isArray(payload) ? historyRows.length >= INITIAL_CHAT_PAGE_SIZE : !!payload?.hasMore);
        setLoading(false);
        wasAtBottomRef.current = true;
        requestScrollToBottom('auto', { force: true });

        if (unreadIds.length > 0) {
          chatRef.current?.markRead(unreadIds);
        }
      },
      onMessage(msg) {
        const shouldStickToBottom = wasAtBottomRef.current;
        suppressTypingUntilRef.current = Date.now() + 1500;
        clearTimeout(typingTimeoutRef.current);
        setPartnerTyping(false);
        const formatted = formatMsg(msg);
        // Deduplicate: skip if message already exists
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, formatted];
        });
        updateConversationPreviewCache(partnerId, partner, formatted);
        if (shouldStickToBottom) requestScrollToBottom('smooth', { force: true });
        markMessagePopped(msg.id);
        // Auto mark as read since we're viewing the chat
        chatRef.current?.markRead([msg.id]);
      },
      onAck(msg) {
        const formatted = formatMsg(msg);
        // Replace optimistic temp message with real one from DO
        setMessages(prev => {
          const tempIdx = prev.findIndex(m => m.id?.startsWith('temp-') && m.senderId === 'me');
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = formatted;
            return updated;
          }
          // If no temp found, just add (deduplicated)
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, formatted];
        });
        updateConversationPreviewCache(partnerId, partner, formatted);
      },
      onRead(messageIds) {
        setMessages(prev => prev.map(m =>
          messageIds.includes(m.id) ? { ...m, is_read: 1 } : m
        ));
      },
      onLimit(data) {
        setApiLimit({ remaining: data.remaining, max: data.max, canSend: data.canSend });
      },
      onError(data) {
        if (data.code === 'LIMIT_REACHED') {
          setApiLimit({ remaining: 0, canSend: false, max: data.max || 5 });
        }
      },
      onStateChange(state) {
        setWsState(state);
      },
      onTyping() {
        if (Date.now() < suppressTypingUntilRef.current) return;
        setPartnerTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 5500);
      },
    });

    if (!nextCachedChat?.messages?.length) {
      historyFallbackTimerRef.current = setTimeout(() => {
        if (cancelled || initialHistoryLoadedRef.current) return;

        apiGetMessages(partnerId, { limit: INITIAL_CHAT_PAGE_SIZE }).then((data) => {
          if (cancelled || initialHistoryLoadedRef.current) return;
          initialHistoryLoadedRef.current = true;
          setMessages(normalizeMessages(data.messages || []));
          setHasOlderMessages(!!data.hasMore);
          setLoading(false);
          wasAtBottomRef.current = true;
          requestScrollToBottom('auto', { force: true });
        }).catch(() => {
          if (!cancelled) setLoading(false);
        });
      }, 2500);
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
      clearTimeout(historyFallbackTimerRef.current);
      clearTimeout(typingTimeoutRef.current);
      stopTypingSignal();
      incomingMessageTimersRef.current.forEach((timer) => clearTimeout(timer));
      incomingMessageTimersRef.current.clear();
      setActiveChatId(null);
      // Bust API in-memory caches so getConversations() fetches fresh on next call
      invalidateConversationsCache();
      // Refresh global unread count once when leaving the chat.
      refreshUnread();
      chatRef.current?.close();
      chatRef.current = null;
    };
  }, [id, navigate, partnerId, partnerPreview, requestScrollToBottom, setActiveChatId, refreshUnread, decrementUnread, stopTypingSignal]);

  useEffect(() => {
    if (!partner && messages.length === 0 && !apiLimit) return;
    writeChatCache(partnerId, {
      partner,
      messages,
      apiLimit,
      hasOlderMessages,
    });
  }, [partnerId, partner, messages, apiLimit, hasOlderMessages]);

  useLayoutEffect(() => {
    if (restoreScrollAfterPrependRef.current && scrollRef.current) {
      const el = scrollRef.current;
      const restore = restoreScrollAfterPrependRef.current;
      el.scrollTop = restore.previousScrollTop + (el.scrollHeight - restore.previousScrollHeight);
      restoreScrollAfterPrependRef.current = null;
      return;
    }

    if (pendingScrollBehaviorRef.current) {
      const behavior = pendingScrollBehaviorRef.current;
      const force = pendingScrollForceRef.current;
      pendingScrollBehaviorRef.current = null;
      pendingScrollForceRef.current = false;
      if (!force && !wasAtBottomRef.current) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(behavior);
        });
      });
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!partnerTyping || !wasAtBottomRef.current) return;
    requestScrollToBottom('smooth');
  }, [partnerTyping]);

  const handleLoadOlderMessages = async () => {
    if (loadingOlder || messages.length === 0) return;
    const oldestMessage = messages.find((message) => message.createdAt);
    if (!oldestMessage?.createdAt) return;

    const el = scrollRef.current;
    if (el) {
      restoreScrollAfterPrependRef.current = {
        previousScrollHeight: el.scrollHeight,
        previousScrollTop: el.scrollTop,
      };
    }

    setLoadingOlder(true);
    try {
      const data = await apiGetMessages(partnerId, {
        before: oldestMessage.createdAt,
        limit: OLDER_CHAT_PAGE_SIZE,
      });
      const olderMessages = normalizeMessages(data.messages || []);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        return [
          ...olderMessages.filter((message) => !existingIds.has(message.id)),
          ...prev,
        ];
      });
      setHasOlderMessages(!!data.hasMore);
    } catch {
      restoreScrollAfterPrependRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  };

  const { indicatorRef } = usePullToRefresh(
    useCallback(async () => {
      await handleLoadOlderMessages();
    }, [handleLoadOlderMessages]),
    { threshold: 90, containerRef: scrollRef }
  );

  // Remove typing-triggered scroll: typing indicator never forces scroll

  if (!partner && !loading) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <p className="text-text-muted">Conversación no encontrada</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
    );
  }

  const effectiveRemaining = apiLimit ? apiLimit.remaining : remaining;
  const effectiveCanSend = apiLimit ? apiLimit.canSend : canSend;
  const effectiveMax = apiLimit ? apiLimit.max : max;

  const handleSend = async () => {
    if (!input.trim() || !effectiveCanSend) return;

    const text = input.trim();
    const tempId = `temp-${Date.now()}`;
    const newMsg = {
      id: tempId,
      senderId: 'me',
      text,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      is_read: 0,
    };

    wasAtBottomRef.current = true;
    requestScrollToBottom('auto', { force: true });
    setMessages((prev) => [...prev, newMsg]);
    updateConversationPreviewCache(partnerId, partner, newMsg);
    setInput('');
    stopTypingSignal();
    setPartnerTyping(false);
    localSendMessage();

    // Send via WebSocket (same channel as typing — proven real-time)
    // The DO handles: save to SQLite + D1, limit check, broadcast to receiver, ack to sender
    const estimatedMessageWrites = effectiveMax >= 999 ? 3 : 4;
    if (chatRef.current?.getState() === 'connected') {
      recordD1WriteEstimate('chat_message_ws', estimatedMessageWrites);
      chatRef.current.send(text);
    } else {
      // Fallback: HTTP when WS is disconnected
      try {
        recordD1WriteEstimate('chat_message_http', estimatedMessageWrites);
        await apiSendMessage(partnerId, text);
        getMessageLimit().then(data => setApiLimit(data)).catch(() => {});
      } catch (err) {
        if (err.status === 403) {
          setApiLimit({ remaining: 0, canSend: false, max: 5 });
        }
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji) => {
    const el = inputRef.current;
    if (!el) { setInput(prev => prev + emoji); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = input.slice(0, start) + emoji + input.slice(end);
    setInput(newVal);
    // Restore cursor after emoji
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    });
  };

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setInput(nextValue);
    handleTypingInput(nextValue);
  };

  return (
    <>
    <DesktopSidebar />
    <div
      className="min-h-mobile-browser-screen h-mobile-browser-screen bg-mansion-base flex flex-col overflow-hidden lg:pl-64 xl:pl-72"
      style={viewportHeight ? { minHeight: `${viewportHeight}px`, height: `${viewportHeight}px` } : undefined}
    >
      {/* Header */}
      <div
        className="glass fixed top-0 left-0 right-0 lg:left-64 xl:left-72 shrink-0 border-b border-mansion-border/30 z-30"
        style={{ paddingTop: 'calc(var(--safe-top) + 56px)' }}
      >
        <div className="flex items-center gap-3 px-3 py-3 lg:px-6 max-w-4xl lg:mx-auto">
          <button
            onClick={() => navigate(backTarget)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-shrink-0 cursor-pointer" onClick={() => navigate(`/perfiles/${partnerId}`, {
            state: desktopProfileOverlayState,
          })}>
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-mansion-border/40">
              <AvatarImg src={partnerPhoto} crop={partnerPhotoCrop} alt={partner.name} className="w-full h-full" />
            </div>
            {partner.online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-mansion-card" />
            )}
          </div>

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/perfiles/${partnerId}`, {
            state: desktopProfileOverlayState,
          })}>
            <h2 className="font-semibold text-sm text-text-primary truncate">{partner.name}</h2>
            <p className={`text-[11px] ${partnerTyping ? 'text-mansion-gold' : partner.online ? 'text-green-400' : 'text-text-dim'}`}>
              {partnerTyping ? 'Escribiendo...' : partner.online ? '● En línea' : 'Desconectado'}
            </p>
          </div>

          {/* Connection status + Limit pill */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              wsState === 'connected' ? 'bg-green-400' : wsState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`} title={wsState === 'connected' ? 'Conectado' : wsState === 'connecting' ? 'Conectando...' : 'Desconectado'} />
            <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
              effectiveRemaining <= 2
                ? 'bg-mansion-crimson/10 border-mansion-crimson/30 text-mansion-crimson'
                : 'bg-mansion-gold/5 border-mansion-gold/20 text-mansion-gold'
            }`}>
              <Lock className="w-3 h-3" />
              <span>{effectiveRemaining}/{effectiveMax}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0 max-w-4xl lg:mx-auto w-full">
        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (el) wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="h-full overflow-y-auto overscroll-y-contain px-4 pt-[calc(var(--safe-top)+132px)] pb-5 space-y-5 lg:px-6 lg:pt-24"
        >
          <div
            ref={indicatorRef}
            className="sticky top-0 z-10 flex justify-center py-2 pointer-events-none"
            style={{ transform: 'translateY(-100%)', opacity: 0, transition: 'transform 0.2s, opacity 0.2s' }}
          >
            <div className="w-7 h-7 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>

        {hasOlderMessages && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleLoadOlderMessages}
              disabled={loadingOlder}
              className="text-xs px-3 py-1.5 rounded-full border border-mansion-border/40 text-text-muted hover:text-text-primary hover:border-mansion-gold/30 transition-colors disabled:opacity-60"
            >
              {loadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-center">
          <span className="text-[10px] text-text-dim bg-mansion-elevated px-3 py-1 rounded-full">
            Hoy
          </span>
        </div>

        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === 'me';
          const isPopped = poppedMessageIds.has(msg.id);
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!isMe && (
                <div className={`flex-shrink-0 w-[50px] h-[50px] rounded-full overflow-hidden mb-0.5 ${isPopped ? 'chat-avatar-highlight' : ''}`}>
                  <AvatarImg src={partnerPhoto} crop={partnerPhotoCrop} alt="" className="w-full h-full" />
                </div>
              )}
              <div
                className={`chat-bubble max-w-[80%] rounded-2xl px-4 py-3 transition-[color,background-color,border-color,box-shadow] duration-300 ${
                  isMe
                    ? 'chat-bubble-outgoing bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark text-white rounded-br-sm shadow-[0_10px_28px_rgba(96,14,30,0.22)]'
                    : `text-text-primary border rounded-bl-sm ${isPopped ? 'chat-bubble-highlight bg-mansion-gold/10 border-mansion-gold/30 shadow-[0_0_0_1px_rgba(212,175,55,0.08)]' : 'bg-mansion-elevated border-mansion-border/30'}`
                }`}
              >
                <p className="text-[15px] leading-relaxed">{msg.text}</p>
                <p className={`text-[11px] mt-1.5 flex items-center ${isMe ? 'justify-end text-white/50 gap-1' : 'justify-end text-text-dim'}`}>
                  {msg.timestamp}
                  {isMe && (
                    <span className={`chat-read-check inline-flex ${msg.is_read ? 'is-read text-blue-400' : 'text-white/40'}`}>
                      {msg.is_read ? (
                        <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M0.5 5.5L4 9L4.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.5 5.5L7 9L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.5 5.5L12 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5L4.5 9L10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}

        {partnerTyping && (
          <div className="flex items-end gap-2 justify-start">
            <div className="flex-shrink-0 w-[50px] h-[50px] rounded-full overflow-hidden mb-0.5">
              <AvatarImg src={partnerPhoto} crop={partnerPhotoCrop} alt="" className="w-full h-full" />
            </div>
            <div className="chat-bubble max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 bg-mansion-elevated border border-mansion-border/30 text-text-primary shadow-[0_6px_18px_rgba(8,8,14,0.18)]">
              <div className="flex items-center gap-1.5 h-6">
                <span className="chat-typing-dot" style={{ animationDelay: '0ms' }} />
                <span className="chat-typing-dot" style={{ animationDelay: '150ms' }} />
                <span className="chat-typing-dot" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

          <div
            ref={messagesEndRef}
            className="h-32"
            style={{ scrollMarginBottom: '80px' }}
          />
        </div>
      </div>

      {/* Input area */}
      <div className="safe-bottom sticky bottom-0 shrink-0 border-t border-mansion-border/30 bg-mansion-card/90 backdrop-blur-xl z-20">
        <div className="flex items-end gap-2 px-3 py-3 lg:px-6 max-w-4xl lg:mx-auto">

          {/* Attach photo */}
          <button className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-text-dim hover:text-mansion-gold hover:bg-mansion-elevated/60 transition-colors border border-mansion-border/30">
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Textarea + emoji */}
          <div className="flex-1 relative flex items-end">
            <div className="flex-1 flex items-end bg-mansion-elevated rounded-2xl border border-mansion-border/30 focus-within:border-mansion-gold/30 transition-colors min-h-[44px]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onBlur={stopTypingSignal}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowEmojis(false)}
                placeholder={effectiveCanSend ? 'Escribe un mensaje...' : 'Sin mensajes disponibles'}
                disabled={!effectiveCanSend}
                rows={1}
                className="flex-1 resize-none bg-transparent py-3 px-4 text-sm outline-none max-h-32 text-text-primary placeholder:text-text-dim disabled:opacity-50"
                style={{ minHeight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowEmojis(v => !v)}
                className={`flex-shrink-0 w-10 self-end pb-2.5 flex items-center justify-center transition-colors ${showEmojis ? 'text-mansion-gold' : 'text-text-dim hover:text-mansion-gold'}`}
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
            <AnimatePresence>
              {showEmojis && (
                <EmojiPicker
                  onSelect={(emoji) => { handleEmojiSelect(emoji); }}
                  onClose={() => setShowEmojis(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Send */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || !effectiveCanSend}
            className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              input.trim() && effectiveCanSend
                ? 'bg-mansion-crimson text-white shadow-glow-crimson'
                : 'bg-mansion-elevated text-text-dim border border-mansion-border/30'
            }`}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
    </>
  );
}
