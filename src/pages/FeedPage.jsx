import { forwardRef, useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Plus } from 'lucide-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useAuth } from '../lib/authContext';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.045 } } };
const storyItem = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
};
import ProfileCard from '../components/ProfileCard';
import AvatarImg from '../components/AvatarImg';
import { getProfiles, getToken } from '../lib/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPrimaryProfileCrop, getPrimaryProfilePhoto } from '../lib/profileMedia';
import { isSafariDesktopBrowser } from '../lib/browser';
import { fetchLivefeedCurrent, fetchLivefeedPayload, selectLivefeedStories, getCachedLivefeedPayload } from '../lib/livefeed';

const FEED_CACHE_KEY = 'mansion_feed';
const HOME_FEED_FOCUS_EVENT = 'mansion-home-feed-focus';
const MOBILE_MAX_DOM_CARDS = 360;
const VIEWED_STORIES_EVENT = 'mansion-viewed-stories-updated';
const PENDING_VIEWED_STORIES_KEY = 'mansion_pending_viewed_story_users';
const VIEWED_STORIES_APPLY_DELAY_MS = 520;

function getGridColumns() {
  if (typeof window === 'undefined') return 2;
  const w = window.innerWidth;
  if (w >= 1536) return 6;
  if (w >= 1280) return 5;
  if (w >= 1024) return 4;
  if (w >= 768) return 3;
  return 2;
}

