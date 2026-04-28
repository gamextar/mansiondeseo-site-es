import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban, ChevronLeft, Send, Smile } from 'lucide-react';
import { useMessageLimit } from '../hooks/useMessageLimit';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import DesktopSidebar from '../components/DesktopSidebar';
import EmojiPicker from '../components/EmojiPicker';
import AvatarImg from '../components/AvatarImg';
import { getMessageLimit, getChatBootstrap, getToken, getStoredUser, getMessages as apiGetMessages, sendMessage as apiSendMessage, invalidateConversationsCache, setUserBlocked } from '../lib/api';
import { createChatSocket } from '../lib/chatSocket';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPrimaryProfileCrop, getPrimaryProfilePhoto } from '../lib/profileMedia';
import { publishLocalConversationUpdate } from '../lib/localConversationEvents';
import { recordD1WriteEstimate } from '../lib/d1Debug';

const CHAT_CACHE_PREFIX = 'mansion_chat_';
const CHAT_CACHE_TTL_MS = 10 * 60_000;
const CHAT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const CHAT_CACHE_MAX_CHATS = 15;
const CHAT_CACHE_MESSAGE_LIMIT = 15;
const INITIAL_CHAT_PAGE_SIZE = 30;
const OLDER_CHAT_PAGE_SIZE = 30;

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

function getChatCacheKey(partnerId) {
  const viewerId = getStoredUser()?.id;
  return `${CHAT_CACHE_PREFIX}${viewerId || 'anonymous'}:${partnerId}`;
}

function getLegacyChatCacheKey(partnerId) {
  return `${CHAT_CACHE_PREFIX}${partnerId}`;
}

function getStorageItem(storage, key) {
  try {
    return storage?.getItem?.(key) || null;
  } catch {
    return null;
  }
}

function removeStorageItem(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // ignore unavailable storage
  }
}

function pruneChatCache(currentKey) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const viewerId = getStoredUser()?.id;
  if (!viewerId) return;
  const prefix = `${CHAT_CACHE_PREFIX}${viewerId}:`;
  const entries = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      const cachedAt = Number(parsed?.cachedAt || 0);
      if (!cachedAt || Date.now() - cachedAt > CHAT_CACHE_MAX_AGE_MS) {
        localStorage.removeItem(key);
        continue;
      }
      entries.push({ key, cachedAt });
    }

    entries
      .filter((entry) => entry.key !== currentKey)
      .sort((a, b) => b.cachedAt - a.cachedAt)
      .slice(Math.max(0, CHAT_CACHE_MAX_CHATS - 1))
      .forEach((entry) => localStorage.removeItem(entry.key));
  } catch {
    // Best-effort cache pruning only.
  }
}

function normalizeMessages(messages = []) {
  return messages.map((message) => ({
    ...message,
    createdAt: message.createdAt || message.created_at || null,
  }));
}

function getMessageTimeValue(message) {
  const value = message?.createdAt || message?.created_at;
  if (!value) return 0;
  const normalized = typeof value === 'string' && !value.endsWith('Z') ? `${value}Z` : value;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getMessageIdValue(message) {
  return message?.id == null ? '' : String(message.id);
}

function areMessagesEqual(message, other) {
  return getMessageIdValue(message) === getMessageIdValue(other)
    && message?.senderId === other?.senderId
    && String(message?.text || '') === String(other?.text || '')
    && (message?.createdAt || message?.created_at || null) === (other?.createdAt || other?.created_at || null)
    && Number(message?.is_read ?? 0) === Number(other?.is_read ?? 0);
}

function areMessageListsEqual(left = [], right = []) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((message, index) => areMessagesEqual(message, right[index]));
}

function sortMessagesByTime(messages) {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const timeA = getMessageTimeValue(a.message);
      const timeB = getMessageTimeValue(b.message);
      if (timeA && timeB && timeA !== timeB) return timeA - timeB;
      if (timeA && !timeB) return -1;
      if (!timeA && timeB) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.message);
}

function isTempMessage(message) {
  return getMessageIdValue(message).startsWith('temp-');
}

function areLikelySamePendingMessage(message, other) {
  if (!message || !other) return false;
  const oneIsTemp = isTempMessage(message) !== isTempMessage(other);
  if (!oneIsTemp) return false;
  if (message?.senderId !== other?.senderId) return false;
  if (String(message?.text || '') !== String(other?.text || '')) return false;

  const messageTime = getMessageTimeValue(message);
  const otherTime = getMessageTimeValue(other);
  return !messageTime || !otherTime || Math.abs(messageTime - otherTime) <= 30_000;
}

function mergeDuplicateMessage(existing, incoming) {
  if (isTempMessage(existing) && !isTempMessage(incoming)) return { ...existing, ...incoming };
  if (!isTempMessage(existing) && isTempMessage(incoming)) return existing;
  return {
    ...existing,
    ...incoming,
    is_read: Math.max(Number(existing?.is_read ?? 0), Number(incoming?.is_read ?? 0)),
  };
}

function dedupeMessages(messages = []) {
  const result = [];

  sortMessagesByTime(messages).forEach((message) => {
    if (!message || message.isPreview) return;
    const messageId = getMessageIdValue(message);
    const duplicateIndex = result.findIndex((existing) => (
      (messageId && getMessageIdValue(existing) === messageId) ||
      areLikelySamePendingMessage(existing, message)
    ));

    if (duplicateIndex >= 0) {
      result[duplicateIndex] = mergeDuplicateMessage(result[duplicateIndex], message);
      return;
    }

    result.push(message);
  });

  return result;
}

