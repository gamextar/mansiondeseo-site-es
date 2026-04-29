import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { RealtimeKitProvider, useRealtimeKitClient, useRealtimeKitSelector } from '@cloudflare/realtimekit-react';

function formatCallChatTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getParticipantName(participant, fallback = 'Usuario') {
  return participant?.name || participant?.displayName || participant?.userId || fallback;
}

function TrackVideo({ track, enabled, muted = false, mirrored = false, className = '' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (enabled && track) {
      const stream = new MediaStream([track]);
      video.srcObject = stream;
      video.play?.().catch(() => {});
      return () => {
        video.srcObject = null;
      };
    }

    video.srcObject = null;
    return undefined;
  }, [enabled, track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`${className} ${mirrored ? '-scale-x-100' : ''}`}
    />
  );
}

function RemoteAudio({ participant }) {
  const audioRef = useRef(null);
  const audioTrack = participant?.audioTrack;
  const audioEnabled = Boolean(participant?.audioEnabled && audioTrack);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    if (audioEnabled && audioTrack) {
      const stream = new MediaStream([audioTrack]);
      audio.srcObject = stream;
      audio.play?.().catch(() => {});
      return () => {
        audio.srcObject = null;
      };
    }

    audio.srcObject = null;
    return undefined;
  }, [audioEnabled, audioTrack]);

  return <audio ref={audioRef} autoPlay />;
}

function ParticipantVideo({ participant, name, self = false, waiting = false, className = '' }) {
  const videoTrack = participant?.videoTrack;
  const videoEnabled = Boolean(participant?.videoEnabled && videoTrack);
  const label = name || getParticipantName(participant, waiting ? 'Esperando' : 'Usuario');

  return (
    <div className={`relative overflow-hidden bg-[#050505] ${className}`}>
      {videoEnabled ? (
        <TrackVideo
          track={videoTrack}
          enabled={videoEnabled}
          muted={self}
          mirrored={self}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#050505] px-4 text-center">
          <div className={`${self ? 'h-12 w-12' : 'h-20 w-20'} flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/65`}>
            <UserRound className={self ? 'h-6 w-6' : 'h-9 w-9'} />
          </div>
          <div>
            <p className={`${self ? 'text-xs' : 'text-base'} font-semibold text-white`}>
              {waiting ? 'Esperando conexión' : label}
            </p>
            {!waiting && (
              <p className="mt-1 text-xs text-white/45">
                Cámara apagada
              </p>
            )}
          </div>
        </div>
      )}

      {!self && participant && <RemoteAudio participant={participant} />}
    </div>
  );
}

