import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, PhoneOff, Send, X } from 'lucide-react';
import { RealtimeKitProvider, useRealtimeKitClient, useRealtimeKitSelector } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';

function formatCallChatTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function InCallChatPanel({ open, onClose, onIncomingMessage }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);
  const previousCountRef = useRef(0);

  const roomJoined = useRealtimeKitSelector((meeting) => Boolean(meeting?.self?.roomJoined));
  const selfId = useRealtimeKitSelector((meeting) => meeting?.self?.id || '');
  const chat = useRealtimeKitSelector((meeting) => meeting?.chat);
  const messages = useRealtimeKitSelector((meeting) => meeting?.chat?.messages || []);

  useEffect(() => {
    const previousCount = previousCountRef.current;
    if (messages.length > previousCount && previousCount > 0 && !open) {
      const incomingCount = messages
        .slice(previousCount)
        .filter((item) => item?.type === 'text' && (!selfId || item.userId !== selfId))
        .length;
      if (incomingCount > 0) onIncomingMessage?.(incomingCount);
    }
    previousCountRef.current = messages.length;
  }, [messages, onIncomingMessage, open, selfId]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending || !chat || !roomJoined) return;

    setSending(true);
    setSendError('');
    try {
      await chat.sendTextMessage(trimmed);
      setMessage('');
    } catch (err) {
      console.error('[VideoCallChat] send error:', err);
      setSendError('No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <aside className="pointer-events-auto absolute bottom-24 right-3 top-20 z-30 flex w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/[0.82] text-white shadow-2xl backdrop-blur-xl lg:right-6">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Chat</p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-mansion-gold/85">
            Videollamada
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Cerrar chat"
          title="Cerrar chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.filter((item) => item?.type === 'text').length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-white/45">
            Sin mensajes todavía.
          </div>
        ) : (
          messages
            .filter((item) => item?.type === 'text')
            .map((item) => {
              const mine = selfId && item.userId === selfId;
              return (
                <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${mine ? 'bg-mansion-gold text-black' : 'bg-white/10 text-white'}`}>
                    {!mine && (
                      <p className="mb-1 truncate text-[11px] font-semibold text-mansion-gold/90">
                        {item.displayName || 'Usuario'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {item.message}
                    </p>
                    <p className={`mt-1 text-right text-[10px] ${mine ? 'text-black/55' : 'text-white/40'}`}>
                      {formatCallChatTime(item.time || item.timeMs)}
                    </p>
                  </div>
                </div>
              );
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      {sendError && (
        <p className="border-t border-white/10 px-4 pt-3 text-xs text-red-200">
          {sendError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-white/10 p-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          disabled={!roomJoined || sending}
          rows={1}
          maxLength={500}
          placeholder={roomJoined ? 'Escribir mensaje' : 'Conectando...'}
          className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-mansion-gold/60 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!message.trim() || !roomJoined || sending}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mansion-gold text-black transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Enviar mensaje"
          title="Enviar mensaje"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}

function MeetingSurface({ authToken, chatOpen, onCloseChat, onIncomingChatMessage, onLeave, onError }) {
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const [loading, setLoading] = useState(true);
  const meetingRef = useRef(null);
  const onLeaveRef = useRef(onLeave);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    initMeeting({
      authToken,
      defaults: {
        audio: true,
        video: true,
      },
    }).then((client) => {
      if (cancelled) {
        client?.leave?.('disconnected').catch(() => {});
        return;
      }
      meetingRef.current = client;
      setLoading(false);
    }).catch((err) => {
      if (!cancelled) {
        setLoading(false);
        onErrorRef.current?.(err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authToken, initMeeting]);

  useEffect(() => {
    if (!meeting?.self?.on) return undefined;
    const handleRoomLeft = () => onLeaveRef.current?.();
    meeting.self.on('roomLeft', handleRoomLeft);
    return () => {
      meeting.self?.removeListener?.('roomLeft', handleRoomLeft);
    };
  }, [meeting]);

  useEffect(() => () => {
    meetingRef.current?.leave?.('disconnected').catch(() => {});
  }, []);

  return (
    <RealtimeKitProvider
      value={meeting}
      fallback={
        <div className="flex h-full items-center justify-center bg-black text-text-secondary">
          <div className="h-8 w-8 rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold animate-spin" />
        </div>
      }
    >
      <div className="relative h-full w-full overflow-hidden bg-black">
        {loading ? (
          <div className="flex h-full items-center justify-center text-text-secondary">
            <div className="h-8 w-8 rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold animate-spin" />
          </div>
        ) : (
          <RtkMeeting mode="fill" meeting={meeting} showSetupScreen={true} />
        )}
        {!loading && (
          <InCallChatPanel
            open={chatOpen}
            onClose={onCloseChat}
            onIncomingMessage={onIncomingChatMessage}
          />
        )}
      </div>
    </RealtimeKitProvider>
  );
}

export default function VideoCallModal({ call, partnerName = '', onClose, onError }) {
  const [closing, setClosing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const closeRef = useRef(onClose);
  const errorRef = useRef(onError);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  const handleClose = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try {
      await closeRef.current?.();
    } finally {
      setClosing(false);
    }
  }, [closing]);

  const handleError = useCallback((err) => {
    errorRef.current?.(err);
  }, []);

  const handleToggleChat = useCallback(() => {
    setChatOpen((value) => {
      const nextValue = !value;
      if (nextValue) setChatUnread(0);
      return nextValue;
    });
  }, []);

  const handleIncomingMessage = useCallback((count) => {
    setChatUnread((value) => value + count);
  }, []);

  if (!call?.authToken) return null;

  return (
    <div className="fixed inset-0 z-[10020] flex bg-black">
      <div className="relative flex h-full w-full flex-col bg-black">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-4 text-white lg:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white lg:text-base">
              {partnerName || call.partnerName || 'Videollamada'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-mansion-gold/90">
              Mansión Deseo
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 backdrop-blur transition-colors hover:text-white disabled:opacity-60"
            aria-label="Cerrar videollamada"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <MeetingSurface
            authToken={call.authToken}
            chatOpen={chatOpen}
            onCloseChat={() => setChatOpen(false)}
            onIncomingChatMessage={handleIncomingMessage}
            onLeave={handleClose}
            onError={handleError}
          />
        </div>

        <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleChat}
              className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-2xl backdrop-blur transition-transform hover:scale-[1.03]"
              aria-label={chatOpen ? 'Cerrar chat' : 'Abrir chat'}
              title={chatOpen ? 'Cerrar chat' : 'Abrir chat'}
            >
              <MessageCircle className="h-5 w-5" />
              {chatUnread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-mansion-gold px-1 text-[10px] font-bold text-black">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={closing}
              className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              <PhoneOff className="h-4 w-4" />
              Finalizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
