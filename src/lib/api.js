// ══════════════════════════════════════════════════════════
// MANSIÓN DESEO — Frontend API client
// ══════════════════════════════════════════════════════════

const API_BASE = import.meta.env.PROD
  ? 'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api'
  : '/api';
const TOKEN_KEY = 'mansion_token';
const USER_KEY = 'mansion_user';
const sharedGetCache = new Map();

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
}

// ── Fetch wrapper ───────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

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

export async function register({ email, password, username, role, seeking, interests, age, city, bio, country }) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username, role, seeking, interests, age: Number(age), city, bio, country }),
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

export async function requestMagicLink(email) {
  return apiFetch('/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getMe() {
  const data = await apiFetch('/auth/me');
  setStoredUser(data.user);
  return data;
}

export async function getAppBootstrap() {
  const data = await apiFetch('/app/bootstrap');
  if (data?.user) {
    setStoredUser(data.user);
  }
  return data;
}

export async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  }
  clearAuth();
}

// ── Profiles ────────────────────────────────────────────

export async function getProfiles({ filter, q } = {}) {
  const params = new URLSearchParams();
  if (filter && filter !== 'all') params.set('filter', filter);
  if (q) params.set('q', q);
  const qs = params.toString();
  return apiFetch(`/profiles${qs ? `?${qs}` : ''}`);
}

export async function getProfile(id) {
  return apiFetch(`/profiles/${id}`);
}

export async function updateProfile(fields) {
  const data = await apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  if (data?.user) {
    setStoredUser(data.user);
  }
  return data;
}

// ── Messages ────────────────────────────────────────────

export async function getConversations() {
  return apiFetch('/messages');
}

export async function getMessages(otherUserId, { before, limit } = {}) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return apiFetch(`/messages/${otherUserId}${qs ? `?${qs}` : ''}`);
}

export async function deleteConversation(otherUserId) {
  return apiFetch(`/messages/${otherUserId}`, {
    method: 'DELETE',
  });
}

export async function sendMessage(receiverId, content) {
  return apiFetch('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId, content }),
  });
}

export async function getMessageLimit() {
  return apiFetch('/messages/limit');
}

export async function getUnreadCount() {
  return apiFetch('/unread-count');
}

export async function adminChatCleanup() {
  return apiFetch('/admin/chat-cleanup', { method: 'POST' });
}

// ── Upload ──────────────────────────────────────────────

export async function uploadImage(file, { purpose = 'asset' } = {}) {
  const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
  const data = await apiFetch(`/upload${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  return data;
}

export async function deletePhoto(url) {
  return apiFetch('/photos', {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  });
}

// ── Settings ────────────────────────────────────────────

export async function getSettings() {
  return apiFetch('/settings');
}

export async function getPublicSettings() {
  return apiFetch('/settings/public');
}

export async function detectCountry() {
  return apiFetch('/detect-country');
}

export async function updateSettings(fields) {
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

// ── Favorites ───────────────────────────────────────────

export async function toggleFavorite(targetId) {
  return apiFetch(`/favorites/${targetId}`, { method: 'POST' });
}

export async function toggleStoryLike(storyId) {
  return apiFetch(`/stories/${storyId}/like`, { method: 'POST' });
}

export async function getFavorites() {
  return apiFetch('/favorites');
}

export async function checkFavorite(targetId) {
  return apiFetch(`/favorites/check/${targetId}`);
}

// ── Visits ──────────────────────────────────────────────

export async function getVisits() {
  return sharedGet('visits', () => apiFetch('/visits'), { ttlMs: 30_000 });
}

// ── Gifts & Coins ───────────────────────────────────────

export async function getGiftCatalog() {
  return apiFetch('/gifts/catalog');
}

export async function sendGift(receiverId, giftId, message = '') {
  return apiFetch('/gifts/send', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId, gift_id: giftId, message }),
  });
}

export async function getReceivedGifts(userId) {
  return apiFetch(`/gifts/received/${userId}`);
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

export async function adminGetUsers({ page = 1, limit = 20, q = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  return apiFetch(`/admin/users?${params}`);
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

// ── Stories ─────────────────────────────────────────────

export async function getStories({ page = 1, limit = 100 } = {}) {
  const params = new URLSearchParams({ page, limit });
  return apiFetch(`/stories?${params}`);
}

function invalidateStoryFeedCache() {
  try {
    sessionStorage.removeItem('vf_stories');
    sessionStorage.removeItem('vf_idx');
  } catch {}
}

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
  return data;
}

export async function adminDeleteStory(storyId) {
  const data = await apiFetch(`/admin/stories/${storyId}`, { method: 'DELETE' });
  invalidateStoryFeedCache();
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
