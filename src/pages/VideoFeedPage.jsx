import { useEffect, useLayoutEffect, useRef, useState, useCallback, useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Send, Plus, Volume2, VolumeX, Play, Film, ChevronLeft, ChevronRight, Gift, X } from 'lucide-react';
import { getStories, getPendingStoryLikes, enqueueStoryLike, flushPendingStoryLikes, subscribePendingStoryLikes, subscribeStoryLikeSync, getGiftCatalog, sendGift as apiSendGift } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import AvatarImg from '../components/AvatarImg';
import { resolveMediaUrl } from '../lib/media';
import { isSafariDesktopBrowser } from '../lib/browser';
import { getBrowserBottomNavOffset, getStandaloneBottomNavOffset } from '../lib/bottomNavConfig';
import { applyPendingViewedStoryUsers, clearPendingViewedStoryUsers, getViewedStoryUsers, markViewedStoryUser, queuePendingViewedStoryUser } from '../lib/storyViews';

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
const VIEWED_STORIES_EVENT = 'mansion-viewed-stories-updated';
const VIEWED_STORY_SYNC_DELAY_MS = 320;
const VIDEO_FEED_INDEX_KEY = 'vf_idx';
const VIDEO_FEED_MUTED_KEY = 'vf_muted';
const VIDEO_FEED_ACTIVE_STORY_KEY = 'vf_active_story';

function getStoryIdentity(story) {
  if (!story) return null;
  const storyId = String(story.story_id || story.id || '').trim();
  const userId = String(story.user_id || '').trim();
  const videoUrl = String(story.video_url || '').trim();
  if (!storyId && !userId && !videoUrl) return null;
  return { storyId, userId, videoUrl };
}

function readSavedVideoFeedStory() {
  try {
    const raw = sessionStorage.getItem(VIDEO_FEED_ACTIVE_STORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      storyId: String(parsed.storyId || '').trim(),
      userId: String(parsed.userId || '').trim(),
      videoUrl: String(parsed.videoUrl || '').trim(),
    };
  } catch {
    return null;
  }
}

function findSavedStoryIndex(stories, savedStory) {
  if (!Array.isArray(stories) || !savedStory) return -1;
  const savedStoryId = String(savedStory.storyId || '').trim();
  const savedUserId = String(savedStory.userId || '').trim();
  const savedVideoUrl = String(savedStory.videoUrl || '').trim();

  if (savedStoryId) {
    const byStoryId = stories.findIndex((story) => String(story?.story_id || story?.id || '').trim() === savedStoryId);
    if (byStoryId >= 0) return byStoryId;
  }

  if (savedUserId && savedVideoUrl) {
    const byUserAndVideo = stories.findIndex((story) => (
      String(story?.user_id || '').trim() === savedUserId
      && String(story?.video_url || '').trim() === savedVideoUrl
    ));
    if (byUserAndVideo >= 0) return byUserAndVideo;
  }

  if (savedUserId) {
    return stories.findIndex((story) => String(story?.user_id || '').trim() === savedUserId);
  }

  if (savedVideoUrl) {
    return stories.findIndex((story) => String(story?.video_url || '').trim() === savedVideoUrl);
  }

  return -1;
}

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

function normalizeStorySeed(seed) {
  if (!seed || typeof seed !== 'object') return null;
  const userId = String(seed.user_id || seed.id || '').trim();
  const videoUrl = String(seed.video_url || '').trim();
  if (!userId || !videoUrl) return null;
  return {
    id: String(seed.story_id || seed.id || userId),
    story_id: String(seed.story_id || seed.id || userId),
    user_id: userId,
    video_url: videoUrl,
    caption: String(seed.caption || ''),
    likes: Number(seed.likes || 0),
    liked: !!seed.liked,
    comments: Number(seed.comments || 0),
    created_at: String(seed.created_at || ''),
    username: String(seed.username || seed.name || ''),
    avatar_url: String(seed.avatar_url || ''),
    avatar_crop: seed.avatar_crop || null,
  };
}

function mergeSeedStory(stories, seedStory) {
  const list = Array.isArray(stories) ? stories : [];
  if (!seedStory) return list;
  const filtered = list.filter((story) => String(story?.user_id || '') !== String(seedStory.user_id));
  return [seedStory, ...filtered];
}

function applyPendingStoryLikeState(inputStories, pendingLikes = {}) {
  if (!Array.isArray(inputStories) || inputStories.length === 0) return inputStories;

  return inputStories.map((story) => {
    const pending = pendingLikes?.[story.id];
    if (!pending || typeof pending.liked !== 'boolean' || story.liked === pending.liked) {
      return story;
    }

    const currentLikes = Number(story.likes || 0);
    const nextLikes = pending.liked
      ? currentLikes + 1
      : Math.max(0, currentLikes - 1);

    return {
      ...story,
      liked: pending.liked,
      likes: nextLikes,
    };
  });
}

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

