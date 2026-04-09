// ══════════════════════════════════════════════════════════
// MANSIÓN DESEO — Frontend API client
// ══════════════════════════════════════════════════════════

import { createMutationQueue } from './mutationQueue';
import { recordD1WriteEstimate } from './d1Debug';

const LEGACY_PROD_API_BASE = 'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api';

function resolveApiBase() {
  const explicitBase = String(import.meta.env.VITE_API_BASE || '').trim();
  if (explicitBase) return explicitBase.replace(/\/$/, '');
  if (!import.meta.env.PROD) return '/api';
  if (typeof window === 'undefined') return LEGACY_PROD_API_BASE;
  if (window.location.hostname.endsWith('.pages.dev')) return LEGACY_PROD_API_BASE;
  return '/api';
}

const API_BASE = resolveApiBase();
const TOKEN_KEY = 'mansion_token';
const USER_KEY = 'mansion_user';
const AUTH_ME_CACHE_KEY = 'authMe';
const AUTH_ME_CACHE_TTL_MS = 60 * 60_000;
const OWN_PROFILE_DASHBOARD_CACHE_KEY = 'ownProfileDashboard';
const OWN_PROFILE_DASHBOARD_TTL_MS = 60 * 60_000;
const API_DEBUG_FLAG_KEY = 'mansion_debug_api_requests';
const API_DEBUG_UPDATE_EVENT = 'mansion-api-debug-update';
const STORY_LIKE_SYNC_EVENT = 'mansion-story-like-sync';
const sharedGetCache = new Map();
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
    record({ method, path, status, durationMs, ok }) {
      if (!state.enabled) return;
      const key = `${method} ${path}`;
      const bucket = state.counts[key] || {
        count: 0,
        ok: 0,
        errors: 0,
        totalMs: 0,
        lastStatus: null,
      };

      bucket.count += 1;
      bucket.totalMs += durationMs;
      bucket.lastStatus = status;
      if (ok) bucket.ok += 1;
      else bucket.errors += 1;
      state.counts[key] = bucket;

      const sessionBucket = state.sessionCounts[key] || {
        count: 0,
        ok: 0,
        errors: 0,
        totalMs: 0,
        lastStatus: null,
      };

      sessionBucket.count += 1;
      sessionBucket.totalMs += durationMs;
      sessionBucket.lastStatus = status;
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
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  invalidateBootstrapCache();
  invalidateUnreadCountCache();
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function clearAuth() {
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

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData/ArrayBuffer (upload)
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  debug?.record({
    method,
    path,
    status: res.status,
    durationMs: Math.round(finishedAt - startedAt),
    ok: res.ok,
  });

  // Handle 401 — token expired
  if (res.status === 401 && token) {
    clearAuth();
    window.location.href = '/bienvenida';
    throw new Error('Sesión expirada');
  }

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || 'Error del servidor');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
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
        window.location.href = '/bienvenida';
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

export async function getMe() {
  const cached = sessionCache.get(AUTH_ME_CACHE_KEY, AUTH_ME_CACHE_TTL_MS);
  if (cached?.user) {
    setStoredUser(cached.user);
    return Promise.resolve(cached);
  }

  return sharedGet('me', async () => {
    const data = await apiFetch('/auth/me');
    cacheMeResponse(data);
    return data;
  }, { ttlMs: AUTH_ME_CACHE_TTL_MS });
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

export async function getProfiles({ filter, q, fresh = false, cursor } = {}) {
  const params = new URLSearchParams();
  if (filter && filter !== 'all') params.set('filter', filter);
  if (q) params.set('q', q);
  if (fresh) params.set('fresh', '1');
  if (cursor !== undefined && cursor !== null && cursor !== '') params.set('cursor', String(cursor));
  const qs = params.toString();
  // Search queries bypass cache (user expects fresh results), browse is cached longer.
  if (q || fresh || cursor) return apiFetch(`/profiles${qs ? `?${qs}` : ''}`);
  return sharedGet(`profiles:${filter || 'all'}`, () => apiFetch(`/profiles${qs ? `?${qs}` : ''}`), { ttlMs: 5 * 60_000 });
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
  try {
    sessionStorage.setItem('mansion_feed_dirty', '1');
    sessionStorage.setItem('mansion_feed_force_refresh', '1');
    sessionStorage.removeItem('mansion_feed');
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
    invalidateMessageHistoryCache(otherUserId);
    invalidateConversationsCache();
    invalidateUnreadCountCache();
    return data;
  });
}

export async function sendMessage(receiverId, content) {
  return apiFetch('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId, content }),
  }).then((data) => {
    invalidateMessageHistoryCache(receiverId);
    invalidateConversationsCache();
    invalidateUnreadCountCache();
    return data;
  });
}

