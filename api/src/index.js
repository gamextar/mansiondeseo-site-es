// ═══════════════════════════════════════════════════════
// MANSIÓN DESEO — Cloudflare Worker API
// ES Modules syntax
// ═══════════════════════════════════════════════════════

export { ChatRoom } from './chat-room.js';
export { UserNotification } from './user-notification.js';

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
  // Update last_active + IP (fire-and-forget)
  const ip = request.headers.get('CF-Connecting-IP') || '';
  env.DB.prepare("UPDATE users SET last_active = datetime('now'), last_ip = ? WHERE id = ?").bind(ip, payload.sub).run().catch(() => {});
  // Check account status (suspended users are blocked)
  const userStatus = await env.DB.prepare('SELECT account_status FROM users WHERE id = ?').bind(payload.sub).first();
  if (userStatus?.account_status === 'suspended') return null;
  return payload; // { sub: userId, email, role }
}

// Returns true if last_active is within the last hour
function isOnline(lastActive) {
  if (!lastActive) return false;
  const ts = new Date(lastActive.endsWith('Z') ? lastActive : lastActive + 'Z').getTime();
  return (Date.now() - ts) < 3600000; // 1 hour
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

async function sendVerificationEmail(env, toEmail, code) {
  const fromEmail = env.MAIL_FROM || 'noreply@unicoapps.com';
  const fromName = 'Mansión Deseo';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
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

  if (password.length < 6) {
    return error('La contraseña debe tener al menos 6 caracteres');
  }

  // Check duplicate
  const existing = await env.DB.prepare('SELECT id, status FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing && existing.status === 'verified') {
    return error('Este email ya está registrado', 409);
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
    seeking,
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
    console.log(`📧 VERIFICATION CODE for ${email}: ${code}`);
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
    console.log(`📧 RESEND CODE for ${email}: ${code}`);
  }

  return json({
    message: 'Nuevo código enviado.',
    ...(env.ENVIRONMENT !== 'production' && { devCode: code }),
  });
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
  return Response.redirect(`${env.CORS_ORIGIN}/?token=${jwt}`, 302);
}

// ── GET /api/auth/me ────────────────────────────────────

async function handleMe(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.sub).first();
  if (!user) return error('Usuario no encontrado', 404);

  return json({ user: sanitizeUser(user, env) });
}

// ── GET /api/profiles ───────────────────────────────────

async function handleProfiles(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  // Get viewer info + settings + viewer's favorites
  const viewer = await env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first();
  const viewerIsPremium = viewer && isPremiumActive(viewer);
  const settings = await loadSettings(env);
  const { results: favRows } = await env.DB.prepare('SELECT target_id FROM favorites WHERE user_id = ?').bind(auth.sub).all();
  const viewerFavorites = new Set(favRows.map(r => r.target_id));

  // Also get who has favorited the viewer (for ghost mode exception)
  const { results: favByRows } = await env.DB.prepare('SELECT user_id FROM favorites WHERE target_id = ?').bind(auth.sub).all();
  const favoritedBySet = new Set(favByRows.map(r => r.user_id));

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

  // Map to frontend shape with new blur logic
  const profiles = results.map(u => {
    const profileIsPremium = isPremiumActive(u);
    const hasGhostMode = profileIsPremium && !!u.ghost_mode;
    // Ghost mode blur: blurred unless viewer is premium OR the ghost-mode user has favorited the viewer
    const blurred = hasGhostMode && !viewerIsPremium && !favoritedBySet.has(u.id);
    const allPhotos = safeParseJSON(u.photos, []);
    // Send all URLs; frontend applies CSS blur to blocked ones
    const visiblePhotos = viewerIsPremium
      ? allPhotos.length
      : blurred
        ? 0
        : settings.freeVisiblePhotos;
    return {
      id: u.id,
      name: u.username,
      age: u.age,
      city: u.city,
      role: mapRoleToDisplay(u.role),
      interests: safeParseJSON(u.interests, []),
      bio: u.bio,
      photos: allPhotos,
      totalPhotos: allPhotos.length,
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
    };
  });

  return json({ profiles, viewerPremium: viewerIsPremium, settings });
}

