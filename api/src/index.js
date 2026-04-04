// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — Cloudflare Worker API
// ES Modules syntax
// ═══════════════════════════════════════════════════════

export { ChatRoom } from './chat-room.js';
export { UserNotification } from './user-notification.js';

// ── In-memory edge cache (persists across requests in same isolate) ──
const _cache = new Map();
function cached(key, ttlMs, fetcher) {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.exp) return Promise.resolve(entry.val);
  return fetcher().then(val => { _cache.set(key, { val, exp: Date.now() + ttlMs }); return val; });
}

const _routeMetrics = new Map();
let _metricsWindowStartedAt = Date.now();
let _metricsRequestCount = 0;
let _hiddenConversationsReady = null;
let _messagingIndexesReady = null;
let _conversationStateReady = null;
let _messageConversationIdReady = null;
let _userBrowseIndexesReady = null;

// ── Helpers ─────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID();
}

function buildConversationId(userA, userB) {
  return [String(userA), String(userB)].sort().join(':');
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function getLegacyMediaBases() {
  return [
    'https://pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev',
    'https://videos.unicoapps.com',
    'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api/images',
  ];
}

function extractMediaKey(url, env) {
  if (!url || typeof url !== 'string') return '';

  const r2Base = String(env?.R2_PUBLIC_URL || '').replace(/\/$/, '');
  const normalizedUrl = url.trim();
  const bases = [r2Base, ...getLegacyMediaBases()]
    .filter(Boolean)
    .map((base) => String(base).replace(/\/$/, ''));

  for (const base of bases) {
    if (normalizedUrl.startsWith(`${base}/`)) {
      return normalizedUrl.slice(base.length + 1);
    }
    if (normalizedUrl === base) {
      return '';
    }
  }

  if (normalizedUrl.includes('/api/images/')) {
    return normalizedUrl.split('/api/images/')[1] || '';
  }

  return normalizedUrl.replace(/^https?:\/\/[^/]+\//, '');
}

function normalizeStoryVideoUrl(url, env) {
  const key = extractMediaKey(url, env);
  if (!key) return url;
  const r2Base = String(env?.R2_PUBLIC_URL || '').replace(/\/$/, '');
  return r2Base ? `${r2Base}/${key}` : url;
}

async function ensureHiddenConversationsTable(env) {
  if (!_hiddenConversationsReady) {
    _hiddenConversationsReady = Promise.all([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS hidden_conversations (
          user_id TEXT NOT NULL REFERENCES users(id),
          partner_id TEXT NOT NULL REFERENCES users(id),
          hidden_before TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, partner_id)
        )
      `).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_hidden_conversations_user ON hidden_conversations(user_id, hidden_before)'
      ).run(),
    ]).catch((err) => {
      _hiddenConversationsReady = null;
      throw err;
    });
  }

  return _hiddenConversationsReady;
}

async function ensureMessagingIndexes(env) {
  if (!_messagingIndexesReady) {
    _messagingIndexesReady = Promise.all([
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, is_read, created_at)'
      ).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_unread ON messages(receiver_id, sender_id, is_read, created_at)'
      ).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_created ON messages(receiver_id, sender_id, created_at)'
      ).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)'
      ).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_messages_conversation_receiver_unread ON messages(conversation_id, receiver_id, is_read, created_at)'
      ).run(),
    ]).catch((err) => {
      _messagingIndexesReady = null;
      throw err;
    });
  }

  return _messagingIndexesReady;
}

async function ensureMessageConversationIdColumn(env) {
  if (!_messageConversationIdReady) {
    _messageConversationIdReady = (async () => {
      try {
        await env.DB.prepare('ALTER TABLE messages ADD COLUMN conversation_id TEXT').run();
      } catch (err) {
        const message = String(err?.message || '').toLowerCase();
        if (!message.includes('duplicate column name')) {
          throw err;
        }
      }
      await ensureMessagingIndexes(env);
    })().catch((err) => {
      _messageConversationIdReady = null;
      throw err;
    });
  }

  return _messageConversationIdReady;
}

async function ensureConversationStateTables(env) {
  if (!_conversationStateReady) {
    _conversationStateReady = Promise.all([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS conversation_state (
          user_id TEXT NOT NULL REFERENCES users(id),
          partner_id TEXT NOT NULL REFERENCES users(id),
          last_message TEXT NOT NULL DEFAULT '',
          last_message_at TEXT NOT NULL,
          unread_count INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, partner_id)
        )
      `).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_conversation_state_user_last ON conversation_state(user_id, last_message_at DESC)'
      ).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_conversation_state_user_unread ON conversation_state(user_id, unread_count, last_message_at DESC)'
      ).run(),
    ]).catch((err) => {
      _conversationStateReady = null;
      throw err;
    });
  }

  return _conversationStateReady;
}

async function ensureUserBrowseIndexes(env) {
  if (!_userBrowseIndexesReady) {
    _userBrowseIndexesReady = Promise.all([
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_users_status_country_role_active ON users(status, country, role, last_active DESC)'
      ).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_users_status_country_active ON users(status, country, last_active DESC)'
      ).run(),
      env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_users_status_active ON users(status, last_active DESC)'
      ).run(),
    ]).catch((err) => {
      _userBrowseIndexesReady = null;
      throw err;
    });
  }

  return _userBrowseIndexesReady;
}

async function setConversationState(env, userId, partnerId, { lastMessage, lastMessageAt, unreadCount }) {
  await env.DB.prepare(
    `INSERT INTO conversation_state (user_id, partner_id, last_message, last_message_at, unread_count, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, partner_id) DO UPDATE SET
       last_message = excluded.last_message,
       last_message_at = excluded.last_message_at,
       unread_count = excluded.unread_count,
       updated_at = excluded.updated_at`
  ).bind(userId, partnerId, lastMessage, lastMessageAt, unreadCount).run();
}

async function incrementConversationStateUnread(env, userId, partnerId, { lastMessage, lastMessageAt, unreadDelta = 1 }) {
  await env.DB.prepare(
    `INSERT INTO conversation_state (user_id, partner_id, last_message, last_message_at, unread_count, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, partner_id) DO UPDATE SET
       last_message = excluded.last_message,
       last_message_at = excluded.last_message_at,
       unread_count = MAX(0, conversation_state.unread_count + ?),
       updated_at = excluded.updated_at`
  ).bind(userId, partnerId, lastMessage, lastMessageAt, Math.max(0, unreadDelta), unreadDelta).run();
}

async function clearConversationStateUnread(env, userId, partnerId) {
  await env.DB.prepare(
    'UPDATE conversation_state SET unread_count = 0, updated_at = datetime(\'now\') WHERE user_id = ? AND partner_id = ?'
  ).bind(userId, partnerId).run();
}

async function deleteConversationState(env, userId, partnerId) {
  await env.DB.prepare(
    'DELETE FROM conversation_state WHERE user_id = ? AND partner_id = ?'
  ).bind(userId, partnerId).run();
}

async function syncConversationStateForMessage(env, senderId, receiverId, msg) {
  const lastMessage = (msg.content || '').slice(0, 50);
  await Promise.all([
    setConversationState(env, senderId, receiverId, {
      lastMessage,
      lastMessageAt: msg.created_at,
      unreadCount: 0,
    }),
    incrementConversationStateUnread(env, receiverId, senderId, {
      lastMessage,
      lastMessageAt: msg.created_at,
      unreadDelta: 1,
    }),
  ]);
}

async function rebuildConversationStateForPair(env, userA, userB) {
  await ensureMessageConversationIdColumn(env);
  const conversationId = buildConversationId(userA, userB);

  async function rebuildForUser(userId, partnerId) {
    const hiddenRow = await env.DB.prepare(
      'SELECT hidden_before FROM hidden_conversations WHERE user_id = ? AND partner_id = ?'
    ).bind(userId, partnerId).first();
    const hiddenBefore = hiddenRow?.hidden_before || null;

    const latestMessage = await env.DB.prepare(`
      SELECT content, created_at
      FROM messages
      WHERE conversation_id = ?
        AND (? IS NULL OR created_at > ?)
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(conversationId, hiddenBefore, hiddenBefore).first();

    if (!latestMessage) {
      await deleteConversationState(env, userId, partnerId);
      return;
    }

    const unreadRow = await env.DB.prepare(`
      SELECT COUNT(*) as unread
      FROM messages
      WHERE conversation_id = ?
        AND receiver_id = ?
        AND is_read = 0
        AND (? IS NULL OR created_at > ?)
    `).bind(conversationId, userId, hiddenBefore, hiddenBefore).first();

    await setConversationState(env, userId, partnerId, {
      lastMessage: (latestMessage.content || '').slice(0, 50),
      lastMessageAt: latestMessage.created_at,
      unreadCount: Number(unreadRow?.unread || 0),
    });
  }

  await Promise.all([
    rebuildForUser(userA, userB),
    rebuildForUser(userB, userA),
  ]);
}

function getProfileVisitDedupeWindowMinutes(env) {
  const raw = Number(env?.PROFILE_VISIT_DEDUPE_MINUTES || 30);
  if (!Number.isFinite(raw) || raw < 1) return 30;
  return Math.floor(raw);
}

function normalizeGalleryPhotos(rawPhotos, avatarUrl = '') {
  const photos = Array.isArray(rawPhotos) ? rawPhotos : [];
  const seen = new Set();
  const gallery = [];

  for (const url of photos) {
    if (typeof url !== 'string' || !url || url === avatarUrl || seen.has(url)) continue;
    seen.add(url);
    gallery.push(url);
  }

  return gallery;
}

function buildDisplayPhotos(avatarUrl = '', rawPhotos = []) {
  const gallery = normalizeGalleryPhotos(rawPhotos, avatarUrl);
  return avatarUrl ? [avatarUrl, ...gallery] : gallery;
}

function isDebugLoggingEnabled(env) {
  return env?.DEBUG_LOGS === '1' || env?.ENVIRONMENT !== 'production';
}

function debugLog(env, ...args) {
  if (isDebugLoggingEnabled(env)) {
    console.log(...args);
  }
}

function isMetricsLoggingEnabled(env) {
  return env?.METRICS_LOGS === '1';
}

function normalizeMetricRoute(path) {
  if (/^\/api\/chat\/ws\/[a-f0-9-]+$/.test(path)) return '/api/chat/ws/:chatId';
  if (/^\/api\/profiles\/[a-f0-9-]+$/.test(path)) return '/api/profiles/:id';
  if (/^\/api\/messages\/[a-f0-9-]+$/.test(path)) return '/api/messages/:userId';
  if (/^\/api\/favorites\/check\/[a-f0-9-]+$/.test(path)) return '/api/favorites/check/:id';
  if (/^\/api\/favorites\/[a-f0-9-]+$/.test(path)) return '/api/favorites/:id';
  if (/^\/api\/gifts\/received\/[a-f0-9-]+$/.test(path)) return '/api/gifts/received/:userId';
  if (/^\/api\/admin\/gifts\/[a-zA-Z0-9-]+$/.test(path)) return '/api/admin/gifts/:id';
  if (/^\/api\/admin\/users\/[a-f0-9-]+$/.test(path)) return '/api/admin/users/:id';
  return path;
}

function recordRouteMetric(env, request, response, durationMs) {
  if (!isMetricsLoggingEnabled(env)) return;

  const route = normalizeMetricRoute(new URL(request.url).pathname);
  const key = `${request.method} ${route}`;
  const status = String(response.status);

  const entry = _routeMetrics.get(key) || {
    route,
    method: request.method,
    count: 0,
    totalMs: 0,
    maxMs: 0,
    statusCounts: {},
  };

  entry.count += 1;
  entry.totalMs += durationMs;
  entry.maxMs = Math.max(entry.maxMs, durationMs);
  entry.statusCounts[status] = (entry.statusCounts[status] || 0) + 1;
  _routeMetrics.set(key, entry);
  _metricsRequestCount += 1;

  const flushEveryMs = Number(env.METRICS_FLUSH_MS || 60000);
  const flushEveryRequests = Number(env.METRICS_FLUSH_REQUESTS || 50);
  const now = Date.now();
  const windowStart = Number.isFinite(_metricsWindowStartedAt) && _metricsWindowStartedAt > 0 && _metricsWindowStartedAt <= now
    ? _metricsWindowStartedAt
    : now;

  if (_metricsRequestCount < flushEveryRequests && now - windowStart < flushEveryMs) {
    return;
  }

  const routes = [..._routeMetrics.values()]
    .sort((a, b) => b.count - a.count)
    .map((item) => ({
      method: item.method,
      route: item.route,
      count: item.count,
      avgMs: Math.round(item.totalMs / item.count),
      maxMs: Math.round(item.maxMs),
      statusCounts: item.statusCounts,
    }));

  console.log('[route-metrics]', JSON.stringify({
    windowMs: now - windowStart,
    requestCount: _metricsRequestCount,
    routes,
  }));

  _routeMetrics.clear();
  _metricsRequestCount = 0;
  _metricsWindowStartedAt = now;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// ── Password hashing (using Web Crypto) ─────────────────

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const computed = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
}

// ── JWT (HMAC-SHA256) ───────────────────────────────────

function base64UrlEncode(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded);
}

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + 86400 * 7 }; // 7 days
  const unsigned = `${base64UrlEncode(header)}.${base64UrlEncode(claims)}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(unsigned));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${unsigned}.${sigStr}`;
}

async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    const unsigned = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(unsigned));
    if (!valid) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Turnstile validation ────────────────────────────────

async function validateTurnstile(token, secret, ip) {
  if (!secret) return true; // Skip in dev if not configured
  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  return data.success === true;
}

// ── Auth middleware ──────────────────────────────────────

// In-memory caches to reduce D1 queries per request
const _lastActiveCache = new Map(); // userId → timestamp of last D1 UPDATE
const _accountStatusCache = new Map(); // userId → { status, exp }
const LAST_ACTIVE_DEBOUNCE_MS = 5 * 60_000; // only UPDATE last_active every 5 min
const ACCOUNT_STATUS_TTL_MS = 5 * 60_000; // cache account_status for 5 min

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  const fallbackToken = request.headers.get('X-Session-Token') || '';
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : fallbackToken.trim();
  if (!token) return null;
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;

  const userId = payload.sub;
  const now = Date.now();

  // Debounce last_active UPDATE — only write to D1 every 5 min per user
  const lastUpdate = _lastActiveCache.get(userId) || 0;
  if (now - lastUpdate > LAST_ACTIVE_DEBOUNCE_MS) {
    _lastActiveCache.set(userId, now);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    env.DB.prepare("UPDATE users SET last_active = datetime('now'), last_ip = ? WHERE id = ?").bind(ip, userId).run().catch(() => {});
  }

  // Cache account_status check — avoid D1 read on every request
  const cached = _accountStatusCache.get(userId);
  if (cached && now < cached.exp) {
    if (cached.status === 'suspended') return null;
  } else {
    const userStatus = await env.DB.prepare('SELECT account_status FROM users WHERE id = ?').bind(userId).first();
    _accountStatusCache.set(userId, { status: userStatus?.account_status, exp: now + ACCOUNT_STATUS_TTL_MS });
    if (userStatus?.account_status === 'suspended') return null;
  }

  return payload; // { sub: userId, email, role }
}

// Returns true if last_active is within the last hour
function isOnline(lastActive) {
  if (!lastActive) return false;
  const ts = new Date(lastActive.endsWith('Z') ? lastActive : lastActive + 'Z').getTime();
  return (Date.now() - ts) < 3600000; // 1 hour
}

// ── CORS ────────────────────────────────────────────────

function getAllowedOrigins(env) {
  const configured = String(env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : ['*'];
}

function getPrimaryAppOrigin(env) {
  const [primary] = getAllowedOrigins(env);
  return primary && primary !== '*' ? primary : 'http://localhost:5173';
}

function corsHeaders(env, request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowedOrigins = getAllowedOrigins(env);
  const primaryOrigin = allowedOrigins[0] || '*';
  let acao = primaryOrigin;
  if (origin && (
    allowedOrigins.includes(origin) ||
    origin === 'http://localhost:5173' ||
    origin.endsWith('.mansiondeseo-site.pages.dev')
  )) {
    acao = origin;
  }
  return {
    'Access-Control-Allow-Origin': acao,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token, X-Turnstile-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function handleOptions(env, request) {
  return new Response(null, { status: 204, headers: corsHeaders(env, request) });
}

// ══════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ══════════════════════════════════════════════════════════

// ── Email via MailChannels ──────────────────────────────

function verificationEmailHTML(code) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#08080E;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:480px;margin:0 auto;padding:40px 24px}
  .card{background:#111118;border-radius:16px;padding:40px 32px;border:1px solid rgba(201,168,76,0.15)}
  .logo{text-align:center;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:1px;margin-bottom:8px}
  .sub{text-align:center;color:#8a8a9a;font-size:13px;margin-bottom:32px}
  .code-box{background:#08080E;border:2px solid rgba(201,168,76,0.3);border-radius:12px;padding:20px;text-align:center;margin:24px 0}
  .code{font-size:36px;letter-spacing:12px;font-weight:700;color:#C9A84C;font-family:'Courier New',monospace}
  .msg{color:#c4c4d0;font-size:14px;line-height:1.6;text-align:center}
  .footer{text-align:center;color:#555;font-size:11px;margin-top:32px}
  .warn{color:#D4183D;font-size:12px;text-align:center;margin-top:16px}
</style></head>
<body><div class="wrap"><div class="card">
  <div class="logo">MANSIÓN DESEO</div>
  <div class="sub">Verificación de cuenta</div>
  <p class="msg">Tu código de verificación es:</p>
  <div class="code-box"><div class="code">${code}</div></div>
  <p class="msg">Introduce este código en la app para completar tu registro. El código expira en <strong>30 minutos</strong>.</p>
  <p class="warn">Si no solicitaste esto, ignora este email.</p>
</div>
<div class="footer">© Mansión Deseo · Este email fue enviado automáticamente</div>
</div></body></html>`;
}

async function getResendCredentials(env) {
  const row = await env.DB.prepare("SELECT key, value FROM site_settings WHERE key IN ('resend_api_key', 'mail_from')").all();
  const map = {};
  for (const r of row.results) map[r.key] = r.value;
  return {
    apiKey: map.resend_api_key || env.RESEND_API_KEY,
    mailFrom: map.mail_from || env.MAIL_FROM || 'noreply@unicoapps.com',
  };
}

async function sendVerificationEmail(env, toEmail, code) {
  const { apiKey, mailFrom } = await getResendCredentials(env);
  const fromEmail = mailFrom;
  const fromName = 'Mansión Deseo';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [toEmail],
        subject: `${code} — Tu código de verificación`,
        text: `Tu código de verificación para Mansión Deseo es: ${code}\n\nExpira en 30 minutos.\n\nSi no solicitaste esto, ignora este email.`,
        html: verificationEmailHTML(code),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend error ${res.status}:`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend send failed:', err.message);
    return false;
  }
}

// ── POST /api/auth/register ─────────────────────────────

function generateVerificationCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, '0');
}

async function handleRegister(request, env) {
  const body = await request.json();
  const { email, password, username, role, seeking, interests, age, city, bio } = body;

  if (!email || !password || !username || !role || !seeking) {
    return error('Campos requeridos: email, password, username, role, seeking');
  }

  // Validate seeking: must be array of valid roles
  const seekingArr = Array.isArray(seeking) ? seeking : [seeking];
  const validSeeking = ['hombre', 'mujer', 'pareja'];
  if (!seekingArr.length || seekingArr.some(s => !validSeeking.includes(s))) {
    return error('Seeking debe contener valores válidos: hombre, mujer, pareja');
  }

  if (password.length < 12) {
    return error('La contraseña debe tener al menos 12 caracteres');
  }

  if (password.length > 50) {
    return error('La contraseña no puede tener más de 50 caracteres');
  }

  if (username.length > 20) {
    return error('El nombre de usuario no puede tener más de 20 caracteres');
  }

  // Validate username format: only letters, numbers, dots, underscores
  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return error('El nombre de usuario solo puede contener letras, números, puntos y guiones bajos');
  }

  // Check duplicate username
  const existingUsername = await env.DB.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND status = ?').bind(username, 'verified').first();
  if (existingUsername) {
    return error('Este nombre de usuario ya está en uso. Elegí otro.', 409);
  }

  // Check duplicate email
  const existing = await env.DB.prepare('SELECT id, status FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing && existing.status === 'verified') {
    return json({ error: 'Este email ya está registrado', code: 'EMAIL_EXISTS' }, 409);
  }

  // If pending user exists, delete and re-create
  if (existing) {
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(existing.id).run();
    await env.DB.prepare('DELETE FROM verification_tokens WHERE user_id = ?').bind(existing.id).run();
  }

  const userId = generateId();
  const passwordHash = await hashPassword(password);

  // Country: use body.country if provided (user picked from allowed list), else CF header
  const detectedCountry = request.headers.get('cf-ipcountry') || '';
  const country = body.country || detectedCountry;

  await env.DB.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, seeking, interests, age, city, country, bio, status, coins)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
  `).bind(
    userId,
    email.toLowerCase(),
    username,
    passwordHash,
    role,
    JSON.stringify(seekingArr),
    JSON.stringify(interests || []),
    age || null,
    city || '',
    country,
    bio || ''
  ).run();

  // Generate 6-digit verification code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  await env.DB.prepare(`
    INSERT INTO verification_tokens (id, user_id, email, token, purpose, expires_at)
    VALUES (?, ?, ?, ?, 'verify_email', ?)
  `).bind(generateId(), userId, email.toLowerCase(), code, expiresAt).run();

  // Send verification email (MailChannels in production, console in dev)
  if (env.ENVIRONMENT === 'production') {
    await sendVerificationEmail(env, email.toLowerCase(), code);
  } else {
    debugLog(env, `📧 VERIFICATION CODE for ${email}: ${code}`);
  }

  return json({
    needsVerification: true,
    email: email.toLowerCase(),
    message: 'Código de verificación enviado a tu email.',
    ...(env.ENVIRONMENT !== 'production' && { devCode: code }),
  }, 201);
}

// ── POST /api/auth/verify-code ──────────────────────────

async function handleVerifyCode(request, env) {
  const { email, code } = await request.json();

  if (!email || !code) {
    return error('Email y código requeridos');
  }

  const record = await env.DB.prepare(`
    SELECT * FROM verification_tokens
    WHERE email = ? AND token = ? AND purpose = 'verify_email' AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(email.toLowerCase(), code.trim()).first();

  if (!record) {
    return error('Código inválido o expirado', 401);
  }

  // Mark token as used
  await env.DB.prepare('UPDATE verification_tokens SET used = 1 WHERE id = ?')
    .bind(record.id).run();

  // Verify the user
  const ipVer = request.headers.get('CF-Connecting-IP') || '';
  await env.DB.prepare("UPDATE users SET status = 'verified', online = 1, last_active = datetime('now'), last_ip = ? WHERE id = ?")
    .bind(ipVer, record.user_id).run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(record.user_id).first();
  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

  return json({ token, user: sanitizeUser(user, env) });
}

