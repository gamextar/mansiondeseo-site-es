const VIEWED_STORY_USERS_KEY_PREFIX = 'viewed_story_users:';
const PENDING_VIEWED_STORY_USERS_KEY_PREFIX = 'mansion_pending_viewed_story_users:';
const MAX_VIEWED_STORY_USERS = 300;

function normalizeUserId(userId) {
  const normalized = String(userId || '').trim();
  return normalized || '';
}

function normalizeIds(values) {
  const raw = Array.isArray(values) ? values : [];
  return raw
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function readJsonArray(storage, key) {
  if (!storage || !key) return [];
  try {
    return normalizeIds(JSON.parse(storage.getItem(key) || '[]'));
  } catch {
    return [];
  }
}

function writeJsonArray(storage, key, values) {
  if (!storage || !key) return;
  const normalized = normalizeIds(values);
  storage.setItem(key, JSON.stringify(normalized));
}

export function getViewedStoryUsersKey(userId) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId ? `${VIEWED_STORY_USERS_KEY_PREFIX}${normalizedUserId}` : '';
}

export function getPendingViewedStoryUsersKey(userId) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId ? `${PENDING_VIEWED_STORY_USERS_KEY_PREFIX}${normalizedUserId}` : '';
}

export function getViewedStoryUsers(userId) {
  if (typeof localStorage === 'undefined') return [];
  return readJsonArray(localStorage, getViewedStoryUsersKey(userId));
}

export function setViewedStoryUsers(userId, values) {
  if (typeof localStorage === 'undefined') return;
  const normalized = normalizeIds(values);
  if (normalized.length > MAX_VIEWED_STORY_USERS) {
    normalized.splice(0, normalized.length - MAX_VIEWED_STORY_USERS);
  }
  writeJsonArray(localStorage, getViewedStoryUsersKey(userId), normalized);
}

export function markViewedStoryUser(userId, storyUserId) {
  const normalizedStoryUserId = normalizeUserId(storyUserId);
  if (!normalizedStoryUserId) return false;
  const current = getViewedStoryUsers(userId);
  if (current.includes(normalizedStoryUserId)) return false;
  current.push(normalizedStoryUserId);
  setViewedStoryUsers(userId, current);
  return true;
}

export function removeViewedStoryUser(userId, storyUserId) {
  const normalizedStoryUserId = normalizeUserId(storyUserId);
  if (!normalizedStoryUserId || typeof localStorage === 'undefined') return false;
  const current = getViewedStoryUsers(userId);
  const filtered = current.filter((value) => value !== normalizedStoryUserId);
  if (filtered.length === current.length) return false;
  setViewedStoryUsers(userId, filtered);
  return true;
}

export function getPendingViewedStoryUsers(userId) {
  if (typeof sessionStorage === 'undefined') return [];
  return readJsonArray(sessionStorage, getPendingViewedStoryUsersKey(userId));
}

export function queuePendingViewedStoryUser(userId, storyUserId) {
  if (typeof sessionStorage === 'undefined') return false;
  const normalizedStoryUserId = normalizeUserId(storyUserId);
  if (!normalizedStoryUserId) return false;
  const current = getPendingViewedStoryUsers(userId);
  if (current.includes(normalizedStoryUserId)) return false;
  current.push(normalizedStoryUserId);
  if (current.length > MAX_VIEWED_STORY_USERS) {
    current.splice(0, current.length - MAX_VIEWED_STORY_USERS);
  }
  writeJsonArray(sessionStorage, getPendingViewedStoryUsersKey(userId), current);
  return true;
}

export function clearPendingViewedStoryUsers(userId) {
  if (typeof sessionStorage === 'undefined') return;
  const key = getPendingViewedStoryUsersKey(userId);
  if (!key) return;
  sessionStorage.removeItem(key);
}

export function applyPendingViewedStoryUsers(userId) {
  const pending = getPendingViewedStoryUsers(userId);
  clearPendingViewedStoryUsers(userId);
  if (pending.length === 0) return false;

  const current = new Set(getViewedStoryUsers(userId));
  let changed = false;
  for (const storyUserId of pending) {
    if (current.has(storyUserId)) continue;
    current.add(storyUserId);
    changed = true;
  }
  if (!changed) return false;
  setViewedStoryUsers(userId, [...current]);
  return true;
}

