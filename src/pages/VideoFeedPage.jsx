import { useEffect, useLayoutEffect, useRef, useState, useCallback, useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Send, Plus, Volume2, VolumeX, Play, Film, ChevronLeft, ChevronRight, Gift, X, Crown, Maximize2, Minimize2 } from 'lucide-react';
import { getStories, recordStoryView, getPublicSettings, getPendingStoryLikes, enqueueStoryLike, flushPendingStoryLikes, subscribePendingStoryLikes, subscribeStoryLikeSync, getGiftCatalog, sendGift as apiSendGift } from '../lib/api';
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
const MOBILE_BROWSER_VIDEO_SCROLL_OFFSET = 68;
const VIDEO_FEED_RAIL_SOURCE = 'rail';

function normalizeLandscapeAspectRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio) || ratio <= 1) return 16 / 9;
  return Math.min(Math.max(ratio, 1.01), 3);
}

function getExpandedStoryFrameMaxWidth(aspectRatio = 16 / 9) {
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  return Math.max(520, Math.round(Math.max(320, viewportHeight - 32) * normalizeLandscapeAspectRatio(aspectRatio)));
}

function getExpandedStorySideOffset(aspectRatio = 16 / 9) {
  const halfWidth = Math.round(getExpandedStoryFrameMaxWidth(aspectRatio) / 2);
  return `max(16px, calc(50% - min(50%, ${halfWidth}px) - 92px))`;
}

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
      source: String(parsed.source || '').trim(),
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
  const requireExactMatch = savedStory.source === VIDEO_FEED_RAIL_SOURCE;

  if (savedStoryId) {
    const byStoryId = stories.findIndex((story) => String(story?.story_id || story?.id || '').trim() === savedStoryId);
    if (byStoryId >= 0) {
      if (!requireExactMatch || !savedVideoUrl || String(stories[byStoryId]?.video_url || '').trim() === savedVideoUrl) return byStoryId;
    }
  }

  if (savedUserId && savedVideoUrl) {
    const byUserAndVideo = stories.findIndex((story) => (
      String(story?.user_id || '').trim() === savedUserId
      && String(story?.video_url || '').trim() === savedVideoUrl
    ));
    if (byUserAndVideo >= 0) return byUserAndVideo;
  }

  if (requireExactMatch) return -1;

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
    vip_only: !!seed.vip_only,
    restricted: !!seed.restricted,
    created_at: String(seed.created_at || ''),
    username: String(seed.username || seed.name || ''),
    avatar_url: String(seed.avatar_url || ''),
    avatar_crop: seed.avatar_crop || null,
  };
}

function mergeSeedStory(stories, seedStory) {
  const list = Array.isArray(stories) ? stories : [];
  if (!seedStory) return list;
  const seedStoryId = String(seedStory.story_id || seedStory.id || '').trim();
  const seedUserId = String(seedStory.user_id || '').trim();
  const seedVideoUrl = String(seedStory.video_url || '').trim();
  const existingIndex = list.findIndex((story) => {
    const storyId = String(story?.story_id || story?.id || '').trim();
    const userId = String(story?.user_id || '').trim();
    const videoUrl = String(story?.video_url || '').trim();
    if (seedStoryId && storyId && seedStoryId === storyId) return true;
    if (seedUserId && userId && seedUserId === userId && (!seedVideoUrl || !videoUrl || seedVideoUrl === videoUrl)) return true;
    return false;
  });

  if (existingIndex >= 0) {
    return list.map((story, index) => (
      index === existingIndex
        ? { ...seedStory, ...story }
        : story
    ));
  }

  const filtered = list.filter((story) => String(story?.user_id || '') !== seedUserId);
  return [seedStory, ...filtered];
}

function findStoryIndexByUser(stories, userId) {
  const targetUserId = String(userId || '').trim();
  if (!targetUserId || !Array.isArray(stories)) return -1;
  return stories.findIndex((story) => String(story?.user_id || '').trim() === targetUserId);
}