// ── POST /api/auth/resend-code ──────────────────────────

async function handleResendCode(request, env) {
  const { email } = await request.json();

  if (!email) return error('Email requerido');

  const user = await env.DB.prepare("SELECT id, status FROM users WHERE email = ? AND status = 'pending'")
    .bind(email.toLowerCase()).first();

  if (!user) {
    return error('No hay registro pendiente para este email', 404);
  }

  // Invalidate old codes
  await env.DB.prepare("UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND purpose = 'verify_email' AND used = 0")
    .bind(user.id).run();

  // Generate new code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO verification_tokens (id, user_id, email, token, purpose, expires_at)
    VALUES (?, ?, ?, ?, 'verify_email', ?)
  `).bind(generateId(), user.id, email.toLowerCase(), code, expiresAt).run();

  // Send verification email
  if (env.ENVIRONMENT === 'production') {
    await sendVerificationEmail(env, email.toLowerCase(), code);
  } else {
    debugLog(env, `📧 RESEND CODE for ${email}: ${code}`);
  }

  return json({
    message: 'Nuevo código enviado.',
    ...(env.ENVIRONMENT !== 'production' && { devCode: code }),
  });
}

// ── POST /api/auth/forgot-password ──────────────────────

function passwordResetEmailHTML(code) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#08080E;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:480px;margin:0 auto;padding:40px 24px}
  .card{background:#111118;border-radius:16px;padding:40px 32px;border:1px solid rgba(201,168,76,0.15)}
  .logo{text-align:center;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:1px;margin-bottom:8px}
  .sub{text-align:center;color:#8a8a9a;font-size:13px;margin-bottom:32px}
  .code-box{background:#08080E;border:2px solid rgba(201,168,76,0.3);border-radius:12px;padding:20px;text-align:center;margin:24px 0}
  .code{font-size:36px;letter-spacing:12px;font-weight:700;color:#C9A84C;font-family:'Courier New',monospace}
  .msg{color:#c4c4d0;font-size:14px;line-height:1.6;text-align:center}
  .footer{text-align:center;color:#555;font-size:11px;margin-top:32px}
  .warn{color:#D4183D;font-size:12px;text-align:center;margin-top:16px}
</style></head>
<body><div class="wrap"><div class="card">
  <div class="logo">MANSIÓN DESEO</div>
  <div class="sub">Recuperar contraseña</div>
  <p class="msg">Tu código para restablecer la contraseña es:</p>
  <div class="code-box"><div class="code">${code}</div></div>
  <p class="msg">Introduce este código en la app para crear una nueva contraseña. El código expira en <strong>30 minutos</strong>.</p>
  <p class="warn">Si no solicitaste esto, ignora este email.</p>
</div>
<div class="footer">© Mansión Deseo · Este email fue enviado automáticamente</div>
</div></body></html>`;
}

async function sendPasswordResetEmail(env, toEmail, code) {
  const { apiKey, mailFrom } = await getResendCredentials(env);
  const fromEmail = mailFrom;
  const fromName = 'Mansión Deseo';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [toEmail],
        subject: `${code} — Recuperar contraseña`,
        text: `Tu código para restablecer la contraseña en Mansión Deseo es: ${code}\n\nExpira en 30 minutos.\n\nSi no solicitaste esto, ignora este email.`,
        html: passwordResetEmailHTML(code),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend error ${res.status}:`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend send failed:', err.message);
    return false;
  }
}

async function handleForgotPassword(request, env) {
  const { email } = await request.json();

  if (!email) return error('Email requerido');

  // Always return success to avoid email enumeration
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND status = 'verified'")
    .bind(email.toLowerCase()).first();

  if (user) {
    // Invalidate old reset codes
    await env.DB.prepare("UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND purpose = 'reset' AND used = 0")
      .bind(user.id).run();

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await env.DB.prepare(`
      INSERT INTO verification_tokens (id, user_id, email, token, purpose, expires_at)
      VALUES (?, ?, ?, ?, 'reset', ?)
    `).bind(generateId(), user.id, email.toLowerCase(), code, expiresAt).run();

    if (env.ENVIRONMENT === 'production') {
      await sendPasswordResetEmail(env, email.toLowerCase(), code);
    } else {
      debugLog(env, `🔑 PASSWORD RESET CODE for ${email}: ${code}`);
    }
  }

  return json({
    message: 'Si el email está registrado, recibirás un código para restablecer tu contraseña.',
    ...(env.ENVIRONMENT !== 'production' && user ? { devCode: (await env.DB.prepare("SELECT token FROM verification_tokens WHERE user_id = ? AND purpose = 'reset' AND used = 0 ORDER BY created_at DESC LIMIT 1").bind(user.id).first())?.token } : {}),

  });
}

// ── POST /api/auth/reset-password ───────────────────────

async function handleResetPassword(request, env) {
  const { email, code, newPassword } = await request.json();

  if (!email || !code || !newPassword) {
    return error('Email, código y nueva contraseña son requeridos');
  }

  if (newPassword.length < 12) {
    return error('La contraseña debe tener al menos 12 caracteres');
  }

  if (newPassword.length > 50) {
    return error('La contraseña no puede tener más de 50 caracteres');
  }

  const record = await env.DB.prepare(`
    SELECT * FROM verification_tokens
    WHERE email = ? AND token = ? AND purpose = 'reset' AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(email.toLowerCase(), code.trim()).first();

  if (!record) {
    return error('Código inválido o expirado', 401);
  }

  // Mark token as used
  await env.DB.prepare('UPDATE verification_tokens SET used = 1 WHERE id = ?')
    .bind(record.id).run();

  // Update password
  const passwordHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, record.user_id).run();

  return json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
}

// ── POST /api/auth/check-email ──────────────────────────

async function handleCheckEmail(request, env) {
  const { email } = await request.json();
  if (!email) return error('Email requerido');

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND status = 'verified'")
    .bind(email.toLowerCase()).first();

  return json({ exists: !!existing });
}

async function handleCheckUsername(request, env) {
  const { username } = await request.json();
  if (!username) return error('Username requerido');

  const existing = await env.DB.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND status = 'verified'")
    .bind(username).first();

  return json({ exists: !!existing });
}

// ── POST /api/auth/login ────────────────────────────────

async function handleLogin(request, env) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return error('Email y contraseña requeridos');
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first();

  if (!user || !user.password_hash) {
    return error('Credenciales inválidas', 401);
  }

  if (user.status === 'pending') {
    return error('Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.', 403);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return error('Credenciales inválidas', 401);
  }

  // Update online status + IP
  const ipLogin = request.headers.get('CF-Connecting-IP') || '';
  await env.DB.prepare("UPDATE users SET online = 1, last_active = datetime('now'), last_ip = ? WHERE id = ?")
    .bind(ipLogin, user.id).run();

  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

  return json({ token, user: sanitizeUser(user, env) });
}

// ── POST /api/auth/magic-link ───────────────────────────

async function handleMagicLink(request, env) {
  const { email } = await request.json();

  if (!email) return error('Email requerido');

  const token = generateId();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  // Check if user exists
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first();

  await env.DB.prepare(`
    INSERT INTO verification_tokens (id, user_id, email, token, purpose, expires_at)
    VALUES (?, ?, ?, ?, 'login', ?)
  `).bind(generateId(), user?.id || null, email.toLowerCase(), token, expiresAt).run();

  // TODO: Replace console.log with actual email service (Resend, SendGrid, etc.)
  debugLog(env, `🔗 MAGIC LINK for ${email}: /api/auth/verify?token=${token}`);

  return json({ message: 'Si el email existe, recibirás un enlace de acceso.' });
}

// ── GET /api/auth/verify?token=... ──────────────────────

