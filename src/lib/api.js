// ══════════════════════════════════════════════════════════
// MANSIÓN DESEO — Frontend API client
// ══════════════════════════════════════════════════════════

import { createMutationQueue } from './mutationQueue';
import { recordD1WriteEstimate } from './d1Debug';
import { resolveApiBase } from './siteConfig';

const API_BASE = resolveApiBase();
const TOKEN_KEY = 'mansion_token';
const USER_KEY = 'mansion_user';
const AUTH_ME_CACHE_KEY = 'authMe';
const AUTH_ME_CACHE_TTL_MS = 60 * 60_000;
const OWN_PROFILE_DASHBOARD_CACHE_KEY = 'ownProfileDashboard';
const OWN_PROFILE_DASHBOARD_TTL_MS = 60 * 60_000;
const EVER_LOGGED_IN_KEY = 'mansion_ever_logged_in';
const API_DEBUG_FLAG_KEY = 'mansion_debug_api_requests';
const API_DEBUG_UPDATE_EVENT = 'mansion-api-debug-update';
const STORY_LIKE_SYNC_EVENT = 'mansion-story-like-sync';
const CLIENT_CACHE_VERSION_KEY = 'mansion_client_cache_version';
const CLIENT_CACHE_VERSION = 'media-paths-v7-avatar-race-fix';
const TOP_VISITED_CACHE_TTL_MS = 10 * 60_000;
const CHAT_CACHE_PREFIX = 'mansion_chat_';
const STORY_SNAPSHOT_CACHE_PREFIX = 'mansion_story_snapshot:';
const STORY_SNAPSHOT_SELECTION_CACHE_PREFIX = 'mansion_story_snapshot_feed_v4:';
const STORY_SNAPSHOT_MANIFEST_TTL_MS = 10 * 60_000;
const STORY_SNAPSHOT_ASSET_TTL_MS = 24 * 60 * 60_000;
const STORY_SNAPSHOT_FAKE_ROTATION_MS = 5 * 60_000;
const STORY_SNAPSHOT_FAKE_REFRESH_COUNT = 5;
const STORY_SNAPSHOT_SHARED_LIMIT = 15;
const STORY_SNAPSHOT_BUCKETS = ['hombre', 'mujer', 'pareja', 'trans'];
const STORY_SEEKING_ROLE_IDS = ['hombre', 'mujer', 'pareja', 'pareja_hombres', 'pareja_mujeres', 'trans'];
const STORY_PAIR_ROLE_IDS = ['pareja', 'pareja_hombres', 'pareja_mujeres'];
const PROFILE_FAKE_ONLINE_ROTATION_MS = 5 * 60_000;
const PROFILE_FAKE_ONLINE_PERCENT_DEFAULT = 42;
export const STORY_FEED_CACHE_INVALIDATED_EVENT = 'mansion-story-feed-cache-invalidated';
const sharedGetCache = new Map();
let avatarUploadCacheSeq = 0;
const sessionCache = {
  get(key, ttlMs = 0) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (ttlMs > 0 && Date.now() - (Number(parsed.timestamp) || 0) > ttlMs) return null;
      return parsed.value;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
    } catch {}
  },
  delete(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};

function clearLegacyMediaCaches() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(CLIENT_CACHE_VERSION_KEY) === CLIENT_CACHE_VERSION) return;

    localStorage.removeItem(USER_KEY);

    sessionStorage.removeItem('appBootstrap');
    sessionStorage.removeItem(AUTH_ME_CACHE_KEY);
    sessionStorage.removeItem(OWN_PROFILE_DASHBOARD_CACHE_KEY);

    localStorage.setItem(CLIENT_CACHE_VERSION_KEY, CLIENT_CACHE_VERSION);
  } catch {
    // Cache cleanup is best-effort; never block app startup.
  }
}

clearLegacyMediaCaches();

function invalidateBootstrapCache() {
  sharedGetCache.delete('bootstrap');
  sessionCache.delete('appBootstrap');
}

function cacheOwnProfileDashboard(data) {
  if (!data || typeof data !== 'object') return;
  sessionCache.set(OWN_PROFILE_DASHBOARD_CACHE_KEY, data);
  sharedGetCache.set('ownProfileDashboard', { value: data, timestamp: Date.now(), promise: null });
}

function cacheMeResponse(data) {
  if (!data?.user) return;
  setStoredUser(data.user);
  sessionCache.set(AUTH_ME_CACHE_KEY, data);
  sharedGetCache.set('me', { value: data, timestamp: Date.now(), promise: null });
}

function invalidateOwnProfileDashboardCache() {
  sharedGetCache.delete('ownProfileDashboard');
  sessionCache.delete(OWN_PROFILE_DASHBOARD_CACHE_KEY);
}

function invalidateFavoritesCache() {
  for (const key of sharedGetCache.keys()) {
    if (String(key).startsWith('favorites:')) {
      sharedGetCache.delete(key);
    }
  }
}

function invalidateMeCache() {
  sharedGetCache.delete('me');
  sessionCache.delete(AUTH_ME_CACHE_KEY);
}

function mergeMeCache(partialUser) {
  if (!partialUser || typeof partialUser !== 'object') return;
  const currentUser = getStoredUser();
  if (!currentUser) return;
  const nextUser = { ...currentUser, ...partialUser };
  cacheMeResponse({ user: nextUser });
  const currentDashboard = sessionCache.get(OWN_PROFILE_DASHBOARD_CACHE_KEY, OWN_PROFILE_DASHBOARD_TTL_MS);
  if (currentDashboard?.user) {
    cacheOwnProfileDashboard({
      ...currentDashboard,
      user: { ...currentDashboard.user, ...nextUser },
    });
  }
}

function invalidateUnreadCountCache() {
  sharedGetCache.delete('unreadCount');
  sessionCache.delete('unreadCount');
}

function getTopVisitedCacheKey(limit, filter) {
  return `topVisited:${filter}:${limit}`;
}

function peekSharedGetValue(key, ttlMs = 0) {
  const cached = sharedGetCache.get(key);
  if (!cached || cached.value === undefined) return null;
  if (ttlMs > 0 && Date.now() - (cached.timestamp || 0) > ttlMs) return null;
  return cached.value;
}

export function invalidateConversationsCache() {
  sharedGetCache.delete('conversations');
  sessionCache.delete('conversations');
}

function invalidateMessageHistoryCache(otherUserId) {
  const prefix = `messages:${otherUserId}:`;
  for (const key of sharedGetCache.keys()) {
    if (String(key).startsWith(prefix)) {
      sharedGetCache.delete(key);
    }
  }
}

function sharedGet(key, fetcher, { ttlMs = 0 } = {}) {
  const now = Date.now();
  const cached = sharedGetCache.get(key);

  if (cached?.promise) return cached.promise;
  if (ttlMs > 0 && cached?.value !== undefined && now - cached.timestamp < ttlMs) {
    return Promise.resolve(cached.value);
  }

  const promise = fetcher()
    .then((value) => {
      sharedGetCache.set(key, { value, timestamp: Date.now(), promise: null });
      return value;
    })
    .catch((error) => {
      sharedGetCache.delete(key);
      throw error;
    });

  sharedGetCache.set(key, {
    value: cached?.value,
    timestamp: cached?.timestamp || 0,
    promise,
  });

  return promise;
}

