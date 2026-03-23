// ══════════════════════════════════════════════════════════
// MANSIÓN DESEO — Frontend API client
// ══════════════════════════════════════════════════════════

const API_BASE = import.meta.env.PROD
  ? 'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api'
  : '/api';
const TOKEN_KEY = 'mansion_token';
const USER_KEY = 'mansion_user';

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

// ── Auth ────────────────────────────────────────────────

export async function register({ email, password, username, role, seeking, interests, age, city, bio }) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username, role, seeking, interests, age: Number(age), city, bio }),
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
  return apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

// ── Messages ────────────────────────────────────────────

export async function getConversations() {
  return apiFetch('/messages');
}

export async function getMessages(otherUserId) {
  return apiFetch(`/messages/${otherUserId}`);
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

// ── Upload ──────────────────────────────────────────────

export async function uploadImage(file) {
  const data = await apiFetch('/upload', {
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

export async function getFavorites() {
  return apiFetch('/favorites');
}

export async function checkFavorite(targetId) {
  return apiFetch(`/favorites/check/${targetId}`);
}