async function handleVerifyToken(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) return error('Token requerido');

  const record = await env.DB.prepare(`
    SELECT * FROM verification_tokens
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).bind(token).first();

  if (!record) return error('Token inválido o expirado', 401);

  // Mark used
  await env.DB.prepare('UPDATE verification_tokens SET used = 1 WHERE id = ?')
    .bind(record.id).run();

  let user;
  if (record.user_id) {
    user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(record.user_id).first();
    const ipMagic = request.headers.get('CF-Connecting-IP') || '';
    await env.DB.prepare("UPDATE users SET status = 'verified', online = 1, last_active = datetime('now'), last_ip = ? WHERE id = ?")
      .bind(ipMagic, user.id).run();
  } else {
    // New user via magic link — create minimal account
    const userId = generateId();
    const country = request.headers.get('cf-ipcountry') || '';
    await env.DB.prepare(`
      INSERT INTO users (id, email, username, role, seeking, country, status)
      VALUES (?, ?, ?, 'hombre', 'mujer', ?, 'verified')
    `).bind(userId, record.email, record.email.split('@')[0], country).run();
    user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  }

  const jwt = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

  // Redirect to frontend with token
  return Response.redirect(`${getPrimaryAppOrigin(env)}/?token=${jwt}`, 302);
}

// ── GET /api/auth/me ────────────────────────────────────

async function handleMe(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.sub).first();
  if (!user) return error('Usuario no encontrado', 404);

  return json({ user: sanitizeUser(user, env) });
}

async function handleAppBootstrap(request, env) {
  const settingsPromise = cached('settings', 300_000, () => loadSettings(env));
  const authHeader = request.headers.get('Authorization');
  let user = null;
  let unread = 0;

  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticate(request, env);
    if (!auth) return error('No autorizado', 401);

    const [dbUser, activeStory, unreadRow] = await Promise.all([
      env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.sub).first(),
      env.DB.prepare('SELECT id FROM stories WHERE user_id = ? AND active = 1 LIMIT 1').bind(auth.sub).first(),
      env.DB.prepare(
        'SELECT COALESCE(SUM(unread_count), 0) as unread FROM conversation_state WHERE user_id = ?'
      ).bind(auth.sub).first(),
    ]);
    if (!dbUser) return error('Usuario no encontrado', 404);
    user = sanitizeUser(dbUser, env);
    user.has_active_story = !!activeStory;
    unread = Number(unreadRow?.unread || 0);
  }

  const settings = await settingsPromise;
  return json({
    user,
    unread,
    settings: getPublicSettingsPayload(settings),
  });
}

// ── GET /api/me/dashboard ──────────────────────────────

async function handleOwnProfileDashboard(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const [dbUser, activeStory, visitRows, giftRows] = await Promise.all([
    env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.sub).first(),
    env.DB.prepare('SELECT id FROM stories WHERE user_id = ? AND active = 1 LIMIT 1').bind(auth.sub).first(),
    env.DB.prepare(
      `SELECT u.id, u.username, u.avatar_url, u.avatar_crop, u.age, u.city, u.role, u.premium, u.last_active,
              MAX(pv.created_at) as visited_at
       FROM profile_visits pv
       JOIN users u ON u.id = pv.visitor_id
       WHERE pv.visited_id = ?
       GROUP BY pv.visitor_id
       ORDER BY visited_at DESC
       LIMIT 10`
    ).bind(auth.sub).all(),
    env.DB.prepare(
      `SELECT ug.id, ug.message, ug.created_at,
              gc.name as gift_name, gc.emoji as gift_emoji, gc.price as gift_price,
              u.id as sender_id, u.username as sender_name, u.avatar_url as sender_avatar
       FROM user_gifts ug
       JOIN gift_catalog gc ON gc.id = ug.gift_id
       JOIN users u ON u.id = ug.sender_id
       WHERE ug.receiver_id = ?
       ORDER BY ug.created_at DESC
       LIMIT 50`
    ).bind(auth.sub).all(),
  ]);

  if (!dbUser) return error('Usuario no encontrado', 404);

  const user = sanitizeUser(dbUser, env);
  user.has_active_story = !!activeStory;

  const visitors = (visitRows?.results || []).map((v) => ({
    id: v.id,
    name: v.username,
    avatar_url: v.avatar_url,
    avatar_crop: safeParseJSON(v.avatar_crop, null),
    age: v.age,
    city: v.city,
    role: v.role,
    premium: !!v.premium,
    online: isOnline(v.last_active),
    visited_at: v.visited_at,
  }));

  return json({
    user,
    visitors,
    gifts: giftRows?.results || [],
  });
}

// ── GET /api/profiles ───────────────────────────────────

async function handleProfiles(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  await ensureUserBrowseIndexes(env);

  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';
  const search = url.searchParams.get('q') || '';

  // Use the authenticated user's registered country (not cf-ipcountry which changes with VPN)
  const viewer = await env.DB.prepare('SELECT premium, premium_until, country, seeking, interests FROM users WHERE id = ?').bind(auth.sub).first();
  const country = viewer?.country || '';

  // Determine role filter: use viewer's seeking from DB, with frontend filter as fallback
  const viewerSeeking = safeParseJSON(viewer?.seeking, []);
  const viewerInterests = safeParseJSON(viewer?.interests, []);

  // Build profiles query (don't exclude current user — cache is shared, filter later)
  let query = `
    SELECT
      id,
      username,
      age,
      city,
      role,
      interests,
      bio,
      avatar_url,
      avatar_crop,
      photos,
      verified,
      premium,
      premium_until,
      ghost_mode,
      last_active
    FROM users
    WHERE status = 'verified'
  `;
  const params = [];
  if (country) { query += ` AND country = ?`; params.push(country); }

  // Role filter: use server-side seeking, fall back to frontend filter param
  const roleFilters = ['hombre', 'mujer', 'pareja'];
  let filterParts;
  if (viewerSeeking.length > 0 && viewerSeeking.length < 3) {
    filterParts = viewerSeeking.filter(f => roleFilters.includes(f));
  } else {
    filterParts = filter.split(',').map(f => f.trim()).filter(f => roleFilters.includes(f));
  }
  if (filterParts.length === 1) {
    query += ` AND role = '${filterParts[0]}'`;
  } else if (filterParts.length > 1) {
    query += ` AND role IN (${filterParts.map(f => `'${f}'`).join(',')})`;
  }
  if (search) {
    query += ` AND (username LIKE ? OR city LIKE ? OR bio LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  query += ` ORDER BY last_active DESC LIMIT 51`;

  // Cache key for profiles query (shared across all users)
  const seekingKey = filterParts.length ? filterParts.sort().join(',') : 'all';
  const profilesCacheKey = `profiles:${seekingKey}:${country}:${search}`;

  // Parallel: cached settings + cached profiles + per-user data (always fresh)
  const [settings, results, { results: favRows }, { results: favByRows }, storyRows] = await Promise.all([
    cached('settings', 300_000, () => loadSettings(env)),  // 5 min
    cached(profilesCacheKey, 30_000, () => env.DB.prepare(query).bind(...params).all().then(r => r.results)),  // 30s
    env.DB.prepare('SELECT target_id FROM favorites WHERE user_id = ?').bind(auth.sub).all(),
    env.DB.prepare('SELECT user_id FROM favorites WHERE target_id = ?').bind(auth.sub).all(),
    cached('active_story_users', 30_000, () => env.DB.prepare('SELECT DISTINCT user_id FROM stories WHERE active = 1').all().then(r => r.results).catch(() => [])),  // 30s
  ]);
  const viewerIsPremium = viewer && isPremiumActive(viewer);
  const viewerFavorites = new Set(favRows.map(r => r.target_id));
  const favoritedBySet = new Set(favByRows.map(r => r.user_id));
  const activeStoryUserIds = new Set((storyRows || []).map(r => String(r.user_id)));

  // Filter out current user (cached query includes everyone) + map to frontend shape
  let profiles = results.filter(u => u.id !== auth.sub).slice(0, 50).map(u => {
    const profileIsPremium = isPremiumActive(u);
    const hasGhostMode = profileIsPremium && !!u.ghost_mode;
    // Ghost mode blur: blurred unless viewer is premium OR the ghost-mode user has favorited the viewer
    const blurred = hasGhostMode && !viewerIsPremium && !favoritedBySet.has(u.id);
    const galleryPhotos = normalizeGalleryPhotos(safeParseJSON(u.photos, []), u.avatar_url);
    const displayPhotos = buildDisplayPhotos(u.avatar_url, galleryPhotos);
    // Keep avatar separate from gallery; frontend can merge both when it needs a full media carousel.
    const visiblePhotos = viewerIsPremium
      ? displayPhotos.length
      : blurred
        ? 0
        : Math.min(displayPhotos.length, settings.freeVisiblePhotos);
    const profileInterests = safeParseJSON(u.interests, []);
    return {
      id: u.id,
      name: u.username,
      age: u.age,
      city: u.city,
      role: mapRoleToDisplay(u.role),
      interests: profileInterests,
      bio: u.bio,
      photos: galleryPhotos,
      totalPhotos: displayPhotos.length,
      visiblePhotos,
      verified: !!u.verified,
      online: isOnline(u.last_active),
      premium: profileIsPremium,
      premium_until: u.premium_until || null,
      ghost_mode: hasGhostMode,
      blurred,
      isFavorited: viewerFavorites.has(u.id),
      lastActive: u.last_active,
      avatar_url: u.avatar_url,
      avatar_crop: safeParseJSON(u.avatar_crop, null),
      has_active_story: activeStoryUserIds.has(String(u.id)),
      _matchingInterests: viewerInterests.length > 0
        ? profileInterests.filter(i => viewerInterests.includes(i)).length
        : 0,
    };
  });

  // Sort: profiles with more matching interests first, then by last_active (already sorted by DB)
  if (viewerInterests.length > 0) {
    profiles.sort((a, b) => b._matchingInterests - a._matchingInterests);
  }
  // Strip internal sort field
  profiles = profiles.map(({ _matchingInterests, ...p }) => p);

  return json({ profiles, viewerPremium: viewerIsPremium, settings });
}

// ── GET /api/profiles/:id ───────────────────────────────

async function handleProfileDetail(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  // Parallel fetch: profile + viewer info + cached settings + favorites (all independent)
  const [user, viewer, settings, favRow, favByRow] = await Promise.all([
    env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first(),
    env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first(),
    cached('settings', 300_000, () => loadSettings(env)),
    env.DB.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND target_id = ?').bind(auth.sub, userId).first(),
    env.DB.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND target_id = ?').bind(userId, auth.sub).first(),
  ]);
  if (!user) return error('Perfil no encontrado', 404);
  const viewerIsPremium = viewer && isPremiumActive(viewer);
  const isFavorited = !!favRow;
  const profileFavoritedViewer = !!favByRow;

  const hasGhostMode = isPremiumActive(user) && !!user.ghost_mode;
  const isOwnProfile = auth.sub === userId;
  // Ghost mode blur: blurred unless viewer is premium, OR profile owner favorited viewer
  const blurred = hasGhostMode && !viewerIsPremium && !profileFavoritedViewer;

  // Record visit (skip own profile)
  if (!isOwnProfile) {
    try {
      const dedupeWindow = `-${getProfileVisitDedupeWindowMinutes(env)} minutes`;
      await env.DB.prepare(
        `INSERT INTO profile_visits (id, visitor_id, visited_id)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1
           FROM profile_visits
           WHERE visitor_id = ?
             AND visited_id = ?
             AND created_at >= datetime('now', ?)
         )`
      ).bind(crypto.randomUUID(), auth.sub, userId, auth.sub, userId, dedupeWindow).run();
    } catch {
      // Silently fail — duplicate or DB issue
    }
  }

  const galleryPhotos = normalizeGalleryPhotos(safeParseJSON(user.photos, []), user.avatar_url);
  const displayPhotos = buildDisplayPhotos(user.avatar_url, galleryPhotos);
  // Keep avatar separate from gallery; frontend can merge both when it needs a full media carousel.
  const visibleLimit = settings.freeVisiblePhotos;
  const visiblePhotos = viewerIsPremium
    ? displayPhotos.length
    : blurred
      ? 0
      : Math.min(displayPhotos.length, visibleLimit);

  // Get received gifts for this profile
  const { results: giftResults } = await env.DB.prepare(
    `SELECT ug.id, ug.created_at,
            gc.name as gift_name, gc.emoji as gift_emoji,
            u.id as sender_id, u.username as sender_name, u.avatar_url as sender_avatar
     FROM user_gifts ug
     JOIN gift_catalog gc ON gc.id = ug.gift_id
     JOIN users u ON u.id = ug.sender_id
     WHERE ug.receiver_id = ?
     ORDER BY ug.created_at DESC
     LIMIT 20`
  ).bind(userId).all();

  return json({
    profile: {
      id: user.id,
      name: user.username,
      age: user.age,
      city: user.city,
      role: mapRoleToDisplay(user.role),
      interests: safeParseJSON(user.interests, []),
      bio: user.bio,
      photos: galleryPhotos,
      totalPhotos: displayPhotos.length,
      visiblePhotos,
      verified: !!user.verified,
      online: isOnline(user.last_active),
      premium: isPremiumActive(user),
      premium_until: user.premium_until || null,
      ghost_mode: hasGhostMode,
      blurred,
      isFavorited,
      isOwnProfile,
      lastActive: user.last_active,
      avatar_url: user.avatar_url,
      avatar_crop: safeParseJSON(user.avatar_crop, null),
      receivedGifts: giftResults,
    },
    viewerPremium: viewerIsPremium,
    settings,
  });
}

// ── POST /api/messages/send ─────────────────────────────

async function handleSendMessage(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  await ensureMessageConversationIdColumn(env);

  const { receiver_id, content } = await request.json();
  if (!receiver_id || !content || !content.trim()) {
    return error('receiver_id y content requeridos');
  }

  // Verify receiver exists
  const receiver = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(receiver_id).first();
  if (!receiver) return error('Destinatario no encontrado', 404);

  // Check daily message limit
  const today = todayUTC();
  const [limit, sender, siteSettings] = await Promise.all([
    env.DB.prepare(
      'SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?'
    ).bind(auth.sub, today).first(),
    env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first(),
    cached('settings', 300_000, () => loadSettings(env)),
  ]);

  const currentCount = limit?.msg_count || 0;

  const dailyLimit = siteSettings.dailyMessageLimit || 5;

  if (!isPremiumActive(sender) && currentCount >= dailyLimit) {
    return error(`Has alcanzado el límite de ${dailyLimit} mensajes diarios. Desbloquea VIP para mensajes ilimitados.`, 403);
  }

  // Insert message
  const msgId = generateId();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const conversationId = buildConversationId(auth.sub, receiver_id);
  await env.DB.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, content, created_at, conversation_id) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(msgId, auth.sub, receiver_id, content.trim(), now, conversationId).run();

  // Update message counter
  if (!isPremiumActive(sender)) {
    if (limit) {
      await env.DB.prepare(
        'UPDATE message_limits SET msg_count = msg_count + 1 WHERE user_id = ? AND date_utc = ?'
      ).bind(auth.sub, today).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO message_limits (user_id, date_utc, msg_count) VALUES (?, ?, 1)'
      ).bind(auth.sub, today).run();
    }
  }

  const msg = {
    id: msgId,
    sender_id: auth.sub,
    receiver_id,
    content: content.trim(),
    is_read: 0,
    created_at: now,
  };

  try {
    await syncConversationStateForMessage(env, auth.sub, receiver_id, msg);
  } catch (err) {
    console.error('[handleSendMessage] conversation_state sync error:', err.message);
    await rebuildConversationStateForPair(env, auth.sub, receiver_id).catch((repairErr) => {
      console.error('[handleSendMessage] conversation_state repair error:', repairErr.message);
    });
  }

  // Notify ChatRoom DO so it broadcasts to connected receivers via WebSocket
  notifyChatRoom(env, auth.sub, receiver_id, msg).catch(() => {});

  const events = await buildNewMessageEvents(env, auth.sub, receiver_id, msg);

  // Notify receiver's notification channel (updates ChatListPage in real-time)
  notifyUser(env, receiver_id, events.receiver).catch(() => {});
  // Also notify sender (so their own ChatListPage updates if open in another tab)
  notifyUser(env, auth.sub, events.sender).catch(() => {});

  return json({ message: msg }, 201);
}

// ── Notify ChatRoom DO of new HTTP message ──────────────

async function notifyChatRoom(env, senderId, receiverId, msg) {
  try {
    const chatId = [senderId, receiverId].sort().join('-');
    debugLog(env, '[notifyChatRoom] chatId:', chatId);
    const doId = env.CHAT_ROOMS.idFromName(chatId);
    const stub = env.CHAT_ROOMS.get(doId);
    const res = await stub.fetch('https://do/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
    debugLog(env, '[notifyChatRoom] DO response:', res.status);
  } catch (err) {
    console.error('[notifyChatRoom] error:', err.message);
  }
}

// ── GET /api/messages/:userId ───────────────────────────

async function handleGetMessages(request, env, otherUserId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  await ensureMessageConversationIdColumn(env);
  const conversationId = buildConversationId(auth.sub, otherUserId);
  const url = new URL(request.url);
  const before = url.searchParams.get('before');
  const rawLimit = Number(url.searchParams.get('limit') || 40);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 40, 1), 100);
  const queryLimit = limit + 1;
  const hiddenRow = await env.DB.prepare(
    'SELECT hidden_before FROM hidden_conversations WHERE user_id = ? AND partner_id = ?'
  ).bind(auth.sub, otherUserId).first();
  const hiddenBefore = hiddenRow?.hidden_before || null;

  const query = before
    ? `
      SELECT * FROM (
        SELECT * FROM messages
        WHERE conversation_id = ?
          AND (? IS NULL OR created_at > ?)
          AND created_at < ?
        ORDER BY created_at DESC
        LIMIT ?
      )
      ORDER BY created_at ASC
    `
    : `
      SELECT * FROM (
        SELECT * FROM messages
        WHERE conversation_id = ?
          AND (? IS NULL OR created_at > ?)
        ORDER BY created_at DESC
        LIMIT ?
      )
      ORDER BY created_at ASC
    `;

  const bindings = before
    ? [conversationId, hiddenBefore, hiddenBefore, before, queryLimit]
    : [conversationId, hiddenBefore, hiddenBefore, queryLimit];

  const { results } = await env.DB.prepare(query).bind(...bindings).all();
  const hasMore = results.length > limit;
  const windowedResults = hasMore ? results.slice(1) : results;

  // Mark as read
  await env.DB.prepare(`
    UPDATE messages SET is_read = 1
    WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      AND (? IS NULL OR created_at > ?)
  `).bind(otherUserId, auth.sub, hiddenBefore, hiddenBefore).run();
  await clearConversationStateUnread(env, auth.sub, otherUserId);

  const messages = windowedResults.map(m => ({
    id: m.id,
    senderId: m.sender_id === auth.sub ? 'me' : 'them',
    text: m.content,
    timestamp: new Date(m.created_at + 'Z').toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
    created_at: m.created_at,
    is_read: m.is_read,
  }));

  return json({ messages, hasMore });
}

