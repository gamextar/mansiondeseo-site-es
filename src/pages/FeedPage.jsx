import { forwardRef, useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Home, Plus, Radio } from 'lucide-react';
import { useAuth } from '../lib/authContext';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } };
import ProfileCard from '../components/ProfileCard';
import AvatarImg from '../components/AvatarImg';
import { getProfiles, getToken } from '../lib/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getPrimaryProfileCrop, getPrimaryProfilePhoto } from '../lib/profileMedia';
import { isSafariDesktopBrowser } from '../lib/browser';
import { getBottomNavPagePadding } from '../lib/bottomNavConfig';
import { applyPendingViewedStoryUsers, getPendingViewedStoryUsers, getViewedStoryUsers, getViewedStoryUsersKey } from '../lib/storyViews';

const FEED_CACHE_KEY = 'mansion_feed';
const FEED_CACHE_VERSION = 2;
const HOME_FEED_FOCUS_EVENT = 'mansion-home-feed-focus';
const HOME_FEED_RESET_EVENT = 'mansion-home-feed-reset';
const DEFAULT_CARDS_PER_PAGE = 12;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_PREFETCH_PAGES = 3;
const VIEWED_STORIES_EVENT = 'mansion-viewed-stories-updated';
const VIEWED_STORIES_APPLY_DELAY_MS = 520;
const STORIES_RAIL_TRANSITION = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
const STORY_CIRCLE_FALLBACK_SIZE = 88;
const STORY_CIRCLE_FALLBACK_BORDER_PERCENT = 4;
const STORY_CIRCLE_FALLBACK_INNER_GAP_PERCENT = 3;
const STORY_RAIL_FALLBACK_GAP_MOBILE = 6;
const STORY_RAIL_FALLBACK_GAP_DESKTOP = 7;
const STORY_RAIL_FALLBACK_OWN_EXTRA_GAP = 1;
const VIDEO_FEED_INDEX_KEY = 'vf_idx';
const VIDEO_FEED_ACTIVE_STORY_KEY = 'vf_active_story';