function getApiDebugController() {
  if (typeof window === 'undefined') return null;

  if (window.__mansionApiDebug) return window.__mansionApiDebug;

  const state = {
    enabled: localStorage.getItem(API_DEBUG_FLAG_KEY) === '1',
    currentRoute: window.location.pathname + window.location.search,
    entries: [],
    counts: {},
    routeSummaries: [],
    sessionTotalRequests: 0,
    sessionCounts: {},
  };

  const snapshotCounts = () => Object.entries(state.counts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, value]) => ({
      key,
      count: value.count,
      ok: value.ok,
      errors: value.errors,
      totalMs: value.totalMs,
      avgMs: value.count ? Math.round(value.totalMs / value.count) : 0,
      lastStatus: value.lastStatus,
      lastTiming: value.lastTiming || '',
      lastCache: value.lastCache || '',
    }));

  const snapshotSessionCounts = () => Object.entries(state.sessionCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, value]) => ({
      key,
      count: value.count,
      ok: value.ok,
      errors: value.errors,
      totalMs: value.totalMs,
      avgMs: value.count ? Math.round(value.totalMs / value.count) : 0,
      lastStatus: value.lastStatus,
      lastTiming: value.lastTiming || '',
      lastCache: value.lastCache || '',
    }));

  const emitUpdate = () => {
    window.dispatchEvent(new CustomEvent(API_DEBUG_UPDATE_EVENT, {
      detail: {
        enabled: state.enabled,
        currentRoute: state.currentRoute,
        totalRequests: state.entries.length,
        counts: snapshotCounts(),
        routeSummaries: [...state.routeSummaries],
        sessionTotalRequests: state.sessionTotalRequests,
        sessionCounts: snapshotSessionCounts(),
      },
    }));
  };

  const controller = {
    enable() {
      state.enabled = true;
      localStorage.setItem(API_DEBUG_FLAG_KEY, '1');
      emitUpdate();
      return this.summary();
    },
    disable() {
      state.enabled = false;
      localStorage.removeItem(API_DEBUG_FLAG_KEY);
      emitUpdate();
      return this.summary();
    },
    isEnabled() {
      return state.enabled;
    },
    reset() {
      state.entries = [];
      state.counts = {};
      state.routeSummaries = [];
      state.currentRoute = window.location.pathname + window.location.search;
      emitUpdate();
      return this.summary();
    },
    resetSession() {
      state.entries = [];
      state.counts = {};
      state.routeSummaries = [];
      state.currentRoute = window.location.pathname + window.location.search;
      state.sessionTotalRequests = 0;
      state.sessionCounts = {};
      emitUpdate();
      return this.summary();
    },
    markRoute(route) {
      if (!state.enabled) {
        state.currentRoute = route;
        emitUpdate();
        return;
      }
      if (route === state.currentRoute) return;

      const summary = {
        route: state.currentRoute,
        totalRequests: state.entries.length,
        counts: snapshotCounts(),
      };

      if (summary.totalRequests > 0) {
        state.routeSummaries.push(summary);
        console.groupCollapsed(`[api-debug] ${summary.route} -> ${summary.totalRequests} requests`);
        console.table(summary.counts);
        console.groupEnd();
      }

      state.currentRoute = route;
      state.entries = [];
      state.counts = {};
      emitUpdate();
    },
    record({ method, path, status, durationMs, ok, timing, cache }) {
      if (!state.enabled) return;
      const key = `${method} ${path}`;
      const bucket = state.counts[key] || {
        count: 0,
        ok: 0,
        errors: 0,
        totalMs: 0,
        lastStatus: null,
        lastTiming: '',
        lastCache: '',
      };

      bucket.count += 1;
      bucket.totalMs += durationMs;
      bucket.lastStatus = status;
      bucket.lastTiming = timing || bucket.lastTiming || '';
      bucket.lastCache = cache || bucket.lastCache || '';
      if (ok) bucket.ok += 1;
      else bucket.errors += 1;
      state.counts[key] = bucket;

      const sessionBucket = state.sessionCounts[key] || {
        count: 0,
        ok: 0,
        errors: 0,
        totalMs: 0,
        lastStatus: null,
        lastTiming: '',
        lastCache: '',
      };

      sessionBucket.count += 1;
      sessionBucket.totalMs += durationMs;
      sessionBucket.lastStatus = status;
      sessionBucket.lastTiming = timing || sessionBucket.lastTiming || '';
      sessionBucket.lastCache = cache || sessionBucket.lastCache || '';
      if (ok) sessionBucket.ok += 1;
      else sessionBucket.errors += 1;
      state.sessionCounts[key] = sessionBucket;
      state.sessionTotalRequests += 1;

      state.entries.push({
        at: new Date().toISOString(),
        route: state.currentRoute,
        method,
        path,
        status,
        durationMs,
        ok,
        timing: timing || '',
        cache: cache || '',
      });
      emitUpdate();
    },
    summary() {
      return {
        enabled: state.enabled,
        currentRoute: state.currentRoute,
        totalRequests: state.entries.length,
        counts: snapshotCounts(),
        routeSummaries: [...state.routeSummaries],
        sessionTotalRequests: state.sessionTotalRequests,
        sessionCounts: snapshotSessionCounts(),
      };
    },
    entries() {
      return [...state.entries];
    },
  };

  window.__mansionApiDebug = controller;
  return controller;
}

export function ensureApiDebug() {
  return getApiDebugController();
}

export function setApiDebugEnabled(enabled) {
  const controller = getApiDebugController();
  if (!controller) return null;
  return enabled ? controller.enable() : controller.disable();
}

export function resetApiDebugRoute() {
  return getApiDebugController()?.reset() || null;
}

export function resetApiDebugSession() {
  return getApiDebugController()?.resetSession() || null;
}

export function markApiDebugRoute(route) {
  getApiDebugController()?.markRoute(route);
}

export function getApiDebugSummary() {
  return getApiDebugController()?.summary() || null;
}

export function subscribeApiDebug(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail);
  window.addEventListener(API_DEBUG_UPDATE_EVENT, handler);
  return () => window.removeEventListener(API_DEBUG_UPDATE_EVENT, handler);
}

if (typeof window !== 'undefined') {
  getApiDebugController();
}

// ── Token management ────────────────────────────────────

export function getToken() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (typeof localStorage === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  invalidateBootstrapCache();
  invalidateUnreadCountCache();
}

export function getStoredUser() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof localStorage === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(EVER_LOGGED_IN_KEY, '1');
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function hasEverLoggedIn() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(EVER_LOGGED_IN_KEY) === '1';
}

function removeMatchingStorageKeys(storage, shouldRemove) {
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && shouldRemove(key)) storage.removeItem(key);
    }
  } catch {
    // Cache cleanup is best-effort.
  }
}

function removeAllStoredChatCaches() {
  if (typeof window === 'undefined') return;
  const shouldRemove = (key) => key.startsWith(CHAT_CACHE_PREFIX);
  removeMatchingStorageKeys(localStorage, shouldRemove);
  removeMatchingStorageKeys(sessionStorage, shouldRemove);
}

function clearSiteStorageKeys(storage) {
  const exactKeys = new Set([
    TOKEN_KEY,
    USER_KEY,
    EVER_LOGGED_IN_KEY,
    'mansion_registered',
    'mansion_feed',
    'mansion_feed_cache_version',
    'mansion_feed_dirty',
    'mansion_feed_filter',
    'mansion_feed_force_refresh',
    'mansion_feed_scroll_y',
    'mansion_conversations',
    'mansion_pending_story_likes',
    'appBootstrap',
    AUTH_ME_CACHE_KEY,
    OWN_PROFILE_DASHBOARD_CACHE_KEY,
    'conversations',
    'unreadCount',
    'vf_active_story',
    'vf_idx',
    'vf_prefetched',
    'vf_stories',
  ]);
  const prefixes = [
    CHAT_CACHE_PREFIX,
    'mansion_home_stories:',
    'mansion_profile_detail_',
    'mansion_pending_viewed_story_users:',
    'viewed_story_users:',
  ];
  const shouldRemove = (key) => (
    exactKeys.has(key) ||
    prefixes.some((prefix) => key.startsWith(prefix))
  );
  removeMatchingStorageKeys(storage, shouldRemove);
}

export function clearAccountLocalData() {
  sharedGetCache.clear();
  if (typeof localStorage !== 'undefined') {
    clearSiteStorageKeys(localStorage);
  }
  if (typeof sessionStorage !== 'undefined') {
    clearSiteStorageKeys(sessionStorage);
  }
  if (typeof caches !== 'undefined') {
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.toLowerCase().includes('mansion'))
          .map((key) => caches.delete(key))
      ))
      .catch(() => {});
  }
}

function removeStoredChatCacheForPartner(partnerId) {
  if (typeof window === 'undefined' || !partnerId) return;
  const viewerId = getStoredUser()?.id;
  const legacyKey = `${CHAT_CACHE_PREFIX}${partnerId}`;
  const scopedKey = viewerId ? `${CHAT_CACHE_PREFIX}${viewerId}:${partnerId}` : null;
  const shouldRemove = (key) => (
    key === legacyKey ||
    (scopedKey && key === scopedKey) ||
    key.endsWith(`:${partnerId}`)
  );
  removeMatchingStorageKeys(localStorage, shouldRemove);
  removeMatchingStorageKeys(sessionStorage, shouldRemove);
}

export function clearAuth() {
  if (typeof localStorage === 'undefined') return;
  removeAllStoredChatCaches();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('mansion_registered');
  invalidateBootstrapCache();
  invalidateUnreadCountCache();
}