function StoryCard({ story, videoSrc, isActive, shouldLoad, isMuted, avatarSize, onLike, navigate, gradientHeight, gradientOpacity, resetOnDeactivate = true, onGift, isOwnStory = false, onRevealReady, enableCinematicReveal = false }) {
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const rafRef = useRef(null);
  const revealSentRef = useRef(false);
  const userPausedRef = useRef(false);
  const recoveryTimerRef = useRef(null);
  const playAttemptIdRef = useRef(0);
  const lastRecoveryAtRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoResetToken, setVideoResetToken] = useState(0);

  // Once src is set, never clear it — clearing causes browser to reload the video
  // which produces the black flash/glitch at boundaries. Matches original behavior.
  const loadedSrcRef = useRef(undefined);
  if (shouldLoad && videoSrc) {
    loadedSrcRef.current = videoSrc;
  }
  const activeSrc = loadedSrcRef.current ? resolveMediaUrl(loadedSrcRef.current) : loadedSrcRef.current;

  useEffect(() => {
    revealSentRef.current = false;
    setIsVideoReady(false);
  }, [activeSrc]);

  const notifyRevealReady = useCallback(() => {
    if (!isActive || !onRevealReady || revealSentRef.current) return;
    revealSentRef.current = true;
    onRevealReady();
  }, [isActive, onRevealReady]);

  const resetSuspendedVideo = useCallback(() => {
    if (!isActive || !activeSrc || userPausedRef.current) return;

    const now = Date.now();
    if (now - lastRecoveryAtRef.current < 900) return;
    lastRecoveryAtRef.current = now;

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.load();
      } catch {}
    }

    setIsPlaying(false);
    setIsVideoReady(false);
    setVideoResetToken((token) => token + 1);
  }, [activeSrc, isActive]);

  const attemptPlay = useCallback((options = {}) => {
    const video = videoRef.current;
    if (!video || !isActive || !activeSrc || userPausedRef.current) return;

    const { verify = false } = options;
    const attemptId = playAttemptIdRef.current + 1;
    playAttemptIdRef.current = attemptId;
    const startedAt = Number(video.currentTime || 0);

    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }

    video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));

    if (!verify || typeof window === 'undefined') return;

    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      if (playAttemptIdRef.current !== attemptId || !isActive || userPausedRef.current) return;

      const currentVideo = videoRef.current;
      if (!currentVideo) return;

      const readyEnough = currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      const advanced = Number(currentVideo.currentTime || 0) > startedAt + 0.04;
      const looksSuspended = currentVideo.paused || !readyEnough || (!advanced && !currentVideo.ended);
      if (looksSuspended) resetSuspendedVideo();
    }, 900);
  }, [activeSrc, isActive, resetSuspendedVideo]);

  useEffect(() => {
    if (isActive) userPausedRef.current = false;
  }, [activeSrc, isActive]);

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
      attemptPlay();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      if (resetOnDeactivate) {
        video.currentTime = 0;
      }
      if (progressBarRef.current) progressBarRef.current.style.width = '0%';
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [attemptPlay, isActive]);

  useEffect(() => {
    if (!isActive || !activeSrc) return;

    const video = videoRef.current;
    if (!video) return;

    const handleReady = () => {
      setIsVideoReady(true);
      notifyRevealReady();
      attemptPlay();
    };

    video.addEventListener('loadeddata', handleReady);
    video.addEventListener('canplay', handleReady);

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      notifyRevealReady();
      attemptPlay();
    }

    return () => {
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('canplay', handleReady);
    };
  }, [activeSrc, attemptPlay, isActive, notifyRevealReady]);

  useEffect(() => {
    if (!isActive || !activeSrc || typeof window === 'undefined') return undefined;

    const resumeActiveVideo = () => {
      if (document.visibilityState === 'hidden' || userPausedRef.current) return;
      attemptPlay({ verify: true });
    };

    const timerA = window.setTimeout(resumeActiveVideo, 80);
    const timerB = window.setTimeout(resumeActiveVideo, 260);
    const timerC = window.setTimeout(resumeActiveVideo, 900);
    window.addEventListener('pageshow', resumeActiveVideo);
    window.addEventListener('focus', resumeActiveVideo);
    document.addEventListener('visibilitychange', resumeActiveVideo);

    return () => {
      window.clearTimeout(timerA);
      window.clearTimeout(timerB);
      window.clearTimeout(timerC);
      window.removeEventListener('pageshow', resumeActiveVideo);
      window.removeEventListener('focus', resumeActiveVideo);
      document.removeEventListener('visibilitychange', resumeActiveVideo);
    };
  }, [activeSrc, attemptPlay, isActive]);

  useEffect(() => () => {
    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || !isPlaying) {
      userPausedRef.current = false;
      attemptPlay({ verify: true });
    } else {
      userPausedRef.current = true;
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
      <div
        data-story-card-frame="true"
        className="relative w-full h-full lg:h-[calc(100%-32px)] lg:max-w-[520px] lg:mx-auto lg:my-4 lg:rounded-2xl lg:overflow-hidden"
      >
        {/* eslint-disable-next-line */}
        <video
          key={`${activeSrc || 'empty-video'}-${videoResetToken}`}
          ref={videoRef}
          src={activeSrc}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            opacity: enableCinematicReveal ? (isVideoReady ? 1 : 0) : 1,
          }}
          loop
          playsInline
          webkit-playsinline="true"
          muted={isMuted}
          autoPlay
          preload={isActive ? 'auto' : 'metadata'}
          onEnded={handleVideoEnd}
          onClick={togglePlay}
        />

        <div
          className="absolute inset-0 pointer-events-none bg-black transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ opacity: enableCinematicReveal ? (isVideoReady ? 0 : 1) : 0 }}
        />

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
                <AvatarImg src={story.avatar_url} crop={story.avatar_crop} cover alt={story.username} className="w-full h-full" />
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

      <div className="hidden lg:flex absolute flex-col items-center gap-5 z-20" style={{ right: 'calc(50% - 350px)', bottom: '60px' }}>
        <DesktopActionButtons story={story} onLike={onLike} navigate={navigate} onGift={onGift} isOwnStory={isOwnStory} />
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

