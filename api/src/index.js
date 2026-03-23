// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — Cloudflare Worker API
// ES Modules syntax
// ═══════════════════════════════════════════════════════

// ── Helpers ─────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID();
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

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  return payload; // { sub: userId, email, role }
}

// ── CORS ────────────────────────────────────────────────

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Turnstile-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function handleOptions(env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}

// ══════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ══════════════════════════════════════════════════════════

// ── POST /api/auth/register ─────────────────────────────

async function handleRegister(request, env) {
  const body = await request.json();
  const { email, password, username, role, seeking, interests, age, city, bio } = body;

  if (!email || !password || !username || !role || !seeking) {
    return error('Campos requeridos: email, password, username, role, seeking');
  }

  if (password.length < 6) {
    return error('La contraseña debe tener al menos 6 caracteres');
  }

  // Check duplicate
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) {
    return error('Este email ya está registrado', 409);
  }

  const userId = generateId();
  const passwordHash = await hashPassword(password);
  const country = request.headers.get('cf-ipcountry') || '';

  await env.DB.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, seeking, interests, age, city, country, bio, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified')
  `).bind(
    userId,
    email.toLowerCase(),
    username,
    passwordHash,
    role,
    seeking,
    JSON.stringify(interests || []),
    age || null,
    city || '',
    country,
    bio || ''
  ).run();

  const token = await signJWT({ sub: userId, email: email.toLowerCase(), role }, env.JWT_SECRET);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

  return json({
    token,
    user: sanitizeUser(user),
  }, 201);
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

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return error('Credenciales inválidas', 401);
  }

  // Update online status
  await env.DB.prepare("UPDATE users SET online = 1, last_active = datetime('now') WHERE id = ?")
    .bind(user.id).run();

  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

  return json({ token, user: sanitizeUser(user) });
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
  console.log(`🔗 MAGIC LINK for ${email}: /api/auth/verify?token=${token}`);

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
    await env.DB.prepare("UPDATE users SET status = 'verified', online = 1, last_active = datetime('now') WHERE id = ?")
      .bind(user.id).run();
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
  return Response.redirect(`${env.CORS_ORIGIN}/?token=${jwt}`, 302);
}

// ── GET /api/auth/me ────────────────────────────────────

async function handleMe(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.sub).first();
  if (!user) return error('Usuario no encontrado', 404);

  return json({ user: sanitizeUser(user) });
}

// ── GET /api/profiles ───────────────────────────────────

async function handleProfiles(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';
  const search = url.searchParams.get('q') || '';
  const country = request.headers.get('cf-ipcountry') || '';

  let query = `SELECT * FROM users WHERE id != ? AND status = 'verified'`;
  const params = [auth.sub];

  // Geo-filter: prioritize same country
  if (country) {
    query += ` AND country = ?`;
    params.push(country);
  }

  // Role filter
  if (filter === 'hombre') {
    query += ` AND role = 'hombre'`;
  } else if (filter === 'mujer') {
    query += ` AND role = 'mujer'`;
  } else if (filter === 'pareja') {
    query += ` AND role = 'pareja'`;
  }

  // Search
  if (search) {
    query += ` AND (username LIKE ? OR city LIKE ? OR bio LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ` ORDER BY last_active DESC LIMIT 50`;

  const { results } = await env.DB.prepare(query).bind(...params).all();

  // Map to frontend shape
  const profiles = results.map(u => ({
    id: u.id,
    name: u.username,
    age: u.age,
    city: u.city,
    role: mapRoleToDisplay(u.role),
    interests: safeParseJSON(u.interests, []),
    bio: u.bio,
    photos: safeParseJSON(u.photos, []),
    verified: u.verified === 1,
    online: u.online === 1,
    premium: u.premium === 1,
    lastActive: u.last_active,
    avatar_url: u.avatar_url,
  }));

  return json({ profiles });
}

// ── GET /api/profiles/:id ───────────────────────────────

