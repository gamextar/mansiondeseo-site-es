import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneOff, X } from 'lucide-react';
import { RealtimeKitProvider, useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';

function MeetingSurface({ authToken, onLeave, onError }) {
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
      <div className="h-full w-full overflow-hidden bg-black">
        {loading ? (
          <div className="flex h-full items-center justify-center text-text-secondary">
            <div className="h-8 w-8 rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold animate-spin" />
          </div>
        ) : (
          <RtkMeeting mode="fill" meeting={meeting} showSetupScreen={true} />
        )}
      </div>
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
            onLeave={handleClose}
            onError={handleError}
          />
        </div>

        <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-20 flex justify-center">
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            <PhoneOff className="h-4 w-4" />
            Finalizar
          </button>
        </div>
      </div>
    </div>
  );
}
