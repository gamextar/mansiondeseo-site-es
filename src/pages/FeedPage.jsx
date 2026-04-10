import { forwardRef, useState, useMemo, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Plus } from 'lucide-react';
import { useAuth } from '../lib/authContext';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.045 } } };
const storyItem = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
};
import ProfileCard from '../components/ProfileCard';
import AvatarImg from '../components/AvatarImg';
import StoryPreviewOverlay from '../components/StoryPreviewOverlay';
import { getProfiles, getToken } from '../lib/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPrimaryProfileCrop, getPrimaryProfilePhoto } from '../lib/profileMedia';
import { isSafariDesktopBrowser } from '../lib/browser';

const FEED_CACHE_KEY = 'mansion_feed';
const FEED_CACHE_TTL_MS = 5 * 60_000;
const FEED_BACKGROUND_REFRESH_MS = 45_000;
const HOME_FEED_FOCUS_EVENT = 'mansion-home-feed-focus';
const FEED_SCROLL_KEY = 'mansion_feed_scroll_y';
const SAFARI_DESKTOP_INITIAL_VISIBLE = 24;
const SAFARI_DESKTOP_VISIBLE_STEP = 12;
const MOBILE_MAX_DOM_CARDS = 200;

const AnimatedBlock = forwardRef(function AnimatedBlock({ disabled = false, motionProps = {}, children, ...rest }, ref) {
  if (disabled) return <div ref={ref} {...rest}>{children}</div>;
  return <motion.div ref={ref} {...rest} {...motionProps}>{children}</motion.div>;
});

function getCachedFeed() {
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.profiles)) return parsed;
    if (Array.isArray(parsed)) {
      return { profiles: parsed, viewerPremium: false, settings: {}, timestamp: 0 };
    }
    return null;
  } catch { return null; }
}

function setCachedFeed(data) {
  try {
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
      profiles: data.profiles || [],
      viewerPremium: data.viewerPremium || false,
      settings: data.settings || {},
      nextCursor: data.nextCursor || null,
      hasMore: !!data.hasMore,
      timestamp: Date.now(),
    }));
  } catch {}
}

function clearCachedFeed() {
  try {
    sessionStorage.removeItem(FEED_CACHE_KEY);
  } catch {}
}

function isFeedCacheFresh(cached) {
  const timestamp = Number(cached?.timestamp) || 0;
  return timestamp > 0 && Date.now() - timestamp < FEED_CACHE_TTL_MS;
}

function shouldBackgroundRefreshFeed(cached) {
  const timestamp = Number(cached?.timestamp) || 0;
  if (timestamp <= 0) return true;
  return Date.now() - timestamp >= FEED_BACKGROUND_REFRESH_MS;
}