function coerceSettingNumber(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function detectStandaloneMobile() {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const ua = window.navigator.userAgent || '';
  const isMobile = /iphone|ipad|ipod|android/i.test(ua);
  return Boolean(standalone && isMobile);
}

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

function mapStoriesToRailProfiles(stories = []) {
  return (Array.isArray(stories) ? stories : [])
    .map((story) => ({
      id: String(story.user_id || story.id || ''),
      user_id: String(story.user_id || story.id || ''),
      story_id: String(story.id || ''),
      name: story.username || '',
      username: story.username || '',
      avatar_url: story.avatar_url || '',
      avatar_crop: story.avatar_crop || null,
      photos: [],
      has_active_story: true,
      active_story_url: story.video_url || '',
      video_url: story.video_url || '',
      caption: story.caption || '',
      likes: Number(story.likes || 0),
      comments: Number(story.comments || 0),
      liked: !!story.liked,
      created_at: story.created_at || '',
    }))
    .filter((story) => story.id && story.active_story_url);
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

function getFeedCardsPerPage(settings, isDesktopViewport) {
  const desktopValue = Number(settings?.feedCardsPerPage ?? DEFAULT_CARDS_PER_PAGE);
  const mobileValue = Number(settings?.feedCardsPerPageMobile ?? desktopValue);
  const resolved = isDesktopViewport ? desktopValue : mobileValue;
  return Math.max(6, Math.min(60, Number.isFinite(resolved) ? resolved : DEFAULT_CARDS_PER_PAGE));
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
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cacheVersion = Number(parsed?.version || 0);
    if (cacheVersion !== FEED_CACHE_VERSION) return null;
    const currentCursor = Number(parsed?.currentCursor) || 0;
    const blockCursor = Number(parsed?.blockCursor ?? parsed?.currentCursor) || 0;
    const pageCursor = Number(parsed?.pageCursor ?? parsed?.currentCursor) || 0;
    // Do not persist deep pagination across refreshes or fresh entries to home.
    // Only reuse cache when it represents the first page/block.
    if (currentCursor > 0 || blockCursor > 0 || pageCursor > 0) return null;
    if (Array.isArray(parsed?.profiles)) {
      return {
        ...parsed,
        settings: {},
      };
    }
    if (Array.isArray(parsed)) {
      return { profiles: parsed, viewerPremium: false, settings: {}, timestamp: 0 };
    }
    return null;
  } catch { return null; }
}

function setCachedFeed(data) {
  try {
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
      version: FEED_CACHE_VERSION,
      profiles: data.profiles || [],
      viewerPremium: data.viewerPremium || false,
      settings: {},
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

function makeFeedBlockKey(cursor, pageSize) {
  return `${Number(cursor) || 0}:${Number(pageSize) || 0}`;
}

export default function FeedPage({ initialData }) {
  const safariDesktop = isSafariDesktopBrowser();
  const cols = useGridColumns();
  const isDesktopViewport = cols >= 4;
  const desktopStoryRailEnhanced = isDesktopViewport;
  const cached = initialData || getCachedFeed();
  const { user, siteSettings, bootstrapStories } = useAuth();
  const isStandaloneMobileApp = detectStandaloneMobile();
  const [profiles, setProfiles] = useState(cached?.profiles || []);
  const [homeStories, setHomeStories] = useState(() => mapStoriesToRailProfiles(bootstrapStories));
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
  const navBottomOffset = getBottomNavPagePadding(isStandaloneMobileApp);
  const gridRef = useRef(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const mobileNavVisibleRef = useRef(false);
  const mobileNavRafRef = useRef(0);
  const mobileNavVisibilityTimerRef = useRef(null);
  const loadIdRef = useRef(0);  // monotonic counter to discard stale responses
  const prefetchedBlocksRef = useRef(new Map());
  const prefetchInFlightRef = useRef(new Map());
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
  const pagedFeedConfigInitializedRef = useRef(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    const vendor = window.navigator.vendor || '';
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Firefox|Edg|OPR/i.test(ua) && /Apple/i.test(vendor);
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    isSafariDesktopRef.current = isSafari && isDesktop;
  }, []);



  const applyLoadedProfiles = useCallback(({ data, cursor = 0, resolvedPageSize, targetPageCursor }) => {
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
  }, []);

  const fetchProfilesBlock = useCallback(async ({ forceFresh = false, cursor = 0, pageSize } = {}) => {
    const s = settingsRef.current;
    const resolvedCardsPerPage = getFeedCardsPerPage(s, isDesktopViewport);
    const resolvedPageSize = Math.max(
      12,
      Number(pageSize) || resolvedCardsPerPage * (s?.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES)
    );
    const data = await getProfiles({
      fresh: forceFresh,
      cursor,
      pageSize: resolvedPageSize,
    });
    return { data, resolvedPageSize };
  }, [isDesktopViewport]);

  const prefetchProfilesBlock = useCallback(({ cursor = 0, pageSize } = {}) => {
    const key = makeFeedBlockKey(cursor, pageSize);
    if (prefetchedBlocksRef.current.has(key)) return Promise.resolve(prefetchedBlocksRef.current.get(key));
    if (prefetchInFlightRef.current.has(key)) return prefetchInFlightRef.current.get(key);

    const task = fetchProfilesBlock({ cursor, pageSize })
      .then(({ data, resolvedPageSize }) => {
        const payload = { data, resolvedPageSize, cursor };
        prefetchedBlocksRef.current.set(key, payload);
        prefetchInFlightRef.current.delete(key);
        return payload;
      })
      .catch((error) => {
        prefetchInFlightRef.current.delete(key);
        throw error;
      });

    prefetchInFlightRef.current.set(key, task);
    return task;
  }, [fetchProfilesBlock]);

  const loadProfiles = useCallback(({ forceFresh = false, cursor = 0, pageSize, targetPageCursor } = {}) => {
    const c = getCachedFeed();
    if (!c) setLoading(true);
    const myId = ++loadIdRef.current;
    return fetchProfilesBlock({ forceFresh, cursor, pageSize })
      .then(data => {
        if (myId !== loadIdRef.current) return;
        applyLoadedProfiles({
          data: data.data,
          cursor,
          resolvedPageSize: data.resolvedPageSize,
          targetPageCursor,
        });
        return data.data;
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
  }, [applyLoadedProfiles, fetchProfilesBlock]); // stable — reads settings from settingsRef

  // Initial/config load — reruns when the viewport crosses the mobile/desktop page-size boundary.
  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    const cachedFeed = getCachedFeed();
    const currentSettings = settingsRef.current;
    const expectedCardsPerPage = getFeedCardsPerPage(currentSettings, isDesktopViewport);
    const cachedPageSize = Number(cachedFeed?.pageSize) || 0;
    const cachedPageCursor = Number(cachedFeed?.pageCursor ?? cachedFeed?.currentCursor) || 0;
    const expectedPageSize = Math.max(
      12,
      expectedCardsPerPage * (currentSettings?.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES)
    );
    const canReuseCached = !!cachedFeed && cachedPageSize === expectedPageSize;

    if (!cachedFeed || !canReuseCached) {
      loadProfiles({ cursor: 0, pageSize: expectedPageSize });
      return;
    }

    // Cache is valid — show it instantly, no background fetch.
    // Data stays fresh until: pull-to-refresh, cache invalidation (profile edit),
    // or cache is > 30 minutes old (stale safety net).
    setLoading(false);
    try {
      sessionStorage.removeItem('mansion_feed_dirty');
      sessionStorage.removeItem('mansion_feed_force_refresh');
    } catch {}
    const cacheAgeMs = Date.now() - (Number(cachedFeed.timestamp) || 0);
    if (cacheAgeMs > 30 * 60 * 1000) {
      loadProfiles({
        cursor: Math.floor(cachedPageCursor / expectedPageSize) * expectedPageSize,
        pageSize: expectedPageSize,
        targetPageCursor: cachedPageCursor,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktopViewport, navigate]);

  const [gridOpacity, setGridOpacity] = useState(1);
  const viewedStoriesStorageKey = useMemo(() => getViewedStoryUsersKey(user?.id), [user?.id]);

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
    const commitMobileNavVisibility = (next, delay) => {
      if (mobileNavVisibilityTimerRef.current) {
        window.clearTimeout(mobileNavVisibilityTimerRef.current);
        mobileNavVisibilityTimerRef.current = null;
      }
      mobileNavVisibilityTimerRef.current = window.setTimeout(() => {
        mobileNavVisibleRef.current = next;
        setShowMobileNav(next);
        mobileNavVisibilityTimerRef.current = null;
      }, delay);
    };
    const handleScroll = () => {
      if (mobileNavRafRef.current) return;
      mobileNavRafRef.current = window.requestAnimationFrame(() => {
        mobileNavRafRef.current = 0;
        const el = gridRef.current;
        if (!el) {
          if (mobileNavVisibleRef.current) commitMobileNavVisibility(false, 120);
          return;
        }
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        // Wide hysteresis keeps the fixed pill from chattering during iOS
        // rubber-band scrolling at the bottom of the document.
        const prev = mobileNavVisibleRef.current;
        const threshold = prev ? 760 : 420;
        const next = rect.bottom <= viewportHeight + threshold;
        if (next === prev) return;
        commitMobileNavVisibility(next, next ? 20 : 180);
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mobileNavRafRef.current) {
        window.cancelAnimationFrame(mobileNavRafRef.current);
        mobileNavRafRef.current = 0;
      }
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
      const nextCardsPerPage = getFeedCardsPerPage(s, isDesktopViewport);
      const nextBlockSize = nextCardsPerPage * (s?.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES);
      loadProfiles({
        forceFresh: shouldForceFresh,
        cursor: Math.floor(pageCursor / nextBlockSize) * nextBlockSize,
        pageSize: nextBlockSize,
        targetPageCursor: pageCursor,
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isDesktopViewport, loadProfiles, pageCursor]);

  const { indicatorRef } = usePullToRefresh(
    useCallback(() => loadProfiles({ forceFresh: true }), [loadProfiles]),
    {
      threshold: 168,
      startMaxY: 92,
      horizontalTolerance: 28,
      preventNativePull: !isStandaloneMobileApp && !isDesktopViewport,
      resetScrollOnRelease: !isStandaloneMobileApp && !isDesktopViewport,
    }
  );

  const safeSettings = useMemo(() => ({
    ...((settings && typeof settings === 'object') ? settings : {}),
    ...((siteSettings && typeof siteSettings === 'object') ? siteSettings : {}),
  }), [settings, siteSettings]);
  settingsRef.current = safeSettings;
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  const cardsPerPage = getFeedCardsPerPage(safeSettings, isDesktopViewport);
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
    const start = Math.max(1, currentPage - 1);
    const end = Math.min(totalPages, start + 2);
    const adjustedStart = Math.max(1, end - 2);
    return Array.from({ length: end - adjustedStart + 1 }, (_, idx) => adjustedStart + idx);
  }, [currentPage, totalPages]);
  const storyLimit = getInitialStoryLimit(safeSettings, isDesktopViewport);
  const bootstrapStoryProfiles = useMemo(
    () => mapStoriesToRailProfiles(bootstrapStories).slice(0, storyLimit),
    [bootstrapStories, storyLimit]
  );
  const fallbackStoryProfiles = useMemo(
    () => safeProfiles.filter((p) => p.has_active_story).slice(0, storyLimit),
    [safeProfiles, storyLimit]
  );
  const storyProfiles = homeStories.length > 0 ? homeStories : fallbackStoryProfiles;
  const storyCircleSize = Math.max(
    1,
    Math.round(coerceSettingNumber(
      safeSettings.storyCircleSize ?? safeSettings.storyCirclePresetMedium,
      STORY_CIRCLE_FALLBACK_SIZE
    ))
  );
  const storyRailGapMobile = Math.max(0, coerceSettingNumber(safeSettings.storyRailGapMobile, STORY_RAIL_FALLBACK_GAP_MOBILE));
  const storyRailGapDesktop = Math.max(0, coerceSettingNumber(safeSettings.storyRailGapDesktop, STORY_RAIL_FALLBACK_GAP_DESKTOP));
  const storyRailOwnStoryExtraGap = Math.max(0, coerceSettingNumber(safeSettings.storyRailOwnStoryExtraGap, STORY_RAIL_FALLBACK_OWN_EXTRA_GAP));
  const storyCircleGap = isDesktopViewport ? storyRailGapDesktop : storyRailGapMobile;
  if (typeof window !== 'undefined' && typeof console !== 'undefined') {
    console.debug('Story rail gap (desktop/mobile):', storyRailGapDesktop, storyRailGapMobile, 'used:', storyCircleGap);
  }
  const storyCircleBorder = Math.max(
    1,
    Math.round((storyCircleSize * coerceSettingNumber(safeSettings.storyCircleBorder, STORY_CIRCLE_FALLBACK_BORDER_PERCENT)) / 100)
  );
  const storyCircleInnerGap = Math.max(
    0,
    Math.round((storyCircleSize * coerceSettingNumber(safeSettings.storyCircleInnerGap, STORY_CIRCLE_FALLBACK_INNER_GAP_PERCENT)) / 100)
  );
  const storyCircleSlotWidth = isDesktopViewport ? storyCircleSize + 6 : storyCircleSize;
  const ownStorySlotWidth = storyCircleSlotWidth;
  const ownStoryPlusRight = isDesktopViewport ? 0 : 2;
  const ownStoryExtraGap = storyProfiles.length > 0 ? storyRailOwnStoryExtraGap : 0;
  const getStoryRailItemStyle = (animationDelay, extraRightGap = 0) => {
    return {
      width: storyCircleSlotWidth,
      animationDelay,
      ...(extraRightGap > 0 ? { marginRight: extraRightGap } : {}),
    };
  };

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
      const prefetchedKey = makeFeedBlockKey(nextBlockCursor, blockSize);
      const prefetched = prefetchedBlocksRef.current.get(prefetchedKey);
      if (prefetched) {
        applyLoadedProfiles({
          data: prefetched.data,
          cursor: nextBlockCursor,
          resolvedPageSize: prefetched.resolvedPageSize,
          targetPageCursor: nextPageCursor,
        });
        prefetchedBlocksRef.current.delete(prefetchedKey);
      } else {
        await loadProfiles({
          cursor: nextBlockCursor,
          pageSize: blockSize,
          targetPageCursor: nextPageCursor,
        });
      }
    }
    const targetTop = isDesktopViewport
      ? Math.max(0, (gridRef.current?.offsetTop || 0) - 24)
      : 0;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [applyLoadedProfiles, blockCursor, blockSize, cardsPerPage, hasMore, isDesktopViewport, loadProfiles, nextCursor, pageCursor, profiles, safeSettings, totalPages, totalProfiles, viewerPremium]);

  useEffect(() => {
    let fadeOutTimer = null;
    let fadeInTimer = null;
    const handleHomeFocus = () => {
      if (window.scrollY <= 0) return;
      setGridOpacity(0);
      fadeOutTimer = setTimeout(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
        document.documentElement.style.scrollBehavior = '';
        fadeInTimer = setTimeout(() => setGridOpacity(1), 16);
      }, 300);
    };
    const handleHomeReset = () => {
      try {
        localStorage.removeItem(FEED_CACHE_KEY);
      } catch {}
      prefetchedBlocksRef.current.clear();
      prefetchInFlightRef.current.clear();
      loadProfiles({ cursor: 0, pageSize: blockSize, targetPageCursor: 0 });
      window.scrollTo(0, 0);
    };
    window.addEventListener(HOME_FEED_FOCUS_EVENT, handleHomeFocus);
    window.addEventListener(HOME_FEED_RESET_EVENT, handleHomeReset);
    return () => {
      window.removeEventListener(HOME_FEED_FOCUS_EVENT, handleHomeFocus);
      window.removeEventListener(HOME_FEED_RESET_EVENT, handleHomeReset);
      clearTimeout(fadeOutTimer);
      clearTimeout(fadeInTimer);
    };
  }, [blockSize, loadProfiles]);

  useEffect(() => {
    if (loading) return;
    const nextConfig = `paged:${cardsPerPage}`;
    if (!pagedFeedConfigInitializedRef.current) {
      pagedFeedConfigRef.current = nextConfig;
      pagedFeedConfigInitializedRef.current = true;
      return;
    }
    if (pagedFeedConfigRef.current === nextConfig) return;
    pagedFeedConfigRef.current = nextConfig;
    prefetchedBlocksRef.current.clear();
    prefetchInFlightRef.current.clear();
    loadProfiles({ cursor: 0, pageSize: blockSize, targetPageCursor: 0 });
  }, [blockSize, cardsPerPage, loadProfiles, loading]);

  useEffect(() => {
    if (!isDesktopViewport) return;
    if (loading || !hasMore || !nextCursor) return;
    if (!profiles.length) return;

    const currentBlockEnd = blockCursor + profiles.length;
    const remainingAfterCurrentPage = currentBlockEnd - (pageCursor + cardsPerPage);
    if (remainingAfterCurrentPage > cardsPerPage) return;

    prefetchProfilesBlock({
      cursor: Number(nextCursor) || currentBlockEnd,
      pageSize: blockSize,
    }).catch(() => {});
  }, [blockCursor, blockSize, cardsPerPage, hasMore, isDesktopViewport, loading, nextCursor, pageCursor, prefetchProfilesBlock, profiles.length]);

  useEffect(() => {
    if (!isDesktopViewport) return;
    if (loading) return;
    if (!profiles.length) return;
    if (blockCursor <= 0) return;

    const pagesBeforeCurrent = pageCursor - blockCursor;
    if (pagesBeforeCurrent > cardsPerPage) return;

    prefetchProfilesBlock({
      cursor: Math.max(0, blockCursor - blockSize),
      pageSize: blockSize,
    }).catch(() => {});
  }, [blockCursor, blockSize, cardsPerPage, isDesktopViewport, loading, pageCursor, prefetchProfilesBlock, profiles.length]);

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
    () => (viewedStoriesStorageKey ? localStorage.getItem(viewedStoriesStorageKey) || '[]' : '[]'),
  );
  const viewedStoryUsers = useMemo(() => {
    try { return new Set(JSON.parse(viewedRaw)); } catch { return new Set(); }
  }, [viewedRaw]);
  const orderedStoryProfiles = useMemo(() => storyProfiles, [storyProfiles]);

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
    previousOrderedStoryIdsRef.current = orderedIds;
  }, [orderedStoryProfiles]);

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
      if (!user?.id) return false;
      const changed = applyPendingViewedStoryUsers(user.id);
      if (!changed) return false;
      window.dispatchEvent(new Event(VIEWED_STORIES_EVENT));
      return true;
    } catch {
      return false;
    }
  }, [user?.id]);

  const schedulePendingViewedStories = useCallback(() => {
    try {
      if (document.hidden) return;
      if (!user?.id) return;
      if (getPendingViewedStoryUsers(user.id).length === 0) return;
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
  }, [applyPendingViewedStories, user?.id]);

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
    const story = typeof storyOrUserId === 'object' && storyOrUserId !== null
      ? storyOrUserId
      : { user_id: storyOrUserId };
    const storyId = String(story.story_id || '').trim();
    const userId = String(story.user_id || story.id || '').trim();
    const videoUrl = String(story.video_url || story.active_story_url || '').trim();

    try {
      sessionStorage.removeItem(VIDEO_FEED_INDEX_KEY);
      if (storyId || userId || videoUrl) {
        sessionStorage.setItem(VIDEO_FEED_ACTIVE_STORY_KEY, JSON.stringify({ storyId, userId, videoUrl, source: 'rail' }));
      }
    } catch {}

    navigate('/videos');
  }, [navigate]);

  useEffect(() => {
    if (!getToken()) return;
    if (bootstrapStoryProfiles.length === 0) {
      setHomeStories([]);
      return;
    }
    setHomeStories((current) => {
      const currentIds = current.map((story) => String(story.story_id || story.id || '')).join(',');
      const nextIds = bootstrapStoryProfiles.map((story) => String(story.story_id || story.id || '')).join(',');
      return currentIds === nextIds ? current : bootstrapStoryProfiles;
    });
  }, [bootstrapStoryProfiles, user?.id]);

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

  const syncStoriesRailTransform = useCallback((offset = storiesEdgeOffsetRef.current) => {
    const rail = storiesScrollRef.current;
    if (!rail) return;
    rail.style.transform = desktopStoryRailEnhanced ? `translate3d(${offset}px, 0, 0)` : 'translate3d(0px, 0, 0)';
    rail.style.transition = desktopStoryRailEnhanced && storiesDragRef.current.active ? 'none' : STORIES_RAIL_TRANSITION;
  }, [desktopStoryRailEnhanced]);

  const stopStoriesBounce = useCallback(() => {
    if (storiesBounceFrameRef.current) {
      cancelAnimationFrame(storiesBounceFrameRef.current);
      storiesBounceFrameRef.current = null;
    }
  }, []);

  const setStoriesEdgeOffsetImmediate = useCallback((nextValue) => {
    const clamped = Math.max(-42, Math.min(42, nextValue));
    storiesEdgeOffsetRef.current = clamped;
    syncStoriesRailTransform(clamped);
  }, [syncStoriesRailTransform]);

  const animateStoriesEdgeOffsetTo = useCallback((target = 0) => {
    stopStoriesBounce();
    const step = () => {
      const current = storiesEdgeOffsetRef.current;
      const next = current + (target - current) * 0.095;
      if (Math.abs(next - target) < 0.18) {
        storiesEdgeOffsetRef.current = target;
        syncStoriesRailTransform(target);
        storiesBounceFrameRef.current = null;
        return;
      }
      storiesEdgeOffsetRef.current = next;
      syncStoriesRailTransform(next);
      storiesBounceFrameRef.current = requestAnimationFrame(step);
    };
    storiesBounceFrameRef.current = requestAnimationFrame(step);
  }, [stopStoriesBounce, syncStoriesRailTransform]);

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
    syncStoriesRailTransform();
  }, [desktopStoryRailEnhanced, setStoriesEdgeOffsetImmediate, stopStoriesBounce, stopStoriesMomentum, syncStoriesRailTransform]);

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
    syncStoriesRailTransform();
  }, [animateStoriesEdgeOffsetTo, desktopStoryRailEnhanced, startStoriesMomentum, syncStoriesRailTransform]);

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
    storiesDragRef.current.active = false;
    storiesDragRef.current.captured = false;
    storiesDragRef.current.moved = false;
    syncStoriesRailTransform(0);
  }, [desktopStoryRailEnhanced, stopStoriesBounce, stopStoriesMomentum, syncStoriesRailTransform]);

  useEffect(() => {
    syncStoriesRailTransform(desktopStoryRailEnhanced ? storiesEdgeOffsetRef.current : 0);
  }, [desktopStoryRailEnhanced, storyCircleGap, syncStoriesRailTransform]);

  useEffect(() => () => {
    stopStoriesMomentum();
    stopStoriesBounce();
  }, [stopStoriesBounce, stopStoriesMomentum]);

  // ── Grid setup ────────────────────────────────────────────────────
  const gap = isDesktopViewport ? 12 : 6;
  const mobileFeedBottomPadding = `calc(${navBottomOffset} + 96px)`;
  const mobilePaginationBottom = `calc(${navBottomOffset} + 10px)`;

  return (
    <div
      className="min-h-mobile-browser-screen bg-mansion-base lg:pt-0 lg:pb-[84px]"
      style={{
        paddingTop: isDesktopViewport ? undefined : 'calc(var(--safe-top) + 8px)',
        paddingBottom: isDesktopViewport
          ? undefined
          : mobileFeedBottomPadding,
      }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="fixed top-[calc(var(--safe-top)+8px)] lg:top-16 left-0 right-0 z-50 flex justify-center py-2 pointer-events-none"
        style={{ transform: 'translateY(-100%)', opacity: 0, transition: 'transform 0.2s, opacity 0.2s' }}
      >
        <div className="w-7 h-7 border-2 border-mansion-gold/30 border-t-mansion-gold rounded-full animate-spin" />
      </div>
      {!isDesktopViewport && (
        <div className="px-0 pr-3 h-10 flex items-center fade-in-up">
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="inline-flex items-center gap-2 rounded-full bg-black/28 px-2.5 py-1.5 backdrop-blur-md"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
              <span className="font-display text-white text-xs font-bold">M</span>
            </div>
            <span
              className="font-display text-[15px] font-semibold text-gradient-gold"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}
            >
              Mansion Deseo
            </span>
          </button>
        </div>
      )}
      {/* Stories section */}
      {showStoriesSection && (
      <div className="px-0 lg:px-8 pt-2 lg:pt-4 pb-0 fade-in-up">
        <div className="flex items-start justify-end gap-1.5 mb-3 px-2 lg:px-0">
          <Radio className="w-4 h-4 text-mansion-crimson" />
          <p className="relative -top-[2px] text-text-muted text-sm lg:text-base font-medium">Video Cards</p>
        </div>
        <div className="pl-[2px] pr-0 lg:px-0">
          <AnimatedBlock
            ref={storiesScrollRef}
            className={`flex overflow-x-auto scrollbar-hide pb-2 select-none ${desktopStoryRailEnhanced ? 'lg:cursor-grab active:lg:cursor-grabbing' : ''}`}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              gap: `${storyCircleGap}px`,
              touchAction: 'pan-x',
              transform: 'translate3d(0px, 0, 0)',
              transition: STORIES_RAIL_TRANSITION,
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
                style={getStoryRailItemStyle(storiesIntroEnabled ? '30ms' : undefined, ownStoryExtraGap)}
                data-story-gap={ownStoryExtraGap}
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
                      : () => navigate('/historia/nueva', { state: { from: '/feed' } })}
                    className="flex flex-col items-center gap-1 w-full"
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <div className={`rounded-full transition-all duration-300 ease-out ${
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
                    onClick={(e) => { e.stopPropagation(); navigate('/historia/nueva', { state: { from: '/feed' } }); }}
                    className="absolute bottom-4 w-5 h-5 rounded-full bg-mansion-gold flex items-center justify-center border-2 border-mansion-base shadow-md"
                    style={{ right: `${ownStoryPlusRight}px` }}
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <Plus className="w-3 h-3 text-mansion-base" strokeWidth={3} />
                  </button>
                </div>
              </div>
            ) : desktopStoryRailEnhanced ? (
              <div
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={getStoryRailItemStyle(storiesIntroEnabled ? '30ms' : undefined, ownStoryExtraGap)}
                data-story-gap={ownStoryExtraGap}
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
                      : () => navigate('/historia/nueva', { state: { from: '/feed' } })}
                    className="flex flex-col items-center gap-1 w-full"
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <div className={`rounded-full transition-all duration-300 ease-out ${
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
                    onClick={(e) => { e.stopPropagation(); navigate('/historia/nueva', { state: { from: '/feed' } }); }}
                    className="absolute bottom-4 w-5 h-5 rounded-full bg-mansion-gold flex items-center justify-center border-2 border-mansion-base shadow-md"
                    style={{ right: `${ownStoryPlusRight}px` }}
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <Plus className="w-3 h-3 text-mansion-base" strokeWidth={3} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={getStoryRailItemStyle(storiesIntroEnabled ? '30ms' : undefined, ownStoryExtraGap)}
                data-story-gap={ownStoryExtraGap}
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
                      : () => navigate('/historia/nueva', { state: { from: '/feed' } })}
                    className="flex flex-col items-center gap-1 w-full"
                    onDragStart={handleStoriesNativeDragStart}
                  >
                    <div className={`rounded-full transition-all duration-300 ease-out ${
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
                    onClick={(e) => { e.stopPropagation(); navigate('/historia/nueva', { state: { from: '/feed' } }); }}
                    className="absolute bottom-4 w-5 h-5 rounded-full bg-mansion-gold flex items-center justify-center border-2 border-mansion-base shadow-md"
                    style={{ right: `${ownStoryPlusRight}px` }}
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
            const itemStyle = getStoryRailItemStyle(
              storiesIntroEnabled ? `${60 + Math.min(index, 10) * 35}ms` : undefined
            );
            return safariDesktop ? (
              <div
                key={`story-${p.id}`}
                ref={(node) => setStoryNodeRef(p.id, node)}
                className={`flex-shrink-0 ${storiesIntroEnabled ? 'story-circle-enter' : ''}`}
                style={itemStyle}
                data-story-gap={itemStyle.marginRight ?? 0}
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => openStoryFromHome(p)}
                  className="flex flex-col items-center gap-1"
                  onDragStart={handleStoriesNativeDragStart}
                >
                  <div className={`rounded-full transition-all duration-300 ease-out ${
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
                style={itemStyle}
                data-story-gap={itemStyle.marginRight ?? 0}
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => openStoryFromHome(p)}
                  className="flex flex-col items-center gap-1"
                  onDragStart={handleStoriesNativeDragStart}
                >
                  <div className={`rounded-full transition-all duration-300 ease-out ${
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
      </div>
      )}

      {/* Results count */}
      <div className={`${isDesktopViewport ? 'px-3 lg:px-8' : 'px-2'} pb-2 fade-in-up fade-delay-300`}>
        <p className="text-text-dim text-xs">
          {visibleProfiles.length} {visibleProfiles.length === 1 ? 'usuario' : 'usuarios'} conectados
        </p>
      </div>

      {/* Grid */}
      <div className={isDesktopViewport ? 'px-3 lg:px-8' : 'px-1'}>
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
                          immersiveMobile={!isDesktopViewport}
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
                {/* Mobile pagination pill — appears near the bottom nav */}
                <div
                  className="lg:hidden fixed left-0 right-0 z-40 px-4 pointer-events-none"
                  style={{ bottom: mobilePaginationBottom }}
                  aria-hidden={!showMobileNav}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: showMobileNav ? 1 : 0,
                      y: showMobileNav ? 0 : 18,
                      scale: showMobileNav ? 1 : 0.96,
                    }}
                    transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center justify-center"
                    style={{ pointerEvents: showMobileNav ? 'auto' : 'none' }}
                  >
                    <div className="flex items-center gap-2 rounded-[999px] border border-white/15 bg-black/88 px-2.5 py-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
                      {currentPage > 1 ? (
                        <button
                          type="button"
                          onClick={() => goToFeedPage(currentPage - 1)}
                          aria-label="Pagina anterior"
                          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] active:scale-95 transition-transform"
                        >
                          <ChevronLeft className="h-5 w-5 text-white/82" />
                        </button>
                      ) : <div className="h-10 w-10" />}
                      <div className="min-w-[3.75rem] text-center">
                        <span className="text-[11px] font-semibold text-white/78">{currentPage} / {totalPages}</span>
                      </div>
                      {currentPage < totalPages ? (
                        <button
                          type="button"
                          onClick={() => goToFeedPage(currentPage + 1)}
                          aria-label="Pagina siguiente"
                          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] active:scale-95 transition-transform"
                        >
                          <ChevronRight className="h-5 w-5 text-white/82" />
                        </button>
                      ) : <div className="h-10 w-10" />}
                    </div>
                  </motion.div>
                </div>

                {/* Desktop pagination pill */}
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                  className="pointer-events-none fixed inset-x-0 bottom-[13px] z-40 hidden justify-center lg:flex"
                >
                  <div className="pointer-events-auto flex items-center gap-2.5 rounded-[999px] border border-black/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] px-3 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[22px]">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent(HOME_FEED_RESET_EVENT))}
                      disabled={currentPage <= 1 || loading}
                      aria-label="Volver a la pagina principal"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/16 text-white/68 transition-all duration-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                    >
                      <Home className="h-4.5 w-4.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => goToFeedPage(currentPage - 1)}
                      disabled={currentPage <= 1 || loading}
                      aria-label="Pagina anterior"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/16 text-white/68 transition-all duration-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                    >
                      <ChevronLeft className="h-4.5 w-4.5" />
                    </button>

                    <div className="flex items-center gap-1.5 rounded-full bg-black/14 px-1 py-1">
                      {pageWindow.map((page) => (
                        <motion.button
                          key={page}
                          type="button"
                          onClick={() => goToFeedPage(page)}
                          disabled={page === currentPage || loading}
                          layout
                          whileHover={page === currentPage ? undefined : { y: -1 }}
                          whileTap={page === currentPage ? undefined : { scale: 0.97 }}
                          transition={{ layout: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } }}
                          className={`relative inline-flex h-9 min-w-[2.85rem] items-center justify-center overflow-hidden rounded-full px-3.5 text-[15px] font-semibold tracking-[-0.01em] transition-colors duration-200 ${
                            page === currentPage
                              ? 'text-black'
                              : 'text-white/62 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          {page === currentPage ? (
                            <motion.span
                              layoutId="desktop-feed-pagination-active-pill"
                              className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,#ffffff,#ececec)] shadow-[0_10px_24px_rgba(255,255,255,0.16),inset_0_1px_0_rgba(255,255,255,0.85)]"
                              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                            />
                          ) : null}
                          <span className="relative z-10">{page}</span>
                        </motion.button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => goToFeedPage(currentPage + 1)}
                      disabled={currentPage >= totalPages || loading}
                      aria-label="Pagina siguiente"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/16 text-white/68 transition-all duration-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-35"
                    >
                      <ChevronRight className="h-4.5 w-4.5" />
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