export async function getMessageLimit() {
  return sharedGet('messageLimit', () => apiFetch('/messages/limit'), { ttlMs: 2 * 60_000 });
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

export async function uploadImage(file, { purpose = 'asset' } = {}) {
  const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
  const data = await apiUpload(`/upload${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  if (purpose === 'avatar') {
    mergeMeCache({ avatar_url: data?.avatar_url || data?.url || '', avatar_crop: null });
  } else if (purpose === 'gallery' && Array.isArray(data?.photos)) {
    mergeMeCache({ photos: data.photos, avatar_url: data?.avatar_url });
  }
  return data;
}

export async function deletePhoto(url) {
  return apiFetch('/photos', {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  }).then((data) => {
    if (Array.isArray(data?.photos)) {
      mergeMeCache({ photos: data.photos, avatar_url: data?.avatar_url });
    }
    return data;
  });
}

// ── Settings ────────────────────────────────────────────

export async function getSettings() {
  return apiFetch('/settings');
}

export async function getPublicSettings() {
  const sessionKey = 'publicSettings';
  const cached = sessionCache.get(sessionKey, 30 * 60_000);
  if (cached) return Promise.resolve(cached);

  return sharedGet('publicSettings', () => apiFetch('/settings/public').then((data) => {
    sessionCache.set(sessionKey, data);
    return data;
  }), { ttlMs: 5 * 60_000 });
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

export async function updateSettings(fields) {
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(fields),
  }).then((data) => {
    sharedGetCache.delete('publicSettings');
    sessionCache.delete('publicSettings');
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
  return sharedGet(
    `topVisited:${safeFilter}:${safeLimit}`,
    () => apiFetch(`/rankings/top-visited?limit=${safeLimit}&filter=${encodeURIComponent(safeFilter)}`),
    { ttlMs: 10 * 60_000 }
  );
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

export async function createPayment({ plan_id, amount }) {
  return apiFetch('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ plan_id, amount }),
  });
}

export async function confirmPayment(payment_id, { gateway, external_reference } = {}) {
  return apiFetch('/payment/confirm', {
    method: 'POST',
    body: JSON.stringify({ payment_id, gateway, external_reference }),
  });
}

// ── Admin ─────────────────────────────────────────────

export async function adminRemoveAllVip() {
  return apiFetch('/admin/remove-all-vip', { method: 'POST', body: '{}' });
}

export async function adminResetAllCoins() {
  return apiFetch('/admin/reset-all-coins', { method: 'POST', body: '{}' });
}

// ── Admin: Users ────────────────────────────────────────

export async function adminGetUsers({ page = 1, limit = 20, q = '', fake = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  if (fake === '1' || fake === '0') params.set('fake', fake);
  return apiFetch(`/admin/users?${params}`);
}

export async function adminGetUserIds({ q = '', fake = '' } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (fake === '1' || fake === '0') params.set('fake', fake);
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

export async function adminDeleteUser(userId) {
  return apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
}

export async function adminBulkDeleteUsers(userIds) {
  return apiFetch('/admin/users/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

// ── Stories ─────────────────────────────────────────────

export async function getStories({ page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  return sharedGet(`stories:${page}:${limit}`, () => apiFetch(`/stories?${params}`), { ttlMs: 2 * 60_000 });
}

export function invalidateStoriesCache() {
  for (const key of sharedGetCache.keys()) {
    if (key.startsWith('stories:')) sharedGetCache.delete(key);
  }
}

function invalidateStoryFeedCache() {
  invalidateStoriesCache();
  try {
    sessionStorage.removeItem('vf_stories');
    sessionStorage.removeItem('vf_idx');
  } catch {}
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

export async function uploadStory(file, { caption = '', onProgress, tokenOverride } = {}) {
  const params = new URLSearchParams();
  if (caption) params.set('caption', caption);
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
  mergeMeCache({ has_active_story: true });
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

export async function deleteOwnStory(storyId) {
  const data = await apiFetch(`/stories/${storyId}`, { method: 'DELETE' });
  invalidateStoryFeedCache();
  mergeMeCache({ has_active_story: false });
  return data;
}

export async function adminUploadStoryForUser(userId, file, { caption = '' } = {}) {
  const params = new URLSearchParams();
  params.set('user_id', userId);
  if (caption) params.set('caption', caption);
  const data = await apiFetch(`/admin/upload-story?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  invalidateStoryFeedCache();
  return data;
}
