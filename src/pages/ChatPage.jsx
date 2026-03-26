import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Lock, ImageIcon, Smile } from 'lucide-react';
import { useMessageLimit } from '../hooks/useMessageLimit';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import DesktopSidebar from '../components/DesktopSidebar';
import EmojiPicker from '../components/EmojiPicker';
import { getMessageLimit, getProfile, getToken, getStoredUser, getMessages as apiGetMessages } from '../lib/api';
import { createChatSocket } from '../lib/chatSocket';

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { remaining, canSend, sendMessage: localSendMessage, max } = useMessageLimit();
  const { refresh: refreshUnread } = useUnreadMessages();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [apiLimit, setApiLimit] = useState(null);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const chatRef = useRef(null);

  // Extract partner ID from conversation ID (conv-{userId} format)
  const partnerId = id.startsWith('conv-') ? id.replace('conv-', '') : id;
  const wasAtBottomRef = useRef(true);
  const myUserIdRef = useRef(null);

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
      is_read: msg.is_read,
    };
  }

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) { navigate('/login'); return; }

    myUserIdRef.current = String(user.id);
    setLoading(true);

    // Fetch partner profile, messages (HTTP fallback), and limit in parallel
    Promise.all([
      getProfile(partnerId).then(data => setPartner(data.profile)).catch(() => null),
      apiGetMessages(partnerId).then(data => setMessages(data.messages || [])).catch(() => setMessages([])),
      getMessageLimit().then(data => setApiLimit(data)).catch(() => {}),
    ]).finally(() => {
      setLoading(false);
      refreshUnread();
    });

    // Open WebSocket connection — will replace HTTP messages with real-time data
    chatRef.current = createChatSocket(String(user.id), partnerId, token, {
      onHistory(msgs) {
        setMessages(msgs.map(m => formatMsg(m)));
        // Mark unread incoming messages as read
        const unread = msgs.filter(m => m.sender_id !== String(user.id) && !m.is_read);
        if (unread.length > 0) {
          chatRef.current?.markRead(unread.map(m => m.id));
        }
        refreshUnread();
      },
      onMessage(msg) {
        setMessages(prev => [...prev, formatMsg(msg)]);
        // Auto mark as read since we're viewing the chat
        chatRef.current?.markRead([msg.id]);
        refreshUnread();
      },
      onAck(msg) {
        // Replace the first optimistic (temp-*) message with the confirmed one
        setMessages(prev => {
          const idx = prev.findIndex(m => typeof m.id === 'string' && m.id.startsWith('temp-'));
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = formatMsg(msg);
            return updated;
          }
          return prev;
        });
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
    });

    return () => {
      chatRef.current?.close();
      chatRef.current = null;
    };
  }, [id, partnerId, navigate]);

  useEffect(() => {
    // Auto-scroll only if user was at the bottom
    if (scrollRef.current && wasAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleSend = () => {
    if (!input.trim() || !effectiveCanSend) return;

    const text = input.trim();
    const tempId = `temp-${Date.now()}`;
    const newMsg = {
      id: tempId,
      senderId: 'me',
      text,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      is_read: 0,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    localSendMessage();

    // Send via WebSocket
    chatRef.current?.send(text);
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

  return (
    <>
    <DesktopSidebar />
    <div className="h-screen bg-mansion-base flex flex-col lg:pl-64 xl:pl-72">
      {/* Header */}
      <div className="glass border-b border-mansion-border/30 safe-top z-20">
        <div className="flex items-center gap-3 px-3 py-3 lg:px-6 max-w-4xl lg:mx-auto">
          <button
            onClick={() => navigate('/mensajes')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-shrink-0 cursor-pointer" onClick={() => navigate(`/perfiles/${partnerId}`)}>
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-mansion-border/40">
              <img src={partner.avatar_url || partner.photos?.[0] || ''} alt={partner.name} className="w-full h-full object-cover" />
            </div>
            {partner.online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-mansion-card" />
            )}
          </div>

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/perfiles/${partnerId}`)}>
            <h2 className="font-semibold text-sm text-text-primary truncate">{partner.name}</h2>
            <p className={`text-[11px] ${partner.online ? 'text-green-400' : 'text-text-dim'}`}>
              {partner.online ? '● En línea' : 'Desconectado'}
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
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (el) wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-5 lg:px-6 max-w-4xl lg:mx-auto w-full"
      >
        <div className="flex items-center justify-center">
          <span className="text-[10px] text-text-dim bg-mansion-elevated px-3 py-1 rounded-full">
            Hoy
          </span>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.senderId === 'me';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18 }}
                className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {/* Partner avatar next to received messages */}
                {!isMe && (
                  <div className="flex-shrink-0 w-[50px] h-[50px] rounded-full overflow-hidden mb-0.5">
                    <img src={partner.avatar_url || partner.photos?.[0] || ''} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isMe
                      ? 'bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark text-white rounded-br-sm'
                      : 'bg-mansion-elevated text-text-primary border border-mansion-border/30 rounded-bl-sm'
                  }`}
                >
                  <p className="text-[15px] leading-relaxed">{msg.text}</p>
                  <p className={`text-[11px] mt-1.5 flex items-center ${isMe ? 'justify-end text-white/50 gap-1' : 'justify-end text-text-dim'}`}>
                    {msg.timestamp}
                    {isMe && (
                      <span className={`inline-flex ${msg.is_read ? 'text-blue-400' : 'text-white/40'}`}>
                        {msg.is_read ? (
                          <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M0.5 5.5L4 9L4.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.5 5.5L7 9L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.5 5.5L12 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5L4.5 9L10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </span>
                    )}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="safe-bottom border-t border-mansion-border/30 bg-mansion-card/90 backdrop-blur-xl">
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
                onChange={(e) => setInput(e.target.value)}
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