// ── GET /api/messages (conversations list) ──────────────

async function handleConversations(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);


  const { results } = await env.DB.prepare(`
    SELECT
      cs.partner_id,
      cs.last_message,
      cs.last_message_at,
      cs.unread_count,
      u.username,
      u.avatar_url,
      u.avatar_crop,
      u.last_active
    FROM conversation_state cs
    JOIN users u ON u.id = cs.partner_id
    WHERE cs.user_id = ?
    ORDER BY cs.last_message_at DESC
  `).bind(auth.sub).all();

  const conversations = results.map((row) => ({
    id: `conv-${row.partner_id}`,
    profileId: row.partner_id,
    name: row.username,
    avatar: row.avatar_url || '',
    avatarCrop: safeParseJSON(row.avatar_crop, null),
    lastMessage: (row.last_message || '').slice(0, 50),
    timestamp: row.last_message_at,
    unread: Number(row.unread_count || 0),
    online: isOnline(row.last_active),
  }));

  return json({ conversations });
}

async function handleDeleteConversation(request, env, otherUserId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const hiddenBefore = new Date().toISOString().replace('T', ' ').slice(0, 19);

  await env.DB.prepare(`
    INSERT INTO hidden_conversations (user_id, partner_id, hidden_before, created_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, partner_id)
    DO UPDATE SET hidden_before = excluded.hidden_before
  `).bind(auth.sub, otherUserId, hiddenBefore).run();
  await deleteConversationState(env, auth.sub, otherUserId);

  const unreadRow = await env.DB.prepare(
    'SELECT COALESCE(SUM(unread_count), 0) as unread FROM conversation_state WHERE user_id = ?'
  ).bind(auth.sub).first();

  notifyUser(env, auth.sub, {
    type: 'conversation_deleted',
    partnerId: otherUserId,
    chatId: [auth.sub, otherUserId].sort().join('-'),
    unreadCount: Number(unreadRow?.unread || 0),
  }).catch(() => {});

  return json({ deleted: true, partnerId: otherUserId, unreadCount: Number(unreadRow?.unread || 0) });
}

// ── GET /api/messages/limit ─────────────────────────────

async function handleMessageLimit(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const today = todayUTC();
  const [limit, sender, siteSettings] = await Promise.all([
    env.DB.prepare(
      'SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?'
    ).bind(auth.sub, today).first(),
    env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first(),
    cached('settings', 300_000, () => loadSettings(env)),
  ]);

  const count = limit?.msg_count || 0;

  const dailyLimit = siteSettings.dailyMessageLimit || 5;
  const senderPremium = isPremiumActive(sender);

  return json({
    sent: count,
    remaining: senderPremium ? 999 : Math.max(0, dailyLimit - count),
    canSend: senderPremium ? true : count < dailyLimit,
    max: senderPremium ? 999 : dailyLimit,
  });
}

// ── GET /api/chat/ws/:chatId — WebSocket upgrade ────────

async function handleChatWebSocket(request, env, chatId) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return error('Token requerido', 401);

  // Verify JWT
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return error('Token inválido', 401);

  const userId = url.searchParams.get('userId');
  if (!userId || userId !== payload.sub) return error('userId no coincide', 403);

  // Get Durable Object stub by chatId name
  const doId = env.CHAT_ROOMS.idFromName(chatId);
  const stub = env.CHAT_ROOMS.get(doId);

  // Pass the original request directly — recommended pattern for WS proxying to DOs
  return stub.fetch(request);
}

// ── Notify UserNotification DO ──────────────────────────

// Cache premium status per user in Worker memory to avoid D1 lookups
const _premiumCache = new Map(); // userId → { isPremium, exp }
const PREMIUM_CACHE_TTL_MS = 60_000; // 1 min

async function isUserPremium(env, userId) {
  const now = Date.now();
  const cached = _premiumCache.get(userId);
  if (cached && now < cached.exp) return cached.isPremium;
  const user = await env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(userId).first();
  const isPremium = !!(user && user.premium_until && new Date(user.premium_until.endsWith('Z') ? user.premium_until : user.premium_until + 'Z') > new Date());
  _premiumCache.set(userId, { isPremium, exp: now + PREMIUM_CACHE_TTL_MS });
  return isPremium;
}

async function notifyUser(env, userId, data) {
  try {
    // Skip DO wake-up for free users — they don't connect notification WS
    const premium = await isUserPremium(env, userId);
    if (!premium) {
      debugLog(env, '[notifyUser] skipping free user:', userId);
      return;
    }
    debugLog(env, '[notifyUser] userId:', userId, 'data:', JSON.stringify(data));
    const doId = env.USER_NOTIFICATIONS.idFromName(userId);
    const stub = env.USER_NOTIFICATIONS.get(doId);
    const res = await stub.fetch('https://do/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    debugLog(env, '[notifyUser] DO response:', res.status);
  } catch (err) {
    console.error('[notifyUser] error:', err.message);
  }
}

function buildConversationPreview(partner, msg, unread) {
  if (!partner) return null;

  return {
    id: `conv-${partner.id}`,
    profileId: partner.id,
    name: partner.username,
    avatar: partner.avatar_url || '',
    avatarCrop: safeParseJSON(partner.avatar_crop, null),
    lastMessage: (msg.content || '').slice(0, 50),
    timestamp: msg.created_at,
    unread,
    online: isOnline(partner.last_active),
  };
}

async function loadConversationUsers(env, senderId, receiverId) {
  const cacheKey = `message-users:${[senderId, receiverId].sort().join(':')}`;
  return cached(cacheKey, 60_000, async () => {
    const { results } = await env.DB.prepare(
      'SELECT id, username, avatar_url, avatar_crop, last_active FROM users WHERE id IN (?, ?)'
    ).bind(senderId, receiverId).all();
    return results;
  });
}

async function buildNewMessageEvents(env, senderId, receiverId, msg) {
  const chatId = [senderId, receiverId].sort().join('-');

  let senderConversation = null;
  let receiverConversation = null;

  try {
    const users = await loadConversationUsers(env, senderId, receiverId);

    const userMap = new Map(users.map((user) => [user.id, user]));
    senderConversation = buildConversationPreview(userMap.get(receiverId), msg, 0);
    receiverConversation = buildConversationPreview(userMap.get(senderId), msg, 0);
    if (receiverConversation) delete receiverConversation.unread;
  } catch (err) {
    console.error('[buildNewMessageEvents] users query error:', err.message);
  }

  return {
    sender: {
      type: 'new_message',
      chatId,
      partnerId: receiverId,
      conversation: senderConversation,
    },
    receiver: {
      type: 'new_message',
      chatId,
      partnerId: senderId,
      unreadDelta: 1,
      conversationUnreadDelta: 1,
      conversation: receiverConversation,
    },
  };
}

// ── GET /api/notifications/ws — User notification WebSocket ─

async function handleNotificationWebSocket(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return error('Token requerido', 401);

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return error('Token inválido', 401);

  // Only premium users get notification WS — free users use HTTP polling
  const premium = await isUserPremium(env, payload.sub);
  if (!premium) return error('Reservado para usuarios VIP', 403);

  debugLog(env, '[handleNotificationWebSocket] userId:', payload.sub);
  try {
    const doId = env.USER_NOTIFICATIONS.idFromName(payload.sub);
    const stub = env.USER_NOTIFICATIONS.get(doId);
    return await stub.fetch(request);
  } catch (err) {
    console.error('[handleNotificationWebSocket] DO error:', err?.message || err);
    return error('Notification service unavailable', 503);
  }
}

// ── GET /api/unread-count ───────────────────────────────

async function handleUnreadCount(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(unread_count), 0) as unread FROM conversation_state WHERE user_id = ?'
  ).bind(auth.sub).first();

  return json({ unread: Number(row?.unread || 0) });
}

// ── POST /api/admin/chat-cleanup ────────────────────────

async function handleAdminChatCleanup(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  // Clean D1 messages older than 30 days
  await env.DB.prepare(
    "DELETE FROM messages WHERE created_at < datetime('now', '-30 days')"
  ).run();

  return json({ cleaned: true, message: 'Mensajes de más de 30 días eliminados' });
}

// ── POST /api/upload ────────────────────────────────────

async function handleUpload(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const uploadUrl = new URL(request.url);
  const purpose = uploadUrl.searchParams.get('purpose') || 'asset';

  if (!['asset', 'avatar', 'gallery'].includes(purpose)) {
    return error('purpose inválido', 400);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.startsWith('image/')) {
    return error('Solo se permiten imágenes (image/jpeg, image/png, image/webp)');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(contentType)) {
    return error('Formato no soportado. Usa JPEG, PNG o WebP.');
  }

  // Read image data
  const imageData = await request.arrayBuffer();

  // Max 5MB
  if (imageData.byteLength > 5 * 1024 * 1024) {
    return error('La imagen no puede superar 5MB');
  }

  // Keep uploads organized by user subfolder: profiles/{userId}/{fileId}.ext
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const folder = purpose === 'avatar' || purpose === 'gallery' ? `profiles/${auth.sub}` : 'assets';
  const key = `${folder}/${generateId()}.${ext}`;

  await env.IMAGES.put(key, imageData, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const publicUrl = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${key}`
    : `/api/images/${key}`; // Serve via Worker in dev

  const user = await env.DB.prepare('SELECT photos, avatar_url FROM users WHERE id = ?').bind(auth.sub).first();
  if (!user) return error('Usuario no encontrado', 404);

  const galleryPhotos = normalizeGalleryPhotos(safeParseJSON(user.photos, []), user.avatar_url);

  if (purpose === 'avatar') {
    await env.DB.prepare(`
      UPDATE users SET avatar_url = ?, avatar_crop = NULL WHERE id = ?
    `).bind(publicUrl, auth.sub).run();

    return json({ url: publicUrl, key, avatar_url: publicUrl, photos: galleryPhotos }, 201);
  }

  if (purpose === 'gallery') {
    const nextPhotos = [...galleryPhotos, publicUrl];
    await env.DB.prepare(`
      UPDATE users SET photos = ? WHERE id = ?
    `).bind(JSON.stringify(nextPhotos), auth.sub).run();

    return json({ url: publicUrl, key, avatar_url: user.avatar_url || '', photos: nextPhotos }, 201);
  }

  return json({ url: publicUrl, key }, 201);
}

// ── GET /api/image-proxy?url=... ─────────────────────────
async function handleImageProxy(request, env) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return error('URL requerida', 400);

  // Only allow proxying our own image bucket domains.
  const r2Base = env.R2_PUBLIC_URL || '';
  const legacyBase = 'https://pub-c0bc1ab6fb294cc1bb2e231bb55b4afb.r2.dev';
  const allowed = [r2Base, legacyBase].filter(Boolean);
  if (!allowed.some((base) => url.startsWith(base))) return error('URL no permitida', 403);

  const res = await fetch(url);
  if (!res.ok) return error('Imagen no encontrada', 404);

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ── GET /api/media?key=... ──────────────────────────────
async function handleMediaProxy(request, env) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return error('key requerida', 400);

  const hasRange = request.headers.has('Range');
  const object = hasRange
    ? await env.IMAGES.get(key, { range: request.headers })
    : await env.IMAGES.get(key);

  if (!object) return error('Media no encontrada', 404);

  const headers = new Headers();
  if (typeof object.writeHttpMetadata === 'function') {
    object.writeHttpMetadata(headers);
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  }
  headers.set('Cache-Control', object.httpMetadata?.cacheControl || 'public, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  let status = 200;
  if (hasRange && object.range && typeof object.size === 'number') {
    status = 206;
    const start = Number(object.range.offset || 0);
    const length = Number(object.range.length || 0);
    const end = Math.max(start, start + Math.max(0, length) - 1);
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(length));
  } else if (typeof object.size === 'number') {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(object.body, { status, headers });
}

// ── DELETE /api/photos ───────────────────────────────────

async function handleDeletePhoto(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { url } = await request.json();
  if (!url || typeof url !== 'string') return error('URL requerida', 400);

  // Get user's current photos
  const user = await env.DB.prepare('SELECT photos, avatar_url FROM users WHERE id = ?').bind(auth.sub).first();
  if (!user) return error('Usuario no encontrado', 404);
  if (user.avatar_url === url) return error('La foto de perfil se gestiona por separado', 400);

  const photos = normalizeGalleryPhotos(safeParseJSON(user.photos, []), user.avatar_url);
  const index = photos.indexOf(url);
  if (index === -1) return error('Foto no encontrada', 404);

  // Remove from array
  photos.splice(index, 1);

  await env.DB.prepare('UPDATE users SET photos = ? WHERE id = ?')
    .bind(JSON.stringify(photos), auth.sub).run();

  // Try to delete from R2 (extract key from URL)
  try {
    const r2Base = env.R2_PUBLIC_URL || '';
    let key = '';
    if (r2Base && url.startsWith(r2Base)) {
      key = url.slice(r2Base.length + 1); // strip base + '/'
    } else if (url.includes('/api/images/')) {
      key = url.split('/api/images/')[1]; // legacy format
    }
    if (key) {
      await env.IMAGES.delete(key);
    }
  } catch {
    // R2 delete is best-effort
  }

  return json({ photos, avatar_url: user.avatar_url || '' });
}

// handleServeImage removed — images now served directly from R2 public bucket

// ── PUT /api/profile ────────────────────────────────────

async function handleUpdateProfile(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const body = await request.json();
  const allowedFields = ['username', 'role', 'seeking', 'interests', 'age', 'city', 'bio', 'avatar_url', 'avatar_crop', 'premium'];
  const currentUser = await env.DB.prepare('SELECT premium, premium_until, avatar_url FROM users WHERE id = ?').bind(auth.sub).first();
  if (!currentUser) return error('Usuario no encontrado', 404);

  // Validate and allow photos reorder (all URLs must originate from our R2 bucket)
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) return error('photos debe ser un arreglo', 400);
    const r2Base = env.R2_PUBLIC_URL || '';
    const legacyBase = 'https://mansion-deseo-api-production.green-silence-8594.workers.dev/api/images';
    const allValid = body.photos.every(url => typeof url === 'string' && (url.startsWith(r2Base) || url.startsWith(legacyBase)));
    if (!allValid) return error('URL de foto inválida', 400);
    allowedFields.push('photos');
  }

  // ghost_mode is only allowed for premium users
  const isPremium = isPremiumActive(currentUser);
  if (isPremium) {
    allowedFields.push('ghost_mode');
  }

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'seeking') {
        // Validate and store seeking as JSON array
        const seekVal = Array.isArray(body[field]) ? body[field] : [body[field]];
        const validS = ['hombre', 'mujer', 'pareja'];
        const filtered = seekVal.filter(s => validS.includes(s));
        if (filtered.length === 0) continue;
        updates.push(`${field} = ?`);
        values.push(JSON.stringify(filtered));
      } else if (field === 'interests' || field === 'photos' || field === 'avatar_crop') {
        updates.push(`${field} = ?`);
        if (field === 'photos') {
          const effectiveAvatarUrl = body.avatar_url !== undefined ? body.avatar_url : currentUser.avatar_url;
          values.push(JSON.stringify(normalizeGalleryPhotos(body[field], effectiveAvatarUrl)));
        } else {
          values.push(JSON.stringify(body[field]));
        }
      } else if (field === 'ghost_mode' || field === 'premium') {
        updates.push(`${field} = ?`);
        values.push(body[field] ? 1 : 0);
      } else {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
  }

  if (updates.length === 0) return error('No hay campos para actualizar');

  values.push(auth.sub);
  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values).run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.sub).first();
  return json({ user: sanitizeUser(user, env) });
}

// ── POST /api/auth/logout ───────────────────────────────

async function handleLogout(request, env) {
  const auth = await authenticate(request, env);
  if (auth) {
    await env.DB.prepare("UPDATE users SET online = 0, last_active = datetime('now') WHERE id = ?")
      .bind(auth.sub).run();
  }
  return json({ message: 'Sesión cerrada' });
}

// ── Utility functions ───────────────────────────────────

// ── Plan durations (days) ────────────────────────────────
const PLAN_DAYS = {
  premium_mensual: 30,
  premium_3meses: 90,
  premium_6meses: 180,
};

function isPremiumActive(user) {
  if (!user.premium_until) return false;
  return new Date(user.premium_until + 'Z') > new Date();
}

function activatePremium(currentPremiumUntil, planId) {
  const days = PLAN_DAYS[planId] || 30;
  const now = new Date();
  // Si la suscripción actual aún es válida, extender desde premium_until
  const base = (currentPremiumUntil && new Date(currentPremiumUntil + 'Z') > now)
    ? new Date(currentPremiumUntil + 'Z')
    : now;
  base.setDate(base.getDate() + days);
  return base.toISOString().replace('Z', '').split('.')[0]; // datetime format for D1
}

function sanitizeUser(user, env) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  const premiumActive = isPremiumActive(safe);
  // Auto-disable ghost_mode if premium has expired
  const ghostMode = premiumActive ? !!safe.ghost_mode : false;
  if (!premiumActive && safe.ghost_mode && env) {
    env.DB.prepare('UPDATE users SET ghost_mode = 0 WHERE id = ?').bind(safe.id).run().catch(() => {});
  }
  // Parse seeking: handle both old single-value and new JSON array format
  const seekingRaw = safe.seeking;
  let seekingParsed;
  try { seekingParsed = JSON.parse(seekingRaw); } catch { seekingParsed = null; }
  if (!Array.isArray(seekingParsed)) seekingParsed = seekingRaw ? [seekingRaw] : ['hombre'];

  return {
    ...safe,
    seeking: seekingParsed,
    interests: safeParseJSON(safe.interests, []),
    photos: normalizeGalleryPhotos(safeParseJSON(safe.photos, []), safe.avatar_url),
    avatar_crop: safeParseJSON(safe.avatar_crop, null),
    verified: !!safe.verified,
    online: !!safe.online,
    premium: premiumActive,
    premium_until: safe.premium_until || null,
    ghost_mode: ghostMode,
    is_admin: !!safe.is_admin,
    coins: safe.coins || 0,
  };
}

function mapRoleToDisplay(role) {
  const map = { hombre: 'Hombre Solo', mujer: 'Mujer Sola', pareja: 'Pareja' };
  return map[role] || role;
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); }
  catch { return fallback; }
}

// ══════════════════════════════════════════════════════════
// PROFILE VISITS
// ══════════════════════════════════════════════════════════

async function handleGetVisits(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.avatar_url, u.avatar_crop, u.age, u.city, u.role, u.premium, u.last_active,
            MAX(pv.created_at) as visited_at
     FROM profile_visits pv
     JOIN users u ON u.id = pv.visitor_id
     WHERE pv.visited_id = ?
     GROUP BY pv.visitor_id
     ORDER BY visited_at DESC
     LIMIT 10`
  ).bind(auth.sub).all();

  const visitors = results.map(v => ({
    id: v.id,
    name: v.username,
    avatar_url: v.avatar_url,
    avatar_crop: safeParseJSON(v.avatar_crop, null),
    age: v.age,
    city: v.city,
    role: v.role,
    premium: !!v.premium,
    online: isOnline(v.last_active),
    visited_at: v.visited_at,
  }));

  return json({ visitors });
}