function mergeMessagesForCache(...messageGroups) {
  const byId = new Map();
  const withoutId = [];

  messageGroups.flat().forEach((message) => {
    if (!message || message.isPreview) return;
    const messageId = getMessageIdValue(message);
    if (messageId) {
      byId.set(messageId, message);
    } else {
      withoutId.push(message);
    }
  });

  return dedupeMessages([...byId.values(), ...withoutId]).slice(-CHAT_CACHE_MESSAGE_LIMIT);
}

function hydrateVisibleMessages(freshMessages, currentMessages, requestStartedAt = 0) {
  if (!currentMessages?.length) {
    return { messages: freshMessages, omittedOlder: false };
  }

  const freshById = new Map();
  freshMessages.forEach((message) => {
    const id = getMessageIdValue(message);
    if (id) freshById.set(id, message);
  });

  const firstCurrentTime = currentMessages.reduce((min, message) => {
    const time = getMessageTimeValue(message);
    return time ? Math.min(min, time) : min;
  }, Infinity);
  const visibleStartTime = Number.isFinite(firstCurrentTime) ? firstCurrentTime : 0;
  const consumedFreshIds = new Set();

  const hydratedCurrent = currentMessages.map((message) => {
    const messageId = getMessageIdValue(message);
    const byId = messageId ? freshById.get(messageId) : null;
    if (byId) {
      consumedFreshIds.add(messageId);
      return areMessagesEqual(message, byId) ? message : byId;
    }

    if (messageId.startsWith('temp-')) {
      const messageTime = getMessageTimeValue(message);
      const replacement = freshMessages.find((fresh) => {
        const freshId = getMessageIdValue(fresh);
        if (!freshId || consumedFreshIds.has(freshId)) return false;
        const freshTime = getMessageTimeValue(fresh);
        return fresh.senderId === message.senderId
          && String(fresh.text || '') === String(message.text || '')
          && (!messageTime || !freshTime || Math.abs(freshTime - messageTime) <= 15_000);
      });

      if (replacement) {
        consumedFreshIds.add(getMessageIdValue(replacement));
        return replacement;
      }
    }

    return message;
  });

  const additions = [];
  let omittedOlder = false;

  freshMessages.forEach((message) => {
    const messageId = getMessageIdValue(message);
    if (messageId && consumedFreshIds.has(messageId)) return;

    const messageTime = getMessageTimeValue(message);
    const belongsToVisibleWindow = !visibleStartTime || !messageTime || messageTime >= visibleStartTime - 1000;
    const arrivedDuringRequest = requestStartedAt && messageTime >= requestStartedAt - 1000;

    if (belongsToVisibleWindow || arrivedDuringRequest) {
      additions.push(message);
      if (messageId) consumedFreshIds.add(messageId);
    } else {
      omittedOlder = true;
    }
  });

  const messages = dedupeMessages([...hydratedCurrent, ...additions]);
  return { messages, omittedOlder };
}

function hasMessagesBeforeVisibleWindow(freshMessages, currentMessages) {
  if (!currentMessages?.length) return false;

  const firstCurrentTime = currentMessages.reduce((min, message) => {
    const time = getMessageTimeValue(message);
    return time ? Math.min(min, time) : min;
  }, Infinity);
  if (!Number.isFinite(firstCurrentTime)) return false;

  const currentIds = new Set(currentMessages.map(getMessageIdValue).filter(Boolean));
  return freshMessages.some((message) => {
    const messageId = getMessageIdValue(message);
    const messageTime = getMessageTimeValue(message);
    return messageTime
      && messageTime < firstCurrentTime - 1000
      && (!messageId || !currentIds.has(messageId));
  });
}

