import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Send, Plus, Volume2, VolumeX, Play, Film, ChevronUp, ChevronDown, Gift } from 'lucide-react';
import { getStories, toggleFavorite } from '../lib/api';
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

function StoryCard({ story, isActive, onFavorite, isMuted, onToggleMute, gradientHeight, gradientOpacity, navBottomOffset }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
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
      {/* Video panel — on desktop, a centered rounded container; on mobile, fullscreen */}
      <div className="relative w-full h-full lg:h-[calc(100%-32px)] lg:max-w-[520px] lg:mx-auto lg:my-4 lg:rounded-2xl lg:overflow-hidden">
        {/* Video */}
        <video
          ref={videoRef}
          src={story.video_url}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)' }}
          loop
          playsInline
          muted={isMuted}
          preload="auto"
          onClick={togglePlay}
          onEnded={handleVideoEnd}
        />

        {/* Play/Pause overlay */}
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

        {/* Gradient overlays */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: gradientHeight,
            background: `linear-gradient(to top, rgba(0,0,0,${(gradientOpacity/100).toFixed(2)}), rgba(0,0,0,0.04), transparent)`,
          }}
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none lg:rounded-t-2xl" />

        {/* Mobile action icons — inside video */}
        <div
          className="absolute right-3 flex flex-col items-center gap-6 z-20 lg:hidden"
          style={{ bottom: `${navBottomOffset + 16}px` }}
        >
          <MobileActionButtons story={story} onFavorite={onFavorite} onToggleMute={onToggleMute} isMuted={isMuted} navigate={navigate} />
        </div>

        {/* Desktop mute button — top-right corner of video */}
        <button onClick={onToggleMute} className="hidden lg:flex absolute top-4 right-4 z-20 rounded-full bg-black/40 backdrop-blur-sm items-center justify-center" style={{ width: 44, height: 44 }}>
          {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>

        {/* Bottom user info + caption */}
        <div
          className="absolute left-4 right-20 z-20 lg:left-auto lg:right-5 lg:max-w-[260px] lg:text-right"
          style={{ bottom: `${navBottomOffset + 8}px` }}
        >
          <button
            onClick={() => navigate(`/perfiles/${story.user_id}`)}
            className="block text-left lg:text-right lg:w-full mb-1"
          >
            <p className="text-white font-bold text-[15px] lg:text-lg leading-tight drop-shadow-lg">@{story.username}</p>
          </button>

          {story.caption && (
            <p className="text-white/90 text-sm lg:text-base leading-relaxed line-clamp-3 drop-shadow">{story.caption}</p>
          )}

          <p className="text-white/40 text-[11px] lg:text-xs mt-1.5">{timeAgo(story.created_at)}</p>
        </div>

        {/* Desktop bottom info override position */}
        <style>{`
          @media (min-width: 1024px) {
            .desktop-bottom-info { bottom: 20px !important; }
          }
        `}</style>

        {/* Progress bar at top */}
        {isActive && (
          <div className="absolute top-0 left-0 right-0 h-[2px] z-30 lg:rounded-t-2xl overflow-hidden">
            <motion.div
              className="h-full bg-mansion-gold"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 15, ease: 'linear' }}
            />
          </div>
        )}
      </div>

      {/* Desktop action icons — outside the video panel to the right */}
      <div className="hidden lg:flex absolute flex-col items-center gap-5 z-20" style={{ right: 'calc(50% - 330px)', bottom: '60px' }}>
        <DesktopActionButtons story={story} onFavorite={onFavorite} navigate={navigate} />
      </div>
    </div>
  );
}

