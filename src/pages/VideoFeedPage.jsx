import { useEffect, useLayoutEffect, useRef, useState, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Send, Plus, Volume2, VolumeX, Play, Film, ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { getStories, toggleStoryLike } from '../lib/api';
import { useAuth } from '../App';
import AvatarImg from '../components/AvatarImg';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ── Avatar size fallback; real value comes from siteSettings.videoAvatarSize ─
const AVATAR_SIZE_DEFAULT = 52;

// ── Floating hearts burst animation ──────────────────────────────────────────
function HeartBurst({ trigger }) {
  const [particles, setParticles] = useState([]);
  const prevTrigger = useRef(0);

  useEffect(() => {
    if (trigger <= prevTrigger.current) return;
    prevTrigger.current = trigger;
    const count = 10;
    const now = Date.now();
    const next = Array.from({ length: count }, (_, i) => ({
      id: `${now}-${i}`,
      x: (Math.random() - 0.5) * 110,
      y: -(60 + Math.random() * 120),
      scale: 0.6 + Math.random() * 1.0,
      rotate: (Math.random() - 0.5) * 60,
      delay: i * 40,
      dur: 700 + Math.random() * 400,
    }));
    setParticles(p => [...p, ...next]);
    setTimeout(() => setParticles(p => p.filter(x => !next.find(n => n.id === x.id))), 1600);
  }, [trigger]);

  if (!particles.length) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 50 }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            animation: `hburst-${p.id} ${p.dur}ms ease-out ${p.delay}ms forwards`,
          }}
        >
          <style>{`
            @keyframes hburst-${p.id} {
              0%   { transform: translate(-50%,-50%) translate(0px,0px) scale(0.2) rotate(${p.rotate}deg); opacity:1; }
              60%  { opacity:1; }
              100% { transform: translate(-50%,-50%) translate(${p.x}px,${p.y}px) scale(${p.scale}) rotate(${p.rotate * 2}deg); opacity:0; }
            }
          `}</style>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      ))}
    </div>
  );
}

function StoryCard({ story, videoSrc, isActive, shouldLoad, isMuted, avatarSize, onLike, navigate, gradientHeight, gradientOpacity }) {
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const rafRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  // Once src is set, never clear it — clearing causes browser to reload the video
  // which produces the black flash/glitch at boundaries. Matches original behavior.
  const loadedSrcRef = useRef(undefined);
  if (shouldLoad && videoSrc) {
    loadedSrcRef.current = videoSrc;
  }
  const activeSrc = loadedSrcRef.current;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tick = () => {
      if (!video.paused) {
        const bar = progressBarRef.current;
        if (bar && video.duration) {
          bar.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    if (isActive) {
      if (activeSrc) {
        video.currentTime = 0;
        if (progressBarRef.current) progressBarRef.current.style.width = '0%';
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
      rafRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  };

  const handleVideoEnd = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center snap-start snap-always">
      <div className="relative w-full h-full lg:h-[calc(100%-32px)] lg:max-w-[520px] lg:mx-auto lg:my-4 lg:rounded-2xl lg:overflow-hidden">
        <video
          ref={videoRef}
          src={activeSrc}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)' }}
          loop
          playsInline
          muted={isMuted}
          preload={shouldLoad ? 'auto' : 'none'}
          onEnded={handleVideoEnd}
        />
        {/* Mobile prioritizes swipe; keep tap-to-play overlay only on desktop */}
        <div className="absolute inset-0 z-10 hidden lg:block" onClick={togglePlay} />

        <AnimatePresence>
          {showPlayIcon && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              <div className="w-20 h-20 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
                <Play className={`w-10 h-10 text-white ${isPlaying ? 'hidden' : ''}`} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: gradientHeight,
            background: `linear-gradient(to top, rgba(0,0,0,${(gradientOpacity / 100).toFixed(2)}), rgba(0,0,0,0.04), transparent)`,
          }}
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none lg:rounded-t-2xl" />

        <div className="hidden lg:flex absolute left-5 bottom-8 z-20 flex-col items-start gap-2.5 max-w-[360px]">
          <button onClick={() => navigate(`/perfiles/${story.user_id}`, { state: { from: '/videos' } })} className="flex flex-col items-start gap-2.5">
            <div className="rounded-full border-[2.5px] border-white/80 overflow-hidden bg-mansion-elevated shadow-lg" style={{ width: avatarSize + 12, height: avatarSize + 12 }}>
              {story.avatar_url ? (
                <AvatarImg src={story.avatar_url} crop={story.avatar_crop} alt={story.username} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60 text-xl font-bold">{(story.username || '?')[0]}</div>
              )}
            </div>
            <p className="text-white font-bold text-xl leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.5)' }}>@{story.username}</p>
          </button>
          {story.caption && (
            <p className="text-white/90 text-lg leading-relaxed line-clamp-3" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.4)' }}>{story.caption}</p>
          )}
          <p className="text-white/40 text-sm mt-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{timeAgo(story.created_at)}</p>
        </div>

        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] z-30 overflow-hidden lg:rounded-b-2xl bg-white/10">
            <div
              ref={progressBarRef}
              className="h-full bg-mansion-gold"
              style={{ width: '0%' }}
            />
          </div>
        )}
      </div>

      <div className="hidden lg:flex absolute flex-col items-center gap-5 z-20" style={{ right: 'calc(50% - 340px)', bottom: '60px' }}>
        <DesktopActionButtons story={story} onLike={onLike} navigate={navigate} />
      </div>
    </div>
  );
}