function useGridColumns() {
  const [cols, setCols] = useState(getGridColumns);
  useEffect(() => {
    const handler = () => setCols(getGridColumns());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return cols;
}

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

export default function FeedPage() {
  const safariDesktop = isSafariDesktopBrowser();
  const cols = useGridColumns();
  const isDesktopViewport = cols >= 4;
  const cached = getCachedFeed();
  const [profiles, setProfiles] = useState(cached?.profiles || []);
  const [showStoriesSection, setShowStoriesSection] = useState(() => !safariDesktop);
  const [showGridSection, setShowGridSection] = useState(() => !safariDesktop);
  const [canAutoLoadMore, setCanAutoLoadMore] = useState(false);
  const [viewerPremium, setViewerPremium] = useState(cached?.viewerPremium || false);
  const [settings, setSettings] = useState(cached?.settings || {});
  const [nextCursor, setNextCursor] = useState(cached?.nextCursor || null);
  const [hasMore, setHasMore] = useState(
    cached ? (typeof cached?.hasMore === 'boolean' ? cached.hasMore : true) : false
  );
  const [loading, setLoading] = useState(!cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [liveStoryProfiles, setLiveStoryProfiles] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, siteSettings } = useAuth();
  const navBottomOffset = (siteSettings?.navBottomPadding ?? 24) + (siteSettings?.navHeight ?? 71);
  const loadMoreRef = useRef(null);
  const gridRef = useRef(null);
  const loadIdRef = useRef(0);  // monotonic counter to discard stale responses
  const loadMoreFailedRef = useRef(false); // stop retrying on persistent errors
  const loadingMoreRef = useRef(false); // sync guard to prevent duplicate requests
  const storiesScrollRef = useRef(null);
  const storiesMomentumRef = useRef({
    frameId: null,
    velocity: 0,
  });
  const pendingViewedTimerRef = useRef(null);
  const storyNodeRefs = useRef(new Map());
  const storyRectsRef = useRef(new Map());
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
  const livefeedVersionRef = useRef('');
  const livefeedPayloadRef = useRef(null);
  const liveStoryProfilesRef = useRef(null);

  useEffect(() => {
    liveStoryProfilesRef.current = liveStoryProfiles;
  }, [liveStoryProfiles]);

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
    const unlockAutoLoad = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop > 80) setCanAutoLoadMore(true);
    };
    window.addEventListener('scroll', unlockAutoLoad, { passive: true });
    return () => window.removeEventListener('scroll', unlockAutoLoad);
  }, []);

  const loadProfiles = useCallback(({ forceFresh = false } = {}) => {
    const c = getCachedFeed();
    if (!c) setLoading(true);
    if (c) {
      setProfiles(c.profiles || []);
      setViewerPremium(c.viewerPremium || false);
      if (c.settings) setSettings(c.settings);
      setNextCursor(c.nextCursor || null);
      setHasMore(!!c.hasMore);
    }
    const myId = ++loadIdRef.current;
    return getProfiles({ fresh: forceFresh })
      .then(data => {
        if (myId !== loadIdRef.current) return;
        setProfiles(data.profiles || []);
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
        loadMoreFailedRef.current = false;
      })
      .catch(() => {
        if (myId !== loadIdRef.current) return;
        if (!c) { setProfiles([]); setNextCursor(null); setHasMore(false); }
      })
      .finally(() => {
        if (myId === loadIdRef.current) setLoading(false);
      });
  }, []);

  const loadMoreProfiles = useCallback(() => {
    const maxCards = Math.max(12, safariDesktop
      ? (settings?.feedMaxCardsDesktop ?? MOBILE_MAX_DOM_CARDS)
      : (settings?.feedMaxCardsMobile ?? MOBILE_MAX_DOM_CARDS));

    // Hit the API cap — stop
    if (profiles.length >= maxCards) return Promise.resolve();

    // Need more from API
    if (loading || loadingMore || !hasMore || !nextCursor || loadMoreFailedRef.current || loadingMoreRef.current) return Promise.resolve();
    loadingMoreRef.current = true;
    setLoadingMore(true);
    ++loadIdRef.current;
    const cursor = nextCursor;
    return getProfiles({ cursor })
      .then((data) => {
        const newProfiles = Array.isArray(data?.profiles) ? data.profiles : [];
        setProfiles((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const merged = [...prev];
          for (const profile of newProfiles) {
            if (!profile?.id || seen.has(profile.id)) continue;
            seen.add(profile.id);
            merged.push(profile);
          }
          return merged;
        });
        if (data.settings) setSettings(data.settings);
        if (typeof data.viewerPremium === 'boolean') setViewerPremium(data.viewerPremium);
        setNextCursor(data.nextCursor || null);
        setHasMore(!!data.hasMore);
        loadMoreFailedRef.current = false;
      })
      .catch(() => { loadMoreFailedRef.current = true; })
      .finally(() => { loadingMoreRef.current = false; setLoadingMore(false); });
  }, [hasMore, loading, loadingMore, nextCursor, profiles.length, safariDesktop, settings]);

  // Initial load — runs once on mount
  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    const cachedFeed = getCachedFeed();
    if (!cachedFeed) {
      loadProfiles();
      return;
    }

    setProfiles(cachedFeed.profiles || []);
    setViewerPremium(cachedFeed.viewerPremium || false);
    if (cachedFeed.settings) setSettings(cachedFeed.settings);
    setNextCursor(cachedFeed.nextCursor || null);
    setHasMore(typeof cachedFeed.hasMore === 'boolean' ? cachedFeed.hasMore : true);
    setLoading(false);
    try {
      sessionStorage.removeItem('mansion_feed_dirty');
      sessionStorage.removeItem('mansion_feed_force_refresh');
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [gridOpacity, setGridOpacity] = useState(1);

  useEffect(() => {
    let fadeOutTimer = null;
    let fadeInTimer = null;
    const handleHomeFocus = () => {
      if (window.scrollY <= 0) return;
      // Fade out → instant jump → fade in
      setGridOpacity(0);
      fadeOutTimer = setTimeout(() => {
        // Force instant jump — overrides any CSS scroll-behavior:smooth
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
        document.documentElement.style.scrollBehavior = '';
        fadeInTimer = setTimeout(() => setGridOpacity(1), 16);
      }, 300);
    };
    window.addEventListener(HOME_FEED_FOCUS_EVENT, handleHomeFocus);
    return () => {
      window.removeEventListener(HOME_FEED_FOCUS_EVENT, handleHomeFocus);
      clearTimeout(fadeOutTimer);
      clearTimeout(fadeInTimer);
    };
  }, []);

  useEffect(() => () => {
    if (pendingViewedTimerRef.current) {
      window.clearTimeout(pendingViewedTimerRef.current);
      pendingViewedTimerRef.current = null;
    }
  }, []);

  const setStoryNodeRef = useCallback((storyId, node) => {
    const key = String(storyId || '');
    if (!key) return;
    if (node) {
      storyNodeRefs.current.set(key, node);
    } else {
      storyNodeRefs.current.delete(key);
      storyRectsRef.current.delete(key);
    }
  }, []);

  // Keep a ref of visibleCount so the scroll handler can read it without being a dep
  const visibleCountRef = useRef(0);

  // Reload feed ONLY when explicitly marked dirty (preference/settings changes)
  useEffect(() => {
    const onFocus = () => {
      if (!sessionStorage.getItem('mansion_feed_dirty')) return;
      sessionStorage.removeItem('mansion_feed_dirty');
      const shouldForceFresh = sessionStorage.getItem('mansion_feed_force_refresh') === '1';
      sessionStorage.removeItem('mansion_feed_force_refresh');
      sessionStorage.removeItem(FEED_CACHE_KEY);
      loadProfiles({ forceFresh: shouldForceFresh });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadProfiles]);

  const { indicatorRef } = usePullToRefresh(
    useCallback(() => loadProfiles({ forceFresh: true }), [loadProfiles])
  );

  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  const storyLimit = Math.max(
    1,
    Math.round(
      isDesktopViewport
        ? (safeSettings.homeStoryCountDesktop ?? 30)
        : (safeSettings.homeStoryCountMobile ?? 15)
    )
  );
  const fallbackStoryProfiles = safeProfiles.filter(p => p.has_active_story).slice(0, storyLimit);
  const storyProfiles = Array.isArray(liveStoryProfiles) ? liveStoryProfiles : fallbackStoryProfiles;
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
      window.addEventListener(VIEWED_STORIES_EVENT, handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('focus', handler);
        window.removeEventListener('visibilitychange', handler);
        window.removeEventListener(VIEWED_STORIES_EVENT, handler);
      };
    }, []),
    () => localStorage.getItem('viewed_story_users') || '[]',
  );
  const viewedStoryUsers = useMemo(() => {
    try { return new Set(JSON.parse(viewedRaw)); } catch { return new Set(); }
  }, [viewedRaw]);
  const orderedStoryProfiles = useMemo(() => {
    const unseen = [];
    const seen = [];
    for (const profile of storyProfiles) {
      if (!profile?.id) continue;
      if (viewedStoryUsers.has(String(profile.id))) {
        seen.push(profile);
      } else {
        unseen.push(profile);
      }
    }
    return [...unseen, ...seen];
  }, [storyProfiles, viewedStoryUsers]);

  useLayoutEffect(() => {
    const nextRects = new Map();

    for (const profile of orderedStoryProfiles) {
      const key = String(profile?.id || '');
      const node = storyNodeRefs.current.get(key);
      if (!key || !node) continue;

      const rect = node.getBoundingClientRect();
      nextRects.set(key, rect);

      const previousRect = storyRectsRef.current.get(key);
      if (!previousRect) continue;

      const deltaX = previousRect.left - rect.left;
      const deltaY = previousRect.top - rect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;

      node.style.willChange = 'transform, filter, opacity';
      const animation = typeof node.animate === 'function'
        ? node.animate(
            [
              {
                transform: `translate(${deltaX}px, ${deltaY}px) scale(0.96)`,
                filter: 'brightness(0.88)',
                opacity: 0.9,
              },
              {
                transform: 'translate(0px, 0px) scale(1)',
                filter: 'brightness(1)',
                opacity: 1,
              },
            ],
            {
              duration: 720,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }
          )
        : null;

      if (animation) {
        animation.onfinish = () => {
          node.style.willChange = '';
        };
      } else {
        node.style.transition = 'none';
        node.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.96)`;
        node.style.filter = 'brightness(0.88)';
        node.style.opacity = '0.9';
        requestAnimationFrame(() => {
          node.style.transition = 'transform 720ms cubic-bezier(0.22, 1, 0.36, 1), filter 720ms cubic-bezier(0.22, 1, 0.36, 1), opacity 720ms cubic-bezier(0.22, 1, 0.36, 1)';
          node.style.transform = 'translate(0px, 0px) scale(1)';
          node.style.filter = 'brightness(1)';
          node.style.opacity = '1';
          const cleanup = () => {
            node.style.transition = '';
            node.style.transform = '';
            node.style.filter = '';
            node.style.opacity = '';
            node.style.willChange = '';
            node.removeEventListener('transitionend', cleanup);
          };
          node.addEventListener('transitionend', cleanup);
        });
      }
    }

    storyRectsRef.current = nextRects;
  }, [orderedStoryProfiles]);
  const applyPendingViewedStories = useCallback(() => {
    try {
      const rawPending = sessionStorage.getItem(PENDING_VIEWED_STORIES_KEY);
      if (!rawPending) return false;
      const pending = JSON.parse(rawPending);
      const nextPending = Array.isArray(pending) ? pending.map((value) => String(value || '')).filter(Boolean) : [];
      if (nextPending.length === 0) {
        sessionStorage.removeItem(PENDING_VIEWED_STORIES_KEY);
        return false;
      }

      const current = JSON.parse(localStorage.getItem('viewed_story_users') || '[]');
      const seen = new Set(Array.isArray(current) ? current.map((value) => String(value || '')).filter(Boolean) : []);
      let changed = false;
      for (const userId of nextPending) {
        if (seen.has(userId)) continue;
        seen.add(userId);
        changed = true;
      }
      sessionStorage.removeItem(PENDING_VIEWED_STORIES_KEY);
      if (!changed) return false;

      const merged = [...seen];
      if (merged.length > 300) merged.splice(0, merged.length - 300);
      localStorage.setItem('viewed_story_users', JSON.stringify(merged));
      window.dispatchEvent(new Event(VIEWED_STORIES_EVENT));
      return true;
    } catch {
      return false;
    }
  }, []);

  const schedulePendingViewedStories = useCallback(() => {
    try {
      if (document.hidden) return;
      if (!sessionStorage.getItem(PENDING_VIEWED_STORIES_KEY)) return;
    } catch {
      return;
    }
    if (pendingViewedTimerRef.current) {
      window.clearTimeout(pendingViewedTimerRef.current);
    }
    pendingViewedTimerRef.current = window.setTimeout(() => {
      applyPendingViewedStories();
      pendingViewedTimerRef.current = null;
    }, VIEWED_STORIES_APPLY_DELAY_MS);
  }, [applyPendingViewedStories]);

  useEffect(() => {
    schedulePendingViewedStories();
    const handleResume = () => schedulePendingViewedStories();
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [schedulePendingViewedStories]);

  const openStoryFromHome = useCallback((storyUserId) => {
    const backgroundScrollY = Number(window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0) || 0;
    navigate('/videos', {
      state: {
        storyUserId,
        modal: 'videos',
        backgroundLocation: location,
        backgroundScrollY,
      },
    });
  }, [location, navigate]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;

    const applyPayload = (payload) => {
      livefeedPayloadRef.current = payload;
      const next = selectLivefeedStories(
        payload,
        user?.seeking || [],
        storyLimit,
        { excludeUserId: user.id }
      );
      if (!cancelled) {
        setLiveStoryProfiles(next.length > 0 ? next : null);
      }
    };

    if (livefeedPayloadRef.current) {
      applyPayload(livefeedPayloadRef.current);
    } else {
      const cachedPayload = getCachedLivefeedPayload();
      if (cachedPayload) {
        livefeedPayloadRef.current = cachedPayload;
        applyPayload(cachedPayload);
      }
    }

    const refreshLivefeed = async () => {
      try {
        const current = await fetchLivefeedCurrent();
        if (!current?.version) return;
        if (livefeedVersionRef.current === current.version && livefeedPayloadRef.current) {
          applyPayload(livefeedPayloadRef.current);
          return;
        }
        const payload = await fetchLivefeedPayload(current);
        livefeedVersionRef.current = current.version;
        applyPayload(payload);
      } catch {
        // Keep fallback story circles from feed if livefeed is unavailable.
      }
    };

    refreshLivefeed();
    const intervalId = window.setInterval(refreshLivefeed, 30_000);

    const handleForegroundRefresh = () => {
      if (document.visibilityState === 'hidden') return;
      refreshLivefeed();
    };

    window.addEventListener('focus', handleForegroundRefresh);
    document.addEventListener('visibilitychange', handleForegroundRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleForegroundRefresh);
      document.removeEventListener('visibilitychange', handleForegroundRefresh);
    };
  }, [storyLimit, user?.id, user?.seeking]);

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
    if (rect.top - window.innerHeight <= 1500) {
      loadMoreProfiles();
    }
  }, [canAutoLoadMore, hasMore, loadMoreProfiles, loading, loadingMore]);

  useEffect(() => {
    if (!loadMoreRef.current || loading || loadingMore || !hasMore || !canAutoLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) loadMoreProfiles(); },
      { rootMargin: '1500px 0px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [canAutoLoadMore, hasMore, loading, loadingMore, loadMoreProfiles]);

  useEffect(() => { maybeLoadMore(); }, [maybeLoadMore, profiles.length, showGridSection]);

  useEffect(() => {
    let ticking = false;
    const scheduleCheck = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; maybeLoadMore(); });
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

  // ── Virtual scroll setup ────────────────────────────────────────────────
  const gap = safariDesktop ? 16 : 12; // matches lg:gap-4 / gap-3
  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < safeProfiles.length; i += cols) {
      result.push(safeProfiles.slice(i, i + cols));
    }
    return result;
  }, [safeProfiles, cols]);

  const estimateRowHeight = useCallback(() => {
    if (!gridRef.current) return 300;
    const containerWidth = gridRef.current.offsetWidth;
    const cardWidth = (containerWidth - gap * (cols - 1)) / cols;
    return Math.round(cardWidth * (4 / 3)) + gap;
  }, [cols, gap]);

  const [gridScrollMargin, setGridScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (!gridRef.current) return;
    const next = gridRef.current.offsetTop;
    setGridScrollMargin(prev => prev !== next ? next : prev);
  });

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: estimateRowHeight,
    overscan: 3,
    scrollMargin: gridScrollMargin,
  });

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
                      ? () => openStoryFromHome(user.id)
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
              <motion.div layout variants={storyItem} className="flex-shrink-0" style={{ width: storyCircleSize + 6 }}>
                <div className="relative">
                  <button
                    type="button"
                    draggable={false}
                    onClick={user.has_active_story && user.active_story_url
                      ? () => openStoryFromHome(user.id)
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
          {orderedStoryProfiles.map((p) => {
            const photo = getPrimaryProfilePhoto(p);
            const photoCrop = getPrimaryProfileCrop(p);
            const isViewed = viewedStoryUsers.has(p.id);
            const size = storyCircleSize;
            const border = storyCircleBorder;
            const innerGap = storyCircleInnerGap;
            return safariDesktop ? (
              <div
                key={`story-${p.id}`}
                ref={(node) => setStoryNodeRef(p.id, node)}
                className="flex-shrink-0"
                style={{ width: size + 6 }}
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => openStoryFromHome(p.id)}
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
              <div
                key={`story-${p.id}`}
                ref={(node) => setStoryNodeRef(p.id, node)}
                className="flex-shrink-0"
                style={{ width: size + 6 }}
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => openStoryFromHome(p.id)}
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
              <div
                ref={gridRef}
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', opacity: gridOpacity, transition: gridOpacity === 0 ? 'opacity 0.3s ease' : 'opacity 0.25s ease' }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                  <div
                    key={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gap: `${gap}px`,
                      paddingBottom: `${gap}px`,
                    }}
                  >
                    {rows[virtualRow.index].map((profile, idx) => {
                      const globalIndex = virtualRow.index * cols + idx;
                      return (
                        <ProfileCard
                          key={profile.id}
                          profile={profile}
                          index={globalIndex}
                          rank={globalIndex + 1}
                          viewerPremium={viewerPremium}
                          settings={safeSettings}
                          safariDesktopOverride={safariDesktop}
                          isMobileOverride={false}
                        />
                      );
                    })}
                  </div>
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
            motionProps={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
            className="text-center py-20"
          >
            <p className="text-text-muted text-lg mb-2">No hay perfiles</p>
            <p className="text-text-dim text-sm">Prueba con otro filtro</p>
          </AnimatedBlock>
        )}
      </AnimatedBlock>

    </div>
  );
}