function readChatCache(partnerId) {
  if (typeof window === 'undefined') return null;
  const key = getChatCacheKey(partnerId);
  const legacyKey = getLegacyChatCacheKey(partnerId);
  try {
    const raw = getStorageItem(localStorage, key)
      || getStorageItem(sessionStorage, key)
      || getStorageItem(sessionStorage, legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt) return null;
    // Use cache as an instant placeholder even if stale; D1 refreshes it after mount.
    if (Date.now() - parsed.cachedAt > CHAT_CACHE_MAX_AGE_MS) {
      removeStorageItem(localStorage, key);
      removeStorageItem(sessionStorage, key);
      removeStorageItem(sessionStorage, legacyKey);
      return null;
    }
    return {
      ...parsed,
      messages: dedupeMessages(normalizeMessages(parsed.messages || []).filter((message) => !message.isPreview)),
      isStale: Date.now() - parsed.cachedAt > CHAT_CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeChatCache(partnerId, payload) {
  if (typeof window === 'undefined') return;
  const key = getChatCacheKey(partnerId);
  try {
    const stableMessages = dedupeMessages(normalizeMessages(payload.messages || []).filter((message) => !message.isPreview));
    localStorage.setItem(key, JSON.stringify({
      ...payload,
      messages: stableMessages.slice(-CHAT_CACHE_MESSAGE_LIMIT),
      cachedAt: Date.now(),
    }));
    pruneChatCache(key);
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
      lastMessageId: String(message.id || '').startsWith('temp-') ? null : message.id,
      lastSenderId: message.senderId === 'me' ? (getStoredUser()?.id || null) : partnerId,
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

function readChatDebugMetrics({
  viewportHeight,
  viewportOffsetTop,
  headerRef,
  composerRef,
  scrollRef,
  route,
}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const root = document.documentElement;
  const body = document.body;
  const vv = window.visualViewport;
  const rootStyles = window.getComputedStyle(root);
  const headerRect = headerRef.current?.getBoundingClientRect?.();
  const composerRect = composerRef.current?.getBoundingClientRect?.();
  const scrollEl = scrollRef.current;

  return {
    route,
    innerHeight: Math.round(window.innerHeight || 0),
    viewportHeightState: Math.round(viewportHeight || 0),
    viewportOffsetTopState: Math.round(viewportOffsetTop || 0),
    vvHeight: Math.round(vv?.height || 0),
    vvOffsetTop: Math.round(vv?.offsetTop || 0),
    vvPageTop: Math.round(vv?.pageTop || 0),
    docClientHeight: Math.round(root.clientHeight || 0),
    scrollY: Math.round(window.scrollY || 0),
    rootScrollTop: Math.round(root.scrollTop || 0),
    bodyScrollTop: Math.round(body?.scrollTop || 0),
    safeTopVar: rootStyles.getPropertyValue('--safe-top').trim() || 'n/a',
    vvTopVar: rootStyles.getPropertyValue('--visual-viewport-offset-top').trim() || 'n/a',
    headerTop: Math.round(headerRect?.top || 0),
    headerHeight: Math.round(headerRect?.height || 0),
    composerTop: Math.round(composerRect?.top || 0),
    composerBottom: Math.round(composerRect?.bottom || 0),
    composerHeight: Math.round(composerRect?.height || 0),
    composerGapBottom: Math.round((window.innerHeight || 0) - (composerRect?.bottom || 0)),
    scrollTop: Math.round(scrollEl?.scrollTop || 0),
    scrollClientHeight: Math.round(scrollEl?.clientHeight || 0),
    scrollHeight: Math.round(scrollEl?.scrollHeight || 0),
  };
}

export default function ChatPage({ conversationId = '', embeddedDesktop = false }) {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const activeRouteId = conversationId || routeId || '';
  const isStandaloneMobileChat = !embeddedDesktop && detectStandaloneMobile();
  const isMobileBrowserChat = !embeddedDesktop && typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 1023px)').matches && !isStandaloneMobileChat
    : false;
  const { canSend, sendMessage: localSendMessage, max } = useMessageLimit();
  const { setActiveChatId, refresh: refreshUnread, decrementUnread } = useUnreadMessages();
  const partnerId = activeRouteId.startsWith('conv-') ? activeRouteId.replace('conv-', '') : activeRouteId;
  const cachedChat = readChatCache(partnerId);
  const partnerPreview = location.state?.partnerPreview || null;
  const initialMessages = cachedChat?.messages || [];
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [apiLimit, setApiLimit] = useState(cachedChat?.apiLimit || null);
  const [blockState, setBlockState] = useState(cachedChat?.blockState || { blockedByMe: false, blockedMe: false });
  const [partner, setPartner] = useState(cachedChat?.partner || partnerPreview || null);
  const [loading, setLoading] = useState(!cachedChat && !partnerPreview);
  const [blockUpdating, setBlockUpdating] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(cachedChat?.hasOlderMessages || false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : null));
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [messagesAreaHeight, setMessagesAreaHeight] = useState(null);
  const [chatDebugEnabled, setChatDebugEnabled] = useState(false);
  const [chatDebugMetrics, setChatDebugMetrics] = useState(null);
  const [chatDebugSnapshots, setChatDebugSnapshots] = useState({});
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const headerRef = useRef(null);
  const composerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const incomingMessageTimersRef = useRef(new Map());
  const lastTypingSentRef = useRef(0);
  const typingActiveRef = useRef(false);
  const typingIdleTimerRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const myUserIdRef = useRef(null);
  const fastKeyboardSettleRef = useRef(false);
  const keyboardFocusedRef = useRef(false);
  const pinOnKeyboardResizeRef = useRef(false);
  const pendingScrollBehaviorRef = useRef(null);
  const pendingScrollForceRef = useRef(false);
  const restoreScrollAfterPrependRef = useRef(null);
  const cacheMessagesRef = useRef(initialMessages);
  const suppressTypingUntilRef = useRef(0);
  const [poppedMessageIds, setPoppedMessageIds] = useState(() => new Set());
  const [headerHeight, setHeaderHeight] = useState(96);
  const [composerHeight, setComposerHeight] = useState(84);
  const partnerPhoto = getPrimaryProfilePhoto(partner);
  const partnerPhotoCrop = getPrimaryProfileCrop(partner);
  const backTarget = location.state?.from || '/mensajes';

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
  const isAtBottom = useCallback((tolerance = 40) => {
    if (!scrollRef.current) return true;
    const el = scrollRef.current;
    return el.scrollHeight - el.scrollTop - el.clientHeight < tolerance;
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

  const keepChatPinnedToBottom = useCallback((behavior = 'auto') => {
    if (!wasAtBottomRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom(behavior);
      });
    });
  }, [scrollToBottom]);

  const captureChatDebug = useCallback((label) => {
    const nextMetrics = readChatDebugMetrics({
      viewportHeight,
      viewportOffsetTop,
      headerRef,
      composerRef,
      scrollRef,
      route: location.pathname,
    });
    if (!nextMetrics) return;
    setChatDebugMetrics(nextMetrics);
    if (label) {
      setChatDebugSnapshots((prev) => ({
        ...prev,
        [label]: nextMetrics,
      }));
    }
  }, [location.pathname, viewportHeight, viewportOffsetTop]);

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

  const settleMobileKeyboardViewport = useCallback((fast = false) => {
    if (!isMobileBrowserChat || typeof window === 'undefined') return;
    const delays = fast ? [0] : [0, 120];
    delays.forEach((delay) => {
      window.setTimeout(() => {
        window.scrollTo(0, 0);
        window.dispatchEvent(new Event('resize'));
      }, delay);
    });
  }, [isMobileBrowserChat]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const params = new URLSearchParams(window.location.search);
    const enabled = params.get('chat_debug') === '1';
    setChatDebugEnabled(enabled);
    if (!enabled) {
      setChatDebugMetrics(null);
      setChatDebugSnapshots({});
      if (!isMobileBrowserChat) return undefined;
    }

    const updateViewport = () => {
      const vv = window.visualViewport;
      const vvHeight = Math.round(vv?.height || 0);
      const vvOffsetTop = Math.round(vv?.offsetTop || 0);
      const innerHeight = Math.round(window.innerHeight || vvHeight || 0);
      const nextHeight = isMobileBrowserChat && !keyboardFocusedRef.current
        ? innerHeight
        : (vvHeight || innerHeight);
      setViewportHeight(nextHeight);
      setViewportOffsetTop(isMobileBrowserChat ? vvOffsetTop : 0);

      if (isMobileBrowserChat && keyboardFocusedRef.current && pinOnKeyboardResizeRef.current) {
        window.requestAnimationFrame(() => {
          scrollToBottom('auto');
          window.requestAnimationFrame(() => scrollToBottom('auto'));
        });
      }
    };

    updateViewport();

    const vv = window.visualViewport;
    const settleTimers = isMobileBrowserChat
      ? [80, 180, 360, 700].map((delay) => window.setTimeout(updateViewport, delay))
      : [];
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.addEventListener('focus', updateViewport);
    window.addEventListener('pageshow', updateViewport);
    vv?.addEventListener('resize', updateViewport);
    vv?.addEventListener('scroll', updateViewport);

    return () => {
      settleTimers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.removeEventListener('focus', updateViewport);
      window.removeEventListener('pageshow', updateViewport);
      vv?.removeEventListener('resize', updateViewport);
      vv?.removeEventListener('scroll', updateViewport);
    };
  }, [isMobileBrowserChat, scrollToBottom]);

  useLayoutEffect(() => {
    if (!isMobileBrowserChat || typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const body = document.body;
    const previousRoot = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
      height: root.style.height,
    };
    const previousBody = {
      overflow: body?.style.overflow || '',
      overscrollBehavior: body?.style.overscrollBehavior || '',
      position: body?.style.position || '',
      inset: body?.style.inset || '',
      width: body?.style.width || '',
      height: body?.style.height || '',
    };

    const lockDocumentScroll = () => {
      root.style.overflow = 'hidden';
      root.style.overscrollBehavior = 'none';
      root.style.height = '100%';
      if (body) {
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        body.style.position = 'fixed';
        body.style.inset = '0';
        body.style.width = '100%';
        body.style.height = '100%';
      }
      window.scrollTo(0, 0);
      root.scrollTop = 0;
      if (body) body.scrollTop = 0;
    };

    lockDocumentScroll();
    const timers = [80, 180, 360].map((delay) => window.setTimeout(lockDocumentScroll, delay));
    window.addEventListener('resize', lockDocumentScroll);
    window.visualViewport?.addEventListener('resize', lockDocumentScroll);

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener('resize', lockDocumentScroll);
      window.visualViewport?.removeEventListener('resize', lockDocumentScroll);
      root.style.overflow = previousRoot.overflow;
      root.style.overscrollBehavior = previousRoot.overscrollBehavior;
      root.style.height = previousRoot.height;
      if (body) {
        body.style.overflow = previousBody.overflow;
        body.style.overscrollBehavior = previousBody.overscrollBehavior;
        body.style.position = previousBody.position;
        body.style.inset = previousBody.inset;
        body.style.width = previousBody.width;
        body.style.height = previousBody.height;
      }
      window.scrollTo(0, 0);
    };
  }, [isMobileBrowserChat]);

  useEffect(() => {
    if (!chatDebugEnabled) return undefined;

    let rafId = 0;
    const update = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        captureChatDebug();
      });
    };

    update();
    const timers = [80, 180, 360, 700].map((delay) => window.setTimeout(update, delay));
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    window.addEventListener('scroll', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    return () => {
      window.cancelAnimationFrame(rafId);
      timers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [captureChatDebug, chatDebugEnabled]);

  useEffect(() => {
    if (!chatDebugEnabled) return;
    captureChatDebug('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatDebugEnabled]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const measure = () => {
      const nextHeaderHeight = headerRef.current?.getBoundingClientRect?.().height;
      const composerRect = composerRef.current?.getBoundingClientRect?.();
      const nextComposerHeight = composerRect?.height;
      if (nextHeaderHeight) setHeaderHeight(Math.round(nextHeaderHeight));
      if (nextComposerHeight) setComposerHeight(Math.round(nextComposerHeight));
      setMessagesAreaHeight((prev) => {
        if (!isMobileBrowserChat || !keyboardFocusedRef.current || !composerRect) {
          return prev === null ? prev : null;
        }
        const nextHeight = Math.max(180, Math.round(composerRect.top));
        return prev === nextHeight ? prev : nextHeight;
      });
    };

    measure();

    const headerNode = headerRef.current;
    const composerNode = composerRef.current;
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measure())
      : null;

    if (headerNode) resizeObserver?.observe(headerNode);
    if (composerNode) resizeObserver?.observe(composerNode);
    const settleTimers = isMobileBrowserChat
      ? [0, 80, 180, 360].map((delay) => window.setTimeout(measure, delay))
      : [];
    window.addEventListener('resize', measure);
    if (isMobileBrowserChat) {
      window.visualViewport?.addEventListener('resize', measure);
      window.visualViewport?.addEventListener('scroll', measure);
    }

    return () => {
      settleTimers.forEach((timerId) => window.clearTimeout(timerId));
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      if (isMobileBrowserChat) {
        window.visualViewport?.removeEventListener('resize', measure);
        window.visualViewport?.removeEventListener('scroll', measure);
      }
    };
  }, [partnerTyping, input, viewportHeight, keyboardActive, isMobileBrowserChat]);

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) { navigate('/login'); return; }

    const nextCachedChat = readChatCache(partnerId);
    const nextPartnerPreview = partnerPreview;
    const nextInitialMessages = nextCachedChat?.messages || [];
    cacheMessagesRef.current = nextInitialMessages;
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
    setMessages((prev) => (areMessageListsEqual(prev, nextInitialMessages) ? prev : nextInitialMessages));
    setApiLimit(nextCachedChat?.apiLimit || null);
    setBlockState(nextCachedChat?.blockState || { blockedByMe: false, blockedMe: false });
    setHasOlderMessages(nextCachedChat?.hasOlderMessages || false);
    setLoading(!nextCachedChat && !nextPartnerPreview);
    if (nextInitialMessages.length > 0) {
      wasAtBottomRef.current = true;
      requestScrollToBottom('auto');
    }

    let cancelled = false;
    getChatBootstrap(partnerId).then((data) => {
      if (cancelled) return;
      if (data?.partner) setPartner((prev) => ({ ...(prev || {}), ...data.partner }));
      if (data?.messageLimit) setApiLimit(data.messageLimit);
      if (data?.blockState) setBlockState(data.blockState);
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

        cacheMessagesRef.current = mergeMessagesForCache(cacheMessagesRef.current, formattedHistory);
        setMessages((prev) => {
          const { messages: merged } = hydrateVisibleMessages(formattedHistory, prev);
          return areMessageListsEqual(prev, merged) ? prev : merged;
        });
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
        setMessages(prev => {
          const tempIdx = prev.findIndex((message) => areLikelySamePendingMessage(message, formatted));
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = mergeDuplicateMessage(updated[tempIdx], formatted);
            return dedupeMessages(updated);
          }
          const merged = dedupeMessages([...prev, formatted]);
          return areMessageListsEqual(prev, merged) ? prev : merged;
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
          const tempIdx = prev.findIndex((message) => areLikelySamePendingMessage(message, formatted));
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = mergeDuplicateMessage(updated[tempIdx], formatted);
            return dedupeMessages(updated);
          }
          const merged = dedupeMessages([...prev, formatted]);
          return areMessageListsEqual(prev, merged) ? prev : merged;
        });
        updateConversationPreviewCache(partnerId, partner, formatted);
      },
      onRead(messageIds) {
        const readIds = new Set(messageIds.map(String));
        setMessages((prev) => {
          let changed = false;
          const next = prev.map((message) => {
            if (!readIds.has(getMessageIdValue(message)) || Number(message.is_read) === 1) return message;
            changed = true;
            return { ...message, is_read: 1 };
          });
          return changed ? next : prev;
        });
      },
      onLimit(data) {
        setApiLimit({ remaining: data.remaining, max: data.max, canSend: data.canSend });
      },
      onError(data) {
        if (data.code === 'LIMIT_REACHED') {
          setApiLimit({ remaining: 0, canSend: false, max: data.max || 5 });
        } else if (data.code === 'USER_BLOCKED_BY_ME' || data.code === 'USER_BLOCKED_ME') {
          setBlockState((prev) => ({
            blockedByMe: data.code === 'USER_BLOCKED_BY_ME' ? true : prev.blockedByMe,
            blockedMe: data.code === 'USER_BLOCKED_ME' ? true : prev.blockedMe,
          }));
          setMessages((prev) => prev.filter((message) => !String(message.id || '').startsWith('temp-')));
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
    }, { loadHistory: false });

    const historyRequestStartedAt = Date.now();
    apiGetMessages(partnerId, { limit: INITIAL_CHAT_PAGE_SIZE }).then((data) => {
      if (cancelled) return;
      const latestMessages = normalizeMessages(data.messages || []);
      const hasHiddenOlderMessages = hasMessagesBeforeVisibleWindow(latestMessages, nextInitialMessages);
      const nextHasOlderMessages = !!data.hasMore || hasHiddenOlderMessages;
      cacheMessagesRef.current = mergeMessagesForCache(cacheMessagesRef.current, latestMessages);
      setMessages((prev) => {
        const { messages: merged } = hydrateVisibleMessages(latestMessages, prev, historyRequestStartedAt);
        return areMessageListsEqual(prev, merged) ? prev : merged;
      });
      setHasOlderMessages(nextHasOlderMessages);
      writeChatCache(partnerId, {
        partner: nextCachedChat?.partner || nextPartnerPreview || null,
        messages: cacheMessagesRef.current,
        apiLimit: nextCachedChat?.apiLimit || null,
        blockState: nextCachedChat?.blockState || { blockedByMe: false, blockedMe: false },
        hasOlderMessages: nextHasOlderMessages,
      });
      setLoading(false);
      if (!nextCachedChat?.messages?.length || wasAtBottomRef.current) {
        wasAtBottomRef.current = true;
        requestScrollToBottom('auto', { force: true });
      }
    }).catch(() => {
      if (!cancelled && !nextCachedChat?.messages?.length) setLoading(false);
    });

    return () => {
      cancelled = true;
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
  }, [decrementUnread, activeRouteId, navigate, partnerId, partnerPreview, refreshUnread, requestScrollToBottom, setActiveChatId, stopTypingSignal]);

  useEffect(() => {
    if (!partner && messages.length === 0 && !apiLimit) return;
    const messagesForCache = mergeMessagesForCache(cacheMessagesRef.current, messages);
    cacheMessagesRef.current = messagesForCache;
    writeChatCache(partnerId, {
      partner,
      messages: messagesForCache,
      apiLimit,
      blockState,
      hasOlderMessages,
    });
  }, [partnerId, partner, messages, apiLimit, blockState, hasOlderMessages]);

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
      if (embeddedDesktop) {
        scrollToBottom('auto');
        return;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(behavior);
        });
      });
    }
  }, [embeddedDesktop, messages, partnerTyping, scrollToBottom]);

  useLayoutEffect(() => {
    keepChatPinnedToBottom('auto');
  }, [viewportHeight, viewportOffsetTop, headerHeight, composerHeight, showEmojis, keepChatPinnedToBottom]);

  useLayoutEffect(() => {
    keepChatPinnedToBottom(partnerTyping ? 'smooth' : 'auto');
  }, [partnerTyping, keepChatPinnedToBottom]);

  useLayoutEffect(() => {
    if (keyboardActive && pinOnKeyboardResizeRef.current) {
      keepChatPinnedToBottom('auto');
    }
  }, [keyboardActive, keepChatPinnedToBottom]);

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
        return dedupeMessages([
          ...olderMessages.filter((message) => !existingIds.has(message.id)),
          ...prev,
        ]);
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

  const isBlockedByMe = !!blockState?.blockedByMe;
  const isBlockedByPartner = !!blockState?.blockedMe;
  const isChatBlocked = isBlockedByMe || isBlockedByPartner;
  const effectiveCanSend = !isChatBlocked && (apiLimit ? apiLimit.canSend : canSend);
  const effectiveMax = apiLimit ? apiLimit.max : max;
  const composerPlaceholder = isBlockedByMe
    ? 'Desbloquea al usuario para enviar mensajes'
    : isBlockedByPartner
      ? 'Este usuario no acepta mensajes tuyos'
      : effectiveCanSend
        ? 'Escribe un mensaje...'
        : 'Sin mensajes disponibles';

  const handleToggleBlock = async () => {
    if (blockUpdating) return;
    const nextBlocked = !isBlockedByMe;
    setBlockUpdating(true);
    const previous = blockState;
    setBlockState((prev) => ({ ...prev, blockedByMe: nextBlocked }));
    if (nextBlocked) {
      setInput('');
      stopTypingSignal();
    }
    try {
      const data = await setUserBlocked(partnerId, nextBlocked);
      setBlockState({
        blockedByMe: !!data.blockedByMe,
        blockedMe: !!data.blockedMe,
      });
    } catch (err) {
      setBlockState(previous);
      alert(err.message || 'No se pudo actualizar el bloqueo');
    } finally {
      setBlockUpdating(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !effectiveCanSend) return;
    fastKeyboardSettleRef.current = true;

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
    setMessages((prev) => dedupeMessages([...prev, newMsg]));
    updateConversationPreviewCache(partnerId, partner, newMsg);
    setInput('');
    stopTypingSignal();
    setPartnerTyping(false);
    localSendMessage();

    // Send via WebSocket (same channel as typing — proven real-time).
    // The DO writes to D1, checks limits, broadcasts to receiver, and acks sender.
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
          const code = err.data?.code || '';
          if (code === 'USER_BLOCKED_BY_ME' || code === 'USER_BLOCKED_ME') {
            setBlockState((prev) => ({
              blockedByMe: code === 'USER_BLOCKED_BY_ME' ? true : prev.blockedByMe,
              blockedMe: code === 'USER_BLOCKED_ME' ? true : prev.blockedMe,
            }));
            setMessages((prev) => prev.filter((message) => message.id !== tempId));
          } else {
            setApiLimit({ remaining: 0, canSend: false, max: 5 });
          }
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

  const handleInputFocus = () => {
    setShowEmojis(false);
    if (isMobileBrowserChat) {
      setKeyboardActive(true);
      keyboardFocusedRef.current = true;
      pinOnKeyboardResizeRef.current = true;
      wasAtBottomRef.current = true;
      scrollToBottom('auto');
      settleMobileKeyboardViewport(true);
    }
    keepChatPinnedToBottom('auto');
    if (chatDebugEnabled) {
      requestAnimationFrame(() => captureChatDebug('focus'));
    }
  };

  const handleInputBlur = () => {
    stopTypingSignal();
    if (isMobileBrowserChat) {
      setKeyboardActive(false);
      setMessagesAreaHeight(null);
      keyboardFocusedRef.current = false;
      pinOnKeyboardResizeRef.current = false;
      setViewportHeight(window.innerHeight);
    }
    const fastSettle = fastKeyboardSettleRef.current || input.trim().length === 0;
    fastKeyboardSettleRef.current = false;
    settleMobileKeyboardViewport(fastSettle);
    if (chatDebugEnabled) {
      requestAnimationFrame(() => captureChatDebug('blur'));
    }
  };

  const handleBackClick = () => {
    navigate(backTarget);
  };

  const messagesAreaStyle = isMobileBrowserChat && keyboardActive && messagesAreaHeight
    ? {
        flex: '0 0 auto',
        height: `${messagesAreaHeight}px`,
      }
    : undefined;
  const shellStyle = embeddedDesktop ? { height: '100%' } : (viewportHeight ? { height: `${viewportHeight}px` } : undefined);
  const headerStyle = !embeddedDesktop && isMobileBrowserChat && viewportOffsetTop
    ? { transform: `translateY(${viewportOffsetTop}px)` }
    : undefined;
  const shellMinHeightClass = isStandaloneMobileChat ? 'min-h-screen' : 'min-h-0';
  const shellTransitionClass = isMobileBrowserChat && keyboardActive ? 'transition-[height] duration-150 ease-out' : '';
  const composerTransitionClass = isMobileBrowserChat ? 'transition-transform duration-150 ease-out' : '';
  const shellLayoutClass = embeddedDesktop
    ? 'h-full lg:min-h-0 lg:pl-0'
    : 'h-[100dvh] lg:min-h-screen lg:pl-64 xl:pl-72';
  const headerLayoutClass = embeddedDesktop
    ? 'glass relative shrink-0 border-b border-mansion-border/30 z-30'
    : 'glass fixed top-0 left-0 right-0 lg:left-64 xl:left-72 shrink-0 border-b border-mansion-border/30 safe-top z-30';
  const scrollAreaStyle = {
    ...(isMobileBrowserChat && keyboardActive && messagesAreaHeight ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: `${messagesAreaHeight}px`,
      zIndex: 10,
    } : null),
    paddingTop: embeddedDesktop ? '16px' : `${headerHeight + 14}px`,
    paddingBottom: '12px',
  };

  return (
    <>
    {!embeddedDesktop && <DesktopSidebar />}
    <div
      className={`${shellMinHeightClass} ${shellLayoutClass} bg-mansion-base flex flex-col overflow-hidden ${shellTransitionClass}`}
      style={shellStyle}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className={headerLayoutClass}
        style={headerStyle}
      >
        <div className="relative flex items-center gap-3 w-full max-w-[88rem] mx-auto px-[5vw] lg:px-[4vw] py-3 lg:gap-3 lg:py-4">
          <button
            onClick={handleBackClick}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors flex-shrink-0 lg:absolute lg:left-1 lg:top-1/2 lg:z-10 lg:w-12 lg:h-12 lg:-translate-y-1/2 lg:bg-mansion-elevated/65 lg:border lg:border-mansion-border/30 ${embeddedDesktop ? 'lg:hidden' : ''}`}
            aria-label="Volver a la lista de chats"
          >
            <ChevronLeft className="w-5 h-5 lg:w-7 lg:h-7" />
          </button>

          <div className="relative flex-shrink-0 cursor-pointer" onClick={() => navigate(`/perfiles/${partnerId}`, {
            state: {
              from: location.pathname,
              returnState: location.state || null,
              preview: partner ? {
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
              } : null,
            },
          })}>
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-mansion-border/40 lg:w-[58px] lg:h-[58px]">
              <AvatarImg src={partnerPhoto} crop={partnerPhotoCrop} alt={partner.name} className="w-full h-full" />
            </div>
          </div>

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/perfiles/${partnerId}`, {
            state: {
              from: location.pathname,
              returnState: location.state || null,
              preview: partner ? {
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
              } : null,
            },
          })}>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold text-sm text-text-primary truncate lg:text-[20px]">{partner.name}</h2>
              <span className={`hidden sm:inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] lg:text-[13px] ${partner.online ? 'text-green-400' : 'text-text-dim'}`}>
                <span className={`w-2 h-2 rounded-full ${partner.online ? 'bg-green-400' : 'bg-text-dim/70'}`} />
                {partner.online ? 'Online' : 'Offline'}
              </span>
            </div>
            {partnerTyping && (
              <p className="text-[11px] text-mansion-gold lg:text-[14px]">Escribiendo...</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleBlock}
            disabled={blockUpdating}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-60 lg:px-4 lg:py-2 lg:text-[11px] ${
              isBlockedByMe
                ? 'border-mansion-gold/35 bg-mansion-gold/15 text-mansion-gold hover:bg-mansion-gold/20'
                : 'border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15'
            }`}
            aria-label={isBlockedByMe ? `Desbloquear a ${partner.name}` : `Bloquear a ${partner.name}`}
          >
            <Ban className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">{isBlockedByMe ? 'Desbloquear' : 'Bloquear'}</span>
            <span className="sm:hidden">{isBlockedByMe ? 'Desbloq.' : 'Bloq.'}</span>
          </button>

        </div>
      </div>

      {/* Messages area */}
      <div
        className="relative flex-1 min-h-0 w-full max-w-[88rem] mx-auto"
        style={messagesAreaStyle}
      >
        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (el) {
              if (keyboardFocusedRef.current && pinOnKeyboardResizeRef.current) {
                wasAtBottomRef.current = true;
                return;
              }
              wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }
          }}
          className="h-full overflow-y-auto overscroll-y-contain px-[5vw] [scrollbar-gutter:stable] lg:px-[4vw]"
          style={scrollAreaStyle}
        >
          <div
            ref={indicatorRef}
            className="sticky top-0 z-10 flex justify-center py-2 pointer-events-none"
            style={{ transform: 'translateY(-100%)', opacity: 0, transition: 'transform 0.2s, opacity 0.2s' }}
          >
            <div className="w-7 h-7 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>

          <div className="flex min-h-full flex-col justify-end gap-5">
            {hasOlderMessages && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadOlderMessages}
                  disabled={loadingOlder}
                  className="text-xs px-3 py-1.5 rounded-full border border-mansion-border/40 text-text-muted hover:text-text-primary hover:border-mansion-gold/30 transition-colors disabled:opacity-60 lg:text-sm lg:px-4 lg:py-2"
                >
                  {loadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-center">
              <span className="text-[10px] text-text-dim bg-mansion-elevated px-3 py-1 rounded-full lg:text-xs lg:px-4 lg:py-1.5">
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
                    <div className={`flex-shrink-0 w-[50px] h-[50px] rounded-full overflow-hidden mb-0.5 lg:w-[58px] lg:h-[58px] ${isPopped ? 'chat-avatar-highlight' : ''}`}>
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
                    <p className="text-[15px] leading-relaxed lg:text-[16px]">{msg.text}</p>
                    <p className={`text-[11px] mt-1.5 flex items-center lg:text-[12px] ${isMe ? 'justify-end text-white/50 gap-1' : 'justify-end text-text-dim'}`}>
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
                <div className="flex-shrink-0 w-[50px] h-[50px] rounded-full overflow-hidden mb-0.5 lg:w-[58px] lg:h-[58px]">
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
              className="h-1 flex-shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Input area */}
      <div
        ref={composerRef}
        className={`${isStandaloneMobileChat ? 'safe-bottom ' : ''}sticky bottom-0 shrink-0 border-t border-mansion-border/30 bg-mansion-card/90 backdrop-blur-xl z-20 ${composerTransitionClass}`}
      >
        <div className="flex items-end gap-2 w-full max-w-[88rem] mx-auto px-[5vw] lg:px-[4vw] py-3">
          {/* Textarea + emoji */}
          <div className="flex-1 relative flex items-end">
            <div className="flex-1 flex items-end bg-mansion-elevated rounded-2xl border border-mansion-border/30 focus-within:border-mansion-gold/30 transition-colors min-h-[44px] lg:min-h-[52px]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                placeholder={composerPlaceholder}
                disabled={!effectiveCanSend}
                rows={1}
                className="flex-1 resize-none bg-transparent py-3 px-4 text-sm outline-none max-h-32 text-text-primary placeholder:text-text-dim disabled:opacity-50 lg:px-5 lg:py-3.5 lg:text-base"
                style={{ minHeight: '44px' }}
              />
              <button
                type="button"
                onClick={() => {
                  setShowEmojis(v => !v);
                  keepChatPinnedToBottom('auto');
                }}
                className={`flex-shrink-0 w-10 self-end pb-2.5 flex items-center justify-center transition-colors lg:w-12 lg:pb-3 ${showEmojis ? 'text-mansion-gold' : 'text-text-dim hover:text-mansion-gold'}`}
              >
                <Smile className="w-5 h-5 lg:w-5.5 lg:h-5.5" />
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
            onPointerDown={() => {
              if (input.trim() && effectiveCanSend) fastKeyboardSettleRef.current = true;
            }}
            onClick={handleSend}
            disabled={!input.trim() || !effectiveCanSend}
            className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all lg:w-12 lg:h-12 ${
              input.trim() && effectiveCanSend
                ? 'bg-mansion-crimson text-white shadow-glow-crimson'
                : 'bg-mansion-elevated text-text-dim border border-mansion-border/30'
            }`}
          >
            <Send className="w-5 h-5 lg:w-5.5 lg:h-5.5" />
          </motion.button>
        </div>
      </div>
    </div>
    {chatDebugEnabled && chatDebugMetrics && (
      <div className="fixed left-2 right-2 top-2 z-[10001] pointer-events-none lg:left-auto lg:right-3 lg:w-[360px]">
        <div className="rounded-2xl border border-amber-300/60 bg-black/88 p-3 font-mono text-[10px] leading-4 text-amber-50 shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="mb-2 flex items-center justify-between gap-3">
            <strong className="text-amber-200">chat_debug=1</strong>
            <span>{chatDebugMetrics.route}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span>innerHeight</span><span>{chatDebugMetrics.innerHeight}px</span>
            <span>vh state</span><span>{chatDebugMetrics.viewportHeightState}px</span>
            <span>vv.height</span><span>{chatDebugMetrics.vvHeight}px</span>
            <span>vv.offsetTop</span><span>{chatDebugMetrics.vvOffsetTop}px</span>
            <span>vv.pageTop</span><span>{chatDebugMetrics.vvPageTop}px</span>
            <span>offsetTop state</span><span>{chatDebugMetrics.viewportOffsetTopState}px</span>
            <span>doc.clientHeight</span><span>{chatDebugMetrics.docClientHeight}px</span>
            <span>scrollY</span><span>{chatDebugMetrics.scrollY}px</span>
            <span>root/body scroll</span><span>{chatDebugMetrics.rootScrollTop}/{chatDebugMetrics.bodyScrollTop}px</span>
            <span>--safe-top</span><span>{chatDebugMetrics.safeTopVar}</span>
            <span>--vv-top</span><span>{chatDebugMetrics.vvTopVar}</span>
            <span>header top/h</span><span>{chatDebugMetrics.headerTop}/{chatDebugMetrics.headerHeight}</span>
            <span>composer top</span><span>{chatDebugMetrics.composerTop}px</span>
            <span>composer bottom</span><span>{chatDebugMetrics.composerBottom}px</span>
            <span>composer h</span><span>{chatDebugMetrics.composerHeight}px</span>
            <span>gap bottom</span><span>{chatDebugMetrics.composerGapBottom}px</span>
            <span>chat scroll</span><span>{chatDebugMetrics.scrollTop}/{chatDebugMetrics.scrollClientHeight}/{chatDebugMetrics.scrollHeight}</span>
          </div>
          <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-[9px] text-white/72">
            <div>initial gap: {chatDebugSnapshots.initial?.composerGapBottom ?? 'n/a'}px</div>
            <div>focus gap: {chatDebugSnapshots.focus?.composerGapBottom ?? 'n/a'}px</div>
            <div>blur gap: {chatDebugSnapshots.blur?.composerGapBottom ?? 'n/a'}px</div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