function MobileOverlayButton({ onPress, scrollContainerRef, className = '', style, children }) {
  const gestureRef = useRef(null);
  const cleanupRef = useRef(() => {});

  useEffect(() => () => {
    cleanupRef.current?.();
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      className={className}
      style={{ ...style, touchAction: 'none' }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const gesture = {
          x: event.clientX,
          y: event.clientY,
          lastY: event.clientY,
          pointerId: event.pointerId,
          cancelled: false,
        };

        gestureRef.current = gesture;

        const handleMove = (moveEvent) => {
          const current = gestureRef.current;
          if (!current || current.pointerId !== moveEvent.pointerId) return;

          const deltaX = Math.abs(moveEvent.clientX - current.x);
          const deltaY = Math.abs(moveEvent.clientY - current.y);

          if (deltaY > 6 && deltaY > deltaX) {
            current.cancelled = true;
          }

          if (current.cancelled) {
            const container = scrollContainerRef?.current;
            if (container) {
              const moveY = moveEvent.clientY - current.lastY;
              container.scrollTop -= moveY;
            }
          }

          current.lastY = moveEvent.clientY;
        };

        const finishGesture = (endEvent) => {
          const current = gestureRef.current;
          if (!current || current.pointerId !== endEvent.pointerId) return;

          cleanupRef.current?.();
          gestureRef.current = null;

          if (!current.cancelled) {
            onPress?.();
          }
        };

        const cancelGesture = (cancelEvent) => {
          const current = gestureRef.current;
          if (!current || current.pointerId !== cancelEvent.pointerId) return;
          cleanupRef.current?.();
          gestureRef.current = null;
        };

        const cleanup = () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', finishGesture);
          window.removeEventListener('pointercancel', cancelGesture);
          cleanupRef.current = () => {};
        };

        cleanupRef.current = cleanup;
        window.addEventListener('pointermove', handleMove, { passive: true });
        window.addEventListener('pointerup', finishGesture, { passive: true });
        window.addEventListener('pointercancel', cancelGesture, { passive: true });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPress?.();
        }
      }}
    >
      {children}
    </div>
  );
}