function rotateStoriesToUser(stories, userId) {
  const list = Array.isArray(stories) ? stories : [];
  const targetIndex = findStoryIndexByUser(list, userId);
  if (targetIndex <= 0) return list;
  return [...list.slice(targetIndex), ...list.slice(0, targetIndex)];
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

function StoryCard({ story, videoSrc, isActive, shouldLoad, isMuted, avatarSize, onLike, navigate, gradientHeight, gradientOpacity, resetOnDeactivate = true, onGift, isOwnStory = false, onRevealReady, onLandscapeExpandedChange, enableCinematicReveal = false, pauseOnAppBackground = false, videoScale = 1, forcePaused = false, isLimitBlocked = false, limit = null, limitBlurLevel = 14, onVip }) {
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const rafRef = useRef(null);
  const revealSentRef = useRef(false);
  const userPausedRef = useRef(false);
  const resumeAfterAppFocusRef = useRef(false);
  const recoveryTimerRef = useRef(null);
  const playAttemptIdRef = useRef(0);
  const lastRecoveryAtRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoResetToken, setVideoResetToken] = useState(0);
  const [videoFitMode, setVideoFitMode] = useState('cover');
  const [isLandscapeVideo, setIsLandscapeVideo] = useState(false);
  const [landscapeExpanded, setLandscapeExpanded] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
  const limitDaily = Number(limit?.dailyLimit ?? 10);
  const limitViewed = Number(limit?.viewedToday ?? limitDaily);
  const limitLabel = limitDaily > 0 ? `${Math.min(limitViewed, limitDaily)}/${limitDaily}` : '0';
  const blockedVideoScale = Math.max(videoScale, 1.08);
  const videoObjectClass = videoFitMode === 'cover' ? 'object-cover' : 'object-contain';
  const frameWidthClass = landscapeExpanded ? 'lg:max-w-none' : 'lg:max-w-[520px]';
  const expandedFrameStyle = landscapeExpanded && isLandscapeVideo
    ? { maxWidth: `min(100%, ${getExpandedStoryFrameMaxWidth(videoAspectRatio)}px)` }
    : undefined;
  const expandedSideOffset = getExpandedStorySideOffset(videoAspectRatio);

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
    setVideoFitMode('cover');
    setIsLandscapeVideo(false);
    setVideoAspectRatio(16 / 9);
    setLandscapeExpanded(false);
    if (isActive) onLandscapeExpandedChange?.(false, 16 / 9);
  }, [activeSrc]);

  useEffect(() => {
    if (!isActive) return;
    onLandscapeExpandedChange?.(landscapeExpanded, videoAspectRatio);
  }, [isActive, landscapeExpanded, onLandscapeExpandedChange, videoAspectRatio]);

  const handleLoadedMetadata = useCallback((event) => {
    const video = event.currentTarget;
    const width = Number(video.videoWidth || 0);
    const height = Number(video.videoHeight || 0);
    const landscape = width > 0 && height > 0 && width > height;
    setIsLandscapeVideo(landscape);
    setVideoAspectRatio(landscape ? normalizeLandscapeAspectRatio(width / height) : 16 / 9);
    setVideoFitMode('cover');
    if (!landscape) setLandscapeExpanded(false);
  }, []);

  const notifyRevealReady = useCallback(() => {
    if (forcePaused || !isActive || !onRevealReady || revealSentRef.current) return;
    revealSentRef.current = true;
    onRevealReady();
  }, [forcePaused, isActive, onRevealReady]);

  const resetSuspendedVideo = useCallback(() => {
    if (forcePaused || !isActive || !activeSrc || userPausedRef.current) return;

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
  }, [activeSrc, forcePaused, isActive]);

  const attemptPlay = useCallback((options = {}) => {
    const video = videoRef.current;
    if (!video || forcePaused || !isActive || !activeSrc || userPausedRef.current) return;

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
      if (playAttemptIdRef.current !== attemptId || forcePaused || !isActive || userPausedRef.current) return;

      const currentVideo = videoRef.current;
      if (!currentVideo) return;

      const readyEnough = currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      const advanced = Number(currentVideo.currentTime || 0) > startedAt + 0.04;
      const looksSuspended = currentVideo.paused || !readyEnough || (!advanced && !currentVideo.ended);
      if (looksSuspended) resetSuspendedVideo();
    }, 900);
  }, [activeSrc, forcePaused, isActive, resetSuspendedVideo]);

  useEffect(() => {
    if (isActive) {
      userPausedRef.current = false;
    } else {
      resumeAfterAppFocusRef.current = false;
    }
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

    if (isActive && !forcePaused) {
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
  }, [attemptPlay, forcePaused, isActive]);

  useEffect(() => {
    if (forcePaused || !isActive || !activeSrc) return;

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
  }, [activeSrc, attemptPlay, forcePaused, isActive, notifyRevealReady]);

  useEffect(() => {
    if (forcePaused || !isActive || !activeSrc || typeof window === 'undefined') return undefined;

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
  }, [activeSrc, attemptPlay, forcePaused, isActive]);

  useEffect(() => {
    if (forcePaused || !pauseOnAppBackground || !isActive || !activeSrc || typeof window === 'undefined') return undefined;

    const pauseForBackground = () => {
      const video = videoRef.current;
      if (!video || userPausedRef.current) {
        resumeAfterAppFocusRef.current = false;
        return;
      }

      resumeAfterAppFocusRef.current = !video.paused || isPlaying;
      if (recoveryTimerRef.current) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }

      try {
        video.pause();
      } catch {}
      setIsPlaying(false);
    };

    const resumeFromBackground = () => {
      if (document.visibilityState === 'hidden' || userPausedRef.current || !resumeAfterAppFocusRef.current) return;
      resumeAfterAppFocusRef.current = false;
      window.setTimeout(() => attemptPlay({ verify: true }), 80);
      window.setTimeout(() => attemptPlay({ verify: true }), 260);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pauseForBackground();
        return;
      }
      resumeFromBackground();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', pauseForBackground);
    window.addEventListener('pageshow', resumeFromBackground);
    window.addEventListener('focus', resumeFromBackground);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', pauseForBackground);
      window.removeEventListener('pageshow', resumeFromBackground);
      window.removeEventListener('focus', resumeFromBackground);
    };
  }, [activeSrc, attemptPlay, forcePaused, isActive, isPlaying, pauseOnAppBackground]);

  useEffect(() => {
    if (!forcePaused) return;
    const video = videoRef.current;
    resumeAfterAppFocusRef.current = false;
    userPausedRef.current = true;
    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (video) {
      try {
        video.pause();
      } catch {}
    }
    if (progressBarRef.current) progressBarRef.current.style.width = '0%';
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, [forcePaused]);

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
    if (forcePaused || isLimitBlocked) return;
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
    if (forcePaused || isLimitBlocked) return;
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
        className={`relative h-full w-full transition-[max-width] duration-300 ease-out lg:mx-auto lg:my-4 lg:h-[calc(100%-32px)] lg:rounded-2xl lg:overflow-hidden ${frameWidthClass}`}
        style={expandedFrameStyle}
      >
        {/* eslint-disable-next-line */}
        <video
          key={`${activeSrc || 'empty-video'}-${videoResetToken}`}
          ref={videoRef}
          src={activeSrc}
          className={`absolute inset-0 w-full h-full ${videoObjectClass} transition-opacity duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]`}
          style={{
            WebkitTransform: `translateZ(0) scale(${isLimitBlocked ? blockedVideoScale : videoScale})`,
            transform: `translateZ(0) scale(${isLimitBlocked ? blockedVideoScale : videoScale})`,
            filter: isLimitBlocked ? `blur(${limitBlurLevel}px)` : undefined,
            opacity: isLimitBlocked ? 1 : (enableCinematicReveal ? (isVideoReady ? 1 : 0) : 1),
          }}
          loop
          playsInline
          webkit-playsinline="true"
          muted={isMuted}
          autoPlay={shouldLoad && !forcePaused}
          preload={shouldLoad && !forcePaused ? 'auto' : 'metadata'}
          onEnded={handleVideoEnd}
          onClick={togglePlay}
          onLoadedMetadata={handleLoadedMetadata}
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
        <div className="absolute inset-x-0 top-0 hidden h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none lg:block lg:rounded-t-2xl" />

        {isLandscapeVideo && !isLimitBlocked && (
          <button
            type="button"
            onClick={() => setLandscapeExpanded((value) => !value)}
            className="absolute left-4 top-4 z-30 hidden h-12 items-center gap-2 rounded-full border border-white/12 bg-black/42 px-4 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/60 lg:flex"
            aria-label={landscapeExpanded ? 'Reducir historia' : 'Expandir historia'}
          >
            {landscapeExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{landscapeExpanded ? 'Reducir' : 'Expandir'}</span>
          </button>
        )}

        {isLimitBlocked && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/28 px-6 text-center">
            <button
              type="button"
              onClick={onVip}
              className="group flex max-w-[300px] flex-col items-center rounded-[1.75rem] border border-mansion-gold/35 bg-black/48 px-6 py-6 text-white shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-md transition-transform active:scale-[0.98] lg:hover:scale-[1.02]"
            >
              <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-mansion-gold/45 bg-mansion-gold/15 text-mansion-gold shadow-[0_0_40px_rgba(212,175,55,0.2)]">
                <Crown className="h-10 w-10" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-mansion-gold/95">Límite diario</span>
              <span className="mt-2 font-display text-2xl font-bold leading-tight text-white">Límite de videos Free alcanzado</span>
              <span className="mt-3 text-sm leading-relaxed text-white/76">
                Ya viste {limitLabel} videos hoy. Hazte VIP para seguir mirando sin límite.
              </span>
            </button>
          </div>
        )}

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

      {!isLimitBlocked && (
        <div
          className="absolute z-20 hidden flex-col items-center gap-5 transition-[right] duration-300 ease-out lg:flex"
          style={{ right: landscapeExpanded ? expandedSideOffset : 'calc(50% - 350px)', bottom: '60px' }}
        >
          <DesktopActionButtons story={story} onLike={onLike} navigate={navigate} onGift={onGift} isOwnStory={isOwnStory} />
        </div>
      )}
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
  const { siteSettings, user, setUser, setSiteSettings } = useAuth();
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
  const pwaReturnAnchorTimersRef = useRef([]);
  const pwaReturnAnchorDoneRef = useRef(false);
  const lastScrollAtRef = useRef(0);
  const lastDesktopWheelAtRef = useRef(0);

  const requestedStoryUserId = location.state?.storyUserId || null;
  const requestedStorySeed = normalizeStorySeed(location.state?.storySeed || null);
  const isOverlayPreview = location.state?.modal === 'videos' && !!location.state?.backgroundLocation;
  const backgroundLocation = location.state?.backgroundLocation || null;
  const initial = applyPendingStoryLikeState(mergeSeedStory([], requestedStorySeed), getPendingStoryLikes());

  const [stories, setStories] = useState(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  const savedIdx = () => { try { const v = sessionStorage.getItem(VIDEO_FEED_INDEX_KEY); return v ? Math.max(1, parseInt(v, 10)) : 1; } catch { return 1; } };
  const savedMuted = () => { try { return sessionStorage.getItem(VIDEO_FEED_MUTED_KEY) !== '0'; } catch { return true; } };

  const [activeDispIdx, setActiveDispIdx] = useState(() => (requestedStoryUserId ? 1 : savedIdx()));
  const [boundaryOverlayIdx, setBoundaryOverlayIdx] = useState(null);
  const [isMuted, setIsMuted] = useState(savedMuted);
  const [storyViewLimit, setStoryViewLimit] = useState(null);
  const [storyLimitBlock, setStoryLimitBlock] = useState(null);
  const [desktopStoryExpanded, setDesktopStoryExpanded] = useState(false);
  const [desktopStoryExpandedAspect, setDesktopStoryExpandedAspect] = useState(16 / 9);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const initialStoryUserIdRef = useRef(requestedStoryUserId);
  const savedStoryRestoreRef = useRef(requestedStoryUserId ? null : readSavedVideoFeedStory());
  const savedStoryRestoredRef = useRef(false);
  const apiRespondedRef = useRef(false);
  const allowedStoryViewsRef = useRef(new Set());
  const recordingStoryViewsRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    getPublicSettings({ fresh: true })
      .then((data) => {
        if (cancelled || !data?.settings) return;
        setSiteSettings((current) => {
          const next = { ...(current || {}), ...data.settings };
          try {
            sessionStorage.setItem('mansion_site_settings', JSON.stringify(next));
          } catch {}
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setSiteSettings]);

  const gradientHeight = siteSettings?.videoGradientHeight ?? 64;
  const gradientOpacity = siteSettings?.videoGradientOpacity ?? 40;
  const avatarSize = siteSettings?.videoAvatarSize ?? AVATAR_SIZE_DEFAULT;
  const limitBlurLevel = siteSettings?.videoLimitBlur
    ?? (isDesktopViewport
      ? (siteSettings?.blurDesktop ?? siteSettings?.blurLevel ?? 8)
      : (siteSettings?.blurMobile ?? siteSettings?.blurLevel ?? 14));
  const backendDailyLimit = Math.max(0, Number(storyViewLimit?.dailyLimit ?? siteSettings?.freeVideoStoryLimit ?? 10) || 0);
  const backendViewedToday = Math.max(0, Number(storyViewLimit?.viewedToday ?? 0) || 0);
  const backendRemaining = storyViewLimit?.remaining === null || storyViewLimit?.remaining === undefined
    ? null
    : Math.max(0, Number(storyViewLimit.remaining) || 0);
  const backendLimitActive = storyViewLimit?.limited !== false;
  const desktopStorySideOffset = desktopStoryExpanded
    ? getExpandedStorySideOffset(desktopStoryExpandedAspect)
    : 'calc(50% - 350px)';
  const handleDesktopStoryExpandedChange = useCallback((expanded, aspectRatio = 16 / 9) => {
    setDesktopStoryExpanded(!!expanded);
    setDesktopStoryExpandedAspect(normalizeLandscapeAspectRatio(aspectRatio));
  }, []);
  const isStoryBlockedByLimit = useCallback((story) => {
    const storyId = String(story?.story_id || story?.id || '').trim();
    if (!storyId || user?.premium) return false;
    if (storyLimitBlock?.storyId && String(storyLimitBlock.storyId) === storyId) return true;
    if (!backendLimitActive || backendRemaining === null || backendRemaining > 0) return false;
    return !allowedStoryViewsRef.current.has(storyId);
  }, [backendLimitActive, backendRemaining, storyLimitBlock?.storyId, user?.premium]);
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
    navigate('/radar', { replace: true });
  }, [backgroundLocation, flushPendingViewedStories, isOverlayPreview, navigate]);
  const closeToHomeFeed = useCallback(() => {
    flushPendingViewedStories();
    navigate('/radar', { replace: true });
  }, [flushPendingViewedStories, navigate]);
  const handleOverlayBackdropPointerDown = useCallback((event) => {
    if (!isOverlayPreview || !isDesktopViewport) return;
    if (event.target.closest('[data-story-card-frame="true"]')) return;
    closeOverlay();
  }, [closeOverlay, isDesktopViewport, isOverlayPreview]);
  const markStoryViewed = useCallback((storyUserId, storyId = '') => {
    const uid = String(storyUserId || '');
    if (!uid) return;
    try {
      if (!user?.id) return;
      const viewedToken = storyId ? `${uid}:${storyId}` : uid;
      if (getViewedStoryUsers(user.id).includes(viewedToken)) {
        clearPendingViewedStoryUsers(user.id);
        return;
      }
      markViewedStoryUser(user.id, uid, storyId);
      clearPendingViewedStoryUsers(user.id);
      window.dispatchEvent(new Event(VIEWED_STORIES_EVENT));
    } catch {}
  }, [user?.id]);
  const queueStoryViewed = useCallback((storyUserId, storyId = '') => {
    const uid = String(storyUserId || '');
    if (!uid) return;
    try {
      if (!user?.id) return;
      queuePendingViewedStoryUser(user.id, uid, storyId);
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
  const activeStoryId = String(activeStory?.story_id || activeStory?.id || '').trim();
  const activeStoryLimitBlocked = Boolean(activeStoryId && isStoryBlockedByLimit(activeStory));

  const standaloneMobileRoute = !isDesktopViewport && !isOverlayPreview;
  const isStandaloneMobileApp = detectStandaloneMobile();
  const mobileBrowserRoute = standaloneMobileRoute && !isStandaloneMobileApp;
  const navBottomOffset = isStandaloneMobileApp
    ? getStandaloneBottomNavOffset()
    : getBrowserBottomNavOffset();
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

  const forceMobileViewportToIndex = useCallback((index) => {
    if (isDesktopViewport) return false;
    const container = containerRef.current;
    if (!container || stories.length === 0) return false;

    const height = container.clientHeight;
    if (!height) return false;

    const clampedIndex = Math.min(Math.max(index, 1), stories.length);
    const nextScrollTop = height * clampedIndex;
    const previousSnap = container.style.scrollSnapType;

    container.style.scrollSnapType = 'none';
    container.scrollTop = nextScrollTop;
    setBoundaryOverlayIdx(null);

    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      containerRef.current.style.scrollSnapType = previousSnap || 'y mandatory';
    });

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
      const nextScrollTop = mobileBrowserRoute ? MOBILE_BROWSER_VIDEO_SCROLL_OFFSET : 0;
      window.scrollTo(0, nextScrollTop);
      document.documentElement.scrollTop = nextScrollTop;
      document.body.scrollTop = nextScrollTop;
    };

    resetPageScroll();
    let rafA = window.requestAnimationFrame(() => {
      resetPageScroll();
      rafA = window.requestAnimationFrame(() => {
        resetPageScroll();
      });
    });
    const timers = [80, 220, 520].map((delay) => window.setTimeout(resetPageScroll, delay));

    return () => {
      if (rafA) window.cancelAnimationFrame(rafA);
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [loading, location.key, mobileBrowserRoute, standaloneMobileRoute, stories.length]);

  useEffect(() => {
    if (!standaloneMobileRoute || !isStandaloneMobileApp || typeof window === 'undefined') return undefined;

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
  }, [isStandaloneMobileApp, standaloneMobileRoute]);

  const refreshStories = useCallback(async () => {
    const data = await getStories({ focusUserId: requestedStoryUserId || '' });
    const baseStories = mergeSeedStory(data.stories || [], requestedStorySeed);
    const orderedStories = requestedStoryUserId
      ? rotateStoriesToUser(baseStories, requestedStoryUserId)
      : baseStories;
    const fresh = applyPendingStoryLikeState(orderedStories, getPendingStoryLikes());
    apiRespondedRef.current = true;
    if (data.videoLimit) setStoryViewLimit(data.videoLimit);
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

    if (savedStory.source === VIDEO_FEED_RAIL_SOURCE && typeof window !== 'undefined') {
      [0, 80, 180, 360].forEach((delay) => {
        window.setTimeout(() => {
          forceMobileViewportToIndex(nextIndex);
        }, delay);
      });
    }
  }, [forceMobileViewportToIndex, requestedStoryUserId, stories, syncMobileViewportToIndex]);

  useEffect(() => {
    if (!activeStory?.user_id) return undefined;

    const storyId = String(activeStory.story_id || activeStory.id || '').trim();
    const storyUserId = activeStory.user_id;
    const markAllowedStoryViewed = () => {
      if (isOverlayPreview) {
        queueStoryViewed(storyUserId, storyId);
        return;
      }
      markStoryViewed(storyUserId, storyId);
    };

    setStoryLimitBlock((current) => (
      current?.storyId && current.storyId !== storyId ? null : current
    ));

    if (user?.premium || !storyId) {
      markAllowedStoryViewed();
      return undefined;
    }

    if (allowedStoryViewsRef.current.has(storyId)) {
      markAllowedStoryViewed();
      return undefined;
    }

    if (backendLimitActive && backendRemaining !== null && backendRemaining <= 0) {
      setStoryLimitBlock({
        storyId,
        limit: storyViewLimit || { dailyLimit: backendDailyLimit, viewedToday: backendViewedToday, remaining: 0 },
        message: 'Alcanzaste el límite diario de videos.',
      });
      return undefined;
    }

    if (recordingStoryViewsRef.current.has(storyId)) {
      return undefined;
    }

    let cancelled = false;
    recordingStoryViewsRef.current.add(storyId);

    recordStoryView(storyId)
      .then((data) => {
        allowedStoryViewsRef.current.add(storyId);
        if (data?.videoLimit && !cancelled) setStoryViewLimit(data.videoLimit);
        if (!cancelled) {
          setStoryLimitBlock((current) => (current?.storyId === storyId ? null : current));
          markAllowedStoryViewed();
        }
      })
      .catch((err) => {
        const code = String(err?.data?.code || '').toUpperCase();
        if (code === 'DAILY_STORY_LIMIT') {
          const nextLimit = err?.data?.videoLimit || { dailyLimit: 10, viewedToday: 10, remaining: 0 };
          if (!cancelled) {
            setStoryViewLimit(nextLimit);
            setStoryLimitBlock({
              storyId,
              limit: nextLimit,
              message: err?.message || 'Alcanzaste el límite diario de stories.',
            });
          }
          return;
        }

        if (code === 'VIP_STORY_REQUIRED') {
          if (!cancelled) navigate('/vip', { state: { from: '/videos' } });
          return;
        }

        if (!cancelled) markAllowedStoryViewed();
      })
      .finally(() => {
        recordingStoryViewsRef.current.delete(storyId);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStory?.id, activeStory?.story_id, activeStory?.user_id, backendDailyLimit, backendLimitActive, backendRemaining, backendViewedToday, isOverlayPreview, markStoryViewed, navigate, queueStoryViewed, storyViewLimit, user?.premium]);

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

  useEffect(() => {
    if (!standaloneMobileRoute || !isStandaloneMobileApp || requestedStoryUserId || loading || stories.length === 0) return;
    if (pwaReturnAnchorDoneRef.current) return;

    const savedStory = savedStoryRestoreRef.current;
    const targetIndex = findSavedStoryIndex(stories, savedStory);
    if (targetIndex < 0) return;

    const nextIndex = targetIndex + 1;
    pwaReturnAnchorDoneRef.current = true;
    setActiveDispIdx(nextIndex);
    setBoundaryOverlayIdx(null);

    pwaReturnAnchorTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    pwaReturnAnchorTimersRef.current = [0, 80, 220, 520].map((delay) => (
      window.setTimeout(() => {
        forceMobileViewportToIndex(nextIndex);
      }, delay)
    ));
  }, [forceMobileViewportToIndex, isStandaloneMobileApp, loading, requestedStoryUserId, standaloneMobileRoute, stories]);

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
        sessionStorage.setItem(VIDEO_FEED_ACTIVE_STORY_KEY, JSON.stringify({ ...storyIdentity, source: 'video' }));
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
    pwaReturnAnchorTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    pwaReturnAnchorTimersRef.current = [];
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

  const desktopOverlayRoute = isOverlayPreview && isDesktopViewport;
  const desktopStandardRoute = isDesktopViewport && !desktopOverlayRoute;

  if (loading) {
    return (
      <div
        className={
          standaloneMobileRoute
            ? 'relative min-h-mobile-browser-screen overflow-hidden bg-black'
            : desktopOverlayRoute
              ? 'fixed inset-0 bg-black flex items-center justify-center z-[60] lg:z-40'
              : desktopStandardRoute
                ? 'fixed inset-y-0 right-0 left-0 lg:left-64 xl:left-72 bg-black flex items-center justify-center z-[60] lg:z-40'
                : 'fixed inset-0 bg-black flex items-center justify-center z-[60] lg:z-40'
        }
      >
        <div
          className={standaloneMobileRoute ? 'flex h-mobile-browser-screen items-center justify-center' : undefined}
        >
          <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div
        className={
          standaloneMobileRoute
            ? 'relative min-h-mobile-browser-screen overflow-hidden bg-mansion-base px-6'
            : desktopOverlayRoute
              ? 'fixed inset-0 bg-mansion-base flex flex-col items-center justify-center z-[60] lg:z-40 px-6'
              : desktopStandardRoute
                ? 'fixed inset-y-0 right-0 left-0 lg:left-64 xl:left-72 bg-mansion-base flex flex-col items-center justify-center z-[60] lg:z-40 px-6'
                : 'fixed inset-0 bg-mansion-base flex flex-col items-center justify-center z-[60] lg:z-40 px-6'
        }
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 right-[-10%] w-[520px] h-[520px] rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="absolute bottom-[-12%] left-[-6%] w-[460px] h-[460px] rounded-full bg-mansion-gold/10 blur-3xl" />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`relative flex flex-col items-center justify-center text-center max-w-sm mx-auto ${standaloneMobileRoute ? 'h-mobile-browser-screen' : ''}`}
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

  return (
    <div
      className={
        mobileBrowserRoute
          ? 'relative min-h-[calc(100vh+125px)] bg-mansion-base pb-mobile-legacy-nav lg:pb-8'
          : standaloneMobileRoute
          ? 'relative min-h-mobile-browser-screen overflow-hidden bg-black'
          : desktopOverlayRoute
            ? 'absolute inset-0 bg-black z-[60]'
            : 'fixed inset-0 bg-black z-[60] lg:z-40 lg:left-64 xl:left-72 lg:bg-mansion-base'
      }
      onPointerDown={handleOverlayBackdropPointerDown}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none z-20 bg-black"
        initial={{ opacity: entryRevealReady ? 0 : 0.7 }}
        animate={{ opacity: entryRevealReady ? 0 : 1 }}
        transition={{ duration: entryRevealReady ? 0.01 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      />

      <div
        className={
          mobileBrowserRoute
            ? 'absolute inset-0 bg-black'
            : standaloneMobileRoute
              ? 'relative h-mobile-browser-screen'
              : 'relative h-full'
        }
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
              const isStoryBlocked = isStoryBlockedByLimit(story);
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
                    shouldLoad={shouldLoad || isStoryBlocked}
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
                  onLandscapeExpandedChange={isActive ? handleDesktopStoryExpandedChange : undefined}
                  enableCinematicReveal={enableCinematicReveal}
                  isLimitBlocked={isStoryBlocked}
                  limit={storyLimitBlock?.limit || storyViewLimit}
                  limitBlurLevel={limitBlurLevel}
                  onVip={() => navigate('/vip', { state: { from: '/videos' } })}
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
            const isStoryBlocked = isStoryBlockedByLimit(story);
            return (
              <div
                key={`${displayIndex}-${mobileStoryKey}`}
                className="w-full flex-shrink-0"
                style={{ height: '100dvh' }}
              >
                <StoryCard
                  story={story}
                  videoSrc={story.video_url}
                  isActive={displayIndex === activeDispIdx}
                  shouldLoad={shouldLoad || isStoryBlocked}
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
                  onLandscapeExpandedChange={displayIndex === activeDispIdx ? handleDesktopStoryExpandedChange : undefined}
                  enableCinematicReveal={enableCinematicReveal}
                  pauseOnAppBackground
                  isLimitBlocked={isStoryBlocked}
                  limit={storyLimitBlock?.limit || storyViewLimit}
                  limitBlurLevel={limitBlurLevel}
                  onVip={() => navigate('/vip', { state: { from: '/videos' } })}
                />
              </div>
            );
          })}
        </div>
        )}

        {activeStory && !activeStoryLimitBlocked && (
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

        {activeStory && !activeStoryLimitBlocked && (
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
            className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-[72px] h-[72px] rounded-full items-center justify-center border border-white/10 transition-all duration-300 ease-out ${safariDesktop ? 'bg-black/60' : 'bg-mansion-card/60 backdrop-blur-sm hover:bg-mansion-card/90 hover:border-white/25 hover:scale-110'}`}
            style={{ left: desktopStorySideOffset }}
          >
            <ChevronLeft className="w-9 h-9 text-white/70" />
          </button>
          <button
            onClick={() => (isDesktopViewport ? moveDesktopByOne(1) : jumpByOne(1))}
            className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-30 w-[72px] h-[72px] rounded-full items-center justify-center border border-white/10 transition-all duration-300 ease-out ${safariDesktop ? 'bg-black/60' : 'bg-mansion-card/60 backdrop-blur-sm hover:bg-mansion-card/90 hover:border-white/25 hover:scale-110'}`}
            style={{ right: desktopStorySideOffset }}
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
