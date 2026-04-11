import { resolveMediaUrl } from './media';

const LIVEFEED_CURRENT_URL = resolveMediaUrl('https://media.mansiondeseo.com/livefeed/current.json');
const LIVEFEED_SESSION_KEY = 'mansion_livefeed_payload';

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

export async function fetchLivefeedCurrent() {
  const response = await fetch(LIVEFEED_CURRENT_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`No pude leer livefeed current (${response.status})`);
  }
  return response.json();
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
    throw new Error(`No pude leer livefeed payload (${response.status})`);
  }
  const payload = await response.json();
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
