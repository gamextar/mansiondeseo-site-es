import { debugInspectMediaCache } from './api';

const MEDIA_DEBUG_EVENT = 'mansion-media-debug-update';

function createCounters() {
  return { total: 0, hit: 0, revalidated: 0, miss: 0, other: 0, errors: 0 };
}

function normalizeFamily(url) {
  try {
    const { pathname } = new URL(url);
    if (pathname.startsWith('/livefeed/')) return 'livefeed';
    if (pathname.startsWith('/stories/')) return 'stories';
    if (pathname.startsWith('/profiles/')) return 'profiles';
    if (pathname.startsWith('/assets/')) return 'assets';
    return 'other';
  } catch {
    return 'other';
  }
}

function accumulateEntry(counter, entry) {
  counter.total += 1;
  if (entry.error) counter.errors += 1;
  else if (entry.cacheStatus === 'HIT') counter.hit += 1;
  else if (entry.cacheStatus === 'REVALIDATED') counter.revalidated += 1;
  else if (entry.cacheStatus === 'MISS') counter.miss += 1;
  else counter.other += 1;
}

function summarizeFamilies(entries = []) {
  const families = {
    livefeed: createCounters(),
    stories: createCounters(),
    profiles: createCounters(),
    assets: createCounters(),
    other: createCounters(),
  };

  for (const entry of entries) {
    const family = normalizeFamily(entry?.url || '');
    accumulateEntry(families[family] || families.other, entry || {});
  }

  return families;
}

function cloneFamilies(families) {
  return Object.fromEntries(
    Object.entries(families || {}).map(([key, value]) => [key, { ...(value || createCounters()) }])
  );
}

function createController() {
  if (typeof window === 'undefined') return null;
  if (window.__mansionMediaDebug) return window.__mansionMediaDebug;

  const state = {
    loading: false,
    inspectedAt: null,
    route: window.location.pathname + window.location.search,
    entries: [],
    summary: createCounters(),
    sessionSummary: createCounters(),
    familySummary: summarizeFamilies(),
    sessionFamilySummary: summarizeFamilies(),
    error: '',
  };

  const emit = () => {
    window.dispatchEvent(new CustomEvent(MEDIA_DEBUG_EVENT, {
      detail: {
        loading: state.loading,
        inspectedAt: state.inspectedAt,
        route: state.route,
        entries: [...state.entries],
        summary: { ...state.summary },
        sessionSummary: { ...state.sessionSummary },
        familySummary: cloneFamilies(state.familySummary),
        sessionFamilySummary: cloneFamilies(state.sessionFamilySummary),
        error: state.error,
      },
    }));
  };

  const controller = {
    summary() {
      return {
        loading: state.loading,
        inspectedAt: state.inspectedAt,
        route: state.route,
        entries: [...state.entries],
        summary: { ...state.summary },
        sessionSummary: { ...state.sessionSummary },
        familySummary: cloneFamilies(state.familySummary),
        sessionFamilySummary: cloneFamilies(state.sessionFamilySummary),
        error: state.error,
      };
    },
    reset() {
      state.loading = false;
      state.inspectedAt = null;
      state.entries = [];
      state.summary = createCounters();
      state.sessionSummary = createCounters();
      state.familySummary = summarizeFamilies();
      state.sessionFamilySummary = summarizeFamilies();
      state.error = '';
      emit();
      return this.summary();
    },
    collectVisibleMedia(limit = 24) {
      const elements = Array.from(document.querySelectorAll('img, video'));
      const unique = new Set();
      const urls = [];

      for (const element of elements) {
        if (urls.length >= limit) break;
        const rect = element.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
        if (!visible) continue;

        const rawUrl = element.currentSrc || element.src || element.getAttribute('src') || '';
        if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) continue;
        if (unique.has(rawUrl)) continue;

        unique.add(rawUrl);
        urls.push(rawUrl);
      }

      return urls;
    },
    async inspectVisibleMedia({ limit = 24 } = {}) {
      state.loading = true;
      state.error = '';
      state.route = window.location.pathname + window.location.search;
      emit();

      try {
        const urls = this.collectVisibleMedia(limit);
        const data = await debugInspectMediaCache(urls);
        const entries = Array.isArray(data?.entries) ? data.entries : [];

        const summary = entries.reduce((acc, entry) => {
          accumulateEntry(acc, entry);
          return acc;
        }, createCounters());
        const familySummary = summarizeFamilies(entries);

        state.entries = entries;
        state.summary = summary;
        state.familySummary = familySummary;
        state.sessionSummary = {
          total: state.sessionSummary.total + summary.total,
          hit: state.sessionSummary.hit + summary.hit,
          miss: state.sessionSummary.miss + summary.miss,
          other: state.sessionSummary.other + summary.other,
          errors: state.sessionSummary.errors + summary.errors,
        };
        for (const [familyKey, counters] of Object.entries(familySummary)) {
          const sessionFamily = state.sessionFamilySummary[familyKey] || createCounters();
          sessionFamily.total += counters.total;
          sessionFamily.hit += counters.hit;
          sessionFamily.revalidated += counters.revalidated;
          sessionFamily.miss += counters.miss;
          sessionFamily.other += counters.other;
          sessionFamily.errors += counters.errors;
          state.sessionFamilySummary[familyKey] = sessionFamily;
        }
        state.inspectedAt = new Date().toISOString();
        state.error = '';
      } catch (error) {
        state.error = error?.message || 'No se pudo inspeccionar el cache de media';
      } finally {
        state.loading = false;
        emit();
      }

      return this.summary();
    },
  };

  window.__mansionMediaDebug = controller;
  return controller;
}

export function getMediaDebugSummary() {
  return createController()?.summary() || null;
}

export function resetMediaDebug() {
  return createController()?.reset() || null;
}

export function inspectVisibleMedia(options) {
  return createController()?.inspectVisibleMedia(options) || Promise.resolve(null);
}

export function subscribeMediaDebug(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail);
  window.addEventListener(MEDIA_DEBUG_EVENT, handler);
  return () => window.removeEventListener(MEDIA_DEBUG_EVENT, handler);
}

if (typeof window !== 'undefined') {
  createController();
}
