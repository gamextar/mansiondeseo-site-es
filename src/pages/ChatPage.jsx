import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Lock, ImageIcon, Smile } from 'lucide-react';
import { mockConversations, mockMessages } from '../data/mockMessages';
import { useMessageLimit } from '../hooks/useMessageLimit';
import DesktopSidebar from '../components/DesktopSidebar';
import { getMessages as apiGetMessages, sendMessage as apiSendMessage, getMessageLimit, getToken } from '../lib/api';

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { remaining, canSend, sendMessage: localSendMessage, max } = useMessageLimit();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [apiLimit, setApiLimit] = useState(null);
  const scrollRef = useRef(null);

  const conv = mockConversations.find((c) => c.id === id);

  // Determine the partner's user ID (for API calls) from the conversation
  const partnerId = conv?.profileId || id;

  useEffect(() => {
    if (getToken()) {
      apiGetMessages(partnerId)
        .then(data => {
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            setMessages(mockMessages[id] || []);
          }
        })
        .catch(() => setMessages(mockMessages[id] || []));

      getMessageLimit()
        .then(data => setApiLimit(data))
        .catch(() => {});
    } else {
      setMessages(mockMessages[id] || []);
    }
  }, [id, partnerId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!conv) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <p className="text-text-muted">Conversación no encontrada</p>
      </div>
    );
  }

  const effectiveRemaining = apiLimit ? apiLimit.remaining : remaining;
  const effectiveCanSend = apiLimit ? apiLimit.canSend : canSend;
  const effectiveMax = apiLimit ? apiLimit.max : max;

  const handleSend = async () => {
    if (!input.trim() || !effectiveCanSend) return;

    const text = input.trim();
    const newMsg = {
      id: `m${messages.length + 1}`,
      senderId: 'me',
      text,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    localSendMessage();

    // Send via API
    if (getToken()) {
      try {
        await apiSendMessage(partnerId, text);
        // Refresh limit
        getMessageLimit().then(data => setApiLimit(data)).catch(() => {});
      } catch (err) {
        // If limit exceeded, show error
        if (err.status === 403) {
          setApiLimit({ remaining: 0, canSend: false, max: 5, sent: 5 });
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

  return (
    <>
    <DesktopSidebar />
    <div className="h-screen bg-mansion-base flex flex-col lg:pl-64 xl:pl-72">
      {/* Header */}
      <div className="glass border-b border-mansion-border/30 safe-top z-20">
        <div className="flex items-center gap-3 px-3 py-3 lg:px-6 max-w-4xl lg:mx-auto">
          <button
            onClick={() => navigate('/mensajes')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <img src={conv.avatar} alt={conv.name} className="w-full h-full object-cover" />
            </div>
            {conv.online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-mansion-card" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-sm text-text-primary truncate">{conv.name}</h2>
            <p className="text-[11px] text-text-dim">
              {conv.online ? 'En línea' : 'Última vez: ' + conv.timestamp}
            </p>
          </div>
        </div>

        {/* Message limit banner */}
        <div className="px-4 pb-2 lg:px-6 max-w-4xl lg:mx-auto">
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            effectiveRemaining <= 2
              ? 'bg-mansion-crimson/10 border border-mansion-crimson/20'
              : 'bg-mansion-gold/5 border border-mansion-gold/10'
          }`}>
            <Lock className={`w-3.5 h-3.5 flex-shrink-0 ${
              effectiveRemaining <= 2 ? 'text-mansion-crimson' : 'text-mansion-gold'
            }`} />
            <span className={effectiveRemaining <= 2 ? 'text-mansion-crimson' : 'text-mansion-gold'}>
              Te quedan <strong>{effectiveRemaining}</strong> mensajes hoy
            </span>
            <div className="flex-1" />
            {/* Progress bar */}
            <div className="w-16 h-1.5 bg-mansion-elevated rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  effectiveRemaining <= 2
                    ? 'bg-mansion-crimson'
                    : 'bg-mansion-gold'
                }`}
                initial={false}
                animate={{ width: `${(effectiveRemaining / effectiveMax) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 lg:px-6 max-w-4xl lg:mx-auto w-full"
      >
        {/* Date separator */}
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
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? 'bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark text-white rounded-br-md'
                      : 'bg-mansion-elevated text-text-primary border border-mansion-border/30 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p className={`text-[10px] mt-1 text-right ${
                    isMe ? 'text-white/50' : 'text-text-dim'
                  }`}>
                    {msg.timestamp}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="safe-bottom border-t border-mansion-border/30 bg-mansion-card/80 backdrop-blur-lg">
        <div className="flex items-end gap-2 px-3 py-3 lg:px-6 max-w-4xl lg:mx-auto">
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-text-dim hover:text-text-muted transition-colors flex-shrink-0">
            <ImageIcon className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={effectiveCanSend ? 'Escribe un mensaje...' : 'Sin mensajes disponibles'}
              disabled={!effectiveCanSend}
              rows={1}
              className="w-full resize-none max-h-24 py-2.5 pr-10 text-sm !rounded-2xl"
              style={{ minHeight: '42px' }}
            />
            <button className="absolute right-2 bottom-1.5 w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-text-muted">
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || !canSend}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              input.trim() && canSend
                ? 'bg-mansion-crimson text-white shadow-glow-crimson'
                : 'bg-mansion-elevated text-text-dim'
            }`}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
    </>
  );
}