// ══════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════

// ── Helper: load site settings as object ────────────────
async function loadSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  for (const r of results) settings[r.key] = r.value;
  const storyCirclePresetMedium = parseInt(settings.story_circle_preset_medium || settings.story_circle_size || '88', 10);
  const storyCirclePresetXl = parseInt(settings.story_circle_preset_xl || settings.sidebar_avatar_size || '154', 10);
  return {
    blurLevel: parseInt(settings.blur_level || '14', 10),
    blurMobile: parseInt(settings.blur_mobile || settings.blur_level || '14', 10),
    blurDesktop: parseInt(settings.blur_desktop || settings.blur_level || '8', 10),
    freeVisiblePhotos: parseInt(settings.free_visible_photos || '1', 10),
    showVipButton: settings.show_vip_button !== '0',
    dailyMessageLimit: parseInt(settings.daily_message_limit || '5', 10),
    siteCountry: settings.site_country || 'AR',
    siteTimezone: settings.site_timezone || 'America/Argentina/Buenos_Aires',
    hidePasswordRegister: settings.hide_password_register !== '0',
    vipPriceMonthly: settings.vip_price_monthly || '',
    vipPrice3Months: settings.vip_price_3months || '',
    vipPrice6Months: settings.vip_price_6months || '',
    incognitoIconSvg: settings.incognito_icon_svg || '',
    roleHombreImg: settings.role_hombre_img || '',
    roleMujerImg: settings.role_mujer_img || '',
    roleParejaImg: settings.role_pareja_img || '',
    galleryHombreImg: settings.gallery_hombre_img || '',
    galleryMujerImg: settings.gallery_mujer_img || '',
    galleryParejaImg: settings.gallery_pareja_img || '',
    allowedCountries: settings.allowed_countries || 'AR',
    coinPack1Coins: settings.coin_pack_1_coins || '1000',
    coinPack1Price: settings.coin_pack_1_price || '',
    coinPack2Coins: settings.coin_pack_2_coins || '2000',
    coinPack2Price: settings.coin_pack_2_price || '',
    coinPack3Coins: settings.coin_pack_3_coins || '3000',
    coinPack3Price: settings.coin_pack_3_price || '',
    paymentTitleVip: settings.payment_title_vip || 'Servicios Digitales',
    paymentDescriptorVip: settings.payment_descriptor_vip || 'UNICOAPPS',
    paymentTitleCoins: settings.payment_title_coins || 'Servicios Digitales',
    paymentDescriptorCoins: settings.payment_descriptor_coins || 'UNICOAPPS',
    paymentGateway: settings.payment_gateway || 'mercadopago',
    storyCircleSize: storyCirclePresetMedium,
    storyCirclePresetSmall: parseInt(settings.story_circle_preset_small || '72', 10),
    storyCirclePresetMedium,
    storyCirclePresetLarge: parseInt(settings.story_circle_preset_large || '104', 10),
    storyCirclePresetXl,
    sidebarAvatarSize: storyCirclePresetXl,
    storyCircleGap: parseInt(settings.story_circle_gap || '8', 10),
    storyCircleBorder: parseInt(settings.story_circle_border || '4', 10),
    storyCircleInnerGap: parseInt(settings.story_circle_inner_gap || '3', 10),
    coinIconUrl: settings.coin_icon_url || '',
    coinIconSize: parseInt(settings.coin_icon_size || '18', 10),
    navBottomPadding: parseInt(settings.nav_bottom_padding || '24', 10),
    navSidePadding: parseInt(settings.nav_side_padding || '16', 10),
    navHeight: parseInt(settings.nav_height || '71', 10),
    navOpacity: parseInt(settings.nav_opacity || '40', 10),
    navBlur: parseInt(settings.nav_blur || '24', 10),
    videoGradientHeight: parseInt(settings.video_gradient_height || '64', 10),
    videoGradientOpacity: parseInt(settings.video_gradient_opacity || '40', 10),
    videoAvatarSize: parseInt(settings.video_avatar_size || '52', 10),
    sidebarStoryRingWidth: parseInt(settings.sidebar_story_ring_width || '4', 10),
    storyMaxDurationSeconds: parseInt(settings.story_max_duration_seconds || '15', 10),
    encoderThreads: parseInt(settings.encoder_threads || '4', 10),
    encoderCrf: settings.encoder_crf || '29',
    encoderMaxrate: settings.encoder_maxrate || '2700k',
    encoderBufsize: settings.encoder_bufsize || '8000k',
    encoderAudioBitrate: settings.encoder_audio_bitrate || '64k',
    encoderAudioMono: settings.encoder_audio_mono !== '0',
    encoderPreset: settings.encoder_preset || 'superfast',
    encoderShowProgressHud: settings.encoder_show_progress_hud === '1',
    resendApiKey: settings.resend_api_key || env.RESEND_API_KEY || '',
    mailFrom: settings.mail_from || env.MAIL_FROM || 'noreply@unicoapps.com',
  };
}

// ── GET /api/detect-country ──────────────────────────────
async function handleDetectCountry(request) {
  const country = request.headers.get('cf-ipcountry') || '';
  return json({ country }, 200, {
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
  });
}

// ── GET /api/settings/public ─────────────────────────────
// Returns non-sensitive settings (VIP prices, blur, etc.)
async function handleGetPublicSettings(request, env) {
  const settings = await loadSettings(env);
  return json({ settings: getPublicSettingsPayload(settings) }, 200, {
    'Cache-Control': 'public, max-age=300, s-maxage=300',
  });
}

function getPublicSettingsPayload(settings) {
  return {
    vipPriceMonthly: settings.vipPriceMonthly,
    vipPrice3Months: settings.vipPrice3Months,
    vipPrice6Months: settings.vipPrice6Months,
    showVipButton: settings.showVipButton,
    blurMobile: settings.blurMobile,
    blurDesktop: settings.blurDesktop,
    freeVisiblePhotos: settings.freeVisiblePhotos,
    allowedCountries: settings.allowedCountries,
    coinPack1Coins: settings.coinPack1Coins,
    coinPack1Price: settings.coinPack1Price,
    coinPack2Coins: settings.coinPack2Coins,
    coinPack2Price: settings.coinPack2Price,
    coinPack3Coins: settings.coinPack3Coins,
    coinPack3Price: settings.coinPack3Price,
    paymentGateway: settings.paymentGateway,
    hidePasswordRegister: settings.hidePasswordRegister,
    roleHombreImg: settings.roleHombreImg,
    roleMujerImg: settings.roleMujerImg,
    roleParejaImg: settings.roleParejaImg,
    galleryHombreImg: settings.galleryHombreImg,
    galleryMujerImg: settings.galleryMujerImg,
    galleryParejaImg: settings.galleryParejaImg,
    coinIconUrl: settings.coinIconUrl,
    coinIconSize: settings.coinIconSize,
    navBottomPadding: settings.navBottomPadding,
    navSidePadding: settings.navSidePadding,
    navHeight: settings.navHeight,
    navOpacity: settings.navOpacity,
    navBlur: settings.navBlur,
    storyCirclePresetSmall: settings.storyCirclePresetSmall,
    storyCirclePresetMedium: settings.storyCirclePresetMedium,
    storyCirclePresetLarge: settings.storyCirclePresetLarge,
    storyCirclePresetXl: settings.storyCirclePresetXl,
    sidebarAvatarSize: settings.sidebarAvatarSize,
    videoGradientHeight: settings.videoGradientHeight,
    videoGradientOpacity: settings.videoGradientOpacity,
    videoAvatarSize: settings.videoAvatarSize,
    storyMaxDurationSeconds: settings.storyMaxDurationSeconds,
    encoderThreads: settings.encoderThreads,
    encoderCrf: settings.encoderCrf,
    encoderMaxrate: settings.encoderMaxrate,
    encoderBufsize: settings.encoderBufsize,
    encoderAudioBitrate: settings.encoderAudioBitrate,
    encoderAudioMono: settings.encoderAudioMono,
    encoderPreset: settings.encoderPreset,
    encoderShowProgressHud: settings.encoderShowProgressHud,
    sidebarStoryRingWidth: settings.sidebarStoryRingWidth,
  };
}

// ── GET /api/settings ───────────────────────────────────
async function handleGetSettings(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  // Check admin
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);
  const settings = await loadSettings(env);
  return json({ settings });
}

// ── PUT /api/settings ───────────────────────────────────
async function handleUpdateSettings(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  // Check admin
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);
  const body = await request.json();
  const allowed = [
    'blur_level', 'blur_mobile', 'blur_desktop',
    'free_visible_photos', 'show_vip_button',
    'daily_message_limit', 'site_country', 'site_timezone',
    'hide_password_register',
    'vip_price_monthly', 'vip_price_3months', 'vip_price_6months',
    'incognito_icon_svg',
    'role_hombre_img', 'role_mujer_img', 'role_pareja_img',
    'gallery_hombre_img', 'gallery_mujer_img', 'gallery_pareja_img',
    'allowed_countries',
    'coin_pack_1_coins', 'coin_pack_1_price',
    'coin_pack_2_coins', 'coin_pack_2_price',
    'coin_pack_3_coins', 'coin_pack_3_price',
    'payment_title_vip', 'payment_descriptor_vip',
    'payment_title_coins', 'payment_descriptor_coins',
    'payment_gateway',
    'story_circle_size',
    'story_circle_preset_small',
    'story_circle_preset_medium',
    'story_circle_preset_large',
    'story_circle_preset_xl',
    'sidebar_avatar_size',
    'story_circle_gap',
    'story_circle_border',
    'story_circle_inner_gap',
    'sidebar_story_ring_width',
    'coin_icon_url',
    'coin_icon_size',
    'nav_bottom_padding',
    'nav_side_padding',
    'nav_height',
    'nav_opacity',
    'nav_blur',
    'video_gradient_height',
    'video_gradient_opacity',
    'video_avatar_size',
    'story_max_duration_seconds',
    'encoder_threads',
    'encoder_crf',
    'encoder_maxrate',
    'encoder_bufsize',
    'encoder_audio_bitrate',
    'encoder_audio_mono',
    'encoder_preset',
    'encoder_show_progress_hud',
    'resend_api_key',
    'mail_from',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await env.DB.prepare(
        'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      ).bind(key, String(body[key]), String(body[key])).run();
    }
  }
  // Invalidate settings cache so new values take effect immediately
  _cache.delete('settings');
  const settings = await loadSettings(env);
  return json({ settings });
}

// ── POST /api/favorites/:id (toggle) ───────────────────
async function handleToggleFavorite(request, env, targetId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  if (targetId === auth.sub) return error('No puedes agregarte a favoritos');

  const existing = await env.DB.prepare(
    'SELECT user_id FROM favorites WHERE user_id = ? AND target_id = ?'
  ).bind(auth.sub, targetId).first();

  if (existing) {
    await env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND target_id = ?')
      .bind(auth.sub, targetId).run();
    return json({ favorited: false });
  } else {
    await env.DB.prepare('INSERT INTO favorites (user_id, target_id) VALUES (?, ?)')
      .bind(auth.sub, targetId).run();
    return json({ favorited: true });
  }
}

// ── GET /api/favorites ──────────────────────────────────
async function handleGetFavorites(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const viewer = await env.DB.prepare('SELECT premium FROM users WHERE id = ?').bind(auth.sub).first();
  const viewerIsPremium = viewer && !!viewer.premium;
  const settings = await loadSettings(env);

  const { results: favByRows } = await env.DB.prepare('SELECT user_id FROM favorites WHERE target_id = ?').bind(auth.sub).all();
  const favoritedBySet = new Set(favByRows.map(r => r.user_id));

  const { results } = await env.DB.prepare(
    `SELECT u.* FROM favorites f JOIN users u ON u.id = f.target_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`
  ).bind(auth.sub).all();

  const profiles = results.map(u => {
    const hasGhostMode = isPremiumActive(u) && !!u.ghost_mode;
    const blurred = hasGhostMode && !viewerIsPremium && !favoritedBySet.has(u.id);
    const galleryPhotos = normalizeGalleryPhotos(safeParseJSON(u.photos, []), u.avatar_url);
    const displayPhotos = buildDisplayPhotos(u.avatar_url, galleryPhotos);
    const visiblePhotos = viewerIsPremium
      ? displayPhotos.length
      : blurred ? 0 : Math.min(displayPhotos.length, settings.freeVisiblePhotos);
    return {
      id: u.id,
      name: u.username,
      age: u.age,
      city: u.city,
      role: mapRoleToDisplay(u.role),
      interests: safeParseJSON(u.interests, []),
      photos: galleryPhotos,
      totalPhotos: displayPhotos.length,
      visiblePhotos,
      verified: !!u.verified,
      online: !!u.online,
      premium: !!u.premium,
      blurred,
      avatar_url: u.avatar_url,
      avatar_crop: safeParseJSON(u.avatar_crop, null),
    };
  });

  return json({ profiles, viewerPremium: viewerIsPremium, settings });
}

