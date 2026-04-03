import { debugInspectMediaCache } from './api';

const MEDIA_DEBUG_EVENT = 'mansion-media-debug-update';

function createController() {
  if (typeof window === 'undefined') return null;
  if (window.__mansionMediaDebug) return window.__mansionMediaDebug;

  const state = {
    loading: false,
    inspectedAt: null,
    route: window.location.pathname + window.location.search,
    entries: [],
    summary: { total: 0, hit: 0, miss: 0, other: 0, errors: 0 },
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
        error: state.error,
      };
    },
    reset() {
      state.loading = false;
      state.inspectedAt = null;
      state.entries = [];
      state.summary = { total: 0, hit: 0, miss: 0, other: 0, errors: 0 };
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
          acc.total += 1;
          if (entry.error) acc.errors += 1;
          else if (entry.cacheStatus === 'HIT') acc.hit += 1;
          else if (entry.cacheStatus === 'MISS') acc.miss += 1;
          else acc.other += 1;
          return acc;
        }, { total: 0, hit: 0, miss: 0, other: 0, errors: 0 });

        state.entries = entries;
        state.summary = summary;
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