async function handleProfileDetail(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error('Perfil no encontrado', 404);

  return json({
    profile: {
      id: user.id,
      name: user.username,
      age: user.age,
      city: user.city,
      role: mapRoleToDisplay(user.role),
      interests: safeParseJSON(user.interests, []),
      bio: user.bio,
      photos: safeParseJSON(user.photos, []),
      verified: user.verified === 1,
      online: user.online === 1,
      premium: user.premium === 1,
      lastActive: user.last_active,
      avatar_url: user.avatar_url,
    },
  });
}

// ── POST /api/messages/send ─────────────────────────────

async function handleSendMessage(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { receiver_id, content } = await request.json();
  if (!receiver_id || !content || !content.trim()) {
    return error('receiver_id y content requeridos');
  }

  // Verify receiver exists
  const receiver = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(receiver_id).first();
  if (!receiver) return error('Destinatario no encontrado', 404);

  // Check daily message limit (5 free per day)
  const today = todayUTC();
  const limit = await env.DB.prepare(
    'SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?'
  ).bind(auth.sub, today).first();

  const currentCount = limit?.msg_count || 0;

  // Check if user is premium (unlimited)
  const sender = await env.DB.prepare('SELECT premium FROM users WHERE id = ?').bind(auth.sub).first();

  if (!sender.premium && currentCount >= 5) {
    return error('Has alcanzado el límite de 5 mensajes diarios. Desbloquea VIP para mensajes ilimitados.', 403);
  }

  // Insert message
  const msgId = generateId();
  await env.DB.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)
  `).bind(msgId, auth.sub, receiver_id, content.trim()).run();

  // Update message counter
  if (!sender.premium) {
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

  return json({
    message: {
      id: msgId,
      sender_id: auth.sub,
      receiver_id,
      content: content.trim(),
      is_read: 0,
      created_at: new Date().toISOString(),
    },
  }, 201);
}

// ── GET /api/messages/:userId ───────────────────────────

async function handleGetMessages(request, env, otherUserId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { results } = await env.DB.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
    LIMIT 100
  `).bind(auth.sub, otherUserId, otherUserId, auth.sub).all();

  // Mark as read
  await env.DB.prepare(`
    UPDATE messages SET is_read = 1
    WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
  `).bind(otherUserId, auth.sub).run();

  const messages = results.map(m => ({
    id: m.id,
    senderId: m.sender_id === auth.sub ? 'me' : 'them',
    text: m.content,
    timestamp: new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    created_at: m.created_at,
  }));

  return json({ messages });
}

// ── GET /api/messages (conversations list) ──────────────

async function handleConversations(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  // Get latest message per conversation partner
  const { results } = await env.DB.prepare(`
    SELECT
      m.*,
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS partner_id
    FROM messages m
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY m.created_at DESC
  `).bind(auth.sub, auth.sub, auth.sub).all();

  // Group by partner, keep latest
  const convMap = new Map();
  for (const m of results) {
    const partnerId = m.sender_id === auth.sub ? m.receiver_id : m.sender_id;
    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, {
        lastMessage: m,
        unread: 0,
      });
    }
    if (m.receiver_id === auth.sub && !m.is_read) {
      const entry = convMap.get(partnerId);
      entry.unread++;
    }
  }

  // Fetch partner profiles
  const conversations = [];
  for (const [partnerId, data] of convMap) {
    const partner = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(partnerId).first();
    if (!partner) continue;
    conversations.push({
      id: `conv-${partnerId}`,
      profileId: partnerId,
      name: partner.username,
      avatar: partner.avatar_url || '',
      lastMessage: data.lastMessage.content.slice(0, 50),
      timestamp: data.lastMessage.created_at,
      unread: data.unread,
      online: partner.online === 1,
    });
  }

  return json({ conversations });
}

// ── GET /api/messages/limit ─────────────────────────────