function MobileActionButtons({ story, onLike, onToggleMute, isMuted, navigate, scrollContainerRef, onGift, isOwnStory = false }) {
  const [burstTrigger, setBurstTrigger] = useState(0);

  const handleHeart = () => {
    setBurstTrigger(t => t + 1);
    onLike(story.id);
  };

  return (
    <>
      {!isOwnStory && (
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
      )}
      {!isOwnStory && (
        <MobileOverlayButton onPress={() => navigate(`/mensajes/${story.user_id}`, { state: { from: '/videos' } })} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-center">
          <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
            <Send className="w-6 h-6 text-white" />
          </div>
        </MobileOverlayButton>
      )}
      {!isOwnStory && (
        <MobileOverlayButton onPress={() => onGift(story)} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-center">
          <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
            <Gift className="w-6 h-6 text-mansion-gold" />
          </div>
        </MobileOverlayButton>
      )}
      <MobileOverlayButton onPress={onToggleMute} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-center">
        <div className="rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center" style={{ width: 52, height: 52 }}>
          {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
        </div>
      </MobileOverlayButton>
    </>
  );
}

function MobileStoryOverlay({ story, onLike, onToggleMute, isMuted, navigate, navBottomOffset, avatarSize, scrollContainerRef, onGift, isOwnStory = false }) {
  if (!story) return null;
  const actionBottom = typeof navBottomOffset === 'number'
    ? `${navBottomOffset + 16}px`
    : `calc(${navBottomOffset} + 16px)`;
  const infoBottom = typeof navBottomOffset === 'number'
    ? `${navBottomOffset + 8}px`
    : `calc(${navBottomOffset} + 8px)`;

  return (
    <>
      <div
        className="pointer-events-none fixed right-3 flex flex-col items-center gap-6 z-[70] lg:hidden"
        style={{ bottom: actionBottom }}
      >
        <MobileActionButtons story={story} onLike={onLike} onToggleMute={onToggleMute} isMuted={isMuted} navigate={navigate} scrollContainerRef={scrollContainerRef} onGift={onGift} isOwnStory={isOwnStory} />
      </div>

      <div
        className="pointer-events-none fixed left-4 right-20 z-[70] lg:hidden"
        style={{ bottom: infoBottom }}
      >
        <MobileOverlayButton onPress={() => navigate(`/perfiles/${story.user_id}`, { state: { from: '/videos' } })} scrollContainerRef={scrollContainerRef} className="pointer-events-auto flex flex-col items-start gap-2.5 mb-1">
          <div className="rounded-full border-2 border-white/80 overflow-hidden bg-mansion-elevated shadow-lg" style={{ width: avatarSize, height: avatarSize }}>
            {story.avatar_url ? (
              <AvatarImg src={story.avatar_url} crop={story.avatar_crop} cover alt={story.username} className="w-full h-full" />
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

      <button onClick={onToggleMute} className={`hidden lg:flex fixed top-4 right-4 z-50 rounded-full items-center justify-center transition-all duration-200 ${safariDesktop ? 'bg-black/60' : 'bg-black/40 backdrop-blur-sm hover:bg-black/60 hover:scale-110'}`} style={{ width: 52, height: 52 }}>
        {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
      </button>
    </>
  );
}

function DesktopActionButtons({ story, onLike, navigate, onGift, isOwnStory = false }) {
  const [burstTrigger, setBurstTrigger] = useState(0);

  const handleHeart = () => {
    setBurstTrigger(t => t + 1);
    onLike(story.id);
  };

  return (
    <>
      {!isOwnStory && (
        <button onClick={handleHeart} className="flex flex-col items-center group relative">
          <HeartBurst trigger={burstTrigger} />
          <div className={`rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${story.liked ? 'bg-mansion-crimson/25 group-hover:bg-mansion-crimson/40' : 'bg-mansion-card/60 border border-white/10 group-hover:bg-mansion-card/90 group-hover:border-white/25'}`} style={{ width: 72, height: 72 }}>
            <Heart className={`w-9 h-9 transition-all duration-150 ${story.liked ? 'text-mansion-crimson fill-mansion-crimson scale-110' : 'text-white'}`} />
          </div>
          <span className="text-white text-xs font-semibold mt-1.5 drop-shadow tabular-nums">{story.likes || 0}</span>
        </button>
      )}
      {!isOwnStory && (
        <button onClick={() => navigate(`/mensajes/${story.user_id}`, { state: { from: '/videos' } })} className="flex flex-col items-center group">
          <div className="rounded-full bg-mansion-card/60 border border-white/10 flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-mansion-card/90 group-hover:border-white/25" style={{ width: 72, height: 72 }}>
            <Send className="w-8 h-8 text-white" />
          </div>
        </button>
      )}
      {!isOwnStory && (
        <button onClick={() => onGift(story)} className="flex flex-col items-center group">
          <div className="rounded-full bg-mansion-card/60 border border-white/10 flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-mansion-card/90 group-hover:border-white/25" style={{ width: 72, height: 72 }}>
            <Gift className="w-8 h-8 text-mansion-gold" />
          </div>
        </button>
      )}
    </>
  );
}

export default function VideoFeedPage() {
  const safariDesktop = isSafariDesktopBrowser();
  const location = useLocation();
  const navigate = useNavigate();
  const { siteSettings, user, setUser } = useAuth();
  const { subscribe } = useUnreadMessages();

  // Gift modal state
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftTargetStory, setGiftTargetStory] = useState(null);
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [giftSent, setGiftSent] = useState(null);
  const [sendingGift, setSendingGift] = useState(null);
  const [entryRevealReady, setEntryRevealReady] = useState(() => {
    try {
      return sessionStorage.getItem('vf_prefetched') === '1';
    } catch {
      return false;
    }
  });
  const entryRevealDoneRef = useRef(false);

  const handleEntryRevealReady = useCallback(() => {
    if (entryRevealDoneRef.current) return;
    entryRevealDoneRef.current = true;
    setEntryRevealReady(true);
    try {
      sessionStorage.removeItem('vf_prefetched');
    } catch {}
  }, []);

  const openGiftModal = useCallback((story) => {
    setGiftTargetStory(story);
    setGiftModalOpen(true);
    setGiftSent(null);
    if (giftCatalog.length === 0) {
      getGiftCatalog().then(data => setGiftCatalog(data.gifts || [])).catch(() => {});
    }
  }, [giftCatalog.length]);

  const handleSendGift = useCallback(async (giftId) => {
    if (sendingGift || !giftTargetStory) return;
    setSendingGift(giftId);
    try {
      const data = await apiSendGift(giftTargetStory.user_id, giftId);
      if (user && data.coins !== undefined) {
        setUser(prev => prev ? { ...prev, coins: data.coins } : prev);
      }
      setGiftSent(data.gift);
      setTimeout(() => { setGiftModalOpen(false); setGiftSent(null); setGiftTargetStory(null); }, 1500);
    } catch (err) {
      alert(err.message || 'Error al enviar regalo');
    } finally {
      setSendingGift(null);
    }
  }, [sendingGift, giftTargetStory, user, setUser]);

  const containerRef = useRef(null);
  const isJumpingRef = useRef(false);
  const scrollEndTimer = useRef(null);
  const jumpUnlockTimer = useRef(null);
  const boundaryCooldownTimer = useRef(null);
  const viewedDispatchTimerRef = useRef(null);
  const overlayCloseViewedTimerRef = useRef(null);
  const lastScrollAtRef = useRef(0);
  const lastDesktopWheelAtRef = useRef(0);

  const requestedStoryUserId = location.state?.storyUserId || null;
  const requestedStorySeed = normalizeStorySeed(location.state?.storySeed || null);
  const isOverlayPreview = location.state?.modal === 'videos' && !!location.state?.backgroundLocation;
  const backgroundLocation = location.state?.backgroundLocation || null;
  // When opened from a story-bar click (seed provided), skip the cache and start
  // with ONLY the seed story. This guarantees that stories.length changes 1→N
  // when the API responds, which triggers the useLayoutEffect scroll-correction
  // and prevents iOS Safari's scroll-reset from showing the wrong story.
  const initial = applyPendingStoryLikeState(mergeSeedStory([], requestedStorySeed), getPendingStoryLikes());

  const [stories, setStories] = useState(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  const savedIdx = () => { try { const v = sessionStorage.getItem(VIDEO_FEED_INDEX_KEY); return v ? Math.max(1, parseInt(v, 10)) : 1; } catch { return 1; } };
  const savedMuted = () => { try { return sessionStorage.getItem(VIDEO_FEED_MUTED_KEY) !== '0'; } catch { return true; } };

  const [activeDispIdx, setActiveDispIdx] = useState(() => (requestedStoryUserId ? 1 : savedIdx()));
  const [boundaryOverlayIdx, setBoundaryOverlayIdx] = useState(null);
  const [isMuted, setIsMuted] = useState(savedMuted);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const initialStoryUserIdRef = useRef(requestedStoryUserId);
  const savedStoryRestoreRef = useRef(requestedStoryUserId ? null : readSavedVideoFeedStory());
  const savedStoryRestoredRef = useRef(false);
  const apiRespondedRef = useRef(false);

  const gradientHeight = siteSettings?.videoGradientHeight ?? 64;
  const gradientOpacity = siteSettings?.videoGradientOpacity ?? 40;
  const avatarSize = siteSettings?.videoAvatarSize ?? AVATAR_SIZE_DEFAULT;
  const flushPendingViewedStories = useCallback(() => {
    try {
      if (!user?.id) return;
      const changed = applyPendingViewedStoryUsers(user.id);
      if (!changed) return;
      if (viewedDispatchTimerRef.current) {
        window.clearTimeout(viewedDispatchTimerRef.current);
      }
      viewedDispatchTimerRef.current = window.setTimeout(() => {
        window.dispatchEvent(new Event(VIEWED_STORIES_EVENT));
        viewedDispatchTimerRef.current = null;
      }, VIEWED_STORY_SYNC_DELAY_MS);
    } catch {}
  }, [user?.id]);
  const closeOverlay = useCallback(() => {
    if (!isOverlayPreview) {
      flushPendingViewedStories();
    } else {
      if (overlayCloseViewedTimerRef.current) {
        window.clearTimeout(overlayCloseViewedTimerRef.current);
      }
      overlayCloseViewedTimerRef.current = window.setTimeout(() => {
        flushPendingViewedStories();
        overlayCloseViewedTimerRef.current = null;
      }, 220);
    }
    if (backgroundLocation?.pathname) {
      navigate(
        {
          pathname: backgroundLocation.pathname,
          search: backgroundLocation.search || '',
          hash: backgroundLocation.hash || '',
        },
        { replace: true, state: backgroundLocation.state || null }
      );
      return;
    }
    navigate('/feed', { replace: true });
  }, [backgroundLocation, flushPendingViewedStories, isOverlayPreview, navigate]);
  const closeToHomeFeed = useCallback(() => {
    flushPendingViewedStories();
    navigate('/feed', { replace: true });
  }, [flushPendingViewedStories, navigate]);
  const handleOverlayBackdropPointerDown = useCallback((event) => {
    if (!isOverlayPreview || !isDesktopViewport) return;
    if (event.target.closest('[data-story-card-frame="true"]')) return;
    closeOverlay();
  }, [closeOverlay, isDesktopViewport, isOverlayPreview]);
  const markStoryViewed = useCallback((storyUserId) => {
    const uid = String(storyUserId || '');
    if (!uid) return;
    try {
      if (!user?.id) return;
      if (getViewedStoryUsers(user.id).includes(uid)) {
        clearPendingViewedStoryUsers(user.id);
        return;
      }
      markViewedStoryUser(user.id, uid);
      clearPendingViewedStoryUsers(user.id);
      window.dispatchEvent(new Event(VIEWED_STORIES_EVENT));
    } catch {}
  }, [user?.id]);
  const queueStoryViewed = useCallback((storyUserId) => {
    const uid = String(storyUserId || '');
    if (!uid) return;
    try {
      if (!user?.id) return;
      queuePendingViewedStoryUser(user.id, uid);
    } catch {}
  }, [user?.id]);

  const infiniteStories = stories.length > 0
    ? [stories[stories.length - 1], ...stories, stories[0]]
    : [];
  const desktopActiveIdx = Math.min(Math.max(activeDispIdx, 1), Math.max(stories.length, 1));
  const mobileOverlayIdx = boundaryOverlayIdx ?? activeDispIdx;
  const activeStory = isDesktopViewport
    ? stories[desktopActiveIdx - 1] || stories[0] || null
    : infiniteStories[mobileOverlayIdx] || stories[0] || null;
  const standaloneMobileRoute = !isDesktopViewport && !isOverlayPreview;
  const isStandaloneMobileApp = detectStandaloneMobile();
  const navBottomOffset = isStandaloneMobileApp
    ? getStandaloneBottomNavOffset()
    : getBrowserBottomNavOffset();
  const standaloneTopOffset = isStandaloneMobileApp
    ? '0px'
    : 'calc(env(safe-area-inset-top, 0px) + 48px)';
  const standaloneViewportShellStyle = standaloneMobileRoute
    ? {
        paddingTop: standaloneTopOffset,
      }
    : undefined;
  const standaloneViewportContentStyle = standaloneMobileRoute
    ? {
        height: 'calc(100lvh + 8px)',
      }
    : undefined;

  const syncMobileViewportToIndex = useCallback((index) => {
    if (isDesktopViewport) return false;
    const container = containerRef.current;
    if (!container || stories.length === 0) return false;

    const height = container.clientHeight;
    if (!height) return false;

    const clampedIndex = Math.min(Math.max(index, 1), stories.length);
    const nextScrollTop = height * clampedIndex;
    if (Math.abs(container.scrollTop - nextScrollTop) <= Math.max(4, height * 0.25)) {
      return true;
    }

    container.scrollTop = nextScrollTop;
    setBoundaryOverlayIdx(null);
    return true;
  }, [isDesktopViewport, stories.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(media.matches);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useLayoutEffect(() => {
    if (!standaloneMobileRoute || typeof window === 'undefined') return undefined;

    const resetPageScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetPageScroll();
    let rafA = window.requestAnimationFrame(() => {
      resetPageScroll();
      rafA = window.requestAnimationFrame(() => {
        resetPageScroll();
      });
    });

    return () => {
      if (rafA) window.cancelAnimationFrame(rafA);
    };
  }, [location.key, standaloneMobileRoute]);

  useEffect(() => {
    if (!standaloneMobileRoute || typeof window === 'undefined') return undefined;

    const { style: bodyStyle } = document.body;
    const { style: htmlStyle } = document.documentElement;
    const previousBodyOverflow = bodyStyle.overflow;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousBodyOverscroll = bodyStyle.overscrollBehavior;
    const previousHtmlOverscroll = htmlStyle.overscrollBehavior;

    bodyStyle.overflow = 'hidden';
    htmlStyle.overflow = 'hidden';
    bodyStyle.overscrollBehavior = 'none';
    htmlStyle.overscrollBehavior = 'none';

    return () => {
      bodyStyle.overflow = previousBodyOverflow;
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overscrollBehavior = previousBodyOverscroll;
      htmlStyle.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [standaloneMobileRoute]);

  const refreshStories = useCallback(async () => {
    const data = await getStories({ focusUserId: requestedStoryUserId || '' });
    const baseStories = mergeSeedStory(data.stories || [], requestedStorySeed);
    const fresh = applyPendingStoryLikeState(baseStories, getPendingStoryLikes());
    apiRespondedRef.current = true;
    setStories(fresh);
    return fresh;
  }, [requestedStorySeed, requestedStoryUserId]);

  useEffect(() => {
    let cancelled = false;

    refreshStories()
      .catch(() => {
        if (!cancelled && stories.length === 0) setStories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      flushPendingStoryLikes({ keepalive: true }).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshStories]);

  useEffect(() => {
    const targetStoryUserId = initialStoryUserIdRef.current;
    if (!targetStoryUserId || stories.length === 0) return;

    const targetIndex = stories.findIndex((story) => String(story.user_id) === String(targetStoryUserId));
    if (targetIndex < 0) {
      if (!apiRespondedRef.current) return;
      setActiveDispIdx(1);
      setBoundaryOverlayIdx(null);
      initialStoryUserIdRef.current = null;
      return;
    }

    setActiveDispIdx(targetIndex + 1);
    setBoundaryOverlayIdx(null);
    syncMobileViewportToIndex(targetIndex + 1);
    // Only clear after the API has responded so we re-match on reorder
    if (apiRespondedRef.current) initialStoryUserIdRef.current = null;
  }, [stories, loading, syncMobileViewportToIndex]);

  useLayoutEffect(() => {
    const savedStory = savedStoryRestoreRef.current;
    if (requestedStoryUserId || savedStoryRestoredRef.current || !savedStory || stories.length === 0) return;

    const targetIndex = findSavedStoryIndex(stories, savedStory);
    if (targetIndex < 0) {
      if (apiRespondedRef.current) savedStoryRestoredRef.current = true;
      return;
    }

    const nextIndex = targetIndex + 1;
    savedStoryRestoredRef.current = true;
    setActiveDispIdx(nextIndex);
    setBoundaryOverlayIdx(null);
    syncMobileViewportToIndex(nextIndex);
  }, [requestedStoryUserId, stories, syncMobileViewportToIndex]);

  useEffect(() => {
    if (!activeStory?.user_id) return;
    if (isOverlayPreview) {
      queueStoryViewed(activeStory.user_id);
      return;
    }
    markStoryViewed(activeStory.user_id);
  }, [activeStory?.user_id, isOverlayPreview, markStoryViewed, queueStoryViewed]);

  useEffect(() => {
    return subscribe((event) => {
      if (event?.type !== 'story_like' || !event.storyId) return;

      setStories((prev) => {
        const next = prev.map((story) => (
          story.id === event.storyId
            ? { ...story, likes: Math.max(0, Number(story.likes || 0) + 1) }
            : story
        ));
        return next;
      });
    });
  }, [subscribe]);

  useEffect(() => {
    const unsubscribeQueue = subscribePendingStoryLikes((pendingLikes) => {
      setStories((prev) => {
        return applyPendingStoryLikeState(prev, pendingLikes);
      });
    });

    const unsubscribeSync = subscribeStoryLikeSync((updates) => {
      if (!Array.isArray(updates) || updates.length === 0) return;
      setStories((prev) => {
        const next = prev.map((story) => {
          const synced = updates.find((item) => item.story_id === story.id);
          return synced
            ? { ...story, liked: !!synced.liked, likes: Number(synced.likes || 0) }
            : story;
        });
        return next;
      });
    });

    return () => {
      unsubscribeQueue();
      unsubscribeSync();
    };
  }, []);

  // Keep a ref of the current activeDispIdx so the stories-identity layout
  // effect can read it without being a dep (avoids interrupting user scrolls).
  const activeDispIdxRef = useRef(activeDispIdx);
  useLayoutEffect(() => { activeDispIdxRef.current = activeDispIdx; });

  useLayoutEffect(() => {
    if (isDesktopViewport) return undefined;
    if (stories.length === 0 || !containerRef.current) return;

    const container = containerRef.current;
    const syncInitialPosition = () => {
      const height = container.clientHeight;
      if (!height) return false;

      const idx = Math.min(Math.max(activeDispIdx, 1), stories.length);
      const nextScrollTop = height * idx;
      if (Math.abs(container.scrollTop - nextScrollTop) > Math.max(4, height * 0.25)) {
        container.scrollTop = nextScrollTop;
      }
      setBoundaryOverlayIdx(null);
      return true;
    };

    if (syncInitialPosition()) return undefined;

    let rafId = requestAnimationFrame(() => {
      syncInitialPosition();
    });

    return () => cancelAnimationFrame(rafId);
  }, [activeDispIdx, isDesktopViewport, stories.length]);

  // Secondary scroll-anchor: fires on every stories identity change (catches
  // same-length updates where the primary effect doesn't re-run). Uses a ref
  // for the index so it reads the latest value without causing extra renders.
  useLayoutEffect(() => {
    if (isDesktopViewport) return;
    const container = containerRef.current;
    if (!container || stories.length === 0) return;
    const height = container.clientHeight;
    if (!height) return;
    const idx = Math.min(Math.max(activeDispIdxRef.current, 1), stories.length);
    const want = height * idx;
    // Only snap back if iOS Safari reset the scrollTop significantly
    if (Math.abs(container.scrollTop - want) > Math.max(4, height * 0.12)) {
      container.scrollTop = want;
      setBoundaryOverlayIdx(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktopViewport, stories]);

  useEffect(() => {
    const clampedIndex = Math.min(Math.max(activeDispIdx, 1), Math.max(stories.length, 1));
    const currentStory = stories[clampedIndex - 1] || null;
    const storyIdentity = getStoryIdentity(currentStory);

    try {
      sessionStorage.setItem(VIDEO_FEED_INDEX_KEY, String(activeDispIdx));
      if (storyIdentity) {
        sessionStorage.setItem(VIDEO_FEED_ACTIVE_STORY_KEY, JSON.stringify(storyIdentity));
      }
    } catch {}
  }, [activeDispIdx, stories]);
  useEffect(() => {
    try { sessionStorage.setItem(VIDEO_FEED_MUTED_KEY, isMuted ? '1' : '0'); } catch {}
  }, [isMuted]);

  useEffect(() => () => {
    clearTimeout(scrollEndTimer.current);
    clearTimeout(jumpUnlockTimer.current);
    clearTimeout(boundaryCooldownTimer.current);
    clearTimeout(viewedDispatchTimerRef.current);
    clearTimeout(overlayCloseViewedTimerRef.current);
  }, []);

  const settleInfiniteBoundary = useCallback(() => {
    const container = containerRef.current;
    if (!container || isJumpingRef.current || stories.length === 0) return;

    const height = container.clientHeight;
    const rawIndex = Math.round(container.scrollTop / height);

    if (rawIndex === 0 || rawIndex >= stories.length + 1) {
      const now = performance.now();
      const timeSinceLastScroll = now - lastScrollAtRef.current;

      if (lastScrollAtRef.current > 0 && timeSinceLastScroll < 170) {
        clearTimeout(boundaryCooldownTimer.current);
        boundaryCooldownTimer.current = setTimeout(() => {
          settleInfiniteBoundary();
        }, 170 - timeSinceLastScroll);
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
    if (isDesktopViewport) return;
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
  }, [activeDispIdx, boundaryOverlayIdx, isDesktopViewport, settleInfiniteBoundary, stories.length]);

  const handleLike = useCallback((storyId) => {
    let desiredLiked = null;
    setStories(prev => {
      const next = prev.map(s =>
        s.id === storyId
          ? (() => {
              desiredLiked = !s.liked;
              return {
                ...s,
                liked: desiredLiked,
                likes: desiredLiked ? s.likes + 1 : Math.max(0, s.likes - 1),
              };
            })()
          : s
      );
      return next;
    });
    if (desiredLiked !== null) enqueueStoryLike(storyId, desiredLiked);
  }, []);

  const scrollByOne = useCallback((dir) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ top: dir * container.clientHeight, behavior: 'smooth' });
  }, []);

  const jumpByOne = useCallback((dir) => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight;
    const rawIndex = Math.round(container.scrollTop / height);
    container.scrollTop = (rawIndex + dir) * height;
  }, []);

  const moveDesktopByOne = useCallback((dir) => {
    if (stories.length === 0) return;
    setBoundaryOverlayIdx(null);
    setActiveDispIdx((prev) => {
      const current = Math.min(Math.max(prev, 1), stories.length);
      if (dir > 0) {
        return current >= stories.length ? 1 : current + 1;
      }
      return current <= 1 ? stories.length : current - 1;
    });
  }, [stories.length]);

  const handleDesktopWheel = useCallback((event) => {
    if (!isDesktopViewport) {
      return;
    }
    event.preventDefault();
  }, [isDesktopViewport]);

  useEffect(() => {
    if (!isDesktopViewport) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOverlayPreview) {
        e.preventDefault();
        closeOverlay();
      } else if (e.key === 'ArrowLeft') {
        moveDesktopByOne(-1);
      } else if (e.key === 'ArrowRight') {
        moveDesktopByOne(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOverlay, isDesktopViewport, isOverlayPreview, moveDesktopByOne]);

  if (loading) {
    return (
      <div
        className={standaloneMobileRoute ? 'relative overflow-hidden bg-black' : 'fixed inset-0 bg-black flex items-center justify-center z-[60] lg:z-40'}
        style={standaloneViewportShellStyle}
      >
        <div
          className={standaloneMobileRoute ? 'flex items-center justify-center' : undefined}
          style={standaloneViewportContentStyle}
        >
          <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div
        className={standaloneMobileRoute ? 'relative overflow-hidden bg-mansion-base px-6' : 'fixed inset-0 bg-mansion-base flex flex-col items-center justify-center z-[60] lg:z-40 px-6'}
        style={standaloneViewportShellStyle}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex flex-col items-center justify-center text-center max-w-sm mx-auto"
          style={standaloneViewportContentStyle}
        >
          <div className="w-24 h-24 rounded-[2rem] bg-mansion-gold/10 border border-mansion-gold/20 flex items-center justify-center mb-6">
            <Film className="w-12 h-12 text-mansion-gold" />
          </div>

          <h1 className="font-display text-3xl font-bold text-text-primary mb-3">Historias</h1>
          <p className="text-text-muted mb-2">Todavía no hay historias publicadas.</p>
          <p className="text-sm text-text-dim mb-8">Sé el primero en compartir un momento con la comunidad.</p>

          <button
            onClick={() => navigate('/historia/nueva', { state: { from: '/videos' } })}
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

  const desktopOverlayRoute = isOverlayPreview && isDesktopViewport;

  return (
    <div
      className={
        standaloneMobileRoute
          ? 'relative overflow-hidden bg-black'
          : desktopOverlayRoute
            ? 'absolute inset-0 bg-black z-[60]'
            : 'fixed inset-0 bg-black z-[60] lg:z-40 lg:left-64 xl:left-72 lg:bg-mansion-base'
      }
      style={standaloneViewportShellStyle}
      onPointerDown={handleOverlayBackdropPointerDown}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none z-20 bg-black"
        initial={{ opacity: entryRevealReady ? 0 : 0.7 }}
        animate={{ opacity: entryRevealReady ? 0 : 1 }}
        transition={{ duration: entryRevealReady ? 0.01 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      />

      <div
        className={standaloneMobileRoute ? 'relative' : 'relative h-full'}
        style={standaloneViewportContentStyle}
      >
        {isDesktopViewport && (
          <div
            className="absolute z-30 flex flex-col items-center gap-2"
            style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 16 }}
          >
            <button
              type="button"
              onClick={closeToHomeFeed}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label="Cerrar"
            >
              <X className="w-8 h-8 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-8 h-8 text-white" /> : <Volume2 className="w-8 h-8 text-white" />}
            </button>
          </div>
        )}
        {!isDesktopViewport && (
          <div
            className="fixed z-[80] lg:hidden"
            style={{ top: 'max(env(safe-area-inset-top, 12px), 12px)', right: 16 }}
          >
            <button
              type="button"
              onClick={closeToHomeFeed}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors active:bg-black/60"
              aria-label="Cerrar"
            >
              <X className="h-7 w-7 text-white" />
            </button>
          </div>
        )}
        {isDesktopViewport ? (
        <div className="h-full overflow-hidden" onWheel={handleDesktopWheel}>
          <div className="relative w-full h-full">
            {stories.map((story, index) => {
              const activeIndex = desktopActiveIdx - 1;
              const rawDistance = Math.abs(index - activeIndex);
              const circularDistance = Math.min(rawDistance, stories.length - rawDistance);
              const isActive = index === activeIndex;
              const shouldLoad = stories.length <= 3 || circularDistance <= 1;
              const enableCinematicReveal = isActive && !entryRevealReady;

              return (
                <div
                  key={story.id}
                  className="absolute inset-0"
                  style={{
                    opacity: isActive ? 1 : 0,
                    visibility: isActive ? 'visible' : 'hidden',
                    pointerEvents: isActive ? 'auto' : 'none',
                    zIndex: isActive ? 10 : 0,
                    contain: 'paint',
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <StoryCard
                    story={story}
                    videoSrc={story.video_url}
                    isActive={isActive}
                    shouldLoad={shouldLoad}
                    isMuted={isMuted}
                    avatarSize={avatarSize}
                    onLike={handleLike}
                    navigate={navigate}
                    gradientHeight={gradientHeight}
                    gradientOpacity={gradientOpacity}
                    resetOnDeactivate={false}
                  onGift={openGiftModal}
                  isOwnStory={String(story.user_id) === String(user?.id)}
                  onRevealReady={isActive ? handleEntryRevealReady : undefined}
                  enableCinematicReveal={enableCinematicReveal}
                />
              </div>
            );
            })}
          </div>
        </div>
        ) : (
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
          {infiniteStories.map((story, displayIndex) => {
            const dist = Math.abs(displayIndex - activeDispIdx);
            const isBoundary = displayIndex <= 1 || displayIndex >= stories.length;
            const shouldLoad = dist <= 3 || isBoundary;
            const enableCinematicReveal = displayIndex === activeDispIdx && !entryRevealReady;
            const mobileStoryKey = story.story_id || story.id || story.user_id || story.video_url || displayIndex;
            return (
              <div
                key={`${displayIndex}-${mobileStoryKey}`}
                className="h-full w-full flex-shrink-0"
              >
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
                  resetOnDeactivate
                  onGift={openGiftModal}
                  isOwnStory={String(story.user_id) === String(user?.id)}
                  onRevealReady={displayIndex === activeDispIdx ? handleEntryRevealReady : undefined}
                  enableCinematicReveal={enableCinematicReveal}
                />
              </div>
            );
          })}
        </div>
        )}

        {activeStory && (
        <div
          className="pointer-events-none fixed right-3 flex flex-col items-center gap-6 z-[70] lg:hidden"
          style={{ bottom: `calc(${navBottomOffset} + 16px)` }}
        >
          <MobileActionButtons
            story={activeStory}
            onLike={handleLike}
            onToggleMute={() => setIsMuted(m => !m)}
            isMuted={isMuted}
            navigate={navigate}
            scrollContainerRef={containerRef}
            onGift={openGiftModal}
            isOwnStory={String(activeStory.user_id) === String(user?.id)}
          />
        </div>
        )}

        {activeStory && (
        <div
          className="pointer-events-none fixed left-4 right-20 z-[70] lg:hidden"
          style={{ bottom: `calc(${navBottomOffset} + 8px)` }}
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
                  <AvatarImg src={activeStory.avatar_url} crop={activeStory.avatar_crop} cover alt={activeStory.username} className="w-full h-full" />
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
            onClick={() => (isDesktopViewport ? moveDesktopByOne(-1) : jumpByOne(-1))}
            className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-[72px] h-[72px] rounded-full items-center justify-center border border-white/10 transition-all duration-200 ${safariDesktop ? 'bg-black/60' : 'bg-mansion-card/60 backdrop-blur-sm hover:bg-mansion-card/90 hover:border-white/25 hover:scale-110'}`}
            style={{ left: 'calc(50% - 350px)' }}
          >
            <ChevronLeft className="w-9 h-9 text-white/70" />
          </button>
          <button
            onClick={() => (isDesktopViewport ? moveDesktopByOne(1) : jumpByOne(1))}
            className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-[72px] h-[72px] rounded-full items-center justify-center border border-white/10 transition-all duration-200 ${safariDesktop ? 'bg-black/60' : 'bg-mansion-card/60 backdrop-blur-sm hover:bg-mansion-card/90 hover:border-white/25 hover:scale-110'}`}
            style={{ right: 'calc(50% - 350px)' }}
          >
            <ChevronRight className="w-9 h-9 text-white/70" />
          </button>
        </>
        )}

        {/* Gift Modal */}
        <AnimatePresence>
          {giftModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => { setGiftModalOpen(false); setGiftSent(null); setGiftTargetStory(null); }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-mansion-base border border-mansion-border/30 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-mansion-border/20">
                <div>
                  <h3 className="font-display text-lg font-bold text-text-primary">Enviar regalo</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="7" fill="none" stroke="#A88A3D" strokeWidth="0.75" />
                      <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
                    </svg>
                    <span className="text-xs font-bold text-mansion-gold">{user?.coins ?? 0} monedas</span>
                  </div>
                </div>
                <button
                  onClick={() => { setGiftModalOpen(false); setGiftSent(null); setGiftTargetStory(null); }}
                  className="w-8 h-8 rounded-full bg-mansion-elevated flex items-center justify-center text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {giftSent ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-5xl mb-3">{giftSent.gift_emoji}</motion.span>
                  <p className="text-text-primary font-semibold">¡Regalo enviado!</p>
                  <p className="text-text-dim text-sm mt-1">{giftSent.gift_name} para @{giftTargetStory?.username}</p>
                </div>
              ) : (
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <div className="grid grid-cols-3 gap-2.5">
                    {giftCatalog.map((gift) => {
                      const canAfford = (user?.coins ?? 0) >= gift.price;
                      return (
                        <button
                          key={gift.id}
                          onClick={() => canAfford && handleSendGift(gift.id)}
                          disabled={!canAfford || !!sendingGift}
                          className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${
                            canAfford
                              ? 'bg-mansion-card/60 border-mansion-border/20 hover:border-mansion-gold/40 hover:bg-mansion-gold/5 active:scale-95'
                              : 'bg-mansion-card/30 border-mansion-border/10 opacity-50'
                          } ${sendingGift === gift.id ? 'animate-pulse' : ''}`}
                        >
                          <span className="text-3xl">{gift.emoji}</span>
                          <span className="text-xs font-medium text-text-primary truncate w-full text-center">{gift.name}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-mansion-gold font-bold">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" fill="#C9A84C" stroke="#A88A3D" strokeWidth="1.5" />
                              <text x="12" y="16" textAnchor="middle" fill="#8B7332" fontSize="10" fontWeight="bold" fontFamily="serif">$</text>
                            </svg>
                            {gift.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
