import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Send, Gift, Volume2, VolumeX, X } from 'lucide-react';
import AvatarImg from './AvatarImg';

const CLOSE_BTN_CLASS = 'absolute z-30 flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60';
const CLOSE_BTN_STYLE = { top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 16 };

// Full-screen feed-style story preview. Used by StoryUploadPage and ProfilePage.
export default function StoryPreviewOverlay({
  videoUrl,
  caption = '',
  user,
  onDismiss,
  // Optional upload-flow props (not needed in profile view mode)
  onClose,
  onConfirm,
  uploading = false,
  uploadProgress = 0,
  avatarSize = 52,
  navBottomOffset = 0,
}) {
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const rafRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const actionBottom = typeof navBottomOffset === 'number'
    ? navBottomOffset + 16
    : `calc(${navBottomOffset} + 16px)`;
  const infoBottom = typeof navBottomOffset === 'number'
    ? navBottomOffset + 8
    : `calc(${navBottomOffset} + 8px)`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let playTimeoutId = null;
    let started = false;

    const startPlayback = () => {
      if (started) return;
      started = true;
      video.play().catch(() => {});
    };

    video.currentTime = 0;
    video.pause();
    video.addEventListener('canplay', startPlayback);
    if (video.readyState >= 3) startPlayback();
    playTimeoutId = setTimeout(startPlayback, 600);

    const tick = () => {
      if (progressRef.current && video.duration) {
        progressRef.current.style.width = `${(video.currentTime / video.duration) * 100}%`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (playTimeoutId) clearTimeout(playTimeoutId);
      video.removeEventListener('canplay', startPlayback);
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoUrl]);

  return (
    <>
      <video
        ref={videoRef}
        src={videoUrl}
        className="absolute inset-0 z-[1] h-full w-full object-cover"
        style={{ WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)' }}
        loop
        playsInline
        preload="auto"
        muted={isMuted}
      />

      <div className="absolute inset-0 z-20">
        {/* Close / dismiss button */}
        {!uploading && (
          <button
            type="button"
            onClick={onDismiss}
            className={CLOSE_BTN_CLASS}
            style={CLOSE_BTN_STYLE}
            aria-label="Cerrar"
          >
            <X className="h-7 w-7 text-white" />
          </button>
        )}

        {/* Right-side action icons — mobile */}
        <div className="pointer-events-none absolute right-3 flex flex-col items-center gap-6 z-[70] lg:hidden" style={{ bottom: actionBottom }}>
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
              <Heart className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-[11px] font-semibold mt-1 drop-shadow tabular-nums">0</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
              <Send className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
              <Gift className="w-6 h-6 text-mansion-gold" />
            </div>
          </div>
          <div className="flex flex-col items-center" onClick={() => setIsMuted(m => !m)} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
            <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
              {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </div>
          </div>
        </div>

        {/* Desktop mute button (inside card, since there are no action icons to the right) */}
        <button
          type="button"
          onClick={() => setIsMuted(m => !m)}
          className="hidden lg:flex absolute z-30 h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
          style={{ bottom: 52, right: 16 }}
          aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* User info + caption — desktop */}
        <div className="hidden lg:flex absolute left-5 bottom-8 z-20 flex-col items-start gap-2.5 max-w-[360px]">
          <div className="flex flex-col items-start gap-2.5">
            <div className="rounded-full border-[2.5px] border-white/80 overflow-hidden bg-mansion-elevated shadow-lg" style={{ width: avatarSize + 12, height: avatarSize + 12 }}>
              {user?.avatar_url
                ? <AvatarImg src={user.avatar_url} crop={user.avatar_crop} alt={user.username} className="w-full h-full" />
                : <div className="w-full h-full flex items-center justify-center text-white/60 text-xl font-bold">{(user?.username || '?')[0]}</div>
              }
            </div>
            <p className="text-white font-bold text-xl leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>@{user?.username || 'usuario'}</p>
          </div>
          {caption && <p className="text-white/90 text-lg leading-relaxed line-clamp-3" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{caption}</p>}
        </div>

        {/* User info + caption — mobile */}
        <div className="absolute left-4 right-20 z-[70] lg:hidden" style={{ bottom: infoBottom }}>
          <div className="flex flex-col items-start gap-2.5 mb-1">
            <div className="rounded-full border-2 border-white/80 overflow-hidden bg-mansion-elevated shadow-lg" style={{ width: avatarSize, height: avatarSize }}>
              {user?.avatar_url
                ? <AvatarImg src={user.avatar_url} crop={user.avatar_crop} alt={user.username} className="w-full h-full" />
                : <div className="w-full h-full flex items-center justify-center text-white/60 text-base font-bold">{(user?.username || '?')[0]}</div>
              }
            </div>
            <p className="text-white font-bold text-[16px] leading-tight drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>@{user?.username || 'usuario'}</p>
          </div>
          {caption && <p className="text-white/90 text-sm leading-relaxed line-clamp-3 drop-shadow" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{caption}</p>}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] z-30 bg-white/10 overflow-hidden">
          <div ref={progressRef} className="h-full bg-mansion-gold" style={{ width: '0%' }} />
        </div>

        {/* Publish / change buttons (upload flow only) */}
        {!uploading && onConfirm && (
          <div className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-10 sm:gap-14" style={{ top: '50%', transform: 'translate(-50%, -50%)' }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex flex-col items-center gap-2">
              <button type="button" onClick={onClose} className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-black/55 border border-white/20 backdrop-blur-md text-white hover:bg-black/65 transition-colors" aria-label="Cambiar">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
              <span className="rounded-full border border-white/10 bg-black/28 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">Cambiar</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="flex flex-col items-center gap-2">
              <button type="button" onClick={onConfirm} className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-emerald-500/40 border border-emerald-400/30 backdrop-blur-md text-white hover:bg-emerald-500/55 transition-colors" aria-label="Publicar">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <span className="rounded-full border border-white/10 bg-black/28 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">Publicar</span>
            </motion.div>
          </div>
        )}

        {/* Upload progress overlay */}
        <AnimatePresence>
          {uploading && (
            <motion.div key="upload-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                  <circle cx="28" cy="28" r="23" fill="none" stroke="url(#uploadGrad)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${uploadProgress * 144.5} 144.5`} className="transition-[stroke-dasharray] duration-300" />
                  <defs>
                    <linearGradient id="uploadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#d4af37" />
                      <stop offset="100%" stopColor="#f0d060" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-mansion-gold tabular-nums">{Math.round(uploadProgress * 100)}%</span>
              </div>
              <p className="mt-5 text-base font-semibold text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>Publicando historia…</p>
              <p className="mt-1.5 text-sm text-white/55">No cierres esta pantalla</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