// ── Fetch wrapper ───────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  const method = options.method || 'GET';
  const debug = getApiDebugController();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const shouldRequestProfileTimings = debug?.isEnabled?.() && method === 'GET' && path.startsWith('/profiles');
  const requestPath = shouldRequestProfileTimings
    ? `${path}${path.includes('?') ? '&' : '?'}timings=1`
    : path;

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData/ArrayBuffer (upload)
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${requestPath}`, {
    ...options,
    headers,
  });
  const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let timingHeader = res.headers.get('X-Profiles-Timing') || '';
  const cacheHeader = res.headers.get('X-Profiles-Cache') || '';

  // Handle 401 — token expired
  if (res.status === 401 && token) {
    clearAuth();
    window.location.href = '/';
    throw new Error('Sesión expirada');
  }

  const data = await res.json();
  if (!timingHeader && data?.debugTimings) {
    timingHeader = [
      `viewer=${Math.round(data.debugTimings.viewerMs ?? 0)}ms`,
      `snapshot=${Math.round(data.debugTimings.snapshotMs ?? 0)}ms`,
      `favorites=${Math.round(data.debugTimings.favoritesMs ?? 0)}ms`,
      `count=${Math.round(data.debugTimings.countMs ?? 0)}ms`,
      `personalize=${Math.round(data.debugTimings.personalizeMs ?? 0)}ms`,
      `total=${Math.round(data.debugTimings.totalMs ?? 0)}ms`,
    ].join(', ');
  }
  const resolvedCacheHeader = cacheHeader || (
    data?.debugTimings?.cache
      ? `viewer:${data.debugTimings.cache.viewer}, snapshot:${data.debugTimings.cache.snapshot}, stories:${data.debugTimings.cache.stories}, count:${data.debugTimings.cache.count}`
      : ''
  );
  debug?.record({
    method,
    path,
    status: res.status,
    durationMs: Math.round(finishedAt - startedAt),
    ok: res.ok,
    timing: timingHeader || res.headers.get('Server-Timing') || '',
    cache: resolvedCacheHeader,
  });

  if (!res.ok) {
    const err = new Error(data.error || 'Error del servidor');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function apiBlob(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && token) {
    clearAuth();
    window.location.href = '/';
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    let message = 'Error del servidor';
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return res.blob();
}

async function apiUpload(path, options = {}) {
  const token = options.tokenOverride ?? getToken();
  const headers = { ...options.headers };
  const method = options.method || 'POST';
  const debug = getApiDebugController();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const bodySize = typeof options.body?.byteLength === 'number' ? options.body.byteLength : 0;

    xhr.open(method, `${API_BASE}${path}`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('X-Session-Token', token);
    }

    Object.entries(headers).forEach(([key, value]) => {
      if (value != null) xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!options.onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        options.onProgress(event.loaded / event.total);
        return;
      }
      if (bodySize > 0) {
        options.onProgress(Math.min(1, event.loaded / bodySize));
      }
    };

    xhr.onerror = () => {
      const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      debug?.record({
        method,
        path,
        status: xhr.status || 0,
        durationMs: Math.round(finishedAt - startedAt),
        ok: false,
      });
      reject(new Error('Error de red'));
    };

    xhr.onload = () => {
      let data = {};

      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        reject(new Error('Respuesta inválida del servidor'));
        return;
      }

      const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      debug?.record({
        method,
        path,
        status: xhr.status,
        durationMs: Math.round(finishedAt - startedAt),
        ok: xhr.status >= 200 && xhr.status < 300,
      });

      if (xhr.status === 401 && token) {
        clearAuth();
        window.location.href = '/';
        reject(new Error('Sesión expirada'));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const err = new Error(data.error || 'Error del servidor');
        err.status = xhr.status;
        err.data = data;
        reject(err);
        return;
      }

      options.onProgress?.(1);
      resolve(data);
    };

    xhr.send(options.body);
  });
}

// ── Auth ────────────────────────────────────────────────

export async function register({ email, password, username, role, seeking, interests, age, birthdate, province, locality, city, bio, country }) {
  const normalizedProvince = province ?? city ?? '';
  const normalizedAge = age === '' || age == null ? undefined : Number(age);
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      username,
      role,
      seeking,
      interests,
      ...(Number.isFinite(normalizedAge) ? { age: normalizedAge } : {}),
      birthdate: birthdate || '',
      province: normalizedProvince,
      locality: locality || '',
      city: normalizedProvince,
      bio,
      country,
    }),
  });
  // Registration now returns needsVerification instead of token
  return data;
}

export async function verifyCode(email, code) {
  const data = await apiFetch('/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  // Invalidate bootstrap cache so next call fetches fresh user data
  invalidateBootstrapCache();
  return data;
}

export async function resendCode(email) {
  return apiFetch('/auth/resend-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function login({ email, password }) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function checkEmail(email) {
  return apiFetch('/auth/check-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function checkUsername(username) {
  return apiFetch('/auth/check-username', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function forgotPassword(email) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email, code, newPassword) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  });
}

export async function requestMagicLink(email) {
  return apiFetch('/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function requestAccountDeletion() {
  return apiFetch('/account/delete/request', { method: 'POST' });
}

export async function confirmAccountDeletion(code) {
  const data = await apiFetch('/account/delete/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  clearAccountLocalData();
  return data;
}

export async function requestEmailChange(newEmail) {
  return apiFetch('/account/email-change/request', {
    method: 'POST',
    body: JSON.stringify({ newEmail }),
  });
}

export async function confirmEmailChange(newEmail, code) {
  const data = await apiFetch('/account/email-change/confirm', {
    method: 'POST',
    body: JSON.stringify({ newEmail, code }),
  });
  if (data?.token) setToken(data.token);
  if (data?.user) {
    cacheMeResponse({ user: data.user });
    invalidateBootstrapCache();
  }
  return data;
}

export async function updateAccountPassword({ currentPassword, newPassword }) {
  return apiFetch('/account/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getMe({ force = false } = {}) {
  const cached = force ? null : sessionCache.get(AUTH_ME_CACHE_KEY, AUTH_ME_CACHE_TTL_MS);
  if (cached?.user) {
    setStoredUser(cached.user);
    return Promise.resolve(cached);
  }

  if (force) {
    invalidateMeCache();
  }

  return sharedGet('me', async () => {
    const data = await apiFetch('/auth/me');
    cacheMeResponse(data);
    return data;
  }, { ttlMs: force ? 0 : AUTH_ME_CACHE_TTL_MS });
}

export async function getAppBootstrap() {
  const cached = sessionCache.get('appBootstrap', 60 * 60_000);
  if (cached) {
    if (typeof cached?.unread === 'number') setUnreadCountCache({ unread: cached.unread });
    if (cached?.user) {
      const currentDashboard = sessionCache.get(OWN_PROFILE_DASHBOARD_CACHE_KEY, OWN_PROFILE_DASHBOARD_TTL_MS);
      if (currentDashboard?.user) {
        cacheOwnProfileDashboard({
          ...currentDashboard,
          user: { ...currentDashboard.user, ...cached.user },
        });
      }
    }
    return Promise.resolve(cached);
  }

  return sharedGet('bootstrap', async () => {
    const data = await apiFetch('/app/bootstrap');
    if (data?.user) cacheMeResponse({ user: data.user });
    if (typeof data?.unread === 'number') setUnreadCountCache({ unread: data.unread });
    sessionCache.set('appBootstrap', data);
    return data;
  }, { ttlMs: 5 * 60_000 });
}

export function peekAppBootstrap() {
  return sessionCache.get('appBootstrap', 60 * 60_000);
}

export async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  }
  invalidateMeCache();
  invalidateOwnProfileDashboardCache();
  clearAuth();
}

// ── Profiles ────────────────────────────────────────────

function hashProfileOnlineSeed(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function applyClientFakeOnline(profilesResponse) {
  if (!profilesResponse || !Array.isArray(profilesResponse.profiles)) return profilesResponse;
  const viewerId = String(getStoredUser()?.id || 'anon');
  const windowKey = Math.floor(Date.now() / PROFILE_FAKE_ONLINE_ROTATION_MS);
  const fakeOnlinePercent = Number(profilesResponse?.settings?.fakeProfileOnlinePercent);
  const onlineRate = Math.max(0, Math.min(100, Number.isFinite(fakeOnlinePercent)
    ? fakeOnlinePercent
    : PROFILE_FAKE_ONLINE_PERCENT_DEFAULT)) / 100;
  return {
    ...profilesResponse,
    profiles: profilesResponse.profiles.map((profile) => {
      if (!profile?.fake) return profile;
      const hash = hashProfileOnlineSeed(`${viewerId}:${windowKey}:${profile.id || profile.name || ''}`);
      const online = (hash / 4294967296) < onlineRate;
      return {
        ...profile,
        online,
      };
    }),
  };
}

export async function getProfiles({ filter, q, fresh = false, cursor, pageSize } = {}) {
  const params = new URLSearchParams();
  if (filter && filter !== 'all') params.set('filter', filter);
  if (q) params.set('q', q);
  if (fresh) params.set('fresh', '1');
  if (cursor !== undefined && cursor !== null && cursor !== '') params.set('cursor', String(cursor));
  if (pageSize !== undefined && pageSize !== null && pageSize !== '') params.set('pageSize', String(pageSize));
  const qs = params.toString();
  const path = `/profiles${qs ? `?${qs}` : ''}`;
  // Search queries and forced refreshes bypass cache.
  if (q || fresh) return apiFetch(path).then(applyClientFakeOnline);
  const cacheKey = `profiles:${filter || 'all'}:${cursor || 0}:${pageSize || 0}`;
  return sharedGet(cacheKey, () => apiFetch(path).then(applyClientFakeOnline), { ttlMs: 5 * 60_000 });
}

export async function getProfilesVersion() {
  return apiFetch('/profiles/version');
}

export function invalidateProfilesCache() {
  for (const key of sharedGetCache.keys()) {
    if (String(key).startsWith('profiles:')) {
      sharedGetCache.delete(key);
    }
  }
}

function markFeedDirty() {
  invalidateProfilesCache();
  invalidateStoryFeedCache();
  try {
    sessionStorage.setItem('mansion_feed_dirty', '1');
    sessionStorage.setItem('mansion_feed_force_refresh', '1');
    localStorage.removeItem('mansion_feed');
  } catch {}
}

export async function getProfile(id) {
  return sharedGet(`profile:${id}`, () => apiFetch__getProfile(id), { ttlMs: 2 * 60_000 });
}

async function apiFetch__getProfile(id) {
  return apiFetch(`/profiles/${id}`);
}

export async function getProfileWithMessageLimit(id) {
  return apiFetch(`/profiles/${id}?include=messageLimit`);
}

export async function reportProfile(profileId, { reason, details = '' } = {}) {
  return apiFetch(`/profiles/${profileId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason, details }),
  });
}