// ── GET /api/favorites/check/:id ────────────────────────
async function handleCheckFavorite(request, env, targetId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const row = await env.DB.prepare(
    'SELECT user_id FROM favorites WHERE user_id = ? AND target_id = ?'
  ).bind(auth.sub, targetId).first();
  return json({ favorited: !!row });
}

// ══════════════════════════════════════════════════════════
// GIFTS & COINS
// ══════════════════════════════════════════════════════════

// ── GET /api/gifts/catalog ──────────────────────────────
async function handleGetGiftCatalog(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { results } = await env.DB.prepare(
    'SELECT id, name, emoji, price, category FROM gift_catalog WHERE active = 1 ORDER BY sort_order ASC'
  ).all();

  return json({ gifts: results });
}

// ── POST /api/gifts/send ────────────────────────────────
async function handleSendGift(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { receiver_id, gift_id, message: giftMessage } = await request.json();
  if (!receiver_id || !gift_id) return error('receiver_id y gift_id requeridos');
  if (receiver_id === auth.sub) return error('No puedes enviarte un regalo a ti mismo');

  // Validate receiver exists
  const receiver = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(receiver_id).first();
  if (!receiver) return error('Destinatario no encontrado', 404);

  // Get gift from catalog
  const gift = await env.DB.prepare('SELECT * FROM gift_catalog WHERE id = ? AND active = 1').bind(gift_id).first();
  if (!gift) return error('Regalo no encontrado', 404);

  // Check sender has enough coins
  const sender = await env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(auth.sub).first();
  if (!sender || sender.coins < gift.price) {
    return error(`No tienes suficientes monedas. Necesitas ${gift.price} monedas.`, 403);
  }

  // Deduct coins from sender
  await env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').bind(gift.price, auth.sub).run();

  // Create gift record
  const giftRecordId = generateId();
  const safeMessage = (giftMessage || '').slice(0, 200);
  await env.DB.prepare(
    'INSERT INTO user_gifts (id, sender_id, receiver_id, gift_id, message) VALUES (?, ?, ?, ?, ?)'
  ).bind(giftRecordId, auth.sub, receiver_id, gift_id, safeMessage).run();

  // Get updated sender coins
  const updated = await env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(auth.sub).first();

  // Notify receiver in real-time
  try {
    const senderUser = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(auth.sub).first();
    await notifyUser(env, receiver_id, {
      type: 'gift',
      senderName: senderUser?.username || 'Alguien',
      giftName: gift.name,
      giftEmoji: gift.emoji,
      message: safeMessage,
    });
  } catch (e) {
    console.error('[handleSendGift] notification error:', e.message);
  }

  return json({
    success: true,
    coins: updated.coins,
    gift: { id: giftRecordId, gift_name: gift.name, gift_emoji: gift.emoji, price: gift.price },
  });
}

// ── GET /api/gifts/received/:userId ─────────────────────
async function handleGetReceivedGifts(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { results } = await env.DB.prepare(
    `SELECT ug.id, ug.message, ug.created_at,
            gc.name as gift_name, gc.emoji as gift_emoji, gc.price as gift_price,
            u.id as sender_id, u.username as sender_name, u.avatar_url as sender_avatar
     FROM user_gifts ug
     JOIN gift_catalog gc ON gc.id = ug.gift_id
     JOIN users u ON u.id = ug.sender_id
     WHERE ug.receiver_id = ?
     ORDER BY ug.created_at DESC
     LIMIT 50`
  ).bind(userId).all();

  return json({ gifts: results });
}

// ── GET /api/coins ──────────────────────────────────────
async function handleGetCoins(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const user = await env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(auth.sub).first();
  return json({ coins: user?.coins || 0 });
}

// ── Admin: GET /api/admin/gifts ─────────────────────────
async function handleAdminGetGifts(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const { results } = await env.DB.prepare(
    'SELECT * FROM gift_catalog ORDER BY sort_order ASC'
  ).all();
  return json({ gifts: results });
}

// ── Admin: POST /api/admin/gifts ────────────────────────
async function handleAdminCreateGift(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const { name, emoji, price, category } = await request.json();
  if (!name || !emoji || !price) return error('name, emoji y price requeridos');

  const id = `gift-${generateId().slice(0, 8)}`;
  const maxOrder = await env.DB.prepare('SELECT MAX(sort_order) as max_order FROM gift_catalog').first();
  const sortOrder = (maxOrder?.max_order || 0) + 1;

  await env.DB.prepare(
    'INSERT INTO gift_catalog (id, name, emoji, price, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, name, emoji, Number(price), category || 'general', sortOrder).run();

  const { results } = await env.DB.prepare('SELECT * FROM gift_catalog ORDER BY sort_order ASC').all();
  return json({ gifts: results });
}

// ── Admin: DELETE /api/admin/gifts/:id ──────────────────
async function handleAdminDeleteGift(request, env, giftId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  await env.DB.prepare('UPDATE gift_catalog SET active = 0 WHERE id = ?').bind(giftId).run();

  const { results } = await env.DB.prepare('SELECT * FROM gift_catalog ORDER BY sort_order ASC').all();
  return json({ gifts: results });
}

// ── Admin: POST /api/admin/coins ────────────────────────
async function handleAdminAddCoins(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const { user_id, amount } = await request.json();
  if (!user_id || !amount) return error('user_id y amount requeridos');

  await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(Number(amount), user_id).run();
  const user = await env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(user_id).first();
  return json({ coins: user?.coins || 0 });
}

// ── Admin: POST /api/admin/remove-all-vip ──────────────
async function handleAdminRemoveAllVip(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const { meta } = await env.DB.prepare('UPDATE users SET premium = 0, premium_until = NULL, ghost_mode = 0 WHERE premium = 1 OR premium_until IS NOT NULL').run();
  console.log(`🔧 Admin removió VIP de todos los usuarios — ${meta.changes} afectados`);
  return json({ success: true, affected: meta.changes });
}

// ── Admin: POST /api/admin/reset-all-coins ──────────────
async function handleAdminResetAllCoins(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const { meta } = await env.DB.prepare('UPDATE users SET coins = 0').run();
  console.log(`🔧 Admin reseteó monedas de todos los usuarios — ${meta.changes} afectados`);
  return json({ success: true, affected: meta.changes });
}

// ── Admin: GET /api/admin/users ─────────────────────────
async function handleAdminGetUsers(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const q = (url.searchParams.get('q') || '').trim();
  const offset = (page - 1) * limit;

  let countQuery = 'SELECT COUNT(*) as total FROM users';
  let dataQuery = `SELECT id, email, username, role, seeking, age, city, country, avatar_url, status,
    premium, premium_until, ghost_mode, verified, online, coins, is_admin, account_status, last_active, last_ip, created_at,
    (SELECT s.id FROM stories s WHERE s.user_id = users.id ORDER BY s.created_at DESC LIMIT 1) as story_id
    FROM users`;
  const bindings = [];

  if (q) {
    const filter = ` WHERE email LIKE ? OR username LIKE ? OR id = ?`;
    countQuery += filter;
    dataQuery += filter;
    bindings.push(`%${q}%`, `%${q}%`, q);
  }

  dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const countStmt = q
    ? env.DB.prepare(countQuery).bind(...bindings)
    : env.DB.prepare(countQuery);
  const dataStmt = q
    ? env.DB.prepare(dataQuery).bind(...bindings, limit, offset)
    : env.DB.prepare(dataQuery).bind(limit, offset);

  const [countRes, dataRes] = await Promise.all([countStmt.first(), dataStmt.all()]);

  return json({
    users: dataRes.results.map(u => ({
      ...u,
      premium: isPremiumActive(u),
      online: isOnline(u.last_active),
      is_admin: !!u.is_admin,
      story_id: u.story_id || null,
      interests: undefined,
      photos: undefined,
    })),
    total: countRes.total,
    page,
    pages: Math.ceil(countRes.total / limit),
  });
}

// ── Admin: GET /api/admin/users/:id ─────────────────────
async function handleAdminGetUser(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error('Usuario no encontrado', 404);

  const { password_hash, ...safe } = user;
  return json({
    user: {
      ...safe,
      interests: safeParseJSON(safe.interests, []),
      photos: normalizeGalleryPhotos(safeParseJSON(safe.photos, []), safe.avatar_url),
      avatar_crop: safeParseJSON(safe.avatar_crop, null),
      premium: isPremiumActive(safe),
      online: isOnline(safe.last_active),
      is_admin: !!safe.is_admin,
    }
  });
}

// ── Admin: PUT /api/admin/users/:id ─────────────────────
async function handleAdminUpdateUser(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error('Usuario no encontrado', 404);

  const body = await request.json();
  const updates = [];
  const vals = [];

  if (body.premium !== undefined) { updates.push('premium = ?'); vals.push(body.premium ? 1 : 0); }
  if (body.premium_until !== undefined) { updates.push('premium_until = ?'); vals.push(body.premium_until || null); }
  if (body.is_admin !== undefined) {
    if (userId === auth.sub) return error('No puedes cambiar tu propio rol de admin', 400);
    updates.push('is_admin = ?'); vals.push(body.is_admin ? 1 : 0);
  }
  if (body.coins !== undefined) { updates.push('coins = ?'); vals.push(Math.max(0, Number(body.coins))); }
  if (body.verified !== undefined) { updates.push('verified = ?'); vals.push(body.verified ? 1 : 0); }
  if (body.ghost_mode !== undefined) { updates.push('ghost_mode = ?'); vals.push(body.ghost_mode ? 1 : 0); }
  if (body.status !== undefined && ['pending', 'verified'].includes(body.status)) { updates.push('status = ?'); vals.push(body.status); }
  if (body.account_status !== undefined && ['active', 'under_review', 'suspended'].includes(body.account_status)) {
    updates.push('account_status = ?'); vals.push(body.account_status);
  }

  if (updates.length === 0) return error('Nada que actualizar');

  vals.push(userId);
  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();

  const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  const { password_hash, ...safe } = updated;
  return json({
    user: {
      ...safe,
      interests: safeParseJSON(safe.interests, []),
      photos: normalizeGalleryPhotos(safeParseJSON(safe.photos, []), safe.avatar_url),
      avatar_crop: safeParseJSON(safe.avatar_crop, null),
      premium: isPremiumActive(safe),
      online: isOnline(safe.last_active),
      is_admin: !!safe.is_admin,
    }
  });
}

// ── Admin: DELETE /api/admin/users/:id ───────────────────
async function handleAdminDeleteUser(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  if (userId === auth.sub) return error('No puedes eliminarte a ti mismo', 400);

  const user = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error('Usuario no encontrado', 404);

  // Delete related data (all FK-referencing tables must be cleaned before users row)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM favorites WHERE user_id = ? OR target_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM profile_visits WHERE visitor_id = ? OR visited_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM user_gifts WHERE sender_id = ? OR receiver_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM verification_tokens WHERE user_id = ? OR email = ?').bind(userId, user.email),
    env.DB.prepare('DELETE FROM processed_payments WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM message_limits WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);

  console.log(`🗑️ Admin eliminó usuario ${userId} (${user.email})`);
  return json({ success: true });
}

// ══════════════════════════════════════════════════════════
// PASARELA DE PAGOS — MercadoPago vía Unico Apps Bridge
// ══════════════════════════════════════════════════════════

async function bridgeHmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function bridgeHmacVerify(secret, message, expectedHex) {
  const computed = await bridgeHmacSign(secret, message);
  if (computed.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

// ══════════════════════════════════════════════════════════
// UALÁ BIS — Payment Gateway
// ══════════════════════════════════════════════════════════

// ── Ualá Bis vía Bridge ──────────────────────────────────
// Todas las operaciones de Ualá Bis pasan por el bridge de UnicoApps
// para que el merchant visible sea UnicoApps, no Mansión Deseo.

async function handleUalaPaymentCreate(request, auth, env, settings, plan_id, numericAmount) {
  if (!env.PAYMENT_BRIDGE_URL || !env.BRIDGE_SECRET) {
    return error('Servicio de pagos no configurado', 500);
  }

  const isCoinPurchase = plan_id && plan_id.startsWith('coins_');
  const externalRef = `${auth.sub}--${plan_id}`;
  const baseUrl = getPrimaryAppOrigin(env);
  const workerUrl = new URL(request.url).origin;

  const bodyPayload = JSON.stringify({
    user_id: auth.sub,
    amount: numericAmount,
    plan_id,
    payment_title: isCoinPurchase ? settings.paymentTitleCoins : settings.paymentTitleVip,
    payment_descriptor: isCoinPurchase ? settings.paymentDescriptorCoins : settings.paymentDescriptorVip,
    gateway: 'uala_bis',
    callback_success: `${baseUrl}/pago-exitoso?gateway=uala&external_reference=${encodeURIComponent(externalRef)}`,
    callback_fail: `${baseUrl}/pago-fallido?gateway=uala`,
    approved_callback_url: `${workerUrl}/api/payment/uala-approved`,
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await bridgeHmacSign(env.BRIDGE_SECRET, `${timestamp}.${bodyPayload}`);

  let bridgeData;
  try {
    const bridgeRes = await fetch(`${env.PAYMENT_BRIDGE_URL}/api/uala/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      },
      body: bodyPayload,
    });
    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text();
      console.error('Bridge Ualá error:', bridgeRes.status, 'headers:', JSON.stringify(Object.fromEntries(bridgeRes.headers)), 'body:', errText.substring(0, 500));
      try {
        const errJson = JSON.parse(errText);
        return error(errJson.error || `bridge ${bridgeRes.status}`, 502);
      } catch {
        return error(`bridge ${bridgeRes.status}: ${errText.substring(0, 100)}`, 502);
      }
    }
    bridgeData = await bridgeRes.json();
  } catch (err) {
    console.error('Bridge Ualá fetch error:', err.message);
    return error('Servicio de pagos no disponible', 502);
  }

  return json({
    redirect_url: bridgeData.redirect_url,
    checkout_id: bridgeData.checkout_id,
  });
}

async function handleUalaPaymentConfirm(auth, env, paymentId, externalRef) {
  if (!env.PAYMENT_BRIDGE_URL || !env.BRIDGE_SECRET) {
    return error('Servicio de pagos no configurado', 500);
  }

  const bodyPayload = JSON.stringify({ checkout_id: String(paymentId) });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await bridgeHmacSign(env.BRIDGE_SECRET, `${timestamp}.${bodyPayload}`);

  try {
    const bridgeRes = await fetch(`${env.PAYMENT_BRIDGE_URL}/api/uala/verify-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      },
      body: bodyPayload,
    });
    if (!bridgeRes.ok) return error('No se pudo verificar el pago', 502);
    const data = await bridgeRes.json();

    if (data.status !== 'APPROVED' && !data.is_approved) {
      return json({ premium: false, reason: `status: ${data.status}` });
    }

    const ref = externalRef || '';
    const [refUserId, planId] = ref.split('--');
    if (refUserId !== auth.sub) {
      return error('El pago no pertenece a este usuario', 403);
    }

    const existing = await env.DB.prepare('SELECT 1 FROM processed_payments WHERE payment_id = ?').bind(String(paymentId)).first();
    if (existing) {
      const isCoin = planId && planId.includes('coins_');
      return json({ premium: !isCoin, coins: !!isCoin, already_processed: true });
    }

    const coinPlanMatch = planId && planId.match(/^coins_(\d+)$/);
    if (coinPlanMatch) {
      const coinsToAdd = parseInt(coinPlanMatch[1], 10);
      await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(coinsToAdd, auth.sub).run();
      await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(paymentId), auth.sub, planId, data.amount || 0).run();
      console.log(`✅ [Ualá Bridge] Monedas confirmadas — user: ${auth.sub} | uuid: ${paymentId} | +${coinsToAdd} coins`);
      return json({ coins: true, coinsAdded: coinsToAdd });
    }

    const current = await env.DB.prepare('SELECT premium_until FROM users WHERE id = ?').bind(auth.sub).first();
    const newUntil = activatePremium(current?.premium_until, planId);
    await env.DB.prepare('UPDATE users SET premium = 1, premium_until = ?, coins = coins + 100 WHERE id = ?').bind(newUntil, auth.sub).run();
    await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(paymentId), auth.sub, planId || '', data.amount || 0).run();
    console.log(`✅ [Ualá Bridge] Premium confirmado — user: ${auth.sub} | uuid: ${paymentId} | plan: ${planId} | hasta: ${newUntil}`);
    return json({ premium: true, premium_until: newUntil });
  } catch (err) {
    console.error('Ualá Bridge confirm error:', err.message);
    return error('Error verificando pago', 502);
  }
}

// ── POST /api/payment/uala-approved ─────────────────────
// Recibe callback del bridge cuando el pago Ualá Bis es aprobado.
// NO requiere JWT ni Turnstile — se autentica con HMAC del bridge.
async function handleUalaApproved(request, env) {
  if (!env.BRIDGE_SECRET) return error('Servicio de pagos no configurado', 500);

  const signature = request.headers.get('X-Signature');
  const timestamp = request.headers.get('X-Timestamp');
  if (!signature || !timestamp) return error('Headers de autenticación faltantes', 401);

  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) return error('Solicitud expirada', 401);

  const rawBody = await request.text();
  const expected = await bridgeHmacSign(env.BRIDGE_SECRET, `${timestamp}.${rawBody}`);
  if (signature !== expected) return error('Firma inválida', 401);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return error('JSON inválido', 400);
  }

  const { user_id: userId, plan_id: planId, checkout_id: uuid, amount } = body;
  if (!userId || !planId || !uuid) return error('Datos incompletos', 400);

  const existing = await env.DB.prepare('SELECT 1 FROM processed_payments WHERE payment_id = ?').bind(String(uuid)).first();
  if (existing) {
    console.log(`⚠️ [Ualá Bridge] Payment ${uuid} ya procesado — ignorando`);
    return json({ success: true, already_processed: true });
  }

  try {
    const coinMatch = planId && planId.match(/^coins_(\d+)$/);
    if (coinMatch) {
      const coinsToAdd = parseInt(coinMatch[1], 10);
      await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(coinsToAdd, userId).run();
      await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(uuid), userId, planId, amount || 0).run();
      console.log(`✅ [Ualá Bridge] Monedas acreditadas vía webhook — user: ${userId} | uuid: ${uuid} | +${coinsToAdd} coins`);
    } else {
      const current = await env.DB.prepare('SELECT premium_until FROM users WHERE id = ?').bind(userId).first();
      const newUntil = activatePremium(current?.premium_until, planId);
      await env.DB.prepare('UPDATE users SET premium = 1, premium_until = ?, coins = coins + 100 WHERE id = ?').bind(newUntil, userId).run();
      await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(uuid), userId, planId, amount || 0).run();
      console.log(`✅ [Ualá Bridge] Premium activado vía webhook — user: ${userId} | uuid: ${uuid} | plan: ${planId} | hasta: ${newUntil}`);
    }
  } catch (err) {
    console.error('[Ualá Bridge] DB error:', err.message);
    return error('Error al activar', 500);
  }

  return json({ success: true });
}

