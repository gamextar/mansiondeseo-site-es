import { resolveMediaUrl } from './media';
import { recordLivefeedCurrentDebug, recordLivefeedDebugError, recordLivefeedPayloadDebug } from './livefeedDebug';

const LIVEFEED_CURRENT_URL = resolveMediaUrl('https://media.mansiondeseo.com/livefeed/current.json');
const LIVEFEED_SESSION_KEY = 'mansion_livefeed_payload';
const LIVEFEED_CURRENT_SESSION_KEY = 'mansion_livefeed_current';
const DEFAULT_CURRENT_MIN_INTERVAL_MS = 15_000;

let currentRequestPromise = null;
let currentSnapshotCache = null;
let currentSnapshotFetchedAt = 0;

function normalizeBucketName(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'mujer') return 'mujer';
  if (normalized === 'hombre') return 'hombre';
  if (normalized === 'trans') return 'trans';
  if (normalized === 'pareja' || normalized === 'pareja_hombres' || normalized === 'pareja_mujeres') return 'pareja';
  return '';
}

export function getLivefeedBucketsForSeeking(seeking = []) {
  const values = Array.isArray(seeking) ? seeking : [seeking];
  const buckets = [];
  for (const value of values) {
    const bucket = normalizeBucketName(value);
    if (!bucket || buckets.includes(bucket)) continue;
    buckets.push(bucket);
  }
  return buckets.length > 0 ? buckets : ['mujer', 'hombre', 'pareja', 'trans'];
}

function readCachedCurrentSnapshot() {
  if (currentSnapshotCache && currentSnapshotFetchedAt > 0) {
    return currentSnapshotCache;
  }
  try {
    const raw = sessionStorage.getItem(LIVEFEED_CURRENT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    currentSnapshotCache = parsed;
    currentSnapshotFetchedAt = Date.now();
    return parsed;
  } catch {
    return null;
  }
}

function storeCurrentSnapshot(snapshot, source = 'network') {
  currentSnapshotCache = snapshot;
  currentSnapshotFetchedAt = Date.now();
  try {
    sessionStorage.setItem(LIVEFEED_CURRENT_SESSION_KEY, JSON.stringify(snapshot));
  } catch {}
  recordLivefeedCurrentDebug(source, snapshot);
}

function interleaveBuckets(storiesByBucket, buckets, limit = 15) {
  const queues = buckets.map((bucket) => Array.isArray(storiesByBucket?.[bucket]) ? [...storiesByBucket[bucket]] : []);
  const output = [];

  while (output.length < limit) {
    let pushedAny = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (!next) continue;
      output.push(next);
      pushedAny = true;
      if (output.length >= limit) break;
    }
    if (!pushedAny) break;
  }

  return output;
}

export async function fetchLivefeedCurrent({ minIntervalMs = DEFAULT_CURRENT_MIN_INTERVAL_MS } = {}) {
  const now = Date.now();
  const cached = readCachedCurrentSnapshot();
  if (cached && now - currentSnapshotFetchedAt < Math.max(0, Number(minIntervalMs) || 0)) {
    recordLivefeedCurrentDebug('memory', cached);
    return cached;
  }

  if (currentRequestPromise) {
    recordLivefeedCurrentDebug('deduped', currentSnapshotCache || cached || null);
    return currentRequestPromise;
  }

  currentRequestPromise = fetch(LIVEFEED_CURRENT_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`No pude leer livefeed current (${response.status})`);
      }
      const snapshot = await response.json();
      storeCurrentSnapshot(snapshot, 'network');
      return snapshot;
    })
    .catch((error) => {
      recordLivefeedDebugError(error);
      throw error;
    })
    .finally(() => {
      currentRequestPromise = null;
    });

  return currentRequestPromise;
}

export async function fetchLivefeedPayload(current) {
  const payloadUrl = current?.versionUrl
    ? resolveMediaUrl(current.versionUrl)
    : current?.versionKey
      ? resolveMediaUrl(`https://media.mansiondeseo.com/${current.versionKey}`)
      : '';

  if (!payloadUrl) {
    throw new Error('Livefeed current sin versionUrl/versionKey');
  }

  const response = await fetch(payloadUrl, { cache: 'force-cache' });
  if (!response.ok) {
    recordLivefeedDebugError(new Error(`No pude leer livefeed payload (${response.status})`));
    throw new Error(`No pude leer livefeed payload (${response.status})`);
  }
  const payload = await response.json();
  recordLivefeedPayloadDebug(payload, payloadUrl);
  try {
    sessionStorage.setItem(LIVEFEED_SESSION_KEY, JSON.stringify(payload));
  } catch {}
  return payload;
}

export function selectLivefeedStories(payload, seeking, limit = 15, { excludeUserId = '' } = {}) {
  const buckets = getLivefeedBucketsForSeeking(seeking);
  const stories = interleaveBuckets(payload?.stories || {}, buckets, limit);
  return stories.map((story) => ({
    id: story?.user_id || story?.id || '',
    name: story?.name || story?.username || '',
    username: story?.username || story?.name || '',
    role: story?.role || '',
    avatar_url: resolveMediaUrl(story?.avatar_url || ''),
    avatar_crop: story?.avatar_crop || null,
    created_at: story?.created_at || '',
    story_id: story?.story_id || '',
    video_url: resolveMediaUrl(story?.video_url || ''),
    caption: story?.caption || '',
    likes: Number(story?.likes || 0),
    comments: Number(story?.comments || 0),
    has_active_story: true,
  })).filter((story) => story.id && String(story.id) !== String(excludeUserId || ''));
}

export function getCachedLivefeedPayload() {
  try {
    const raw = sessionStorage.getItem(LIVEFEED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