async function handleMessageLimit(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const today = todayUTC();
  const limit = await env.DB.prepare(
    'SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?'
  ).bind(auth.sub, today).first();

  const sender = await env.DB.prepare('SELECT premium FROM users WHERE id = ?').bind(auth.sub).first();

  const count = limit?.msg_count || 0;
  const max = sender?.premium ? Infinity : 5;

  return json({
    sent: count,
    remaining: sender?.premium ? 999 : Math.max(0, 5 - count),
    canSend: sender?.premium ? true : count < 5,
    max: sender?.premium ? 999 : 5,
  });
}

// ── POST /api/upload ────────────────────────────────────

async function handleUpload(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

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

  // Generate obfuscated path
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const key = `profiles/${auth.sub}/${generateId()}.${ext}`;

  await env.IMAGES.put(key, imageData, {
    httpMetadata: { contentType },
  });

  const publicUrl = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${key}`
    : key; // Return key if no public URL configured

  // Update user photos array
  const user = await env.DB.prepare('SELECT photos, avatar_url FROM users WHERE id = ?').bind(auth.sub).first();
  const photos = safeParseJSON(user.photos, []);
  photos.push(publicUrl);

  const updates = { photos: JSON.stringify(photos) };
  if (!user.avatar_url) {
    updates.avatar_url = publicUrl;
  }

  await env.DB.prepare(`
    UPDATE users SET photos = ?, avatar_url = COALESCE(NULLIF(avatar_url, ''), ?) WHERE id = ?
  `).bind(JSON.stringify(photos), publicUrl, auth.sub).run();

  return json({ url: publicUrl, key }, 201);
}

// ── PUT /api/profile ────────────────────────────────────

async function handleUpdateProfile(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const body = await request.json();
  const allowedFields = ['username', 'role', 'seeking', 'interests', 'age', 'city', 'bio', 'avatar_url'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'interests') {
        updates.push(`${field} = ?`);
        values.push(JSON.stringify(body[field]));
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
  return json({ user: sanitizeUser(user) });
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

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return {
    ...safe,
    interests: safeParseJSON(safe.interests, []),
    photos: safeParseJSON(safe.photos, []),
    verified: safe.verified === 1,
    online: safe.online === 1,
    premium: safe.premium === 1,
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
// ROUTER
// ══════════════════════════════════════════════════════════

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') return handleOptions(env);

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
  if (path === '/api/auth/magic-link' && method === 'POST') return handleMagicLink(request, env);
  if (path === '/api/auth/verify' && method === 'GET') return handleVerifyToken(request, env);
  if (path === '/api/auth/me' && method === 'GET') return handleMe(request, env);
  if (path === '/api/auth/logout' && method === 'POST') return handleLogout(request, env);

  // ── Profile routes
  if (path === '/api/profiles' && method === 'GET') return handleProfiles(request, env);
  if (path === '/api/profile' && method === 'PUT') return handleUpdateProfile(request, env);
  const profileMatch = path.match(/^\/api\/profiles\/([a-f0-9-]+)$/);
  if (profileMatch && method === 'GET') return handleProfileDetail(request, env, profileMatch[1]);

  // ── Message routes
  if (path === '/api/messages' && method === 'GET') return handleConversations(request, env);
  if (path === '/api/messages/send' && method === 'POST') return handleSendMessage(request, env);
  if (path === '/api/messages/limit' && method === 'GET') return handleMessageLimit(request, env);
  const msgMatch = path.match(/^\/api\/messages\/([a-f0-9-]+)$/);
  if (msgMatch && method === 'GET') return handleGetMessages(request, env, msgMatch[1]);

  // ── Upload
  if (path === '/api/upload' && method === 'POST') return handleUpload(request, env);

  return error('Ruta no encontrada', 404);
}

// ══════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ══════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    try {
      const response = await handleRequest(request, env);
      // Add CORS headers to all responses
      const cors = corsHeaders(env);
      for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value);
      }
      return response;
    } catch (err) {
      console.error('Worker error:', err.message, err.stack);
      return json({ error: 'Error interno del servidor' }, 500);
    }
  },
};