// ── GET /api/profiles/:id ───────────────────────────────

async function handleProfileDetail(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error('Perfil no encontrado', 404);

  // Get viewer info + settings
  const viewer = await env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first();
  const viewerIsPremium = viewer && isPremiumActive(viewer);
  const settings = await loadSettings(env);

  // Check if viewer has favorited this profile
  const favRow = await env.DB.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND target_id = ?').bind(auth.sub, userId).first();
  const isFavorited = !!favRow;

  // Check if this profile's owner has favorited the viewer (ghost mode exception)
  const favByRow = await env.DB.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND target_id = ?').bind(userId, auth.sub).first();
  const profileFavoritedViewer = !!favByRow;

  const hasGhostMode = isPremiumActive(user) && !!user.ghost_mode;
  const isOwnProfile = auth.sub === userId;
  // Ghost mode blur: blurred unless viewer is premium, OR profile owner favorited viewer
  const blurred = hasGhostMode && !viewerIsPremium && !profileFavoritedViewer;

  // Record visit (skip own profile)
  if (!isOwnProfile) {
    try {
      await env.DB.prepare(
        'INSERT INTO profile_visits (id, visitor_id, visited_id) VALUES (?, ?, ?)'
      ).bind(crypto.randomUUID(), auth.sub, userId).run();
    } catch {
      // Silently fail — duplicate or DB issue
    }
  }

  const allPhotos = safeParseJSON(user.photos, []);
  // Send all URLs; frontend applies CSS blur to blocked ones
  const visibleLimit = settings.freeVisiblePhotos;
  const visiblePhotos = viewerIsPremium
    ? allPhotos.length
    : blurred
      ? 0
      : visibleLimit;

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
      photos: allPhotos,
      totalPhotos: allPhotos.length,
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

  const { receiver_id, content } = await request.json();
  if (!receiver_id || !content || !content.trim()) {
    return error('receiver_id y content requeridos');
  }

  // Verify receiver exists
  const receiver = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(receiver_id).first();
  if (!receiver) return error('Destinatario no encontrado', 404);

  // Check daily message limit
  const today = todayUTC();
  const limit = await env.DB.prepare(
    'SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?'
  ).bind(auth.sub, today).first();

  const currentCount = limit?.msg_count || 0;

  // Check if user is premium (unlimited)
  const sender = await env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first();

  // Load configurable daily limit
  const siteSettings = await loadSettings(env);
  const dailyLimit = siteSettings.dailyMessageLimit || 5;

  if (!isPremiumActive(sender) && currentCount >= dailyLimit) {
    return error(`Has alcanzado el límite de ${dailyLimit} mensajes diarios. Desbloquea VIP para mensajes ilimitados.`, 403);
  }

  // Insert message
  const msgId = generateId();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await env.DB.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?, ?)
  `).bind(msgId, auth.sub, receiver_id, content.trim(), now).run();

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

  // Notify ChatRoom DO so it broadcasts to connected receivers via WebSocket
  notifyChatRoom(env, auth.sub, receiver_id, msg).catch(() => {});

  // Notify receiver's notification channel (updates ChatListPage in real-time)
  notifyUser(env, receiver_id, { type: 'new_message', chatId: [auth.sub, receiver_id].sort().join('-') }).catch(() => {});
  // Also notify sender (so their own ChatListPage updates if open in another tab)
  notifyUser(env, auth.sub, { type: 'new_message', chatId: [auth.sub, receiver_id].sort().join('-') }).catch(() => {});

  return json({ message: msg }, 201);
}

// ── Notify ChatRoom DO of new HTTP message ──────────────

async function notifyChatRoom(env, senderId, receiverId, msg) {
  try {
    const chatId = [senderId, receiverId].sort().join('-');
    const doId = env.CHAT_ROOMS.idFromName(chatId);
    const stub = env.CHAT_ROOMS.get(doId);
    await stub.fetch(new URL('https://do/notify').toString(), {
      method: 'POST',
      body: JSON.stringify(msg),
    });
  } catch (err) {
    console.error('DO notify error:', err.message);
  }
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
    timestamp: new Date(m.created_at + 'Z').toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
    created_at: m.created_at,
    is_read: m.is_read,
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
      online: isOnline(partner.last_active),
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

  const sender = await env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first();

  const count = limit?.msg_count || 0;

  // Load configurable daily limit
  const siteSettings = await loadSettings(env);
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

  // Forward the request to the DO (it handles the WS upgrade)
  const doUrl = new URL(request.url);
  doUrl.pathname = '/ws';
  doUrl.searchParams.set('chatId', chatId);
  return stub.fetch(new Request(doUrl.toString(), request));
}

// ── Notify UserNotification DO ──────────────────────────

async function notifyUser(env, userId, data) {
  try {
    const doId = env.USER_NOTIFICATIONS.idFromName(userId);
    const stub = env.USER_NOTIFICATIONS.get(doId);
    await stub.fetch('https://do/notify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('UserNotification notify error:', err.message);
  }
}

// ── GET /api/notifications/ws — User notification WebSocket ─

async function handleNotificationWebSocket(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return error('Token requerido', 401);

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return error('Token inválido', 401);

  const doId = env.USER_NOTIFICATIONS.idFromName(payload.sub);
  const stub = env.USER_NOTIFICATIONS.get(doId);

  return stub.fetch(request);
}

// ── GET /api/unread-count ───────────────────────────────

async function handleUnreadCount(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const row = await env.DB.prepare(
    'SELECT COUNT(*) as unread FROM messages WHERE receiver_id = ? AND is_read = 0'
  ).bind(auth.sub).first();

  return json({ unread: row?.unread || 0 });
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
    : `/api/images/${key}`; // Serve via Worker in dev

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

// ── DELETE /api/photos ───────────────────────────────────

async function handleDeletePhoto(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const { url } = await request.json();
  if (!url || typeof url !== 'string') return error('URL requerida', 400);

  // Get user's current photos
  const user = await env.DB.prepare('SELECT photos, avatar_url FROM users WHERE id = ?').bind(auth.sub).first();
  if (!user) return error('Usuario no encontrado', 404);

  const photos = safeParseJSON(user.photos, []);
  const index = photos.indexOf(url);
  if (index === -1) return error('Foto no encontrada', 404);

  // Remove from array
  photos.splice(index, 1);

  // If deleted photo was avatar, set next photo or empty
  const newAvatar = user.avatar_url === url ? (photos[0] || '') : user.avatar_url;

  await env.DB.prepare('UPDATE users SET photos = ?, avatar_url = ? WHERE id = ?')
    .bind(JSON.stringify(photos), newAvatar, auth.sub).run();

  // Try to delete from R2 (extract key from URL)
  try {
    let key = '';
    if (url.includes('/api/images/')) {
      key = url.split('/api/images/')[1];
    }
    if (key && key.startsWith('profiles/')) {
      await env.IMAGES.delete(key);
    }
  } catch {
    // R2 delete is best-effort
  }

  return json({ photos, avatar_url: newAvatar });
}

// ── GET /api/images/* ───────────────────────────────────

async function handleServeImage(request, env, path) {
  const key = path.replace('/api/images/', '');
  if (!key || key.includes('..')) return error('Ruta inválida', 400);

  const object = await env.IMAGES.get(key);
  if (!object) return error('Imagen no encontrada', 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── PUT /api/profile ────────────────────────────────────

async function handleUpdateProfile(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error('No autorizado', 401);

  const body = await request.json();
  const allowedFields = ['username', 'role', 'seeking', 'interests', 'age', 'city', 'bio', 'avatar_url', 'premium'];

  // Validate and allow photos reorder (all URLs must originate from our R2 bucket)
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) return error('photos debe ser un arreglo', 400);
    const r2Base = env.R2_PUBLIC_URL || '';
    const allValid = body.photos.every(url => typeof url === 'string' && url.startsWith(r2Base));
    if (!allValid) return error('URL de foto inválida', 400);
    allowedFields.push('photos');
  }

  // ghost_mode is only allowed for premium users
  const currentUser = await env.DB.prepare('SELECT premium, premium_until FROM users WHERE id = ?').bind(auth.sub).first();
  const isPremium = isPremiumActive(currentUser);
  if (isPremium) {
    allowedFields.push('ghost_mode');
  }

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'interests' || field === 'photos') {
        updates.push(`${field} = ?`);
        values.push(JSON.stringify(body[field]));
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
  return {
    ...safe,
    interests: safeParseJSON(safe.interests, []),
    photos: safeParseJSON(safe.photos, []),
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
    `SELECT u.id, u.username, u.avatar_url, u.age, u.city, u.role, u.premium, u.last_active,
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
  };
}