// ── POST /api/payment/create ─────────────────────────────
// Requiere JWT del usuario. Crea preferencia de pago en el gateway activo.
async function handlePaymentCreate(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autenticado', 401);

  let plan_id, amount;
  try {
    ({ plan_id, amount } = await request.json());
  } catch {
    return error('JSON inválido');
  }

  if (!plan_id || !amount) return error('plan_id y amount son requeridos');
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) return error('amount inválido');

  const settings = await loadSettings(env);

  // Route to active payment gateway
  if (settings.paymentGateway === 'uala_bis') {
    return handleUalaPaymentCreate(request, auth, env, settings, plan_id, numericAmount);
  }

  // ── MercadoPago via Bridge (default) ──
  if (!env.PAYMENT_BRIDGE_URL || !env.BRIDGE_SECRET) {
    return error('Servicio de pagos no configurado', 500);
  }

  const isCoinPurchase = plan_id && plan_id.startsWith('coins_');
  const bodyPayload = JSON.stringify({
    user_id: auth.sub,
    amount: numericAmount,
    plan_id,
    payment_title: isCoinPurchase ? settings.paymentTitleCoins : settings.paymentTitleVip,
    payment_descriptor: isCoinPurchase ? settings.paymentDescriptorCoins : settings.paymentDescriptorVip,
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await bridgeHmacSign(env.BRIDGE_SECRET, `${timestamp}.${bodyPayload}`);

  let bridgeData;
  try {
    const bridgeRes = await fetch(`${env.PAYMENT_BRIDGE_URL}/api/create-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      },
      body: bodyPayload,
    });
    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text();
      console.error('Bridge error:', bridgeRes.status, errText);
      try {
        const errJson = JSON.parse(errText);
        return error(errJson.error || `bridge ${bridgeRes.status}`, 502);
      } catch {
        return error(`bridge ${bridgeRes.status}`, 502);
      }
    }
    bridgeData = await bridgeRes.json();
  } catch (err) {
    console.error('Bridge fetch error:', err.message);
    return error('Servicio de pagos no disponible', 502);
  }

  return json({ init_point: bridgeData.init_point, preference_id: bridgeData.preference_id });
}

// ── POST /api/payment/approved ───────────────────────────
// Recibe callback del bridge cuando el pago es aprobado.
// NO requiere JWT ni Turnstile — se autentica con HMAC del bridge.
async function handlePaymentApproved(request, env) {
  if (!env.BRIDGE_SECRET) return error('Servicio de pagos no configurado', 500);

  const signature = request.headers.get('X-Signature');
  const timestamp  = request.headers.get('X-Timestamp');
  if (!signature || !timestamp) return error('Headers de autenticación faltantes', 401);

  const now = Math.floor(Date.now() / 1000);
  const ts  = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) return error('Solicitud expirada', 401);

  const rawBody = await request.text();
  const valid = await bridgeHmacVerify(env.BRIDGE_SECRET, `${timestamp}.${rawBody}`, signature);
  if (!valid) return error('Firma inválida', 401);

  let body;
  try { body = JSON.parse(rawBody); } catch { return error('JSON inválido'); }

  const { user_id, plan_id, payment_id, amount, status } = body;
  if (!user_id || status !== 'approved') return error('Datos inválidos');

  try {
    // Prevenir re-uso del mismo payment_id
    const existing = await env.DB.prepare('SELECT 1 FROM processed_payments WHERE payment_id = ?').bind(String(payment_id)).first();
    if (existing) {
      console.log(`⚠️ Payment ${payment_id} ya procesado — ignorando`);
      return json({ success: true, already_processed: true });
    }

    const current = await env.DB.prepare('SELECT premium_until FROM users WHERE id = ?').bind(user_id).first();

    // Check if this is a coin purchase
    const coinMatch = plan_id && plan_id.match(/^coins_(\d+)$/);
    if (coinMatch) {
      const coinsToAdd = parseInt(coinMatch[1], 10);
      await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(coinsToAdd, user_id).run();
      await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(payment_id), user_id, plan_id, amount || 0).run();
      console.log(`✅ Monedas acreditadas — user: ${user_id} | payment: ${payment_id} | +${coinsToAdd} coins`);
    } else {
      const newUntil = activatePremium(current?.premium_until, plan_id);
      await env.DB.prepare('UPDATE users SET premium = 1, premium_until = ?, coins = coins + 100 WHERE id = ?').bind(newUntil, user_id).run();
      await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(payment_id), user_id, plan_id || '', amount || 0).run();
      console.log(`✅ Premium activado — user: ${user_id} | payment: ${payment_id} | plan: ${plan_id} | hasta: ${newUntil} | +100 coins`);
    }
  } catch (err) {
    console.error('DB error activando premium:', err.message);
    return error('Error al activar suscripción', 500);
  }

  return json({ success: true });
}

// ── POST /api/payment/confirm ────────────────────────────
// El frontend llama después del redirect del gateway.
// Verifica el pago y activa premium/monedas si corresponde.
// Requiere JWT (usuario autenticado).
async function handlePaymentConfirm(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autenticado', 401);

  let payment_id, gateway, external_reference;
  try {
    const body = await request.json();
    payment_id = body.payment_id;
    gateway = body.gateway;
    external_reference = body.external_reference;
  } catch {
    return error('JSON inválido');
  }
  if (!payment_id) return error('payment_id requerido');

  // Route to Ualá Bis confirm
  if (gateway === 'uala') {
    return handleUalaPaymentConfirm(auth, env, payment_id, external_reference);
  }

  // ── MercadoPago via Bridge (default) ──
  if (!env.PAYMENT_BRIDGE_URL || !env.BRIDGE_SECRET) {
    return error('Servicio de pagos no configurado', 500);
  }

  // Verificar con bridge
  const bodyPayload = JSON.stringify({ payment_id: String(payment_id) });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await bridgeHmacSign(env.BRIDGE_SECRET, `${timestamp}.${bodyPayload}`);

  try {
    const bridgeRes = await fetch(`${env.PAYMENT_BRIDGE_URL}/api/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      },
      body: bodyPayload,
    });

    if (!bridgeRes.ok) return error('No se pudo verificar el pago', 502);

    const data = await bridgeRes.json();

    // Verificar que el pago sea approved y pertenezca a este usuario
    if (data.status !== 'approved') {
      return json({ premium: false, reason: `status: ${data.status}` });
    }

    const ref = data.external_reference || '';
    const [refUserId, planId] = ref.split('--');
    if (refUserId !== auth.sub) {
      return error('El pago no pertenece a este usuario', 403);
    }

    // Prevenir re-uso del mismo payment_id
    const existing = await env.DB.prepare('SELECT 1 FROM processed_payments WHERE payment_id = ?').bind(String(payment_id)).first();
    if (existing) {
      console.log(`⚠️ Payment ${payment_id} ya procesado vía confirm — ignorando`);
      const coinMatch = ref.includes('coins_');
      return json({ premium: !coinMatch, coins: coinMatch, already_processed: true });
    }

    // Check if this is a coin purchase
    const coinPlanMatch = planId && planId.match(/^coins_(\d+)$/);
    if (coinPlanMatch) {
      const coinsToAdd = parseInt(coinPlanMatch[1], 10);
      await env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(coinsToAdd, auth.sub).run();
      await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(payment_id), auth.sub, planId, data.amount || 0).run();
      console.log(`✅ Monedas confirmadas vía confirm — user: ${auth.sub} | payment: ${payment_id} | +${coinsToAdd} coins`);
      return json({ coins: true, coinsAdded: coinsToAdd });
    }

    // Activar premium con duración según plan + 100 coins de regalo
    const current = await env.DB.prepare('SELECT premium_until FROM users WHERE id = ?').bind(auth.sub).first();
    const newUntil = activatePremium(current?.premium_until, planId);
    await env.DB.prepare('UPDATE users SET premium = 1, premium_until = ?, coins = coins + 100 WHERE id = ?').bind(newUntil, auth.sub).run();
    await env.DB.prepare('INSERT INTO processed_payments (payment_id, user_id, plan_id, amount) VALUES (?, ?, ?, ?)').bind(String(payment_id), auth.sub, planId || '', data.amount || 0).run();
    console.log(`✅ Premium confirmado vía confirm — user: ${auth.sub} | payment: ${payment_id} | plan: ${planId} | hasta: ${newUntil} | +100 coins`);

    return json({ premium: true, premium_until: newUntil });
  } catch (err) {
    console.error('Payment confirm error:', err.message);
    return error('Error verificando pago', 502);
  }
}

// ── Stories ─────────────────────────────────────────────

let _storiesTableReady = null;
async function ensureStoriesTable(env) {
  if (!_storiesTableReady) {
    _storiesTableReady = env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS stories (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id),
        video_url   TEXT NOT NULL,
        caption     TEXT DEFAULT '',
        likes       INTEGER NOT NULL DEFAULT 0,
        comments    INTEGER NOT NULL DEFAULT 0,
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run().then(() =>
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(active, created_at)').run()
    ).then(() =>
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS story_likes (
          user_id   TEXT NOT NULL,
          story_id  TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, story_id)
        )
      `).run()
    ).catch((err) => {
      _storiesTableReady = null;
      throw err;
    });
  }
  return _storiesTableReady;
}

// GET /api/stories
async function handleGetStories(request, env) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  // Try to get current user for per-user liked status
  const auth = await authenticate(request, env).catch(() => null);
  const viewerId = auth?.sub || null;

  const { results } = await env.DB.prepare(`
    SELECT s.id, s.user_id, s.video_url, s.caption, s.likes, s.comments, s.created_at,
           u.username, u.avatar_url, u.avatar_crop,
           CASE WHEN sl.user_id IS NOT NULL THEN 1 ELSE 0 END as liked
    FROM stories s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN story_likes sl ON sl.story_id = s.id AND sl.user_id = ?
    WHERE s.active = 1
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(viewerId || '', limit, offset).all();

  const stories = (results || []).map(r => ({
    id: r.id,
    user_id: r.user_id,
    video_url: normalizeStoryVideoUrl(r.video_url, env),
    caption: r.caption || '',
    likes: r.likes || 0,
    liked: !!r.liked,
    comments: r.comments || 0,
    created_at: r.created_at,
    username: r.username,
    avatar_url: r.avatar_url || '',
    avatar_crop: safeParseJSON(r.avatar_crop, null),
  }));

  return json({ stories });
}

// POST /api/stories/:id/like — toggle like on a story
async function handleToggleStoryLike(request, env, storyId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const story = await env.DB.prepare('SELECT id, user_id, likes FROM stories WHERE id = ?').bind(storyId).first();
  if (!story) return error('Historia no encontrada', 404);

  const existing = await env.DB.prepare(
    'SELECT user_id FROM story_likes WHERE user_id = ? AND story_id = ?'
  ).bind(auth.sub, storyId).first();

  let liked;
  let newLikes;
  if (existing) {
    await env.DB.prepare('DELETE FROM story_likes WHERE user_id = ? AND story_id = ?')
      .bind(auth.sub, storyId).run();
    await env.DB.prepare('UPDATE stories SET likes = MAX(0, likes - 1) WHERE id = ?').bind(storyId).run();
    liked = false;
    newLikes = Math.max(0, (story.likes || 0) - 1);
  } else {
    await env.DB.prepare('INSERT INTO story_likes (user_id, story_id) VALUES (?, ?)')
      .bind(auth.sub, storyId).run();
    await env.DB.prepare('UPDATE stories SET likes = likes + 1 WHERE id = ?').bind(storyId).run();
    liked = true;
    newLikes = (story.likes || 0) + 1;

    // Notify the story author (don't notify yourself)
    if (story.user_id !== auth.sub) {
      try {
        const liker = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(auth.sub).first();
        await notifyUser(env, story.user_id, {
          type: 'story_like',
          senderName: liker?.username || 'Alguien',
          storyId,
        });
      } catch (e) {
        console.error('[handleToggleStoryLike] notification error:', e.message);
      }
    }
  }

  return json({ liked, likes: newLikes });
}

async function handleSyncStoryLikes(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const body = await request.json().catch(() => ({}));
  const rawUpdates = Array.isArray(body?.updates) ? body.updates : [];
  if (rawUpdates.length === 0) return json({ updates: [] });

  const deduped = new Map();
  for (const update of rawUpdates) {
    const storyId = typeof update?.story_id === 'string' ? update.story_id : '';
    if (!storyId) continue;
    deduped.set(storyId, !!update?.liked);
  }

  const updates = [];
  for (const [storyId, desiredLiked] of deduped.entries()) {
    const story = await env.DB.prepare('SELECT id, user_id, likes FROM stories WHERE id = ?').bind(storyId).first();
    if (!story) continue;

    const existing = await env.DB.prepare(
      'SELECT user_id FROM story_likes WHERE user_id = ? AND story_id = ?'
    ).bind(auth.sub, storyId).first();

    let liked = !!existing;
    let likes = Number(story.likes || 0);

    if (desiredLiked && !existing) {
      await env.DB.prepare('INSERT OR IGNORE INTO story_likes (user_id, story_id) VALUES (?, ?)')
        .bind(auth.sub, storyId).run();
      await env.DB.prepare('UPDATE stories SET likes = likes + 1 WHERE id = ?').bind(storyId).run();
      liked = true;
      likes += 1;

      if (story.user_id !== auth.sub) {
        try {
          const liker = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(auth.sub).first();
          await notifyUser(env, story.user_id, {
            type: 'story_like',
            senderName: liker?.username || 'Alguien',
            storyId,
          });
        } catch (e) {
          console.error('[handleSyncStoryLikes] notification error:', e.message);
        }
      }
    } else if (!desiredLiked && existing) {
      await env.DB.prepare('DELETE FROM story_likes WHERE user_id = ? AND story_id = ?')
        .bind(auth.sub, storyId).run();
      await env.DB.prepare('UPDATE stories SET likes = MAX(0, likes - 1) WHERE id = ?').bind(storyId).run();
      liked = false;
      likes = Math.max(0, likes - 1);
    }

    updates.push({ story_id: storyId, liked, likes });
  }

  return json({ updates });
}

async function handleDebugMediaCache(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);

  const body = await request.json().catch(() => ({}));
  const urls = Array.isArray(body?.urls) ? body.urls.filter((value) => typeof value === 'string' && /^https?:\/\//i.test(value)).slice(0, 24) : [];

  const entries = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      entries.push({
        url,
        status: response.status,
        cacheStatus: response.headers.get('cf-cache-status') || '',
        age: response.headers.get('age') || '',
        cacheControl: response.headers.get('cache-control') || '',
        contentType: response.headers.get('content-type') || '',
        contentLength: response.headers.get('content-length') || '',
      });
    } catch (err) {
      entries.push({
        url,
        error: err?.message || 'request_failed',
      });
    }
  }

  return json({ entries });
}