function hasFeedPaginationState(cached) {
  if (!cached || typeof cached !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(cached, 'hasMore')
    || Object.prototype.hasOwnProperty.call(cached, 'nextCursor');
}

export default function FeedPage() {
  const safariDesktop = isSafariDesktopBrowser();
  const cached = getCachedFeed();
  const getInitialVisibleCount = useCallback(
    (list) => (safariDesktop ? Math.min(Array.isArray(list) ? list.length : 0, SAFARI_DESKTOP_INITIAL_VISIBLE) : Array.isArray(list) ? list.length : 0),
    [safariDesktop]
  );
  const [profiles, setProfiles] = useState(cached?.profiles || []);
  const [visibleCount, setVisibleCount] = useState(() => getInitialVisibleCount(cached?.profiles || []));
  const [showStoriesSection, setShowStoriesSection] = useState(() => !safariDesktop);
  const [showGridSection, setShowGridSection] = useState(() => !safariDesktop);
  const [canAutoLoadMore, setCanAutoLoadMore] = useState(() => !safariDesktop);
  const [viewerPremium, setViewerPremium] = useState(cached?.viewerPremium || false);
  const [settings, setSettings] = useState(cached?.settings || {});
  const [nextCursor, setNextCursor] = useState(cached?.nextCursor || null);
  const [hasMore, setHasMore] = useState(
    cached
      ? (typeof cached?.hasMore === 'boolean' ? cached.hasMore : true)
      : false
  );
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showOwnStoryPreview, setShowOwnStoryPreview] = useState(false);
  const navigate = useNavigate();
  const { user, siteSettings } = useAuth();
  const navBottomOffset = (siteSettings?.navBottomPadding ?? 24) + (siteSettings?.navHeight ?? 71);
  const loadMoreRef = useRef(null);
  const scrollRestoredRef = useRef(false);
  const paginatedRef = useRef(false);
  const storiesScrollRef = useRef(null);
  const storiesMomentumRef = useRef({
    frameId: null,
    velocity: 0,
  });
  const storiesDragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    lastX: 0,
    lastTs: 0,
    velocity: 0,
  });
  const isSafariDesktopRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    const vendor = window.navigator.vendor || '';
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|OPR/i.test(ua) && /Apple/i.test(vendor);
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    isSafariDesktopRef.current = isSafari && isDesktop;
  }, []);

  useEffect(() => {
    if (!safariDesktop) {
      setShowStoriesSection(true);
      setShowGridSection(true);
      setCanAutoLoadMore(true);
      return undefined;
    }

    setShowStoriesSection(false);
    setShowGridSection(false);
    setCanAutoLoadMore(false);
    let frameA = 0;
    let frameB = 0;
    let frameC = 0;
    let frameD = 0;
    const timeoutId = window.setTimeout(() => {
      frameA = requestAnimationFrame(() => {
        frameB = requestAnimationFrame(() => {
          setShowStoriesSection(true);
        });
      });
      frameC = requestAnimationFrame(() => {
        frameD = requestAnimationFrame(() => {
          setShowGridSection(true);
        });
      });
    }, 140);

    return () => {
      window.clearTimeout(timeoutId);
      if (frameA) cancelAnimationFrame(frameA);
      if (frameB) cancelAnimationFrame(frameB);
      if (frameC) cancelAnimationFrame(frameC);
      if (frameD) cancelAnimationFrame(frameD);
    };
  }, [safariDesktop]);

  useEffect(() => {
    if (!safariDesktop) return undefined;

    const unlockAutoLoad = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop > 80) {
        setCanAutoLoadMore(true);
      }
    };

    window.addEventListener('scroll', unlockAutoLoad, { passive: true });
    return () => window.removeEventListener('scroll', unlockAutoLoad);
  }, [safariDesktop]);

  const loadProfiles = useCallback(({ silent = false, forceFresh = false } = {}) => {
    const c = getCachedFeed();
    if (!silent && !c) setLoading(true);
    if (!silent && c) {
      setProfiles(c.profiles || []);
      setVisibleCount(getInitialVisibleCount(c.profiles || []));
      setViewerPremium(c.viewerPremium || false);
      if (c.settings) setSettings(c.settings);
      setNextCursor(c.nextCursor || null);
      setHasMore(!!c.hasMore);
    }
    paginatedRef.current = false;
    return getProfiles({ fresh: forceFresh })
      .then(data => {
        setProfiles(data.profiles || []);
        setVisibleCount(getInitialVisibleCount(data.profiles || []));
        setViewerPremium(data.viewerPremium || false);
        if (data.settings) setSettings(data.settings);
        setNextCursor(data.nextCursor || null);
        setHasMore(!!data.hasMore);
        setCachedFeed({
          profiles: data.profiles || [],
          viewerPremium: data.viewerPremium || false,
          settings: data.settings || {},
          nextCursor: data.nextCursor || null,
          hasMore: !!data.hasMore,
        });
      })
      .catch(() => {
        if (!silent) {
          setProfiles([]);
          setNextCursor(null);
          setHasMore(false);
        }
      })
      .finally(() => setLoading(false));
  }, [getInitialVisibleCount]);

  const loadMoreProfiles = useCallback(() => {
    if (safariDesktop && visibleCount < profiles.length) {
      setVisibleCount((current) => Math.min(profiles.length, current + SAFARI_DESKTOP_VISIBLE_STEP));
      return Promise.resolve();
    }
    if (loading || loadingMore || !hasMore || !nextCursor) return Promise.resolve();
    setLoadingMore(true);
    return getProfiles({ cursor: nextCursor })
      .then((data) => {
        const newProfiles = Array.isArray(data?.profiles) ? data.profiles : [];
        paginatedRef.current = true;
        setProfiles((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const merged = [...prev];
          for (const profile of newProfiles) {
            if (!profile?.id || seen.has(profile.id)) continue;
            seen.add(profile.id);
            merged.push(profile);
          }
          setVisibleCount((current) => (
            safariDesktop
              ? Math.min(merged.length, Math.max(current, current + SAFARI_DESKTOP_VISIBLE_STEP))
              : merged.length
          ));
          return merged;
        });
        if (data.settings) setSettings(data.settings);
        if (typeof data.viewerPremium === 'boolean') setViewerPremium(data.viewerPremium);
        setNextCursor(data.nextCursor || null);
        setHasMore(!!data.hasMore);
      })
      .finally(() => setLoadingMore(false));
  }, [hasMore, loading, loadingMore, nextCursor, profiles.length, safariDesktop, visibleCount]);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    const cachedFeed = getCachedFeed();
    if (!cachedFeed) {
      loadProfiles();
      return;
    }

    setProfiles(cachedFeed.profiles || []);
    setVisibleCount(getInitialVisibleCount(cachedFeed.profiles || []));
    setViewerPremium(cachedFeed.viewerPremium || false);
    if (cachedFeed.settings) setSettings(cachedFeed.settings);
    setNextCursor(cachedFeed.nextCursor || null);
    setHasMore(typeof cachedFeed.hasMore === 'boolean' ? cachedFeed.hasMore : true);
    setLoading(false);

    if (!isFeedCacheFresh(cachedFeed) || !hasFeedPaginationState(cachedFeed) || shouldBackgroundRefreshFeed(cachedFeed)) {
      loadProfiles({ silent: true });
    }
  }, [getInitialVisibleCount, navigate, loadProfiles]);

  useEffect(() => {
    const handleHomeFocus = () => {
      setShowOwnStoryPreview(false);
      try { sessionStorage.removeItem(FEED_SCROLL_KEY); } catch {}
      const scrollTarget = document.scrollingElement || document.documentElement || document.body;
      if (scrollTarget) {
        scrollTarget.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener(HOME_FEED_FOCUS_EVENT, handleHomeFocus);
    return () => window.removeEventListener(HOME_FEED_FOCUS_EVENT, handleHomeFocus);
  }, []);

  // Save scroll position (throttled via rAF)
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          try { sessionStorage.setItem(FEED_SCROLL_KEY, String(window.scrollY)); } catch {}
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position once after profiles render from cache
  useEffect(() => {
    if (scrollRestoredRef.current || profiles.length === 0) return;
    scrollRestoredRef.current = true;
    try {
      const savedY = parseInt(sessionStorage.getItem(FEED_SCROLL_KEY), 10);
      if (savedY > 0) {
        requestAnimationFrame(() => { window.scrollTo(0, savedY); });
      }
    } catch {}
  }, [profiles.length]);

  // Reload feed when navigating back after preference changes
  useEffect(() => {
    const onFocus = () => {
      if (sessionStorage.getItem('mansion_feed_dirty')) {
        sessionStorage.removeItem('mansion_feed_dirty');
        const shouldForceFresh = sessionStorage.getItem('mansion_feed_force_refresh') === '1';
        sessionStorage.removeItem('mansion_feed_force_refresh');
        sessionStorage.removeItem(FEED_CACHE_KEY);
        try { sessionStorage.removeItem(FEED_SCROLL_KEY); } catch {}
        loadProfiles({ forceFresh: shouldForceFresh });
        return;
      }

      // Don't background-refresh if user has paginated past page 1
      if (paginatedRef.current) return;

      const cachedFeed = getCachedFeed();
      if (!isFeedCacheFresh(cachedFeed) || !hasFeedPaginationState(cachedFeed) || shouldBackgroundRefreshFeed(cachedFeed)) {
        loadProfiles({ silent: true });
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadProfiles]);

  const { indicatorRef } = usePullToRefresh(
    useCallback(() => loadProfiles({ silent: true }), [loadProfiles])
  );

  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  const renderedProfiles = safariDesktop
    ? safeProfiles.slice(0, visibleCount)
    : safeProfiles.slice(0, MOBILE_MAX_DOM_CARDS);
  const storyProfiles = safeProfiles.filter(p => p.has_active_story).slice(0, safariDesktop ? 6 : 15);
  const storyCircleSize = safeSettings.storyCircleSize || 88;
  const storyCircleGap = Math.max(0, Math.round((storyCircleSize * (safeSettings.storyCircleGap ?? 8)) / 100));
  const storyCircleBorder = Math.max(1, Math.round((storyCircleSize * (safeSettings.storyCircleBorder ?? 4)) / 100));
  const storyCircleInnerGap = Math.max(0, Math.round((storyCircleSize * (safeSettings.storyCircleInnerGap ?? 3)) / 100));

  const viewedRaw = useSyncExternalStore(
    useCallback((cb) => {
      const handler = () => cb();
      window.addEventListener('storage', handler);
      window.addEventListener('focus', handler);
      window.addEventListener('visibilitychange', handler);
      return () => { window.removeEventListener('storage', handler); window.removeEventListener('focus', handler); window.removeEventListener('visibilitychange', handler); };
    }, []),
    () => localStorage.getItem('viewed_story_users') || '[]',
  );
  const viewedStoryUsers = useMemo(() => {
    try { return new Set(JSON.parse(viewedRaw)); } catch { return new Set(); }
  }, [viewedRaw]);

  const handleStoriesWheel = useCallback((event) => {
    if (isSafariDesktopRef.current) return;
    const el = storiesScrollRef.current;
    if (!el) return;
    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    if (absY <= absX) return;
    if (el.scrollWidth <= el.clientWidth) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
  }, []);

  const handleStoriesNativeDragStart = useCallback((event) => {
    event.preventDefault();
  }, []);

  const stopStoriesMomentum = useCallback(() => {
    const momentum = storiesMomentumRef.current;
    if (momentum.frameId) {
      cancelAnimationFrame(momentum.frameId);
      momentum.frameId = null;
    }
    momentum.velocity = 0;
  }, []);

  const startStoriesMomentum = useCallback(() => {
    const el = storiesScrollRef.current;
    const momentum = storiesMomentumRef.current;
    if (!el || Math.abs(momentum.velocity) < 0.01) return;

    const step = () => {
      const currentEl = storiesScrollRef.current;
      if (!currentEl) {
        momentum.frameId = null;
        momentum.velocity = 0;
        return;
      }

      currentEl.scrollLeft += momentum.velocity * 16;

      const maxScrollLeft = Math.max(0, currentEl.scrollWidth - currentEl.clientWidth);
      if (currentEl.scrollLeft <= 0 || currentEl.scrollLeft >= maxScrollLeft) {
        currentEl.scrollLeft = Math.min(maxScrollLeft, Math.max(0, currentEl.scrollLeft));
        momentum.frameId = null;
        momentum.velocity = 0;
        return;
      }

      momentum.velocity *= 0.92;
      if (Math.abs(momentum.velocity) < 0.01) {
        momentum.frameId = null;
        momentum.velocity = 0;
        return;
      }

      momentum.frameId = requestAnimationFrame(step);
    };

    if (momentum.frameId) cancelAnimationFrame(momentum.frameId);
    momentum.frameId = requestAnimationFrame(step);
  }, []);

  const handleStoriesPointerDown = useCallback((event) => {
    if (isSafariDesktopRef.current) return;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const el = storiesScrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    stopStoriesMomentum();
    storiesDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
      lastX: event.clientX,
      lastTs: event.timeStamp || performance.now(),
      velocity: 0,
    };
    el.setPointerCapture?.(event.pointerId);
  }, [stopStoriesMomentum]);

  const handleStoriesPointerMove = useCallback((event) => {
    if (isSafariDesktopRef.current) return;
    const el = storiesScrollRef.current;
    const drag = storiesDragRef.current;
    if (!el || !drag.active) return;
    const deltaX = event.clientX - drag.startX;
    const now = event.timeStamp || performance.now();
    const deltaTs = Math.max(1, now - drag.lastTs);
    const deltaSinceLast = event.clientX - drag.lastX;
    if (Math.abs(deltaX) > 4) {
      drag.moved = true;
    }
    el.scrollLeft = drag.startScrollLeft - deltaX;
    drag.velocity = (-deltaSinceLast) / deltaTs;
    drag.lastX = event.clientX;
    drag.lastTs = now;
  }, []);

  const finishStoriesDrag = useCallback((event) => {
    if (isSafariDesktopRef.current) return;
    const el = storiesScrollRef.current;
    const drag = storiesDragRef.current;
    if (!drag.active) return;
    drag.active = false;
    if (el && event?.pointerId !== undefined) {
      try { el.releasePointerCapture?.(event.pointerId); } catch {}
    }
    storiesMomentumRef.current.velocity = drag.moved ? drag.velocity : 0;
    if (drag.moved) {
      startStoriesMomentum();
    } else {
      storiesMomentumRef.current.velocity = 0;
    }
  }, [startStoriesMomentum]);

  const handleStoriesClickCapture = useCallback((event) => {
    if (isSafariDesktopRef.current) return;
    if (!storiesDragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    storiesDragRef.current.moved = false;
  }, []);

  const maybeLoadMore = useCallback(() => {
    if (!loadMoreRef.current || loading || loadingMore || !hasMore || !canAutoLoadMore) return;
    const rect = loadMoreRef.current.getBoundingClientRect();
    const thresholdPx = 1500;
    if (rect.top - window.innerHeight <= thresholdPx) {
      loadMoreProfiles();
    }
  }, [canAutoLoadMore, hasMore, loadMoreProfiles, loading, loadingMore, safariDesktop]);

  useEffect(() => {
    if (!loadMoreRef.current || loading || loadingMore || !hasMore || !canAutoLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreProfiles();
        }
      },
      { rootMargin: '1500px 0px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [canAutoLoadMore, hasMore, loading, loadingMore, loadMoreProfiles, safariDesktop]);

  useEffect(() => {
    maybeLoadMore();
  }, [maybeLoadMore, profiles.length, showGridSection, visibleCount]);

  useEffect(() => {
    let ticking = false;
    const scheduleCheck = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        maybeLoadMore();
      });
    };

    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('resize', scheduleCheck);
    window.addEventListener('focus', scheduleCheck);
    return () => {
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('resize', scheduleCheck);
      window.removeEventListener('focus', scheduleCheck);
    };
  }, [maybeLoadMore]);

  useEffect(() => () => stopStoriesMomentum(), [stopStoriesMomentum]);

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-navbar">
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="fixed top-16 left-0 right-0 z-50 flex justify-center py-2 pointer-events-none"
        style={{ transform: 'translateY(-100%)', opacity: 0, transition: 'transform 0.2s, opacity 0.2s' }}
      >
        <div className="w-7 h-7 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
      {/* Stories section */}
      {showStoriesSection && (
      <AnimatedBlock
        disabled={safariDesktop}
        className="px-4 lg:px-8 pt-2 lg:pt-4 pb-0"
        motionProps={{
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
        }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Radio className="w-4 h-4 text-mansion-crimson" />
          <p className="text-text-muted text-sm lg:text-base font-medium">Video Flashes</p>
        </div>
        <AnimatedBlock
          disabled={safariDesktop}
          ref={storiesScrollRef}
          className="flex overflow-x-auto scrollbar-hide pb-2 lg:cursor-grab active:lg:cursor-grabbing select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', gap: `${storyCircleGap}px`, touchAction: 'pan-x' }}
          motionProps={{
            variants: stagger,
            initial: 'hidden',
            animate: 'visible',
          }}
          onWheel={handleStoriesWheel}
          onDragStart={handleStoriesNativeDragStart}
          onPointerDownCapture={handleStoriesPointerDown}
          onPointerMove={handleStoriesPointerMove}
          onPointerUp={finishStoriesDrag}
          onPointerCancel={finishStoriesDrag}
          onPointerLeave={finishStoriesDrag}
          onClickCapture={handleStoriesClickCapture}
        >
          {/* User's own story circle */}
          {user && (
            safariDesktop ? (
              <div className="flex-shrink-0" style={{ width: storyCircleSize + 6 }}>
                <div className="relative">
                  <button
                    type="button"
                    draggable={false}
                    onClick={user.has_active_story && user.active_story_url
                      ? () => setShowOwnStoryPreview(true)
                      : () => navigate('/historia/nueva', { state: { from: '/' } })}
                    className="flex flex-col items-center gap-1 w-full"
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <div className={`rounded-full ${
                      user.has_active_story
                        ? viewedStoryUsers.has(String(user.id))
                          ? 'bg-white/20'
                          : 'bg-gradient-to-tr from-emerald-400 via-emerald-500 to-emerald-400'
                        : 'bg-mansion-border/40'
                    }`} style={{ width: storyCircleSize, height: storyCircleSize, padding: storyCircleBorder }}>
                      <div className="w-full h-full rounded-full bg-mansion-base" style={{ padding: storyCircleInnerGap }}>
                        <div className="w-full h-full rounded-full overflow-hidden bg-mansion-elevated">
                          {user.avatar_url ? (
                            <AvatarImg src={user.avatar_url} crop={user.avatar_crop} cover alt={user.username} className="w-full h-full" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-dim text-xs font-bold">
                              {user.username?.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-mansion-gold truncate w-full text-center leading-tight">Tú</span>
                  </button>
                  <button
                    type="button"
                    draggable={false}
                    onClick={(e) => { e.stopPropagation(); navigate('/historia/nueva', { state: { from: '/' } }); }}
                    className="absolute bottom-4 right-0 w-5 h-5 rounded-full bg-mansion-gold flex items-center justify-center border-2 border-mansion-base shadow-md"
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <Plus className="w-3 h-3 text-mansion-base" strokeWidth={3} />
                  </button>
                </div>
              </div>
            ) : (
              <motion.div variants={storyItem} className="flex-shrink-0" style={{ width: storyCircleSize + 6 }}>
                <div className="relative">
                  <button
                    type="button"
                    draggable={false}
                    onClick={user.has_active_story && user.active_story_url
                      ? () => setShowOwnStoryPreview(true)
                      : () => navigate('/historia/nueva', { state: { from: '/' } })}
                    className="flex flex-col items-center gap-1 w-full"
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <div className={`rounded-full ${
                      user.has_active_story
                        ? viewedStoryUsers.has(String(user.id))
                          ? 'bg-white/20'
                          : 'bg-gradient-to-tr from-emerald-400 via-emerald-500 to-emerald-400'
                        : 'bg-mansion-border/40'
                    }`} style={{ width: storyCircleSize, height: storyCircleSize, padding: storyCircleBorder }}>
                      <div className="w-full h-full rounded-full bg-mansion-base" style={{ padding: storyCircleInnerGap }}>
                        <div className="w-full h-full rounded-full overflow-hidden bg-mansion-elevated">
                          {user.avatar_url ? (
                            <AvatarImg src={user.avatar_url} crop={user.avatar_crop} cover alt={user.username} className="w-full h-full" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-dim text-xs font-bold">
                              {user.username?.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-mansion-gold truncate w-full text-center leading-tight">Tú</span>
                  </button>
                  <button
                    type="button"
                    draggable={false}
                    onClick={(e) => { e.stopPropagation(); navigate('/historia/nueva', { state: { from: '/' } }); }}
                    className="absolute bottom-4 right-0 w-5 h-5 rounded-full bg-mansion-gold flex items-center justify-center border-2 border-mansion-base shadow-md"
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <Plus className="w-3 h-3 text-mansion-base" strokeWidth={3} />
                  </button>
                </div>
              </motion.div>
            )
          )}
          {storyProfiles.map((p) => {
            const photo = getPrimaryProfilePhoto(p);
            const photoCrop = getPrimaryProfileCrop(p);
            const isViewed = viewedStoryUsers.has(p.id);
            const size = storyCircleSize;
            const border = storyCircleBorder;
            const innerGap = storyCircleInnerGap;
            return safariDesktop ? (
              <div key={`story-${p.id}`} className="flex-shrink-0" style={{ width: size + 6 }}>
                <button
                  type="button"
                  draggable={false}
                  onClick={() => navigate('/videos', { state: { storyUserId: p.id } })}
                  className="flex flex-col items-center gap-1"
                  onDragStart={handleStoriesNativeDragStart}
                >
                  <div className={`rounded-full ${
                    isViewed
                      ? 'bg-white/20'
                      : 'bg-gradient-to-tr from-mansion-crimson via-mansion-gold to-mansion-crimson'
                  }`} style={{ width: size, height: size, padding: border }}>
                    <div className="w-full h-full rounded-full bg-mansion-base" style={{ padding: innerGap }}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-mansion-elevated">
                        {photo ? (
                          <AvatarImg src={photo} crop={photoCrop} cover alt={p.name} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-dim text-xs font-bold">
                            {p.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted truncate w-full text-center leading-tight">{p.name?.split(' ')[0]}</span>
                </button>
              </div>
            ) : (
              <motion.div key={`story-${p.id}`} variants={storyItem} className="flex-shrink-0" style={{ width: size + 6 }}>
                <button
                  type="button"
                  draggable={false}
                  onClick={() => navigate('/videos', { state: { storyUserId: p.id } })}
                  className="flex flex-col items-center gap-1"
                  onDragStart={handleStoriesNativeDragStart}
                >
                  <div className={`rounded-full ${
                    isViewed
                      ? 'bg-white/20'
                      : 'bg-gradient-to-tr from-mansion-crimson via-mansion-gold to-mansion-crimson'
                  }`} style={{ width: size, height: size, padding: border }}>
                    <div className="w-full h-full rounded-full bg-mansion-base" style={{ padding: innerGap }}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-mansion-elevated">
                        {photo ? (
                          <AvatarImg src={photo} crop={photoCrop} cover alt={p.name} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-dim text-xs font-bold">
                            {p.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted truncate w-full text-center leading-tight">{p.name?.split(' ')[0]}</span>
                </button>
              </motion.div>
            );
          })}
        </AnimatedBlock>
      </AnimatedBlock>
      )}

      {/* Results count */}
      <AnimatedBlock
        disabled={safariDesktop}
        className="px-4 lg:px-8 pb-2"
        motionProps={{
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.3, delay: 0.25 },
        }}
      >
        <p className="text-text-dim text-xs">
          {safeProfiles.length} {safeProfiles.length === 1 ? 'usuario' : 'usuarios'} conectados
        </p>
      </AnimatedBlock>

      {/* Grid */}
      <AnimatedBlock
        disabled={safariDesktop}
        className="px-4 lg:px-8"
        motionProps={{
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] },
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        ) : safeProfiles.length > 0 ? (
          <>
            {showGridSection ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 lg:gap-4">
                {renderedProfiles.map((profile, index) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    index={index}
                    rank={index + 1}
                    viewerPremium={viewerPremium}
                    settings={safeSettings}
                    safariDesktopOverride={safariDesktop}
                    isMobileOverride={false}
                  />
                ))}
              </div>
            ) : (
              <div className="h-24" aria-hidden="true" />
            )}
            <div ref={loadMoreRef} className="h-8" />
            {loadingMore && (
              <div className="flex items-center justify-center py-6">
                <div className="w-7 h-7 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <AnimatedBlock
            disabled={safariDesktop}
            motionProps={{
              initial: { opacity: 0 },
              animate: { opacity: 1 },
            }}
            className="text-center py-20"
          >
            <p className="text-text-muted text-lg mb-2">No hay perfiles</p>
            <p className="text-text-dim text-sm">Prueba con otro filtro</p>
          </AnimatedBlock>
        )}
      </AnimatedBlock>

      {showOwnStoryPreview && user?.active_story_url && (
        <div className="fixed inset-0 z-50 bg-black lg:left-64 xl:left-72 lg:bg-mansion-base">
          <div className="relative w-full h-full lg:h-[calc(100%-32px)] lg:max-w-[520px] lg:mx-auto lg:my-4 lg:rounded-2xl lg:overflow-hidden">
            <StoryPreviewOverlay
              videoUrl={user.active_story_url}
              user={user}
              navBottomOffset={navBottomOffset}
              onDismiss={() => setShowOwnStoryPreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
