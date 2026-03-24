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
  const country = request.headers.get('cf-ipcountry') || '';

  await env.DB.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, seeking, interests, age, city, country, bio, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
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
  await env.DB.prepare("UPDATE users SET status = 'verified', online = 1, last_active = datetime('now') WHERE id = ?")
    .bind(record.user_id).run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(record.user_id).first();
  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);

  return json({ token, user: sanitizeUser(user) });
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

  // Get viewer info + settings + viewer's favorites
  const viewer = await env.DB.prepare('SELECT premium FROM users WHERE id = ?').bind(auth.sub).first();
  const viewerIsPremium = viewer && !!viewer.premium;
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
    const hasGhostMode = !!u.ghost_mode;
    const profileIsPremium = !!u.premium;
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
      online: !!u.online,
      premium: profileIsPremium,
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
  const viewer = await env.DB.prepare('SELECT premium FROM users WHERE id = ?').bind(auth.sub).first();
  const viewerIsPremium = viewer && !!viewer.premium;
  const settings = await loadSettings(env);

  // Check if viewer has favorited this profile
  const favRow = await env.DB.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND target_id = ?').bind(auth.sub, userId).first();
  const isFavorited = !!favRow;

  // Check if this profile's owner has favorited the viewer (ghost mode exception)
  const favByRow = await env.DB.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND target_id = ?').bind(userId, auth.sub).first();
  const profileFavoritedViewer = !!favByRow;

  const hasGhostMode = !!user.ghost_mode;
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
  const visibleLimit = isOwnProfile ? settings.freeOwnPhotos : settings.freeVisiblePhotos;
  const visiblePhotos = viewerIsPremium
    ? allPhotos.length
    : blurred
      ? 0
      : visibleLimit;

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
      online: !!user.online,
      premium: !!user.premium,
      ghost_mode: hasGhostMode,
      blurred,
      isFavorited,
      isOwnProfile,
      lastActive: user.last_active,
      avatar_url: user.avatar_url,
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
  const sender = await env.DB.prepare('SELECT premium FROM users WHERE id = ?').bind(auth.sub).first();

  // Load configurable daily limit
  const siteSettings = await loadSettings(env);
  const dailyLimit = siteSettings.dailyMessageLimit || 5;

  if (!sender.premium && currentCount >= dailyLimit) {
    return error(`Has alcanzado el límite de ${dailyLimit} mensajes diarios. Desbloquea VIP para mensajes ilimitados.`, 403);
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

  // Load configurable daily limit
  const siteSettings = await loadSettings(env);
  const dailyLimit = siteSettings.dailyMessageLimit || 5;

  return json({
    sent: count,
    remaining: sender?.premium ? 999 : Math.max(0, dailyLimit - count),
    canSend: sender?.premium ? true : count < dailyLimit,
    max: sender?.premium ? 999 : dailyLimit,
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
  const currentUser = await env.DB.prepare('SELECT premium FROM users WHERE id = ?').bind(auth.sub).first();
  const isPremium = body.premium !== undefined ? (body.premium ? 1 : 0) : currentUser?.premium;
  if (!!isPremium) {
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
    verified: !!safe.verified,
    online: !!safe.online,
    premium: !!safe.premium,
    ghost_mode: !!safe.ghost_mode,
    is_admin: !!safe.is_admin,
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
    `SELECT u.id, u.username, u.avatar_url, u.age, u.city, u.role, u.premium, u.online,
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
    online: !!v.online,
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
    freeOwnPhotos: parseInt(settings.free_own_photos || '3', 10),
    showVipButton: settings.show_vip_button !== '0',
    dailyMessageLimit: parseInt(settings.daily_message_limit || '5', 10),
    siteCountry: settings.site_country || 'AR',
    siteTimezone: settings.site_timezone || 'America/Argentina/Buenos_Aires',
    hidePasswordRegister: settings.hide_password_register !== '0',
    vipPriceMonthly: settings.vip_price_monthly || '',
    vipPrice3Months: settings.vip_price_3months || '',
    vipPrice6Months: settings.vip_price_6months || '',
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
    'free_visible_photos', 'free_own_photos', 'show_vip_button',
    'daily_message_limit', 'site_country', 'site_timezone',
    'hide_password_register',
    'vip_price_monthly', 'vip_price_3months', 'vip_price_6months',
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
    const hasGhostMode = !!u.ghost_mode;
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
  const msgMatch = path.match(/^\/api\/messages\/([a-f0-9-]+)$/);
  if (msgMatch && method === 'GET') return handleGetMessages(request, env, msgMatch[1]);

  // ── Upload & Photos
  if (path === '/api/upload' && method === 'POST') return handleUpload(request, env);
  if (path === '/api/photos' && method === 'DELETE') return handleDeletePhoto(request, env);

  // ── Settings
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