// POST /api/admin/upload-story — admin uploads a video story for any user
async function handleAdminUploadStory(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);


  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const caption = url.searchParams.get('caption') || '';

  if (!userId) return error('user_id requerido', 400);

  // Verify target user exists
  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!targetUser) return error('Usuario no encontrado', 404);

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.startsWith('video/')) {
    return error('Solo se permiten videos (video/mp4, video/webm, video/quicktime)');
  }

  const videoData = await request.arrayBuffer();

  // Max 50MB for videos
  if (videoData.byteLength > 50 * 1024 * 1024) {
    return error('El video no puede superar 50MB');
  }

  const ext = contentType === 'video/webm' ? 'webm' : contentType === 'video/quicktime' ? 'mov' : 'mp4';
  const key = `stories/${generateId()}.${ext}`;

  await env.IMAGES.put(key, videoData, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const videoUrl = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${key}`
    : `/api/images/${key}`;

  // Delete any previous story for this user (DB + R2)
  const existingAdmin = await env.DB.prepare(
    'SELECT id, video_url FROM stories WHERE user_id = ?'
  ).bind(userId).all();
  for (const old of existingAdmin.results || []) {
    try {
      const oldKey = extractMediaKey(old.video_url, env);
      await env.IMAGES.delete(oldKey);
    } catch {}
    await env.DB.prepare('DELETE FROM stories WHERE id = ?').bind(old.id).run();
  }

  const storyId = generateId();
  await env.DB.prepare(`
    INSERT INTO stories (id, user_id, video_url, caption) VALUES (?, ?, ?, ?)
  `).bind(storyId, userId, videoUrl, caption).run();

  return json({ id: storyId, video_url: videoUrl, user_id: userId, caption }, 201);
}

// ── Admin: DELETE /api/admin/stories/:id ───────────────
async function handleDeleteOwnStory(request, env, storyId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);


  let story;
  if (storyId === 'current') {
    story = await env.DB.prepare('SELECT id, user_id, video_url FROM stories WHERE user_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1').bind(auth.sub).first();
  } else {
    story = await env.DB.prepare('SELECT id, user_id, video_url FROM stories WHERE id = ?').bind(storyId).first();
  }
  if (!story) return error('Historia no encontrada', 404);
  if (story.user_id !== auth.sub) return error('No puedes borrar historias de otros usuarios', 403);

  await env.DB.prepare('DELETE FROM stories WHERE id = ?').bind(story.id).run();

  // Best-effort R2 delete
  try {
    const key = extractMediaKey(story.video_url, env);
    if (key) await env.IMAGES.delete(key);
  } catch {
    // R2 delete is best-effort
  }

  return json({ deleted: true, story_id: story.id });
}

async function handleAdminDeleteStory(request, env, storyId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);
  const adminUser = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.sub).first();
  if (!adminUser?.is_admin) return error('Acceso denegado', 403);


  const story = await env.DB.prepare('SELECT id, video_url FROM stories WHERE id = ?').bind(storyId).first();
  if (!story) return error('Historia no encontrada', 404);

  await env.DB.prepare('DELETE FROM stories WHERE id = ?').bind(storyId).run();

  // Best-effort R2 delete
  try {
    const key = extractMediaKey(story.video_url, env);
    if (key) await env.IMAGES.delete(key);
  } catch {
    // R2 delete is best-effort
  }

  return json({ deleted: true, story_id: storyId });
}

// POST /api/stories — authenticated user uploads their own story
async function handleUploadStory(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);


  const url = new URL(request.url);
  const caption = url.searchParams.get('caption') || '';

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.startsWith('video/')) {
    return error('Solo se permiten videos (video/mp4, video/webm, video/quicktime)');
  }

  const videoData = await request.arrayBuffer();

  // Max 50MB for videos
  if (videoData.byteLength > 50 * 1024 * 1024) {
    return error('El video no puede superar 50MB');
  }

  const ext = contentType === 'video/webm' ? 'webm' : contentType === 'video/quicktime' ? 'mov' : 'mp4';
  const key = `stories/${generateId()}.${ext}`;

  await env.IMAGES.put(key, videoData, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const videoUrl = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${key}`
    : `/api/images/${key}`;

  // Delete any previous story from this user (DB + R2)
  const existing = await env.DB.prepare(
    'SELECT id, video_url FROM stories WHERE user_id = ?'
  ).bind(auth.sub).all();
  for (const old of existing.results || []) {
    try {
      const oldKey = extractMediaKey(old.video_url, env);
      await env.IMAGES.delete(oldKey);
    } catch {}
    await env.DB.prepare('DELETE FROM stories WHERE id = ?').bind(old.id).run();
  }

  const storyId = generateId();
  await env.DB.prepare(`
    INSERT INTO stories (id, user_id, video_url, caption) VALUES (?, ?, ?, ?)
  `).bind(storyId, auth.sub, videoUrl, caption).run();

  return json({ id: storyId, video_url: videoUrl, caption }, 201);
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') return handleOptions(env, request);

  // ── WebSocket upgrades (before Turnstile check) ──
  const chatWsMatch = path.match(/^\/api\/chat\/ws\/([a-f0-9-]+)$/);
  if (chatWsMatch && request.headers.get('Upgrade') === 'websocket') {
    return handleChatWebSocket(request, env, chatWsMatch[1]);
  }
  if (path === '/api/notifications/ws' && request.headers.get('Upgrade') === 'websocket') {
    return handleNotificationWebSocket(request, env);
  }

  // ── Rutas server-to-server (bypass Turnstile) — autenticadas con HMAC o verificación API)
  if (path === '/api/payment/approved' && method === 'POST') return handlePaymentApproved(request, env);
  if (path === '/api/payment/uala-approved' && method === 'POST') return handleUalaApproved(request, env);

  // Story upload is JWT-authenticated and sends large binary bodies — skip Turnstile
  if (path === '/api/stories' && method === 'POST') return handleUploadStory(request, env);

  // Turnstile validation for mutations (skip for GET and dev)
  if (['POST', 'PUT', 'DELETE'].includes(method) && env.TURNSTILE_SECRET) {
    const turnstileToken = request.headers.get('X-Turnstile-Token');
    if (!turnstileToken) {
      return error('Verificación de Turnstile requerida', 403);
    }
    const ip = request.headers.get('CF-Connecting-IP');
    const valid = await validateTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
    if (!valid) {
      return error('Verificación de Turnstile fallida', 403);
    }
  }

  // ── Auth routes
  if (path === '/api/auth/register' && method === 'POST') return handleRegister(request, env);
  if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, env);
  if (path === '/api/auth/verify-code' && method === 'POST') return handleVerifyCode(request, env);
  if (path === '/api/auth/resend-code' && method === 'POST') return handleResendCode(request, env);
  if (path === '/api/auth/check-email' && method === 'POST') return handleCheckEmail(request, env);
  if (path === '/api/auth/check-username' && method === 'POST') return handleCheckUsername(request, env);
  if (path === '/api/auth/forgot-password' && method === 'POST') return handleForgotPassword(request, env);
  if (path === '/api/auth/reset-password' && method === 'POST') return handleResetPassword(request, env);
  if (path === '/api/auth/magic-link' && method === 'POST') return handleMagicLink(request, env);
  if (path === '/api/auth/verify' && method === 'GET') return handleVerifyToken(request, env);
  if (path === '/api/auth/me' && method === 'GET') return handleMe(request, env);
  if (path === '/api/auth/logout' && method === 'POST') return handleLogout(request, env);
  if (path === '/api/app/bootstrap' && method === 'GET') return handleAppBootstrap(request, env);
  if (path === '/api/me/dashboard' && method === 'GET') return handleOwnProfileDashboard(request, env);

  // ── Profile routes
  if (path === '/api/profiles' && method === 'GET') return handleProfiles(request, env);
  if (path === '/api/profile' && method === 'PUT') return handleUpdateProfile(request, env);
  const profileMatch = path.match(/^\/api\/profiles\/([a-f0-9-]+)$/);
  if (profileMatch && method === 'GET') return handleProfileDetail(request, env, profileMatch[1]);

  // ── Message routes
  if (path === '/api/messages' && method === 'GET') return handleConversations(request, env);
  if (path === '/api/messages/send' && method === 'POST') return handleSendMessage(request, env);
  if (path === '/api/messages/limit' && method === 'GET') return handleMessageLimit(request, env);
  if (path === '/api/unread-count' && method === 'GET') return handleUnreadCount(request, env);
  const msgMatch = path.match(/^\/api\/messages\/([a-f0-9-]+)$/);
  if (msgMatch && method === 'GET') return handleGetMessages(request, env, msgMatch[1]);
  if (msgMatch && method === 'DELETE') return handleDeleteConversation(request, env, msgMatch[1]);

  // ── Upload & Photos
  if (path === '/api/upload' && method === 'POST') return handleUpload(request, env);
  if (path === '/api/photos' && method === 'DELETE') return handleDeletePhoto(request, env);
  if (path === '/api/image-proxy' && method === 'GET') return handleImageProxy(request, env);
  if (path === '/api/media' && method === 'GET') return handleMediaProxy(request, env);

  // ── Settings
  if (path === '/api/detect-country' && method === 'GET') return handleDetectCountry(request);
  if (path === '/api/settings/public' && method === 'GET') return handleGetPublicSettings(request, env);
  if (path === '/api/settings' && method === 'GET') return handleGetSettings(request, env);
  if (path === '/api/settings' && method === 'PUT') return handleUpdateSettings(request, env);

  // ── Favorites
  if (path === '/api/favorites' && method === 'GET') return handleGetFavorites(request, env);
  const favCheckMatch = path.match(/^\/api\/favorites\/check\/([a-f0-9-]+)$/);
  if (favCheckMatch && method === 'GET') return handleCheckFavorite(request, env, favCheckMatch[1]);
  const favToggleMatch = path.match(/^\/api\/favorites\/([a-f0-9-]+)$/);
  if (favToggleMatch && method === 'POST') return handleToggleFavorite(request, env, favToggleMatch[1]);

  // ── Profile Visits
  if (path === '/api/visits' && method === 'GET') return handleGetVisits(request, env);

  // ── Gifts & Coins
  if (path === '/api/gifts/catalog' && method === 'GET') return handleGetGiftCatalog(request, env);
  if (path === '/api/gifts/send' && method === 'POST') return handleSendGift(request, env);
  if (path === '/api/coins' && method === 'GET') return handleGetCoins(request, env);
  const giftsRecMatch = path.match(/^\/api\/gifts\/received\/([a-f0-9-]+)$/);
  if (giftsRecMatch && method === 'GET') return handleGetReceivedGifts(request, env, giftsRecMatch[1]);

  // ── Admin: Gifts
  if (path === '/api/admin/gifts' && method === 'GET') return handleAdminGetGifts(request, env);
  if (path === '/api/admin/gifts' && method === 'POST') return handleAdminCreateGift(request, env);
  const adminGiftDelMatch = path.match(/^\/api\/admin\/gifts\/([a-zA-Z0-9-]+)$/);
  if (adminGiftDelMatch && method === 'DELETE') return handleAdminDeleteGift(request, env, adminGiftDelMatch[1]);
  if (path === '/api/admin/coins' && method === 'POST') return handleAdminAddCoins(request, env);
  if (path === '/api/admin/remove-all-vip' && method === 'POST') return handleAdminRemoveAllVip(request, env);
  if (path === '/api/admin/reset-all-coins' && method === 'POST') return handleAdminResetAllCoins(request, env);
  if (path === '/api/admin/chat-cleanup' && method === 'POST') return handleAdminChatCleanup(request, env);
  if (path === '/api/debug/media-cache' && method === 'POST') return handleDebugMediaCache(request, env);

  // ── Admin: Users
  if (path === '/api/admin/users' && method === 'GET') return handleAdminGetUsers(request, env);
  const adminUserMatch = path.match(/^\/api\/admin\/users\/([a-f0-9-]+)$/);
  if (adminUserMatch && method === 'GET') return handleAdminGetUser(request, env, adminUserMatch[1]);
  if (adminUserMatch && method === 'PUT') return handleAdminUpdateUser(request, env, adminUserMatch[1]);
  if (adminUserMatch && method === 'DELETE') return handleAdminDeleteUser(request, env, adminUserMatch[1]);

  // ── Pagos
  if (path === '/api/payment/create' && method === 'POST') return handlePaymentCreate(request, env);
  if (path === '/api/payment/confirm' && method === 'POST') return handlePaymentConfirm(request, env);

  // ── Stories
  if (path === '/api/stories' && method === 'GET') return handleGetStories(request, env);
  // POST /api/stories is handled above (before Turnstile check)
  if (path === '/api/stories/likes/sync' && method === 'POST') return handleSyncStoryLikes(request, env);
  const storyLikeMatch = path.match(/^\/api\/stories\/([a-f0-9-]+)\/like$/);
  if (storyLikeMatch && method === 'POST') return handleToggleStoryLike(request, env, storyLikeMatch[1]);
  const userStoryMatch = path.match(/^\/api\/stories\/([a-f0-9-]+)$/);
  if (userStoryMatch && method === 'DELETE') return handleDeleteOwnStory(request, env, userStoryMatch[1]);
  if (path === '/api/admin/upload-story' && method === 'POST') return handleAdminUploadStory(request, env);
  const adminStoryMatch = path.match(/^\/api\/admin\/stories\/([a-f0-9-]+)$/);
  if (adminStoryMatch && method === 'DELETE') return handleAdminDeleteStory(request, env, adminStoryMatch[1]);

  return error('Ruta no encontrada', 404);
}

// ══════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ══════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    const startedAt = Date.now();
    try {
      const response = await handleRequest(request, env);
      recordRouteMetric(env, request, response, Date.now() - startedAt);
      // WebSocket upgrade responses (101) have immutable headers — skip CORS
      if (response.status === 101) {
        return response;
      }
      // Add CORS headers to all other responses
      const cors = corsHeaders(env, request);
      for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value);
      }
      return response;
    } catch (err) {
      recordRouteMetric(env, request, new Response(null, { status: 500 }), Date.now() - startedAt);
      console.error('Worker error:', err.message, err.stack);
      const errRes = json({ error: 'Error interno del servidor' }, 500);
      const cors = corsHeaders(env, request);
      for (const [key, value] of Object.entries(cors)) {
        errRes.headers.set(key, value);
      }
      return errRes;
    }
  },
};