/* Mobile action buttons (inside video, smaller) */
function MobileActionButtons({ story, onFavorite, onToggleMute, isMuted, navigate }) {
  return (
    <>
      <button onClick={() => onFavorite(story.user_id)} className="flex flex-col items-center">
        <div className={`rounded-full flex items-center justify-center ${story.favorited ? 'bg-mansion-crimson/25' : 'bg-black/30 backdrop-blur-sm'}`} style={{ width: 52, height: 52 }}>
          <Heart className={`w-7 h-7 ${story.favorited ? 'text-mansion-crimson fill-mansion-crimson' : 'text-white'}`} />
        </div>
      </button>
      <button onClick={() => navigate(`/mensajes/${story.user_id}`)} className="flex flex-col items-center">
        <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
          <Send className="w-6 h-6 text-white" />
        </div>
      </button>
      <button onClick={() => navigate(`/perfiles/${story.user_id}`)} className="flex flex-col items-center">
        <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
          <Gift className="w-6 h-6 text-mansion-gold" />
        </div>
      </button>
      <button onClick={onToggleMute} className="flex flex-col items-center">
        <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
          {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
        </div>
      </button>
      <button onClick={() => navigate(`/perfiles/${story.user_id}`)} className="flex flex-col items-center">
        <div className="w-14 h-14 rounded-full border-[2.5px] border-white/80 overflow-hidden bg-mansion-elevated shadow-lg">
          {story.avatar_url ? (
            <AvatarImg src={story.avatar_url} crop={story.avatar_crop} alt={story.username} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60 text-base font-bold">{(story.username || '?')[0]}</div>
          )}
        </div>
      </button>
    </>
  );
}

/* Desktop action buttons (outside video, bigger) */
function DesktopActionButtons({ story, onFavorite, navigate }) {
  return (
    <>
      <button onClick={() => onFavorite(story.user_id)} className="flex flex-col items-center">
        <div className={`rounded-full flex items-center justify-center ${story.favorited ? 'bg-mansion-crimson/25' : 'bg-mansion-card/60 border border-white/10'}`} style={{ width: 60, height: 60 }}>
          <Heart className={`w-8 h-8 ${story.favorited ? 'text-mansion-crimson fill-mansion-crimson' : 'text-white'}`} />
        </div>
      </button>
      <button onClick={() => navigate(`/mensajes/${story.user_id}`)} className="flex flex-col items-center">
        <div className="rounded-full bg-mansion-card/60 border border-white/10 flex items-center justify-center" style={{ width: 60, height: 60 }}>
          <Send className="w-7 h-7 text-white" />
        </div>
      </button>
      <button onClick={() => navigate(`/perfiles/${story.user_id}`)} className="flex flex-col items-center">
        <div className="rounded-full bg-mansion-card/60 border border-white/10 flex items-center justify-center" style={{ width: 60, height: 60 }}>
          <Gift className="w-7 h-7 text-mansion-gold" />
        </div>
      </button>
      <button onClick={() => navigate(`/perfiles/${story.user_id}`)} className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full border-[2.5px] border-white/80 overflow-hidden bg-mansion-elevated shadow-lg">
          {story.avatar_url ? (
            <AvatarImg src={story.avatar_url} crop={story.avatar_crop} alt={story.username} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60 text-lg font-bold">{(story.username || '?')[0]}</div>
          )}
        </div>
      </button>
    </>
  );
}

export default function VideoFeedPage() {
  const navigate = useNavigate();
  const { user, siteSettings } = useAuth();
  const containerRef = useRef(null);
  const isJumpingRef = useRef(false);
  const scrollEndTimer = useRef(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDispIdx, setActiveDispIdx] = useState(1);
  const [isMuted, setIsMuted] = useState(true);

  const gradientHeight = siteSettings?.videoGradientHeight ?? 64;
  const gradientOpacity = siteSettings?.videoGradientOpacity ?? 40;
  const navHeight = siteSettings?.navHeight ?? 71;
  const navBottomOffset = (siteSettings?.navBottomPadding ?? 24) + navHeight;

  // Infinite list: clone of last item prepended, clone of first appended
  const infiniteStories = stories.length > 0
    ? [stories[stories.length - 1], ...stories, stories[0]]
    : [];

  // Real index (0-based) derived from display index
  const realActiveIndex = stories.length > 0
    ? Math.max(0, Math.min(activeDispIdx - 1, stories.length - 1))
    : 0;

  useEffect(() => {
    let cancelled = false;
    getStories()
      .then(data => {
        if (!cancelled) {
          setStories(data.stories || []);
        }
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // After stories load, snap to the first real clip.
  useEffect(() => {
    if (stories.length > 0) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.clientHeight; // index 1 = first real clip
        }
      });
    }
  }, [stories.length]);

  useEffect(() => () => clearTimeout(scrollEndTimer.current), []);

  const settleInfiniteBoundary = useCallback(() => {
    const container = containerRef.current;
    if (!container || isJumpingRef.current || stories.length === 0) return;

    const height = container.clientHeight;
    const rawIndex = Math.round(container.scrollTop / height);

    if (rawIndex === 0) {
      isJumpingRef.current = true;
      container.style.scrollSnapType = 'none';
      container.scrollTop = stories.length * height;
      setActiveDispIdx(stories.length);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.style.scrollSnapType = 'y mandatory';
          }
          isJumpingRef.current = false;
        });
      });
      return;
    }

    if (rawIndex >= stories.length + 1) {
      isJumpingRef.current = true;
      container.style.scrollSnapType = 'none';
      container.scrollTop = height;
      setActiveDispIdx(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.style.scrollSnapType = 'y mandatory';
          }
          isJumpingRef.current = false;
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
    const height = container.clientHeight;
    const rawIndex = Math.round(container.scrollTop / height);

    // Keep the previous active item while on edge clones to avoid visible jump glitches.
    if (rawIndex > 0 && rawIndex <= stories.length && rawIndex !== activeDispIdx) {
      setActiveDispIdx(rawIndex);
    }

    // Fallback for browsers where scrollend is unreliable or unavailable.
    clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => {
      settleInfiniteBoundary();
    }, 180);
  }, [activeDispIdx, stories.length, settleInfiniteBoundary]);

  const handleFavorite = useCallback(async (userId) => {
    try {
      const data = await toggleFavorite(userId);
      setStories(prev => prev.map(s =>
        s.user_id === userId ? { ...s, favorited: data.favorited } : s
      ));
    } catch {
      // Silently fail
    }
  }, []);

  const scrollByOne = useCallback((dir) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ top: dir * container.clientHeight, behavior: 'smooth' });
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-40">
        <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state
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

        {/* Bottom nav spacing */}
        <div className="h-20" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-40 lg:left-64 xl:left-72 lg:bg-mansion-base">
      {/* Video feed container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{
          scrollSnapType: 'y mandatory',
          touchAction: 'pan-y',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {infiniteStories.map((story, displayIndex) => (
          <div key={displayIndex} className="w-full flex-shrink-0" style={{ height: '100dvh' }}>
            <StoryCard
              story={story}
              isActive={displayIndex === activeDispIdx}
              onFavorite={handleFavorite}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(m => !m)}
              gradientHeight={gradientHeight}
              gradientOpacity={gradientOpacity}
              navBottomOffset={navBottomOffset}
            />
          </div>
        ))}
      </div>

      {/* Scroll arrows — desktop only, prev left / next right */}
      {stories.length > 1 && (
        <>
          <button
            onClick={() => scrollByOne(-1)}
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-mansion-card/60 backdrop-blur-sm items-center justify-center border border-white/10 hover:bg-mansion-card/80 transition-colors"
            style={{ left: 'calc(50% - 310px)' }}
          >
            <ChevronUp className="w-6 h-6 text-white/70" />
          </button>
          <button
            onClick={() => scrollByOne(1)}
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-mansion-card/60 backdrop-blur-sm items-center justify-center border border-white/10 hover:bg-mansion-card/80 transition-colors"
            style={{ right: 'calc(50% - 310px)' }}
          >
            <ChevronDown className="w-6 h-6 text-white/70" />
          </button>
        </>
      )}

      {/* Bottom safe area for nav */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-10 lg:hidden" />
    </div>
  );
}
