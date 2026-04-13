import { forwardRef, useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Radio } from 'lucide-react';
import { useAuth } from '../lib/authContext';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } };
import ProfileCard from '../components/ProfileCard';
import AvatarImg from '../components/AvatarImg';
import { getProfiles, getToken } from '../lib/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPrimaryProfileCrop, getPrimaryProfilePhoto } from '../lib/profileMedia';
import { isSafariDesktopBrowser } from '../lib/browser';

const FEED_CACHE_KEY = 'mansion_feed';
const HOME_FEED_FOCUS_EVENT = 'mansion-home-feed-focus';
const DEFAULT_CARDS_PER_PAGE = 12;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_PREFETCH_PAGES = 6;
const VIEWED_STORIES_EVENT = 'mansion-viewed-stories-updated';
const PENDING_VIEWED_STORIES_KEY = 'mansion_pending_viewed_story_users';
const VIEWED_STORIES_APPLY_DELAY_MS = 520;

function getInitialStoryLimit(settings, isDesktopViewport) {
  return Math.max(
    1,
    Math.round(
      isDesktopViewport
        ? (settings?.homeStoryCountDesktop ?? 30)
        : (settings?.homeStoryCountMobile ?? 15)
    )
  );
}

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
      totalProfiles: Number(data.totalProfiles) || 0,
      currentCursor: Number(data.currentCursor) || 0,
      blockCursor: Number(data.blockCursor ?? data.currentCursor) || 0,
      pageCursor: Number(data.pageCursor ?? data.currentCursor) || 0,
      pageSize: Number(data.pageSize) || 0,
      nextCursor: data.nextCursor || null,
      hasMore: !!data.hasMore,
      timestamp: Date.now(),
    }));
  } catch {}
}

