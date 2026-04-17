const FEED_CACHE_KEY = 'mansion_feed';
const FEED_CACHE_VERSION = 2;
const DEFAULT_CARDS_PER_PAGE = 12;
const DEFAULT_PREFETCH_PAGES = 3;

export { FEED_CACHE_KEY, FEED_CACHE_VERSION, DEFAULT_CARDS_PER_PAGE, DEFAULT_PREFETCH_PAGES };

export function resolveHomeFeedPageSize(settings = {}) {
  return Math.max(
    12,
    (settings?.feedCardsPerPage ?? DEFAULT_CARDS_PER_PAGE) * (settings?.feedPrefetchPages ?? DEFAULT_PREFETCH_PAGES)
  );
}

export function getCachedHomeFeed() {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cacheVersion = Number(parsed?.version || 0);
    if (cacheVersion !== FEED_CACHE_VERSION) return null;
    const currentCursor = Number(parsed?.currentCursor) || 0;
    const blockCursor = Number(parsed?.blockCursor ?? parsed?.currentCursor) || 0;
    const pageCursor = Number(parsed?.pageCursor ?? parsed?.currentCursor) || 0;
    if (currentCursor > 0 || blockCursor > 0 || pageCursor > 0) return null;
    if (Array.isArray(parsed?.profiles)) return parsed;
    if (Array.isArray(parsed)) {
      return { profiles: parsed, viewerPremium: false, settings: {}, timestamp: 0 };
    }
    return null;
  } catch {
    return null;
  }
}

export function setCachedHomeFeed(data) {
  try {
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
      version: FEED_CACHE_VERSION,
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