export async function getChatBootstrap(id) {
  return sharedGet(`chatBootstrap:${id}`, () => apiFetch(`/chat/bootstrap/${id}`), { ttlMs: 60_000 });
}

export async function updateProfile(fields) {
  const data = await apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  if (data?.user) {
    cacheMeResponse({ user: data.user });
    sharedGetCache.delete(`profile:${data.user.id}`);
    invalidateBootstrapCache();
    const currentDashboard = sessionCache.get(OWN_PROFILE_DASHBOARD_CACHE_KEY, OWN_PROFILE_DASHBOARD_TTL_MS);
    if (currentDashboard) {
      cacheOwnProfileDashboard({
        ...currentDashboard,
        user: { ...(currentDashboard.user || {}), ...data.user },
      });
    }
  }
  const touchesBrowseState = [
    'role',
    'seeking',
    'interests',
    'country',
    'city',
    'province',
    'locality',
    'premium',
    'ghost_mode',
  ].some((key) => Object.prototype.hasOwnProperty.call(fields || {}, key));

  if (touchesBrowseState) {
    markFeedDirty();
  }
  return data;
}

export async function getOwnProfileDashboard() {
  return sharedGet('ownProfileDashboard', () => apiFetch('/me/dashboard'), { ttlMs: 10 * 60_000 });
}

export function peekOwnProfileDashboard() {
  return sessionCache.get(OWN_PROFILE_DASHBOARD_CACHE_KEY, OWN_PROFILE_DASHBOARD_TTL_MS);
}

// ── Messages ────────────────────────────────────────────

export async function getConversations() {
  const cached = sessionCache.get('conversations', 2 * 60_000);
  if (cached) return Promise.resolve(cached);

  return sharedGet('conversations', () => apiFetch('/messages').then((data) => {
    sessionCache.set('conversations', data);
    return data;
  }), { ttlMs: 2 * 60_000 });
}

export async function getMessages(otherUserId, { before, limit } = {}) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const path = `/messages/${otherUserId}${qs ? `?${qs}` : ''}`;

  // The latest chat page is prone to duplicate mounts/reconnects; collapse
  // identical fetches briefly so they do not fan out into many Worker hits.
  if (!before) {
    const latestLimit = limit || 40;
    return sharedGet(`messages:${otherUserId}:latest:${latestLimit}`, () => apiFetch(path), { ttlMs: 2_000 });
  }

  return apiFetch(path);
}

export async function deleteConversation(otherUserId) {
  return apiFetch(`/messages/${otherUserId}`, {
    method: 'DELETE',
  }).then((data) => {
    recordD1WriteEstimate('chat_delete', 2);
    removeStoredChatCacheForPartner(otherUserId);
    invalidateMessageHistoryCache(otherUserId);
    invalidateConversationsCache();
    invalidateUnreadCountCache();
    return data;
  });
}

export async function getUserBlockState(otherUserId) {
  return apiFetch(`/users/${otherUserId}/block`);
}

export async function setUserBlocked(otherUserId, blocked) {
  return apiFetch(`/users/${otherUserId}/block`, {
    method: 'PUT',
    body: JSON.stringify({ blocked: !!blocked }),
  }).then((data) => {
    sharedGetCache.delete(`chatBootstrap:${otherUserId}`);
    invalidateMessageHistoryCache(otherUserId);
    invalidateConversationsCache();
    return data;
  });
}

export async function sendMessage(receiverId, content, attachment = {}) {
  return apiFetch('/messages/send', {
    method: 'POST',
    body: JSON.stringify({
      receiver_id: receiverId,
      content,
      ...attachment,
    }),
  }).then((data) => {
    invalidateMessageHistoryCache(receiverId);
    invalidateConversationsCache();
    invalidateUnreadCountCache();
    return data;
  });
}

export async function startVideoCall(receiverId) {
  return apiFetch(`/chat/video-call/${receiverId}/start`, {
    method: 'POST',
    body: '{}',
  });
}

export async function joinVideoCall(callId) {
  return apiFetch(`/chat/video-call/${callId}/join`, {
    method: 'POST',
    body: '{}',
  });
}

export async function endVideoCall(callId) {
  return apiFetch(`/chat/video-call/${callId}/end`, {
    method: 'POST',
    body: '{}',
  });
}

export async function getMessageLimit() {
  return apiFetch('/messages/limit');
}

export async function getUnreadCount({ force = false } = {}) {
  if (!force) {
    const cached = sessionCache.get('unreadCount', 15_000);
    if (cached) return Promise.resolve(cached);
  }

  return sharedGet('unreadCount', () => apiFetch('/unread-count').then((data) => {
    sessionCache.set('unreadCount', data);
    return data;
  }), { ttlMs: force ? 0 : 15_000 });
}

export function setUnreadCountCache(data) {
  sessionCache.set('unreadCount', data);
  sharedGetCache.set('unreadCount', { value: data, timestamp: Date.now(), promise: null });
}

export function peekUnreadCountCache(ttlMs = 15_000) {
  return sessionCache.get('unreadCount', ttlMs);
}

export function invalidateUnreadCache() {
  invalidateUnreadCountCache();
}

export async function adminChatCleanup() {
  return apiFetch('/admin/chat-cleanup', { method: 'POST' });
}

export async function debugInspectMediaCache(urls = []) {
  return apiFetch('/debug/media-cache', {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });
}

// ── Upload ──────────────────────────────────────────────