function MobileActionButtons({ story, onLike, onToggleMute, isMuted, navigate, scrollContainerRef }) {
  const [burstTrigger, setBurstTrigger] = useState(0);

  const handleHeart = () => {
    setBurstTrigger(t => t + 1);
    onLike(story.id);
  };

  return (
    <>
      <div className="pointer-events-none flex flex-col items-center">
        <MobileOverlayButton
          onPress={handleHeart}
          scrollContainerRef={scrollContainerRef}
          className="pointer-events-auto relative"
          style={{ width: 58, height: 58 }}
        >
          <HeartBurst trigger={burstTrigger} />
          <div className={`rounded-full flex items-center justify-center transition-all duration-150 ${story.liked ? 'bg-mansion-crimson/25 scale-110' : 'bg-black/30 backdrop-blur-sm'}`} style={{ width: 58, height: 58 }}>
            <Heart className={`w-7.5 h-7.5 transition-all duration-150 ${story.liked ? 'text-mansion-crimson fill-mansion-crimson scale-110' : 'text-white'}`} />
          </div>
        </MobileOverlayButton>
        <span className="pointer-events-none text-white text-[11px] font-semibold mt-1 drop-shadow tabular-nums">{story.likes || 0}</span>
      </div>
      <MobileOverlayButton onPress={() => navigate(`/mensajes/${story.user_id}`, { state: { from: '/videos' } })} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-center">
        <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
          <Send className="w-6 h-6 text-white" />
        </div>
      </MobileOverlayButton>
      <MobileOverlayButton onPress={() => navigate(`/perfiles/${story.user_id}`, { state: { from: '/videos' } })} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-center">
        <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
          <Gift className="w-6 h-6 text-mansion-gold" />
        </div>
      </MobileOverlayButton>
      <MobileOverlayButton onPress={onToggleMute} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-center">
        <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
          {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
        </div>
      </MobileOverlayButton>
    </>
  );
}

function MobileStoryOverlay({ story, onLike, onToggleMute, isMuted, navigate, navBottomOffset, avatarSize, scrollContainerRef }) {
  if (!story) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed right-3 flex flex-col items-center gap-6 z-50 lg:hidden"
        style={{ bottom: `${navBottomOffset + 16}px` }}
      >
        <MobileActionButtons story={story} onLike={onLike} onToggleMute={onToggleMute} isMuted={isMuted} navigate={navigate} scrollContainerRef={scrollContainerRef} />
      </div>

      <div
        className="pointer-events-none fixed left-4 right-20 z-50 lg:hidden"
        style={{ bottom: `${navBottomOffset + 8}px` }}
      >
        <MobileOverlayButton onPress={() => navigate(`/perfiles/${story.user_id}`, { state: { from: '/videos' } })} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-start gap-2.5 mb-1">
          <div className="rounded-full border-2 border-white/80 overflow-hidden bg-mansion-elevated shadow-lg" style={{ width: avatarSize, height: avatarSize }}>
            {story.avatar_url ? (
              <AvatarImg src={story.avatar_url} crop={story.avatar_crop} alt={story.username} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/60 text-base font-bold">{(story.username || '?')[0]}</div>
            )}
          </div>
          <p className="text-white font-bold text-[16px] leading-tight drop-shadow-lg">@{story.username}</p>
        </MobileOverlayButton>
        {story.caption && (
          <p className="pointer-events-none text-white/90 text-sm leading-relaxed line-clamp-3 drop-shadow">{story.caption}</p>
        )}
        <p className="pointer-events-none text-white/40 text-[11px] mt-1.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{timeAgo(story.created_at)}</p>
      </div>

      <button onClick={onToggleMute} className="hidden lg:flex fixed top-4 right-4 z-50 rounded-full bg-black/40 backdrop-blur-sm items-center justify-center hover:bg-black/60 hover:scale-110 transition-all duration-200" style={{ width: 52, height: 52 }}>
        {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
      </button>
    </>
  );
}

function DesktopActionButtons({ story, onLike, navigate }) {
  const [burstTrigger, setBurstTrigger] = useState(0);

  const handleHeart = () => {
    setBurstTrigger(t => t + 1);
    onLike(story.id);
  };

  return (
    <>
      <button onClick={handleHeart} className="flex flex-col items-center group relative">
        <HeartBurst trigger={burstTrigger} />
        <div className={`rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${story.liked ? 'bg-mansion-crimson/25 group-hover:bg-mansion-crimson/40' : 'bg-mansion-card/60 border border-white/10 group-hover:bg-mansion-card/90 group-hover:border-white/25'}`} style={{ width: 72, height: 72 }}>
          <Heart className={`w-9 h-9 transition-all duration-150 ${story.liked ? 'text-mansion-crimson fill-mansion-crimson scale-110' : 'text-white'}`} />
        </div>
        <span className="text-white text-xs font-semibold mt-1.5 drop-shadow tabular-nums">{story.likes || 0}</span>
      </button>
      <button onClick={() => navigate(`/mensajes/${story.user_id}`, { state: { from: '/videos' } })} className="flex flex-col items-center group">
        <div className="rounded-full bg-mansion-card/60 border border-white/10 flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-mansion-card/90 group-hover:border-white/25" style={{ width: 72, height: 72 }}>
          <Send className="w-8 h-8 text-white" />
        </div>
      </button>
      <button onClick={() => navigate(`/perfiles/${story.user_id}`, { state: { from: '/videos' } })} className="flex flex-col items-center group">
        <div className="rounded-full bg-mansion-card/60 border border-white/10 flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-mansion-card/90 group-hover:border-white/25" style={{ width: 72, height: 72 }}>
          <Gift className="w-8 h-8 text-mansion-gold" />
        </div>
      </button>
    </>
  );
}

export default function VideoFeedPage() {
  const navigate = useNavigate();
  const { siteSettings } = useAuth();
  const containerRef = useRef(null);
  const isJumpingRef = useRef(false);
  const scrollEndTimer = useRef(null);
  const jumpUnlockTimer = useRef(null);
  const boundaryCooldownTimer = useRef(null);
  const lastScrollAtRef = useRef(0);
  const lastDesktopWheelAtRef = useRef(0);

  const cachedStories = () => {
    try {
      const raw = sessionStorage.getItem('vf_stories');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  };
  const initial = cachedStories();

  const [stories, setStories] = useState(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  const savedIdx = () => { try { const v = sessionStorage.getItem('vf_idx'); return v ? Math.max(1, parseInt(v, 10)) : 1; } catch { return 1; } };
  const savedMuted = () => { try { return sessionStorage.getItem('vf_muted') !== '0'; } catch { return true; } };

  const [activeDispIdx, setActiveDispIdx] = useState(savedIdx);
  const [boundaryOverlayIdx, setBoundaryOverlayIdx] = useState(null);
  const [isMuted, setIsMuted] = useState(savedMuted);

  const gradientHeight = siteSettings?.videoGradientHeight ?? 64;
  const gradientOpacity = siteSettings?.videoGradientOpacity ?? 40;
  const avatarSize = siteSettings?.videoAvatarSize ?? AVATAR_SIZE_DEFAULT;
  const navHeight = siteSettings?.navHeight ?? 71;
  const navBottomOffset = (siteSettings?.navBottomPadding ?? 24) + navHeight;
  const isDesktopViewport = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

  const infiniteStories = stories.length > 0
    ? [stories[stories.length - 1], ...stories, stories[0]]
    : [];
  const overlayIdx = boundaryOverlayIdx ?? activeDispIdx;
  const activeStory = infiniteStories[overlayIdx] || stories[0] || null;

  useEffect(() => {
    let cancelled = false;
    getStories()
      .then(data => {
        if (!cancelled) {
          const fresh = data.stories || [];
          setStories(fresh);
          try { sessionStorage.setItem('vf_stories', JSON.stringify(fresh)); } catch {}
        }
      })
      .catch(() => {
        if (!cancelled && stories.length === 0) setStories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (stories.length === 0 || !containerRef.current) return;

    const container = containerRef.current;
    const syncInitialPosition = () => {
      const height = container.clientHeight;
      if (!height) return false;

      const idx = Math.min(Math.max(activeDispIdx, 1), stories.length);
      container.scrollTop = height * idx;
      setBoundaryOverlayIdx(null);
      return true;
    };

    if (syncInitialPosition()) return undefined;

    let rafId = requestAnimationFrame(() => {
      syncInitialPosition();
    });

    return () => cancelAnimationFrame(rafId);
  }, [stories.length]);

  useEffect(() => {
    try { sessionStorage.setItem('vf_idx', String(activeDispIdx)); } catch {}
  }, [activeDispIdx]);
  useEffect(() => {
    try { sessionStorage.setItem('vf_muted', isMuted ? '1' : '0'); } catch {}
  }, [isMuted]);

  useEffect(() => () => {
    clearTimeout(scrollEndTimer.current);
    clearTimeout(jumpUnlockTimer.current);
    clearTimeout(boundaryCooldownTimer.current);
  }, []);

  const settleInfiniteBoundary = useCallback(() => {
    const container = containerRef.current;
    if (!container || isJumpingRef.current || stories.length === 0) return;

    const height = container.clientHeight;
    const rawIndex = Math.round(container.scrollTop / height);

    if (rawIndex === 0 || rawIndex >= stories.length + 1) {
      const now = performance.now();
      const timeSinceLastScroll = now - lastScrollAtRef.current;

      if (lastScrollAtRef.current > 0 && timeSinceLastScroll < 115) {
        clearTimeout(boundaryCooldownTimer.current);
        boundaryCooldownTimer.current = setTimeout(() => {
          settleInfiniteBoundary();
        }, 115 - timeSinceLastScroll);
        return;
      }

      // Cancel any pending fallback timer before jumping
      clearTimeout(scrollEndTimer.current);
      clearTimeout(jumpUnlockTimer.current);
      clearTimeout(boundaryCooldownTimer.current);

      isJumpingRef.current = true;
      container.style.scrollSnapType = 'none';

      if (rawIndex === 0) {
        container.scrollTop = stories.length * height;
        setActiveDispIdx(stories.length);
        setBoundaryOverlayIdx(null);
      } else {
        container.scrollTop = height;
        setActiveDispIdx(1);
        setBoundaryOverlayIdx(null);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.style.scrollSnapType = 'y mandatory';
          }
          // Short lock to absorb jump noise without making the snap feel sticky
          jumpUnlockTimer.current = setTimeout(() => {
            isJumpingRef.current = false;
          }, 28);
        });
      });
    }
  }, [stories.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const handleScrollEnd = () => {
      clearTimeout(scrollEndTimer.current);
      settleInfiniteBoundary();
    };

    container.addEventListener('scrollend', handleScrollEnd);
    return () => container.removeEventListener('scrollend', handleScrollEnd);
  }, [settleInfiniteBoundary]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || isJumpingRef.current) return;

    lastScrollAtRef.current = performance.now();

    // Safety net: if scrollSnapType got stuck as 'none' from an interrupted jump, restore it
    if (container.style.scrollSnapType === 'none') {
      container.style.scrollSnapType = 'y mandatory';
    }

    const height = container.clientHeight;
    const rawIndex = Math.round(container.scrollTop / height);

    if ((rawIndex === 0 || rawIndex === stories.length + 1) && rawIndex !== boundaryOverlayIdx) {
      setBoundaryOverlayIdx(rawIndex);
    } else if (rawIndex > 0 && rawIndex <= stories.length && boundaryOverlayIdx !== null) {
      setBoundaryOverlayIdx(null);
    }

    if (rawIndex > 0 && rawIndex <= stories.length && rawIndex !== activeDispIdx) {
      setActiveDispIdx(rawIndex);
    }

    clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => {
      settleInfiniteBoundary();
    }, 90);
  }, [activeDispIdx, boundaryOverlayIdx, settleInfiniteBoundary, stories.length]);

  const handleLike = useCallback(async (storyId) => {
    // Optimistic: flip immediately
    setStories(prev => prev.map(s =>
      s.id === storyId ? { ...s, liked: !s.liked, likes: s.liked ? Math.max(0, s.likes - 1) : s.likes + 1 } : s
    ));
    try {
      const data = await toggleStoryLike(storyId);
      // Sync with server truth
      setStories(prev => prev.map(s =>
        s.id === storyId ? { ...s, liked: data.liked, likes: data.likes } : s
      ));
    } catch {
      // Revert on failure
      setStories(prev => prev.map(s =>
        s.id === storyId ? { ...s, liked: !s.liked, likes: s.liked ? Math.max(0, s.likes - 1) : s.likes + 1 } : s
      ));
    }
  }, []);

  const scrollByOne = useCallback((dir) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ top: dir * container.clientHeight, behavior: 'smooth' });
  }, []);

  const handleDesktopWheel = useCallback((event) => {
    if (typeof window === 'undefined' || !window.matchMedia('(min-width: 1024px)').matches) {
      return;
    }

    if (stories.length <= 1 || isJumpingRef.current || Math.abs(event.deltaY) < 16) {
      return;
    }

    event.preventDefault();

    const now = performance.now();
    if (now - lastDesktopWheelAtRef.current < 420) {
      return;
    }

    lastDesktopWheelAtRef.current = now;
    scrollByOne(event.deltaY > 0 ? 1 : -1);
  }, [scrollByOne, stories.length]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-40">
        <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="fixed inset-0 bg-mansion-base flex flex-col items-center justify-center z-40 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex flex-col items-center text-center max-w-sm"
        >
          <div className="w-24 h-24 rounded-[2rem] bg-mansion-gold/10 border border-mansion-gold/20 flex items-center justify-center mb-6">
            <Film className="w-12 h-12 text-mansion-gold" />
          </div>

          <h1 className="font-display text-3xl font-bold text-text-primary mb-3">Historias</h1>
          <p className="text-text-muted mb-2">Todavía no hay historias publicadas.</p>
          <p className="text-sm text-text-dim mb-8">Sé el primero en compartir un momento con la comunidad.</p>

          <button
            onClick={() => navigate('/historia/nueva')}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-mansion-gold text-mansion-base font-semibold text-lg hover:bg-mansion-gold-light transition-colors shadow-[0_12px_30px_rgba(212,175,55,0.18)]"
          >
            <Plus className="w-5 h-5" />
            Subir mi historia
          </button>
        </motion.div>

        <div className="h-20" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-40 lg:left-64 xl:left-72 lg:bg-mansion-base">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={handleDesktopWheel}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{
          scrollSnapType: 'y mandatory',
          touchAction: 'pan-y',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {infiniteStories.map((story, displayIndex) => {
          const dist = Math.abs(displayIndex - activeDispIdx);
          const isBoundary = displayIndex <= 1 || displayIndex >= stories.length;
          const shouldLoad = dist <= 3 || isBoundary;
          return (
            <div key={displayIndex} className="w-full flex-shrink-0" style={{ height: '100dvh' }}>
              <StoryCard
                story={story}
                videoSrc={story.video_url}
                isActive={displayIndex === activeDispIdx}
                shouldLoad={shouldLoad}
                isMuted={isMuted}
                avatarSize={avatarSize}
                onLike={handleLike}
                navigate={navigate}
                gradientHeight={gradientHeight}
                gradientOpacity={gradientOpacity}
              />
            </div>
          );
        })}
      </div>

      {activeStory && (
        <div
          className="pointer-events-none fixed right-3 flex flex-col items-center gap-6 z-50 lg:hidden"
          style={{ bottom: `${navBottomOffset + 16}px` }}
        >
          <MobileActionButtons
            story={activeStory}
            onLike={handleLike}
            onToggleMute={() => setIsMuted(m => !m)}
            isMuted={isMuted}
            navigate={navigate}
            scrollContainerRef={containerRef}
          />
        </div>
      )}

      {activeStory && (
        <div
          className="pointer-events-none fixed left-4 right-20 z-50 lg:hidden"
          style={{ bottom: `${navBottomOffset + 8}px` }}
        >
          <div className="pointer-events-none flex flex-col items-start gap-2.5 mb-1">
            <MobileOverlayButton
              onPress={() => navigate(`/perfiles/${activeStory.user_id}`, { state: { from: '/videos' } })}
              scrollContainerRef={containerRef}
              className="pointer-events-auto"
              style={{ width: avatarSize, height: avatarSize }}
            >
              <div className="rounded-full border-2 border-white/80 overflow-hidden bg-mansion-elevated shadow-lg" style={{ width: avatarSize, height: avatarSize }}>
                {activeStory.avatar_url ? (
                  <AvatarImg src={activeStory.avatar_url} crop={activeStory.avatar_crop} alt={activeStory.username} className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/60 text-base font-bold">{(activeStory.username || '?')[0]}</div>
                )}
              </div>
            </MobileOverlayButton>
            <MobileOverlayButton
              onPress={() => navigate(`/perfiles/${activeStory.user_id}`, { state: { from: '/videos' } })}
              scrollContainerRef={containerRef}
              className="pointer-events-auto inline-flex items-start"
            >
              <p className="pointer-events-none text-white font-bold text-[16px] leading-tight drop-shadow-lg">@{activeStory.username}</p>
            </MobileOverlayButton>
            {activeStory.caption && (
              <p className="pointer-events-none text-white/90 text-sm leading-relaxed line-clamp-3 drop-shadow">{activeStory.caption}</p>
            )}
          </div>
        </div>
      )}

      {stories.length > 1 && (
        <>
          <button
            onClick={() => scrollByOne(-1)}
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-16 h-16 rounded-full bg-mansion-card/60 backdrop-blur-sm items-center justify-center border border-white/10 hover:bg-mansion-card/90 hover:border-white/25 hover:scale-110 transition-all duration-200"
            style={{ left: 'calc(50% - 350px)' }}
          >
            <ChevronLeft className="w-8 h-8 text-white/70" />
          </button>
          <button
            onClick={() => scrollByOne(1)}
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-16 h-16 rounded-full bg-mansion-card/60 backdrop-blur-sm items-center justify-center border border-white/10 hover:bg-mansion-card/90 hover:border-white/25 hover:scale-110 transition-all duration-200"
            style={{ right: 'calc(50% - 350px)' }}
          >
            <ChevronRight className="w-8 h-8 text-white/70" />
          </button>
        </>
      )}
    </div>
  );
}