export default function FeedPage({ initialData }) {
  const safariDesktop = isSafariDesktopBrowser();
  const cols = useGridColumns();
  const isDesktopViewport = cols >= 4;
  const desktopStoryRailEnhanced = isDesktopViewport;
  const cached = initialData || getCachedFeed();
  const { user, siteSettings } = useAuth();
  const [profiles, setProfiles] = useState(cached?.profiles || []);
  const [showStoriesSection, setShowStoriesSection] = useState(true);
  const [showGridSection, setShowGridSection] = useState(true);
  const [viewerPremium, setViewerPremium] = useState(cached?.viewerPremium || false);
  const [settings, setSettings] = useState(cached?.settings || {});
  const [nextCursor, setNextCursor] = useState(cached?.nextCursor || null);
  const [blockCursor, setBlockCursor] = useState(Number(cached?.blockCursor ?? cached?.currentCursor) || 0);
  const [pageCursor, setPageCursor] = useState(Number(cached?.pageCursor ?? cached?.currentCursor) || 0);
  const [totalProfiles, setTotalProfiles] = useState(Number(cached?.totalProfiles) || (Array.isArray(cached?.profiles) ? cached.profiles.length : 0));
  const [hasMore, setHasMore] = useState(
    cached ? (typeof cached?.hasMore === 'boolean' ? cached.hasMore : true) : false
  );
  const [loading, setLoading] = useState(!cached);
  const [storiesIntroEnabled, setStoriesIntroEnabled] = useState(true);
  const storiesIntroConsumedRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navBottomOffset = (siteSettings?.navBottomPadding ?? 24) + (siteSettings?.navHeight ?? 71);
  const gridRef = useRef(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const mobileNavVisibilityTimerRef = useRef(null);
  const loadIdRef = useRef(0);  // monotonic counter to discard stale responses
  const storiesScrollRef = useRef(null);
  const storiesMomentumRef = useRef({
    frameId: null,
    velocity: 0,
  });
  const storiesBounceFrameRef = useRef(null);
  const storiesEdgeOffsetRef = useRef(0);
  const pendingViewedTimerRef = useRef(null);
  const storyNodeRefs = useRef(new Map());
  const storyRectsRef = useRef(new Map());
  const previousOrderedStoryIdsRef = useRef('');
  const initialStoriesAlignedRef = useRef(false);
  const [storiesEdgeOffset, setStoriesEdgeOffset] = useState(0);
  const storiesDragRef = useRef({
    active: false,
    captured: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    lastX: 0,
    lastTs: 0,
    velocity: 0,
  });
  const isSafariDesktopRef = useRef(false);
  const pagedFeedConfigRef = useRef('');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    const vendor = window.navigator.vendor || '';
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|OPR/i.test(ua) && /Apple/i.test(vendor);
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    isSafariDesktopRef.current = isSafari && isDesktop;
  }, []);



  const loadProfiles = useCallback(({ forceFresh = false, cursor = 0, pageSize, targetPageCursor } = {}) => {
    const s = settingsRef.current;
    const resolvedPageSize = Math.max(
      12,
      Number(pageSize) || (s?.feedCardsPerPage ?? DEFAULT_CARDS_PER_PAGE) * (s?.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES)
    );
    const c = getCachedFeed();
    if (!c) setLoading(true);
    const myId = ++loadIdRef.current;
    return getProfiles({ fresh: forceFresh, cursor, pageSize: resolvedPageSize })
      .then(data => {
        if (myId !== loadIdRef.current) return;
        setProfiles(data.profiles || []);
        setViewerPremium(data.viewerPremium || false);
        if (data.settings) setSettings(data.settings);
        setNextCursor(data.nextCursor || null);
        setBlockCursor(Number(data.cursor) || cursor || 0);
        setPageCursor(Number(targetPageCursor ?? data.cursor ?? cursor) || 0);
        setTotalProfiles(Number(data.totalProfiles) || 0);
        setHasMore(!!data.hasMore);
        setCachedFeed({
          profiles: data.profiles || [],
          viewerPremium: data.viewerPremium || false,
          settings: data.settings || {},
          totalProfiles: Number(data.totalProfiles) || 0,
          currentCursor: Number(data.cursor) || cursor || 0,
          blockCursor: Number(data.cursor) || cursor || 0,
          pageCursor: Number(targetPageCursor ?? data.cursor ?? cursor) || 0,
          pageSize: resolvedPageSize,
          nextCursor: data.nextCursor || null,
          hasMore: !!data.hasMore,
        });
        return data;
      })
      .catch(() => {
        if (myId !== loadIdRef.current) return;
        if (!c) {
          setProfiles([]);
          setNextCursor(null);
          setBlockCursor(0);
          setPageCursor(0);
          setTotalProfiles(0);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (myId === loadIdRef.current) setLoading(false);
      });
  }, []); // stable — reads settings from settingsRef

  // Initial load — runs once on mount
  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    const cachedFeed = getCachedFeed();
    const currentSettings = settingsRef.current;
    const cachedPageSize = Number(cachedFeed?.pageSize) || 0;
    const expectedPageSize = Math.max(
      12,
      (currentSettings?.feedCardsPerPage ?? DEFAULT_CARDS_PER_PAGE) * (currentSettings?.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES)
    );
    const canReuseCached = !!cachedFeed && cachedPageSize === expectedPageSize;

    if (!cachedFeed || !canReuseCached) {
      loadProfiles({ cursor: 0, pageSize: expectedPageSize });
      return;
    }

    // State was already initialized from cache in useState — just clean up flags
    setLoading(false);
    try {
      sessionStorage.removeItem('mansion_feed_dirty');
      sessionStorage.removeItem('mansion_feed_force_refresh');
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

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
    if (mobileNavVisibilityTimerRef.current) {
      window.clearTimeout(mobileNavVisibilityTimerRef.current);
      mobileNavVisibilityTimerRef.current = null;
    }
  }, []);

  // Show mobile pagination arrows when user scrolls near the bottom of the grid
  useEffect(() => {
    if (isDesktopViewport) return;
    const handleScroll = () => {
      const el = gridRef.current;
      if (!el) { setShowMobileNav(false); return; }
      const rect = el.getBoundingClientRect();
      // Add hysteresis + delayed commit so the overlay does not chatter
      // when the bottom edge hovers around the viewport threshold on iOS.
      setShowMobileNav((prev) => {
        const threshold = prev ? 220 : 110;
        const next = rect.bottom <= window.innerHeight + threshold;
        if (next === prev) return prev;
        if (mobileNavVisibilityTimerRef.current) {
          window.clearTimeout(mobileNavVisibilityTimerRef.current);
          mobileNavVisibilityTimerRef.current = null;
        }
        mobileNavVisibilityTimerRef.current = window.setTimeout(() => {
          setShowMobileNav(next);
          mobileNavVisibilityTimerRef.current = null;
        }, next ? 90 : 160);
        return prev;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mobileNavVisibilityTimerRef.current) {
        window.clearTimeout(mobileNavVisibilityTimerRef.current);
        mobileNavVisibilityTimerRef.current = null;
      }
    };
  }, [isDesktopViewport, pageCursor]);

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
      const s = settingsRef.current;
      const nextBlockSize = (s?.feedCardsPerPage ?? DEFAULT_CARDS_PER_PAGE) * (s?.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES);
      loadProfiles({
        forceFresh: shouldForceFresh,
        cursor: Math.floor(pageCursor / nextBlockSize) * nextBlockSize,
        pageSize: nextBlockSize,
        targetPageCursor: pageCursor,
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadProfiles, pageCursor]);

  const { indicatorRef } = usePullToRefresh(
    useCallback(() => loadProfiles({ forceFresh: true }), [loadProfiles])
  );

  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  const cardsPerPage = Math.max(6, Math.min(60, safeSettings.feedCardsPerPage ?? DEFAULT_CARDS_PER_PAGE));
  const maxPages = Math.max(1, Math.min(50, safeSettings.feedMaxPages ?? DEFAULT_MAX_PAGES));
  const prefetchPages = Math.max(1, Math.min(20, safeSettings.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES));
  const blockSize = cardsPerPage * prefetchPages;
  const visibleProfiles = useMemo(() => {
    const start = Math.max(0, pageCursor - blockCursor);
    return safeProfiles.slice(start, start + cardsPerPage);
  }, [blockCursor, cardsPerPage, pageCursor, safeProfiles]);
  const currentPage = Math.floor(pageCursor / cardsPerPage) + 1;
  const totalPages = Math.min(maxPages, Math.max(1, Math.ceil((totalProfiles || 0) / cardsPerPage)));
  const pageWindow = useMemo(() => {
    if (totalPages <= 1) return [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    return Array.from({ length: end - adjustedStart + 1 }, (_, idx) => adjustedStart + idx);
  }, [currentPage, totalPages]);
  const storyLimit = getInitialStoryLimit(safeSettings, isDesktopViewport);
  const fallbackStoryProfiles = safeProfiles.filter(p => p.has_active_story).slice(0, storyLimit);
  const storyProfiles = fallbackStoryProfiles;
  const storyCircleSize = safeSettings.storyCircleSize || 88;
  const storyCircleGap = Math.max(0, Math.round((storyCircleSize * (safeSettings.storyCircleGap ?? 8)) / 100));
  const storyCircleBorder = Math.max(1, Math.round((storyCircleSize * (safeSettings.storyCircleBorder ?? 4)) / 100));
  const storyCircleInnerGap = Math.max(0, Math.round((storyCircleSize * (safeSettings.storyCircleInnerGap ?? 3)) / 100));

  const goToFeedPage = useCallback(async (page) => {
    const safePage = Math.max(1, Math.min(totalPages, Number(page) || 1));
    const nextPageCursor = (safePage - 1) * cardsPerPage;
    if (nextPageCursor === pageCursor && profiles.length > 0) return;
    const nextBlockCursor = Math.floor(nextPageCursor / blockSize) * blockSize;
    const blockEndCursor = blockCursor + profiles.length;
    if (nextPageCursor >= blockCursor && nextPageCursor < blockEndCursor) {
      setPageCursor(nextPageCursor);
      setCachedFeed({
        profiles,
        viewerPremium,
        settings: safeSettings,
        totalProfiles,
        currentCursor: nextBlockCursor,
        blockCursor: nextBlockCursor,
        pageCursor: nextPageCursor,
        pageSize: blockSize,
        nextCursor,
        hasMore,
      });
    } else {
      await loadProfiles({
        cursor: nextBlockCursor,
        pageSize: blockSize,
        targetPageCursor: nextPageCursor,
      });
    }
    const targetTop = Math.max(0, (gridRef.current?.offsetTop || 0) - 24);
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [blockCursor, blockSize, cardsPerPage, hasMore, loadProfiles, nextCursor, pageCursor, profiles, safeSettings, totalPages, totalProfiles, viewerPremium]);

  useEffect(() => {
    if (loading) return;
    const nextConfig = `paged:${cardsPerPage}`;
    if (pagedFeedConfigRef.current === nextConfig) return;
    pagedFeedConfigRef.current = nextConfig;
    loadProfiles({ cursor: 0, pageSize: blockSize, targetPageCursor: 0 });
  }, [blockSize, cardsPerPage, loadProfiles, loading]);

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

  useEffect(() => {
    if (storiesIntroConsumedRef.current) return;
    if (orderedStoryProfiles.length === 0 && !user) return;
    storiesIntroConsumedRef.current = true;
    const timerId = window.setTimeout(() => {
      setStoriesIntroEnabled(false);
    }, 1400);
    return () => window.clearTimeout(timerId);
  }, [orderedStoryProfiles.length, user]);

  useLayoutEffect(() => {
    if (!showStoriesSection || orderedStoryProfiles.length === 0) {
      initialStoriesAlignedRef.current = false;
      return;
    }
    const container = storiesScrollRef.current;
    if (!container || initialStoriesAlignedRef.current) return;
    initialStoriesAlignedRef.current = true;
    container.scrollLeft = 0;
    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      container.scrollLeft = 0;
      rafB = requestAnimationFrame(() => {
        if (storiesScrollRef.current) storiesScrollRef.current.scrollLeft = 0;
      });
    });
    return () => {
      if (rafA) cancelAnimationFrame(rafA);
      if (rafB) cancelAnimationFrame(rafB);
    };
  }, [orderedStoryProfiles.length, showStoriesSection]);

  useLayoutEffect(() => {
    const orderedIds = orderedStoryProfiles.map((profile) => String(profile?.id || '')).filter(Boolean).join(',');
    const previousOrderedIds = previousOrderedStoryIdsRef.current;
    previousOrderedStoryIdsRef.current = orderedIds;
    if (!orderedIds || !storiesScrollRef.current || orderedIds === previousOrderedIds) return;

    const container = storiesScrollRef.current;
    if (!previousOrderedIds) {
      container.scrollLeft = 0;
      return;
    }
    const firstUnseen = orderedStoryProfiles.find((profile) => !viewedStoryUsers.has(String(profile?.id || ''))) || orderedStoryProfiles[0];
    const targetNode = storyNodeRefs.current.get(String(firstUnseen?.id || ''));
    if (!targetNode) return;

    const targetLeft = Math.max(0, targetNode.offsetLeft - 8);
    if (Math.abs(container.scrollLeft - targetLeft) < 12) return;

    container.scrollTo({
      left: targetLeft,
      behavior: previousOrderedIds ? 'smooth' : 'auto',
    });
  }, [orderedStoryProfiles, viewedStoryUsers]);

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

  const openStoryFromHome = useCallback((storyOrUserId) => {
    const storyUserId = typeof storyOrUserId === 'object' && storyOrUserId !== null
      ? String(storyOrUserId.user_id || storyOrUserId.id || '')
      : String(storyOrUserId || '');
    const storySeed = typeof storyOrUserId === 'object' && storyOrUserId !== null
      ? {
          id: String(storyOrUserId.story_id || storyOrUserId.id || storyUserId),
          story_id: String(storyOrUserId.story_id || storyOrUserId.id || storyUserId),
          user_id: storyUserId,
          video_url: storyOrUserId.video_url || storyOrUserId.active_story_url || '',
          caption: storyOrUserId.caption || '',
          likes: Number(storyOrUserId.likes || 0),
          comments: Number(storyOrUserId.comments || 0),
          created_at: storyOrUserId.created_at || '',
          username: storyOrUserId.username || storyOrUserId.name || '',
          avatar_url: storyOrUserId.avatar_url || '',
          avatar_crop: storyOrUserId.avatar_crop || null,
          liked: false,
        }
      : null;
    const backgroundScrollY = Number(window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0) || 0;
    navigate('/videos', {
      state: {
        storyUserId,
        storySeed,
        modal: 'videos',
        backgroundLocation: location,
        backgroundScrollY,
      },
    });
  }, [location, navigate]);

  const handleStoriesWheel = useCallback((event) => {
    if (!desktopStoryRailEnhanced) return;
    const el = storiesScrollRef.current;
    if (!el) return;
    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    if (absY <= absX) return;
    if (el.scrollWidth <= el.clientWidth) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
  }, [desktopStoryRailEnhanced]);

  const handleStoriesNativeDragStart = useCallback((event) => {
    event.preventDefault();
  }, []);

  const stopStoriesBounce = useCallback(() => {
    if (storiesBounceFrameRef.current) {
      cancelAnimationFrame(storiesBounceFrameRef.current);
      storiesBounceFrameRef.current = null;
    }
  }, []);

  const setStoriesEdgeOffsetImmediate = useCallback((nextValue) => {
    const clamped = Math.max(-42, Math.min(42, nextValue));
    storiesEdgeOffsetRef.current = clamped;
    setStoriesEdgeOffset(clamped);
  }, []);

  const animateStoriesEdgeOffsetTo = useCallback((target = 0) => {
    stopStoriesBounce();
    const step = () => {
      const current = storiesEdgeOffsetRef.current;
      const next = current + (target - current) * 0.095;
      if (Math.abs(next - target) < 0.18) {
        storiesEdgeOffsetRef.current = target;
        setStoriesEdgeOffset(target);
        storiesBounceFrameRef.current = null;
        return;
      }
      storiesEdgeOffsetRef.current = next;
      setStoriesEdgeOffset(next);
      storiesBounceFrameRef.current = requestAnimationFrame(step);
    };
    storiesBounceFrameRef.current = requestAnimationFrame(step);
  }, [stopStoriesBounce]);

  const nudgeStoriesEdge = useCallback((direction, magnitude = 34) => {
    setStoriesEdgeOffsetImmediate(direction * magnitude);
    animateStoriesEdgeOffsetTo(0);
  }, [animateStoriesEdgeOffsetTo, setStoriesEdgeOffsetImmediate]);

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

      currentEl.scrollLeft += momentum.velocity * 22;

      const maxScrollLeft = Math.max(0, currentEl.scrollWidth - currentEl.clientWidth);
      if (currentEl.scrollLeft <= 0 || currentEl.scrollLeft >= maxScrollLeft) {
        currentEl.scrollLeft = Math.min(maxScrollLeft, Math.max(0, currentEl.scrollLeft));
        if (momentum.velocity !== 0) {
          nudgeStoriesEdge(currentEl.scrollLeft <= 0 ? 1 : -1, Math.min(62, Math.max(20, Math.abs(momentum.velocity) * 34)));
        }
        momentum.frameId = null;
        momentum.velocity = 0;
        return;
      }

      momentum.velocity *= 0.955;
      if (Math.abs(momentum.velocity) < 0.01) {
        momentum.frameId = null;
        momentum.velocity = 0;
        return;
      }

      momentum.frameId = requestAnimationFrame(step);
    };

    if (momentum.frameId) cancelAnimationFrame(momentum.frameId);
    momentum.frameId = requestAnimationFrame(step);
  }, [nudgeStoriesEdge]);

  const handleStoriesPointerDown = useCallback((event) => {
    if (!desktopStoryRailEnhanced) return;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const el = storiesScrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    stopStoriesMomentum();
    stopStoriesBounce();
    if (storiesEdgeOffsetRef.current !== 0) {
      setStoriesEdgeOffsetImmediate(0);
    }
    storiesDragRef.current = {
      active: true,
      captured: false,
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
      lastX: event.clientX,
      lastTs: event.timeStamp || performance.now(),
      velocity: 0,
    };
  }, [desktopStoryRailEnhanced, setStoriesEdgeOffsetImmediate, stopStoriesBounce, stopStoriesMomentum]);

  const handleStoriesPointerMove = useCallback((event) => {
    if (!desktopStoryRailEnhanced) return;
    const el = storiesScrollRef.current;
    const drag = storiesDragRef.current;
    if (!el || !drag.active) return;
    const deltaX = event.clientX - drag.startX;
    const now = event.timeStamp || performance.now();
    const deltaTs = Math.max(1, now - drag.lastTs);
    const deltaSinceLast = event.clientX - drag.lastX;
    if (Math.abs(deltaX) > 4) {
      if (!drag.moved) {
        drag.moved = true;
        drag.captured = true;
        try { el.setPointerCapture?.(event.pointerId); } catch {}
      }
    }
    if (!drag.moved) return;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const desiredScrollLeft = drag.startScrollLeft - deltaX;
    const clampedScrollLeft = Math.min(maxScrollLeft, Math.max(0, desiredScrollLeft));
    el.scrollLeft = clampedScrollLeft;
    if (desiredScrollLeft !== clampedScrollLeft) {
      const overflow = desiredScrollLeft - clampedScrollLeft;
      const elasticOffset = -Math.sign(overflow) * Math.min(42, Math.pow(Math.abs(overflow), 0.82) * 0.52);
      setStoriesEdgeOffsetImmediate(elasticOffset);
    } else if (storiesEdgeOffsetRef.current !== 0) {
      setStoriesEdgeOffsetImmediate(storiesEdgeOffsetRef.current * 0.82);
    }
    drag.velocity = (-deltaSinceLast) / deltaTs;
    drag.lastX = event.clientX;
    drag.lastTs = now;
  }, [desktopStoryRailEnhanced, setStoriesEdgeOffsetImmediate]);

  const finishStoriesDrag = useCallback((event) => {
    if (!desktopStoryRailEnhanced) return;
    const el = storiesScrollRef.current;
    const drag = storiesDragRef.current;
    if (!drag.active) return;
    drag.active = false;
    if (el && drag.captured && event?.pointerId !== undefined) {
      try { el.releasePointerCapture?.(event.pointerId); } catch {}
    }
    storiesMomentumRef.current.velocity = drag.moved ? drag.velocity : 0;
    if (drag.moved) {
      startStoriesMomentum();
    } else {
      storiesMomentumRef.current.velocity = 0;
    }
    if (storiesEdgeOffsetRef.current !== 0) {
      animateStoriesEdgeOffsetTo(0);
    }
    drag.captured = false;
  }, [animateStoriesEdgeOffsetTo, desktopStoryRailEnhanced, startStoriesMomentum]);

  const handleStoriesClickCapture = useCallback((event) => {
    if (!desktopStoryRailEnhanced) return;
    if (!storiesDragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    storiesDragRef.current.moved = false;
  }, [desktopStoryRailEnhanced]);

  useEffect(() => {
    if (desktopStoryRailEnhanced) return;
    stopStoriesMomentum();
    stopStoriesBounce();
    storiesEdgeOffsetRef.current = 0;
    setStoriesEdgeOffset(0);
    storiesDragRef.current.active = false;
    storiesDragRef.current.captured = false;
    storiesDragRef.current.moved = false;
  }, [desktopStoryRailEnhanced, stopStoriesBounce, stopStoriesMomentum]);

  useEffect(() => () => {
    stopStoriesMomentum();
    stopStoriesBounce();
  }, [stopStoriesBounce, stopStoriesMomentum]);

  // ── Grid setup ────────────────────────────────────────────────────
  const gap = 12;

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
      <div
        className="px-4 lg:px-8 pt-2 lg:pt-4 pb-0 fade-in-up"
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Radio className="w-4 h-4 text-mansion-crimson" />
          <p className="text-text-muted text-sm lg:text-base font-medium">Video Flashes</p>
        </div>
        <AnimatedBlock
          ref={storiesScrollRef}
          className={`flex overflow-x-auto scrollbar-hide pb-2 select-none ${desktopStoryRailEnhanced ? 'lg:cursor-grab active:lg:cursor-grabbing' : ''}`}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            gap: `${storyCircleGap}px`,
            touchAction: 'pan-x',
            transform: desktopStoryRailEnhanced ? `translate3d(${storiesEdgeOffset}px, 0, 0)` : 'translate3d(0px, 0, 0)',
            transition: desktopStoryRailEnhanced && storiesDragRef.current.active ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
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
              <div
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={{ width: storyCircleSize + 6, animationDelay: storiesIntroEnabled ? '30ms' : undefined }}
              >
                <div className="relative">
                  <button
                    type="button"
                    draggable={false}
                    onClick={user.has_active_story && user.active_story_url
                      ? () => openStoryFromHome({
                          user_id: user.id,
                          story_id: user.id,
                          video_url: user.active_story_url || '',
                          username: user.username || '',
                          avatar_url: user.avatar_url || '',
                          avatar_crop: user.avatar_crop || null,
                        })
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
            ) : desktopStoryRailEnhanced ? (
              <div
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={{ width: storyCircleSize + 6, animationDelay: storiesIntroEnabled ? '30ms' : undefined }}
              >
                <div className="relative">
                  <button
                    type="button"
                    draggable={false}
                    onClick={user.has_active_story && user.active_story_url
                      ? () => openStoryFromHome({
                          user_id: user.id,
                          story_id: user.id,
                          video_url: user.active_story_url || '',
                          username: user.username || '',
                          avatar_url: user.avatar_url || '',
                          avatar_crop: user.avatar_crop || null,
                        })
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
              <div
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={{ width: storyCircleSize + 6, animationDelay: storiesIntroEnabled ? '30ms' : undefined }}
              >
                <div className="relative">
                  <button
                    type="button"
                    draggable={false}
                    onClick={user.has_active_story && user.active_story_url
                      ? () => openStoryFromHome({
                          user_id: user.id,
                          story_id: user.id,
                          video_url: user.active_story_url || '',
                          username: user.username || '',
                          avatar_url: user.avatar_url || '',
                          avatar_crop: user.avatar_crop || null,
                        })
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
            )
          )}
          {orderedStoryProfiles.map((p, index) => {
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
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={{ width: size + 6, animationDelay: storiesIntroEnabled ? `${60 + Math.min(index, 10) * 35}ms` : undefined }}
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => openStoryFromHome(p)}
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
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={{ width: size + 6, animationDelay: storiesIntroEnabled ? `${60 + Math.min(index, 10) * 35}ms` : undefined }}
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => openStoryFromHome(p)}
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
      </div>
      )}

      {/* Results count */}
      <div
        className="px-4 lg:px-8 pb-2 fade-in-up fade-delay-300"
      >
        <p className="text-text-dim text-xs">
          {visibleProfiles.length} {visibleProfiles.length === 1 ? 'usuario' : 'usuarios'} conectados
        </p>
      </div>

      {/* Grid */}
      <div
        className="px-4 lg:px-8"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
          </div>
        ) : visibleProfiles.length > 0 ? (
          <>
            {showGridSection ? (
                  <div
                    key={`feed-page-${pageCursor}`}
                    ref={gridRef}
                    className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                    style={{
                      gap: `${gap}px`,
                      opacity: gridOpacity,
                      transition: gridOpacity === 0 ? 'opacity 0.3s ease' : 'opacity 0.25s ease',
                    }}
                  >
                    {visibleProfiles.map((profile, index) => (
                      <div
                        key={`${pageCursor}-${profile.id}`}
                        className="feed-card-enter"
                        style={{ animationDelay: isDesktopViewport ? `${0.03 + index * 0.04}s` : `${0.1 + index * 0.075}s` }}
                      >
                        <ProfileCard
                          profile={profile}
                          index={index}
                          rank={pageCursor + index + 1}
                          viewerPremium={viewerPremium}
                          settings={safeSettings}
                        />
                      </div>
                    ))}
                  </div>
            ) : (
              <div className="h-24" aria-hidden="true" />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <>
                {/* Mobile overlay arrows — appear on scroll to bottom */}
                <div
                  className="lg:hidden fixed left-0 right-0 top-1/2 z-40 -translate-y-1/2 px-4 pointer-events-none"
                  aria-hidden={!showMobileNav}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: showMobileNav ? 1 : 0,
                      y: showMobileNav ? 0 : 26,
                      scale: showMobileNav ? 1 : 0.96,
                    }}
                    transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center gap-3"
                    style={{ pointerEvents: showMobileNav ? 'auto' : 'none' }}
                  >
                    <div className="flex w-full items-center justify-between">
                      {currentPage > 1 ? (
                        <button
                          type="button"
                          onClick={() => goToFeedPage(currentPage - 1)}
                          aria-label="Pagina anterior"
                          className="pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full bg-black/72 border border-white/15 shadow-lg active:scale-95 transition-transform"
                        >
                          <ChevronLeft className="w-7 h-7 text-white/80" />
                        </button>
                      ) : <div className="w-14" />}
                      {currentPage < totalPages ? (
                        <button
                          type="button"
                          onClick={() => goToFeedPage(currentPage + 1)}
                          aria-label="Pagina siguiente"
                          className="pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full bg-black/72 border border-white/15 shadow-lg active:scale-95 transition-transform"
                        >
                          <ChevronRight className="w-7 h-7 text-white/80" />
                        </button>
                      ) : <div className="w-14" />}
                    </div>
                    <div className="rounded-full bg-black/72 border border-white/15 px-4 py-2 shadow-lg">
                      <span className="text-xs font-medium text-white/70">{currentPage} / {totalPages}</span>
                    </div>
                  </motion.div>
                </div>

                {/* Desktop pagination bar */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                  className="hidden lg:block py-6"
                >
                  <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-mansion-card/80 px-3 py-3 shadow-[0_16px_36px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                    <span className="mr-1 text-xs font-medium text-text-muted">
                      {Math.min(totalProfiles, pageCursor + 1)}-{Math.min(totalProfiles, pageCursor + visibleProfiles.length)} de {totalProfiles}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToFeedPage(currentPage - 1)}
                      disabled={currentPage <= 1 || loading}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-muted transition hover:border-white/20 hover:text-white disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>
                    {pageWindow.map((page) => (
                      <motion.button
                        key={page}
                        type="button"
                        onClick={() => goToFeedPage(page)}
                        disabled={page === currentPage || loading}
                        whileHover={page === currentPage ? undefined : { y: -1 }}
                        whileTap={page === currentPage ? undefined : { scale: 0.98 }}
                        className={`min-w-10 rounded-xl px-3 py-2 text-sm font-semibold transition ${page === currentPage
                          ? 'border border-mansion-gold/40 bg-mansion-gold/15 text-mansion-gold'
                          : 'border border-white/10 bg-black/20 text-text-muted hover:border-white/20 hover:text-white'}`}
                      >
                        {page}
                      </motion.button>
                    ))}
                    <button
                      type="button"
                      onClick={() => goToFeedPage(currentPage + 1)}
                      disabled={currentPage >= totalPages || loading}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-muted transition hover:border-white/20 hover:text-white disabled:opacity-40"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </>
        ) : (
          <div
            className="text-center py-20"
          >
            <p className="text-text-muted text-lg mb-2">No hay perfiles</p>
            <p className="text-text-dim text-sm">Prueba con otro filtro</p>
          </div>
        )}
      </div>

    </div>
  );
}