export async function uploadImage(file, { purpose = 'asset', sourceUrl = '' } = {}) {
  const params = new URLSearchParams();
  if (purpose) params.set('purpose', purpose);
  if (sourceUrl) params.set('source_url', sourceUrl);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const currentAvatarUploadSeq = purpose === 'avatar' ? avatarUploadCacheSeq + 1 : 0;
  if (purpose === 'avatar') avatarUploadCacheSeq = currentAvatarUploadSeq;

  const data = await apiUpload(`/upload${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  if (purpose === 'avatar') {
    invalidateMeCache();
    invalidateBootstrapCache();
    invalidateOwnProfileDashboardCache();
    if (currentAvatarUploadSeq === avatarUploadCacheSeq) {
      mergeMeCache({
        avatar_url: data?.avatar_url || data?.url || '',
        avatar_thumb_url: data?.avatar_thumb_url || '',
        avatar_crop: null,
      });
    }
  } else if (purpose === 'avatar_thumb') {
    invalidateMeCache();
    invalidateBootstrapCache();
    invalidateOwnProfileDashboardCache();
    mergeMeCache({ avatar_thumb_url: data?.avatar_thumb_url || data?.url || '' });
  } else if (purpose === 'gallery' && Array.isArray(data?.photos)) {
    invalidateMeCache();
    invalidateBootstrapCache();
    invalidateOwnProfileDashboardCache();
    mergeMeCache({ photos: data.photos, photo_thumbs: data?.photo_thumbs, avatar_url: data?.avatar_url });
  } else if (purpose === 'gallery_thumb') {
    invalidateMeCache();
    invalidateBootstrapCache();
    invalidateOwnProfileDashboardCache();
    mergeMeCache({ photo_thumbs: data?.photo_thumbs });
  }
  return data;
}

export async function uploadAvatar(file, thumbnailFile) {
  const avatarData = await uploadImage(file, { purpose: 'avatar' });
  const fallbackThumbUrl = avatarData?.avatar_thumb_url || avatarData?.avatar_url || avatarData?.url || '';
  if (!thumbnailFile) {
    return {
      ...avatarData,
      avatar_thumb_url: fallbackThumbUrl,
    };
  }

  try {
    let thumbData;
    try {
      thumbData = await uploadImage(thumbnailFile, { purpose: 'avatar_thumb' });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 350));
      thumbData = await uploadImage(thumbnailFile, { purpose: 'avatar_thumb' });
    }
    return {
      ...avatarData,
      avatar_thumb_url: thumbData?.avatar_thumb_url || thumbData?.url || fallbackThumbUrl,
    };
  } catch (err) {
    console.warn('Avatar thumbnail upload failed:', err);
    return {
      ...avatarData,
      avatar_thumb_url: fallbackThumbUrl,
    };
  }
}

export async function uploadGalleryImage(file, thumbnailFile) {
  const galleryData = await uploadImage(file, { purpose: 'gallery' });
  if (!thumbnailFile || !galleryData?.url) return galleryData;

  try {
    const thumbData = await uploadImage(thumbnailFile, {
      purpose: 'gallery_thumb',
      sourceUrl: galleryData.url,
    });
    return {
      ...galleryData,
      photo_thumbs: thumbData?.photo_thumbs || galleryData?.photo_thumbs || {},
      photo_thumb_url: thumbData?.photo_thumb_url || thumbData?.url || '',
    };
  } catch (err) {
    console.warn('Gallery thumbnail upload failed:', err);
    return galleryData;
  }
}

export async function deletePhoto(url) {
  return apiFetch('/photos', {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  }).then((data) => {
    if (Array.isArray(data?.photos)) {
      mergeMeCache({ photos: data.photos, photo_thumbs: data?.photo_thumbs, avatar_url: data?.avatar_url });
    }
    return data;
  });
}

// ── Photo OTP verification ─────────────────────────────

export async function getPhotoOtpVerification() {
  return apiFetch('/verification/photo-otp');
}

export async function startPhotoOtpVerification() {
  return apiFetch('/verification/photo-otp/start', {
    method: 'POST',
    body: '{}',
  });
}

export async function cancelPhotoOtpVerification() {
  const data = await apiFetch('/verification/photo-otp/cancel', {
    method: 'POST',
    body: '{}',
  });
  invalidateMeCache();
  invalidateBootstrapCache();
  return data;
}

export async function uploadPhotoOtpVerificationPhoto(file) {
  const data = await apiUpload('/verification/photo-otp/photo', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  invalidateMeCache();
  invalidateBootstrapCache();
  return data;
}

export async function getPhotoOtpVerificationPhotoBlob(requestId) {
  return apiBlob(`/verification/photo-otp/photo/${requestId}`);
}

// ── Settings ────────────────────────────────────────────

export async function getSettings() {
  return apiFetch('/settings');
}

export async function getPublicSettings({ fresh = false } = {}) {
  const path = fresh ? `/settings/public?ts=${Date.now()}` : '/settings/public';
  return apiFetch(path, fresh ? {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  } : {});
}

export async function detectCountry() {
  const sessionKey = 'detectedCountry';
  const cached = sessionCache.get(sessionKey, 24 * 60 * 60_000);
  if (cached) return Promise.resolve(cached);

  return apiFetch('/detect-country').then((data) => {
    sessionCache.set(sessionKey, data);
    return data;
  });
}

export async function getCloudflareLocationDebug() {
  return apiFetch('/debug/cf-location');
}

export async function getGeoDefaults() {
  return apiFetch('/geo/defaults');
}

export async function updateSettings(fields) {
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(fields),
  }).then((data) => {
    sharedGetCache.delete('publicSettings');
    sessionCache.delete('publicSettings');
    removeMatchingStorageKeys(sessionStorage, (key) => key.startsWith('mansion_profile_detail_'));
    markFeedDirty();
    return data;
  });
}

// ── Favorites ───────────────────────────────────────────

export async function toggleFavorite(targetId) {
  const data = await apiFetch(`/favorites/${targetId}`, { method: 'POST' });
  invalidateFavoritesCache();
  return data;
}

export async function toggleStoryLike(storyId) {
  return apiFetch(`/stories/${storyId}/like`, { method: 'POST' });
}

export async function getFavorites(tab = 'following', limit = 100) {
  const safeTab = String(tab || '').toLowerCase() === 'followers' ? 'followers' : 'following';
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  return sharedGet(
    `favorites:${safeTab}:${safeLimit}`,
    () => apiFetch(`/favorites?tab=${encodeURIComponent(safeTab)}&limit=${safeLimit}`),
    { ttlMs: 20_000 }
  );
}

export async function checkFavorite(targetId) {
  return apiFetch(`/favorites/check/${targetId}`);
}

// ── Visits ──────────────────────────────────────────────

export async function getVisits() {
  return sharedGet('visits', () => apiFetch('/visits'), { ttlMs: 10 * 60_000 });
}

export async function getTopVisitedProfiles(limit = 100, filter = 'all') {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  const safeFilter = ['all', 'mujeres', 'hombres', 'parejas'].includes(String(filter || '').toLowerCase())
    ? String(filter || 'all').toLowerCase()
    : 'all';
  const cacheKey = getTopVisitedCacheKey(safeLimit, safeFilter);
  const sessionKey = `session:${cacheKey}`;
  return sharedGet(
    cacheKey,
    async () => {
      const data = await apiFetch(`/rankings/top-visited?limit=${safeLimit}&filter=${encodeURIComponent(safeFilter)}`);
      sessionCache.set(sessionKey, data);
      return data;
    },
    { ttlMs: TOP_VISITED_CACHE_TTL_MS }
  );
}

export function peekTopVisitedProfiles(limit = 100, filter = 'all') {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  const safeFilter = ['all', 'mujeres', 'hombres', 'parejas'].includes(String(filter || '').toLowerCase())
    ? String(filter || 'all').toLowerCase()
    : 'all';
  const cacheKey = getTopVisitedCacheKey(safeLimit, safeFilter);
  return (
    peekSharedGetValue(cacheKey, TOP_VISITED_CACHE_TTL_MS)
    || sessionCache.get(`session:${cacheKey}`, TOP_VISITED_CACHE_TTL_MS)
  );
}

export function warmTopVisitedProfiles(limit = 100, filter = 'all') {
  return getTopVisitedProfiles(limit, filter).catch(() => null);
}

// ── Gifts & Coins ───────────────────────────────────────

export async function getGiftCatalog() {
  return sharedGet('giftCatalog', () => apiFetch('/gifts/catalog'), { ttlMs: 5 * 60_000 });
}

export async function sendGift(receiverId, giftId, message = '') {
  const data = await apiFetch('/gifts/send', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId, gift_id: giftId, message }),
  });
  sharedGetCache.delete(`gifts:${receiverId}`);
  if (getStoredUser()?.id === receiverId) invalidateOwnProfileDashboardCache();
  return data;
}

export async function getReceivedGifts(userId) {
  return sharedGet(`gifts:${userId}`, () => apiFetch(`/gifts/received/${userId}`), { ttlMs: 10 * 60_000 });
}

export async function getCoins() {
  return apiFetch('/coins');
}

// ── Admin: Gifts ────────────────────────────────────────

export async function adminGetGifts() {
  return apiFetch('/admin/gifts');
}

export async function adminCreateGift({ name, emoji, price, category }) {
  return apiFetch('/admin/gifts', {
    method: 'POST',
    body: JSON.stringify({ name, emoji, price, category }),
  });
}

export async function adminDeleteGift(giftId) {
  return apiFetch(`/admin/gifts/${giftId}`, { method: 'DELETE' });
}

export async function adminAddCoins(userId, amount) {
  return apiFetch('/admin/coins', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, amount }),
  });
}

// ── Pagos ───────────────────────────────────────────────

export async function createPayment({ plan_id, amount, source = '', source_path = '' }) {
  return apiFetch('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ plan_id, amount, source, source_path }),
  });
}

export async function confirmPayment(payment_id, { gateway, external_reference } = {}) {
  const data = await apiFetch('/payment/confirm', {
    method: 'POST',
    body: JSON.stringify({ payment_id, gateway, external_reference }),
  });
  invalidateMeCache();
  invalidateBootstrapCache();
  invalidateOwnProfileDashboardCache();

  const partialUser = {};
  if (data?.premium_until) {
    partialUser.premium = true;
    partialUser.premium_until = data.premium_until;
  }
  if (Number.isFinite(Number(data?.coinsAdded))) {
    const currentCoins = Number(getStoredUser()?.coins || 0);
    partialUser.coins = currentCoins + Number(data.coinsAdded);
  }
  if (Object.keys(partialUser).length > 0) {
    mergeMeCache(partialUser);
  }
  return data;
}

export async function reportPaymentResult({ payment_log_id, payment_id, uuid, gateway, external_reference, status, reason } = {}) {
  return apiFetch('/payment/result', {
    method: 'POST',
    body: JSON.stringify({ payment_log_id, payment_id, uuid, gateway, external_reference, status, reason }),
  });
}

// ── Admin ─────────────────────────────────────────────

export async function adminRemoveAllVip() {
  return apiFetch('/admin/remove-all-vip', { method: 'POST', body: '{}' });
}

export async function adminResetAllCoins() {
  return apiFetch('/admin/reset-all-coins', { method: 'POST', body: '{}' });
}

export async function adminGetStorySnapshots({ fresh = false } = {}) {
  const qs = fresh ? '?fresh=1' : '';
  return apiFetch(`/admin/stories/snapshots${qs}`);
}

export async function adminRebuildStorySnapshots({ includeReal = false, includeFakes = true } = {}) {
  const result = await apiFetch('/admin/stories/snapshots/rebuild', {
    method: 'POST',
    body: JSON.stringify({
      include_real: includeReal,
      include_fakes: includeFakes,
    }),
  });
  invalidateStoryFeedCache();
  return result;
}

export async function adminGetProfileSnapshots({ fresh = false } = {}) {
  const qs = fresh ? '?fresh=1' : '';
  return apiFetch(`/admin/profiles/snapshots${qs}`);
}

export async function adminRebuildProfileSnapshots({ includeReal = false, includeFakes = true } = {}) {
  const result = await apiFetch('/admin/profiles/snapshots/rebuild', {
    method: 'POST',
    body: JSON.stringify({
      include_real: includeReal,
      include_fakes: includeFakes,
    }),
  });
  markFeedDirty();
  return result;
}

export async function adminGetFeedItems() {
  return apiFetch('/admin/feed-items');
}

export async function adminRebuildFeedItems() {
  const result = await apiFetch('/admin/feed-items/rebuild', {
    method: 'POST',
    body: '{}',
  });
  markFeedDirty();
  invalidateStoryFeedCache();
  return result;
}

export async function adminGetSubscriptionPaymentLogs({ page = 1, limit = 25, q = '', status = '', gateway = '', refresh_uala = false } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (gateway) params.set('gateway', gateway);
  if (refresh_uala) params.set('refresh_uala', '1');
  return apiFetch(`/admin/subscription-payment-logs?${params}`);
}

export async function adminDeleteSubscriptionPaymentLog(logId) {
  return apiFetch(`/admin/subscription-payment-logs/${encodeURIComponent(logId)}`, {
    method: 'DELETE',
  });
}

// ── Admin: Users ────────────────────────────────────────

export async function adminGetUsers({ page = 1, limit = 20, q = '', fake = '', role = '', status = '', duplicate = '', created = '', reported = '', featured = '', verification = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  if (fake === '1' || fake === '0') params.set('fake', fake);
  if (['mujer', 'hombre', 'pareja'].includes(role)) params.set('role', role);
  if (['active', 'under_review', 'suspended'].includes(status)) params.set('status', status);
  if (duplicate === '1' || duplicate === '0') params.set('duplicate', duplicate);
  if (['1d', '72h'].includes(created)) params.set('created', created);
  if (reported === '1' || reported === '0') params.set('reported', reported);
  if (featured === '1' || featured === '0') params.set('featured', featured);
  if (['pending', 'verified', 'unverified'].includes(verification)) params.set('verification', verification);
  return apiFetch(`/admin/users?${params}`);
}

export async function adminGetUserIds({ q = '', fake = '', role = '', status = '', duplicate = '', created = '', reported = '', featured = '', verification = '' } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (fake === '1' || fake === '0') params.set('fake', fake);
  if (['mujer', 'hombre', 'pareja'].includes(role)) params.set('role', role);
  if (['active', 'under_review', 'suspended'].includes(status)) params.set('status', status);
  if (duplicate === '1' || duplicate === '0') params.set('duplicate', duplicate);
  if (['1d', '72h'].includes(created)) params.set('created', created);
  if (reported === '1' || reported === '0') params.set('reported', reported);
  if (featured === '1' || featured === '0') params.set('featured', featured);
  if (['pending', 'verified', 'unverified'].includes(verification)) params.set('verification', verification);
  return apiFetch(`/admin/users/ids?${params}`);
}

export async function adminGetUser(userId) {
  return apiFetch(`/admin/users/${userId}`);
}

export async function adminUpdateUser(userId, fields) {
  return apiFetch(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export async function adminUploadGalleryThumb(userId, sourceUrl, file) {
  const params = new URLSearchParams({ source_url: sourceUrl });
  return apiUpload(`/admin/users/${userId}/gallery-thumb?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
}

export async function adminUploadAvatarThumb(userId, file) {
  return apiUpload(`/admin/users/${userId}/avatar-thumb`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
}

export async function adminDeleteGalleryPhoto(userId, url) {
  return apiFetch(`/admin/users/${userId}/gallery-photo`, {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  });
}

export async function adminReviewPhotoOtpVerification(requestId, { status, adminNote = '' } = {}) {
  const result = await apiFetch(`/admin/photo-verifications/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, admin_note: adminNote }),
  });
  markFeedDirty();
  return result;
}

export async function adminGetPhotoOtpVerificationPhotoBlob(requestId) {
  return apiBlob(`/admin/photo-verifications/${requestId}/photo`);
}

export async function adminCloseProfileReport(reportId) {
  return apiFetch(`/admin/profile-reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'closed' }),
  });
}