function CallControlButton({ active = true, danger = false, disabled = false, label, onClick, children }) {
  const activeClasses = danger
    ? 'border-red-300/20 bg-red-500/[0.92] text-white hover:bg-red-500'
    : active
      ? 'border-white/15 bg-white/[0.12] text-white hover:bg-white/[0.18]'
      : 'border-mansion-gold/30 bg-mansion-gold text-black hover:bg-mansion-gold/90';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full border shadow-2xl backdrop-blur transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60 ${activeClasses}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function CallTextDock() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef(null);

  const roomJoined = useRealtimeKitSelector((meeting) => Boolean(meeting?.self?.roomJoined));
  const selfId = useRealtimeKitSelector((meeting) => meeting?.self?.id || '');
  const chat = useRealtimeKitSelector((meeting) => meeting?.chat);
  const messages = useRealtimeKitSelector((meeting) => meeting?.chat?.messages || []);
  const textMessages = messages.filter((item) => item?.type === 'text').slice(-4);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [textMessages.length]);

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

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/[0.88] to-transparent px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        {textMessages.length > 0 && (
          <div className="pointer-events-auto max-h-28 space-y-2 overflow-y-auto pr-32 lg:pr-44">
            {textMessages.map((item) => {
              const mine = selfId && item.userId === selfId;
              return (
                <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 shadow-xl backdrop-blur ${mine ? 'bg-mansion-gold text-black' : 'bg-black/[0.58] text-white ring-1 ring-white/10'}`}>
                    {!mine && (
                      <p className="mb-0.5 truncate text-[11px] font-semibold text-mansion-gold/90">
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
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {sendError && (
          <p className="pointer-events-auto text-xs text-red-200">
            {sendError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="pointer-events-auto flex items-end gap-2">
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
            placeholder={roomJoined ? 'Mensaje' : 'Conectando...'}
            className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl border border-white/10 bg-black/[0.72] px-4 py-3 text-sm text-white shadow-2xl outline-none backdrop-blur transition-colors placeholder:text-white/[0.38] focus:border-mansion-gold/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!message.trim() || !roomJoined || sending}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mansion-gold text-black shadow-2xl transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Enviar mensaje"
            title="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function FaceTimeSurface({ partnerName, joining, closing, onLeave }) {
  const self = useRealtimeKitSelector((meeting) => meeting?.self);
  const roomJoined = useRealtimeKitSelector((meeting) => Boolean(meeting?.self?.roomJoined));
  const activeParticipants = useRealtimeKitSelector((meeting) => meeting?.participants?.active?.toArray?.() || []);
  const joinedParticipants = useRealtimeKitSelector((meeting) => meeting?.participants?.joined?.toArray?.() || []);

  const remoteActive = activeParticipants.find((participant) => participant?.id !== self?.id);
  const remoteJoined = joinedParticipants.find((participant) => participant?.id !== self?.id);
  const remoteParticipant = remoteActive || remoteJoined || null;
  const remoteName = getParticipantName(remoteParticipant, partnerName || 'Usuario');
  const selfName = getParticipantName(self, 'Vos');
  const waiting = roomJoined && !remoteParticipant;

  const handleToggleAudio = useCallback(() => {
    if (!self) return;
    if (self.audioEnabled) {
      self.disableAudio?.().catch(() => {});
    } else {
      self.enableAudio?.().catch(() => {});
    }
  }, [self]);

  const handleToggleVideo = useCallback(() => {
    if (!self) return;
    if (self.videoEnabled) {
      self.disableVideo?.().catch(() => {});
    } else {
      self.enableVideo?.().catch(() => {});
    }
  }, [self]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <ParticipantVideo
        participant={remoteParticipant}
        name={remoteName}
        waiting={waiting}
        className="absolute inset-0 h-full w-full"
      />

      {(joining || !roomJoined) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/[0.52] text-white backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold animate-spin" />
            <p className="text-sm font-medium text-white/75">Conectando...</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-[112px] right-3 z-40 h-36 w-24 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl lg:bottom-[116px] lg:right-6 lg:h-44 lg:w-32">
        <ParticipantVideo
          participant={self}
          name={selfName}
          self
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent px-2 pb-2 pt-8">
          <p className="truncate text-[11px] font-semibold text-white/90">
            Vos
          </p>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-[126px] left-4 z-40 flex items-center gap-2 lg:left-1/2 lg:-translate-x-1/2">
        <CallControlButton
          active={Boolean(self?.audioEnabled)}
          disabled={!self || closing}
          label={self?.audioEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
          onClick={handleToggleAudio}
        >
          {self?.audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </CallControlButton>
        <CallControlButton
          active={Boolean(self?.videoEnabled)}
          disabled={!self || closing}
          label={self?.videoEnabled ? 'Apagar cámara' : 'Activar cámara'}
          onClick={handleToggleVideo}
        >
          {self?.videoEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        </CallControlButton>
        <CallControlButton
          danger
          disabled={closing}
          label="Finalizar"
          onClick={onLeave}
        >
          <PhoneOff className="h-5 w-5" />
        </CallControlButton>
      </div>

      <CallTextDock />
    </div>
  );
}

function MeetingSurface({ authToken, partnerName, closing = false, onLeave, onError }) {
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
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
    setJoining(false);
    initMeeting({
      authToken,
      defaults: {
        audio: true,
        video: true,
      },
    }).then(async (client) => {
      if (cancelled) {
        client?.leave?.('disconnected').catch(() => {});
        return;
      }
      meetingRef.current = client;
      setLoading(false);
      setJoining(true);
      try {
        if (!client?.self?.roomJoined) {
          const join = client?.joinRoom || client?.join;
          await join?.call(client);
        }
      } catch (err) {
        if (!cancelled) onErrorRef.current?.(err);
      } finally {
        if (!cancelled) setJoining(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        setLoading(false);
        setJoining(false);
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
      {loading || !meeting ? (
        <div className="flex h-full items-center justify-center bg-black text-text-secondary">
          <div className="h-8 w-8 rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold animate-spin" />
        </div>
      ) : (
        <FaceTimeSurface
          partnerName={partnerName}
          joining={joining}
          closing={closing}
          onLeave={onLeave}
        />
      )}
    </RealtimeKitProvider>
  );
}

export default function VideoCallModal({ call, partnerName = '', onClose, onError }) {
  const [closing, setClosing] = useState(false);
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

  if (!call?.authToken) return null;

  return (
    <div className="fixed inset-0 z-[10020] flex bg-black">
      <div className="relative flex h-full w-full flex-col bg-black">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-4 text-white lg:px-6">
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
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/[0.55] text-white/80 backdrop-blur transition-colors hover:text-white disabled:opacity-60"
            aria-label="Cerrar videollamada"
            title="Cerrar videollamada"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <MeetingSurface
            authToken={call.authToken}
            partnerName={partnerName || call.partnerName || 'Usuario'}
            closing={closing}
            onLeave={handleClose}
            onError={handleError}
          />
        </div>
      </div>
    </div>
  );
}