// ── GET /api/detect-country ──────────────────────────────
async function handleDetectCountry(request) {
  const country = request.headers.get('cf-ipcountry') || '';
  return json({ country });
}

// ── GET /api/settings/public ─────────────────────────────
// Returns non-sensitive settings (VIP prices, blur, etc.)
async function handleGetPublicSettings(request, env) {
  const settings = await loadSettings(env);
  return json({
    settings: {
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
    },
  });
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
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await env.DB.prepare(
        'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      ).bind(key, String(body[key]), String(body[key])).run();
    }
  }
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
    const allPhotos = safeParseJSON(u.photos, []);
    const visiblePhotos = viewerIsPremium
      ? allPhotos.length
      : blurred ? 0 : settings.freeVisiblePhotos;
    return {
      id: u.id,
      name: u.username,
      age: u.age,
      city: u.city,
      role: mapRoleToDisplay(u.role),
      interests: safeParseJSON(u.interests, []),
      photos: allPhotos,
      totalPhotos: allPhotos.length,
      visiblePhotos,
      verified: !!u.verified,
      online: !!u.online,
      premium: !!u.premium,
      blurred,
      avatar_url: u.avatar_url,
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
    premium, premium_until, ghost_mode, verified, online, coins, is_admin, account_status, last_active, last_ip, created_at
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
      photos: safeParseJSON(safe.photos, []),
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
      photos: safeParseJSON(safe.photos, []),
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

  // Delete related data
  await env.DB.batch([
    env.DB.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM favorites WHERE user_id = ? OR target_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM profile_visits WHERE visitor_id = ? OR visited_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM user_gifts WHERE sender_id = ? OR receiver_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM verification_tokens WHERE user_id = ? OR email = ?').bind(userId, user.email),
    env.DB.prepare('DELETE FROM processed_payments WHERE user_id = ?').bind(userId),
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
  const baseUrl = env.CORS_ORIGIN || 'http://localhost:5173';
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

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') return handleOptions(env);

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
  if (path === '/api/unread-count' && method === 'GET') return handleUnreadCount(request, env);
  const msgMatch = path.match(/^\/api\/messages\/([a-f0-9-]+)$/);
  if (msgMatch && method === 'GET') return handleGetMessages(request, env, msgMatch[1]);

  // ── Upload & Photos
  if (path === '/api/upload' && method === 'POST') return handleUpload(request, env);
  if (path === '/api/photos' && method === 'DELETE') return handleDeletePhoto(request, env);

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

  // ── Admin: Users
  if (path === '/api/admin/users' && method === 'GET') return handleAdminGetUsers(request, env);
  const adminUserMatch = path.match(/^\/api\/admin\/users\/([a-f0-9-]+)$/);
  if (adminUserMatch && method === 'GET') return handleAdminGetUser(request, env, adminUserMatch[1]);
  if (adminUserMatch && method === 'PUT') return handleAdminUpdateUser(request, env, adminUserMatch[1]);
  if (adminUserMatch && method === 'DELETE') return handleAdminDeleteUser(request, env, adminUserMatch[1]);

  // ── Pagos
  if (path === '/api/payment/create' && method === 'POST') return handlePaymentCreate(request, env);
  if (path === '/api/payment/confirm' && method === 'POST') return handlePaymentConfirm(request, env);

  // ── Serve R2 images
  if (path.startsWith('/api/images/') && method === 'GET') return handleServeImage(request, env, path);

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