export async function adminDeleteUser(userId) {
  const result = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
  markFeedDirty();
  return result;
}

export async function adminBulkDeleteUsers(userIds) {
  const result = await apiFetch('/admin/users/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
  if (Number(result?.deleted || 0) > 0) markFeedDirty();
  return result;
}

export async function adminGetErrorLogs({ page = 1, limit = 25, q = '', source = '', level = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  if (['worker', 'client'].includes(source)) params.set('source', source);
  if (['error', 'warn'].includes(level)) params.set('level', level);
  return apiFetch(`/admin/error-logs?${params}`);
}

export async function adminDeleteErrorLog(logId) {
  return apiFetch(`/admin/error-logs/${logId}`, { method: 'DELETE' });
}

export async function adminDeleteAllErrorLogs() {
  return apiFetch('/admin/error-logs', { method: 'DELETE' });
}

export async function adminGetFakeInbox({ page = 1, limit = 20, q = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  return apiFetch(`/admin/fake-inbox?${params}`);
}

export async function adminGetFakeInboxConversation({ realId, fakeId, limit = 80 } = {}) {
  const params = new URLSearchParams({ real_id: realId || '', fake_id: fakeId || '', limit });
  return apiFetch(`/admin/fake-inbox/conversation?${params}`);
}

export async function adminReplyFakeInbox({ realId, fakeId, content } = {}) {
  return apiFetch('/admin/fake-inbox/reply', {
    method: 'POST',
    body: JSON.stringify({
      real_id: realId || '',
      fake_id: fakeId || '',
      content: content || '',
    }),
  });
}

export async function reportClientError(payload = {}) {
  try {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    await fetch(`${API_BASE}/client-errors`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort only
  }
}

// ── Stories ─────────────────────────────────────────────

function readStorySnapshotStorage(key, ttlMs) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const timestamp = Number(parsed?.timestamp || 0);
    if (ttlMs > 0 && (!timestamp || Date.now() - timestamp > ttlMs)) return null;
    return parsed?.value || null;
  } catch {
    return null;
  }
}

function writeStorySnapshotStorage(key, value) {
  if (typeof localStorage === 'undefined' || !value) return;
  try {
    localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
  } catch {
    // Snapshot cache is an optimization only.
  }
}

function getStorySnapshotFilename(ref) {
  const raw = typeof ref === 'string'
    ? ref
    : (ref?.key || ref?.url || '');
  const value = String(raw || '').trim();
  if (!value) return '';

  try {
    const parsed = value.startsWith('http://') || value.startsWith('https://')
      ? new URL(value)
      : null;
    const pathname = parsed ? parsed.pathname : value;
    return pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return value.split('/').filter(Boolean).pop() || '';
  }
}

function isAllowedStorySnapshotFilename(filename) {
  return /^(manifest\.json|real\.v[a-z0-9_-]+\.json|fakes-(hombre|mujer|pareja|trans)\.v[a-z0-9_-]+\.json)$/i
    .test(String(filename || ''));
}

async function fetchStorySnapshotJson(filename, { fresh = false, ttlMs = STORY_SNAPSHOT_ASSET_TTL_MS } = {}) {
  const safeFilename = getStorySnapshotFilename(filename);
  if (!isAllowedStorySnapshotFilename(safeFilename)) return null;

  const cacheKey = `${STORY_SNAPSHOT_CACHE_PREFIX}${safeFilename}`;
  if (!fresh) {
    const cached = readStorySnapshotStorage(cacheKey, ttlMs);
    if (cached) return cached;
  }

  const qs = fresh ? '?fresh=1' : '';
  const res = await fetch(`${API_BASE}/story-snapshots/${encodeURIComponent(safeFilename)}${qs}`, {
    cache: fresh ? 'reload' : 'default',
  });
  if (!res.ok) throw new Error('No se pudo cargar el snapshot de stories');

  const data = await res.json();
  writeStorySnapshotStorage(cacheKey, data);
  return data;
}

function safeParseStorySnapshotCrop(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeStorySnapshotRow(row) {
  const id = String(row?.id || row?.story_id || '').trim();
  const userId = String(row?.user_id || '').trim();
  if (!id || !userId) return null;

  return {
    id,
    user_id: userId,
    video_url: row?.video_url || '',
    caption: row?.caption || '',
    vip_only: Number(row?.vip_only || 0) === 1,
    restricted: false,
    likes: Number(row?.likes || 0),
    liked: !!row?.liked,
    comments: Number(row?.comments || 0),
    created_at: row?.created_at || '',
    username: row?.username || '',
    avatar_url: row?.avatar_url || '',
    avatar_crop: safeParseStorySnapshotCrop(row?.avatar_crop),
    role: row?.role || '',
    fake: Number(row?.fake || 0) === 1,
    last_active: row?.last_active || '',
    visits_total: Number(row?.visits_total || 0),
    rotation_position: Number(row?.rotation_position || 0),
  };
}

function uniqueStorySnapshotRows(rows = [], limit = Infinity) {
  const seenStoryIds = new Set();
  const seenUserIds = new Set();
  const output = [];
  for (const rawRow of rows || []) {
    const row = normalizeStorySnapshotRow(rawRow);
    if (!row) continue;
    if (seenStoryIds.has(row.id) || seenUserIds.has(row.user_id)) continue;
    seenStoryIds.add(row.id);
    seenUserIds.add(row.user_id);
    output.push(row);
    if (output.length >= limit) break;
  }
  return output;
}

function hashStorySnapshotSeed(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createStorySnapshotRandom(seedValue) {
  let state = Number(seedValue || 1) >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleStorySnapshotRows(rows = [], seedValue = Date.now()) {
  const output = [...rows];
  const random = createStorySnapshotRandom(seedValue);
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function parseStoryRoleArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeStoryRoleValues(value) {
  const roles = parseStoryRoleArray(value)
    .map((role) => String(role || '').trim())
    .filter((role) => STORY_SEEKING_ROLE_IDS.includes(role));
  if (roles.length === 0 || roles.length >= STORY_SEEKING_ROLE_IDS.length) return [];
  return [...new Set(roles.flatMap((role) => (role === 'pareja' ? STORY_PAIR_ROLE_IDS : [role])))];
}

function readStoredViewerSeeking() {
  const storedSeeking = getStoredUser()?.seeking;
  const storedRoles = normalizeStoryRoleValues(storedSeeking);
  if (storedRoles.length > 0) return storedRoles;

  try {
    const storedFilter = localStorage.getItem('mansion_feed_filter') || '';
    if (storedFilter && storedFilter !== 'all') return normalizeStoryRoleValues(storedFilter);
  } catch {}

  return [];
}

function getStoryRoleBucket(role) {
  return STORY_PAIR_ROLE_IDS.includes(role) ? 'pareja' : role;
}

function getViewerStoryRoleValues(viewer) {
  const explicitRoles = normalizeStoryRoleValues(viewer?.roleValues || viewer?.seeking);
  if (explicitRoles.length > 0) return explicitRoles;
  return viewer?.id ? readStoredViewerSeeking() : [];
}

function getStorySnapshotBucketsForRoleValues(roleValues = []) {
  if (!Array.isArray(roleValues) || roleValues.length === 0) return STORY_SNAPSHOT_BUCKETS;
  const buckets = [...new Set(roleValues.map(getStoryRoleBucket).filter((bucket) => STORY_SNAPSHOT_BUCKETS.includes(bucket)))];
  return buckets.length > 0 ? buckets : STORY_SNAPSHOT_BUCKETS;
}

function storyMatchesRoleValues(story, roleValues = []) {
  if (!Array.isArray(roleValues) || roleValues.length === 0) return true;
  return roleValues.includes(String(story?.role || ''));
}

function getStorySnapshotFakeWindowKey(now = Date.now()) {
  return Math.floor(now / STORY_SNAPSHOT_FAKE_ROTATION_MS);
}

function getStorySnapshotSelectionCacheKey({ viewerId = '', roleKey = 'all', version = '', fakeWindowKey = '' } = {}) {
  const safeViewer = String(viewerId || 'anon').replace(/[^a-z0-9_-]/gi, '');
  const safeRole = String(roleKey || 'all').replace(/[^a-z0-9_,.-]/gi, '');
  const safeVersion = String(version || '').replace(/[^a-z0-9_-]/gi, '');
  const safeWindow = String(fakeWindowKey || '').replace(/[^a-z0-9_-]/gi, '');
  return `${STORY_SNAPSHOT_SELECTION_CACHE_PREFIX}${safeViewer}:${safeRole}:${safeVersion}:${safeWindow}`;
}

function getStorySnapshotSelectionStateKey({ viewerId = '', roleKey = 'all', version = '' } = {}) {
  const safeViewer = String(viewerId || 'anon').replace(/[^a-z0-9_-]/gi, '');
  const safeRole = String(roleKey || 'all').replace(/[^a-z0-9_,.-]/gi, '');
  const safeVersion = String(version || '').replace(/[^a-z0-9_-]/gi, '');
  return `${STORY_SNAPSHOT_SELECTION_CACHE_PREFIX}state:${safeViewer}:${safeRole}:${safeVersion}`;
}

function getStorySnapshotSelectionTtlMs(now = Date.now()) {
  const nextWindowAt = (getStorySnapshotFakeWindowKey(now) + 1) * STORY_SNAPSHOT_FAKE_ROTATION_MS;
  return Math.max(30_000, nextWindowAt - now);
}

function selectRollingStorySnapshotFakes({ fakePool = [], fakeLimit = 0, previousStories = [], seed = Date.now() } = {}) {
  const safeLimit = Math.max(0, Number(fakeLimit) || 0);
  if (safeLimit <= 0) return [];

  const pool = uniqueStorySnapshotRows(fakePool);
  if (pool.length <= safeLimit) return pool.slice(0, safeLimit);

  const previousRows = uniqueStorySnapshotRows(
    (Array.isArray(previousStories) ? previousStories : [])
      .filter((story) => Number(story?.fake || 0) === 1)
  );
  if (previousRows.length === 0) {
    return uniqueStorySnapshotRows(shuffleStorySnapshotRows(pool, seed), safeLimit);
  }

  const poolById = new Map(pool.map((row) => [String(row.id), row]));
  const previousIds = new Set(previousRows.map((row) => String(row.id)));
  const currentPreviousRows = previousRows
    .map((row) => poolById.get(String(row.id)))
    .filter(Boolean);

  const replaceCount = Math.min(STORY_SNAPSHOT_FAKE_REFRESH_COUNT, safeLimit);
  const keepCount = Math.min(currentPreviousRows.length, Math.max(0, safeLimit - replaceCount));
  const keepRows = uniqueStorySnapshotRows(currentPreviousRows, keepCount);
  const keepIds = new Set(keepRows.map((row) => String(row.id)));

  const needed = Math.max(0, safeLimit - keepRows.length);
  const freshCandidates = pool.filter((row) => !keepIds.has(String(row.id)) && !previousIds.has(String(row.id)));
  const fallbackCandidates = pool.filter((row) => !keepIds.has(String(row.id)));
  const replacementSource = freshCandidates.length >= needed ? freshCandidates : fallbackCandidates;
  const replacements = uniqueStorySnapshotRows(shuffleStorySnapshotRows(replacementSource, seed), needed);

  return uniqueStorySnapshotRows([...keepRows, ...replacements], safeLimit);
}

function orderRollingStorySnapshotRows({ desiredRows = [], previousStories = [], seed = Date.now(), limit = STORY_SNAPSHOT_SHARED_LIMIT } = {}) {
  const safeLimit = Math.max(1, Number(limit) || STORY_SNAPSHOT_SHARED_LIMIT);
  const desired = uniqueStorySnapshotRows(desiredRows, safeLimit);
  if (desired.length === 0) return [];

  const desiredById = new Map(desired.map((row) => [String(row.id), row]));
  const previousOrdered = uniqueStorySnapshotRows(previousStories)
    .map((row) => desiredById.get(String(row.id)))
    .filter(Boolean);
  const placedIds = new Set(previousOrdered.map((row) => String(row.id)));
  const missingRows = desired.filter((row) => !placedIds.has(String(row.id)));

  return uniqueStorySnapshotRows([
    ...previousOrdered,
    ...shuffleStorySnapshotRows(missingRows, seed),
  ], safeLimit);
}

async function loadSharedStorySnapshotFeed({ viewer = null, fresh = false } = {}) {
  const viewerId = String(viewer?.id || viewer?.user_id || '').trim();
  const roleValues = getViewerStoryRoleValues(viewer);
  const roleKey = roleValues.length ? roleValues.slice().sort().join(',') : 'all';
  const fakeWindowKey = getStorySnapshotFakeWindowKey();

  const manifest = await fetchStorySnapshotJson('manifest.json', {
    fresh,
    ttlMs: STORY_SNAPSHOT_MANIFEST_TTL_MS,
  });
  if (!manifest?.real?.key && !manifest?.fakes) return null;

  const selectionCacheKey = getStorySnapshotSelectionCacheKey({
    viewerId,
    roleKey,
    version: manifest.version || '',
    fakeWindowKey,
  });
  const selectionStateKey = getStorySnapshotSelectionStateKey({
    viewerId,
    roleKey,
    version: manifest.version || '',
  });
  if (!fresh) {
    const cachedSelection = readStorySnapshotStorage(selectionCacheKey, getStorySnapshotSelectionTtlMs());
    if (Array.isArray(cachedSelection?.stories) && cachedSelection.stories.length > 0) {
      return {
        ...cachedSelection,
        snapshot: true,
        fromLocalSelectionCache: true,
      };
    }
  }
  const previousSelection = readStorySnapshotStorage(selectionStateKey, 7 * 24 * 60 * 60_000);

  const sharedLimit = STORY_SNAPSHOT_SHARED_LIMIT;
  let realRows = [];
  const realFilename = getStorySnapshotFilename(manifest?.real);
  if (realFilename) {
    const realSnapshot = await fetchStorySnapshotJson(realFilename, { ttlMs: STORY_SNAPSHOT_ASSET_TTL_MS });
    realRows = uniqueStorySnapshotRows(
      (realSnapshot?.stories || [])
        .filter((story) => storyMatchesRoleValues(story, roleValues))
        .filter((story) => !viewerId || String(story?.user_id || '') !== viewerId),
      sharedLimit
    );
  }

  const fakeLimit = Math.max(0, sharedLimit - realRows.length);
  let fakeRows = [];
  if (fakeLimit > 0) {
    const buckets = getStorySnapshotBucketsForRoleValues(roleValues);
    const fakeSnapshots = await Promise.all(buckets.map(async (bucket) => {
      const filename = getStorySnapshotFilename(manifest?.fakes?.[bucket]);
      if (!filename) return [];
      const snapshot = await fetchStorySnapshotJson(filename, { ttlMs: STORY_SNAPSHOT_ASSET_TTL_MS });
      return Array.isArray(snapshot?.stories) ? snapshot.stories : [];
    }));
    const fakePool = uniqueStorySnapshotRows(
      fakeSnapshots.flat()
        .filter((story) => storyMatchesRoleValues(story, roleValues))
        .filter((story) => !viewerId || String(story?.user_id || '') !== viewerId)
    );
    const seed = hashStorySnapshotSeed(`${viewerId || 'anon'}:${manifest.version || ''}:${roleKey}:${fakeWindowKey}:${fakePool.length}`);
    fakeRows = selectRollingStorySnapshotFakes({
      fakePool,
      fakeLimit,
      previousStories: previousSelection?.stories || [],
      seed,
    });
  }

  const mixedRows = [...realRows, ...fakeRows];
  const mixSeed = hashStorySnapshotSeed(`${viewerId || 'anon'}:${manifest.version || ''}:${roleKey}:${fakeWindowKey}:mix:${realRows.length}:${fakeRows.length}`);
  const stories = orderRollingStorySnapshotRows({
    desiredRows: mixedRows,
    previousStories: previousSelection?.stories || [],
    seed: mixSeed,
    limit: sharedLimit,
  });
  if (stories.length === 0) return null;

  const payload = {
    stories,
    snapshot: true,
    snapshotVersion: manifest.version || '',
    fakeWindowKey,
  };
  writeStorySnapshotStorage(selectionCacheKey, payload);
  writeStorySnapshotStorage(selectionStateKey, payload);
  return payload;
}

export async function getStorySnapshotFeed({ limit = STORY_SNAPSHOT_SHARED_LIMIT, viewer = null, fresh = false } = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || STORY_SNAPSHOT_SHARED_LIMIT));
  const payload = await loadSharedStorySnapshotFeed({ viewer, fresh });
  if (!payload?.stories?.length) return null;
  return {
    ...payload,
    stories: payload.stories.slice(0, safeLimit),
  };
}

export async function getStorySnapshotRail(options = {}) {
  return getStorySnapshotFeed(options);
}

export async function getStories({ page = 1, limit = 25, focusUserId = '', surface = '', fresh = false } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (focusUserId) params.set('focus_user_id', focusUserId);
  if (surface) params.set('surface', surface);
  if (fresh) params.set('fresh', '1');
  const path = `/stories?${params}`;
  if (focusUserId || fresh) {
    // Reopening the same story reuses the same focus_user_id, and rail
    // background refreshes need the latest ordering.
    // Bypass shared cache/promise reuse on these paths to avoid stale modal/rail state.
    return apiFetch(path);
  }
  const surfaceKey = surface || 'video';
  const ttlMs = ['rail', 'home', 'feed'].includes(surfaceKey) ? 5 * 60_000 : 2 * 60_000;
  return sharedGet(`stories:${surfaceKey}:${page}:${limit}:`, () => apiFetch(path), { ttlMs });
}

export async function recordStoryView(storyId, { keepalive = false } = {}) {
  const id = String(storyId || '').trim();
  if (!id) throw new Error('storyId requerido');
  const data = await apiFetch(`/stories/${id}/view`, {
    method: 'POST',
    body: '{}',
    keepalive,
  });
  invalidateStoriesCache();
  return data;
}

export function invalidateStoriesCache() {
  for (const key of sharedGetCache.keys()) {
    if (key.startsWith('stories:')) sharedGetCache.delete(key);
  }
}

function invalidateStoryFeedCache() {
  invalidateStoriesCache();
  invalidateProfilesCache();
  invalidateBootstrapCache();
  invalidateMeCache();
  invalidateOwnProfileDashboardCache();
  try {
    sessionStorage.setItem('mansion_feed_dirty', '1');
    sessionStorage.setItem('mansion_feed_force_refresh', '1');
    sessionStorage.removeItem('vf_idx');
    sessionStorage.removeItem('appBootstrap');
    localStorage.removeItem('mansion_feed');
    localStorage.removeItem('vf_stories');
    removeMatchingStorageKeys(localStorage, (key) => key.startsWith('mansion_home_stories:'));
    removeMatchingStorageKeys(localStorage, (key) => key.startsWith(STORY_SNAPSHOT_CACHE_PREFIX));
    removeMatchingStorageKeys(localStorage, (key) => key.startsWith(STORY_SNAPSHOT_SELECTION_CACHE_PREFIX));
    removeMatchingStorageKeys(sessionStorage, (key) => key.startsWith('mansion_home_stories:'));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORY_FEED_CACHE_INVALIDATED_EVENT));
  }
}

const storyLikesQueue = createMutationQueue({
  storageKey: 'mansion_pending_story_likes',
  flushDelayMs: 30000,
  flush: async (entries, { keepalive } = {}) => {
    const data = await apiFetch('/stories/likes/sync', {
      method: 'POST',
      keepalive: !!keepalive,
      body: JSON.stringify({
        updates: entries.map(({ key, value }) => ({
          story_id: key,
          liked: !!value?.liked,
        })),
      }),
    });
    if (typeof window !== 'undefined' && Array.isArray(data?.updates)) {
      window.dispatchEvent(new CustomEvent(STORY_LIKE_SYNC_EVENT, { detail: data.updates }));
    }
    return data;
  },
});

export async function uploadStory(file, { caption = '', vipOnly = false, onProgress, tokenOverride } = {}) {
  const params = new URLSearchParams();
  if (caption) params.set('caption', caption);
  if (vipOnly) params.set('vip_only', '1');
  const qs = params.toString();
  const body = await file.arrayBuffer();
  const data = await apiUpload(`/stories${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body,
    onProgress,
	 tokenOverride,
  });
  invalidateStoryFeedCache();
  mergeMeCache({
    has_active_story: true,
    active_story_id: data?.id || null,
    active_story_url: data?.video_url || null,
  });
  return data;
}

export function getPendingStoryLikes() {
  return storyLikesQueue.getPending();
}

export function enqueueStoryLike(storyId, liked) {
  storyLikesQueue.set(storyId, { liked: !!liked, updatedAt: Date.now() });
}

export function removePendingStoryLike(storyId) {
  storyLikesQueue.remove(storyId);
}

export function flushPendingStoryLikes(options) {
  return storyLikesQueue.flush(options);
}

export function subscribePendingStoryLikes(listener) {
  return storyLikesQueue.subscribe(listener);
}

export function subscribeStoryLikeSync(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail || []);
  window.addEventListener(STORY_LIKE_SYNC_EVENT, handler);
  return () => window.removeEventListener(STORY_LIKE_SYNC_EVENT, handler);
}

export async function adminDeleteStory(storyId) {
  const data = await apiFetch(`/admin/stories/${storyId}`, { method: 'DELETE' });
  invalidateStoryFeedCache();
  return data;
}

export async function adminUpdateStory(storyId, { vipOnly = false } = {}) {
  const data = await apiFetch(`/admin/stories/${storyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ vip_only: !!vipOnly }),
  });
  invalidateStoryFeedCache();
  return data;
}

export async function deleteOwnStory(storyId) {
  const data = await apiFetch(`/stories/${storyId}`, { method: 'DELETE' });
  invalidateStoryFeedCache();
  mergeMeCache({ has_active_story: false });
  return data;
}

export async function adminUploadStoryForUser(userId, file, { caption = '', vipOnly = false } = {}) {
  const params = new URLSearchParams();
  params.set('user_id', userId);
  if (caption) params.set('caption', caption);
  if (vipOnly) params.set('vip_only', '1');
  const data = await apiFetch(`/admin/upload-story?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  invalidateStoryFeedCache();
  return data;
}
