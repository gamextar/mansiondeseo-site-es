var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/src/index.js
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
__name(json, "json");
function error(message, status = 400) {
  return json({ error: message }, status);
}
__name(error, "error");
function todayUTC() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
__name(todayUTC, "todayUTC");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const computed = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === hashHex;
}
__name(verifyPassword, "verifyPassword");
function base64UrlEncode(data) {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}
__name(base64UrlDecode, "base64UrlDecode");
async function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const claims = { ...payload, iat: now, exp: now + 86400 * 7 };
  const unsigned = `${base64UrlEncode(header)}.${base64UrlEncode(claims)}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${unsigned}.${sigStr}`;
}
__name(signJWT, "signJWT");
async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    const unsigned = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(unsigned));
    if (!valid) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function validateTurnstile(token, secret, ip) {
  if (!secret) return true;
  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  const data = await res.json();
  return data.success === true;
}
__name(validateTurnstile, "validateTurnstile");
async function authenticate(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  return payload;
}
__name(authenticate, "authenticate");
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Turnstile-Token",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function handleOptions(env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}
__name(handleOptions, "handleOptions");
function generateVerificationCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1e6).padStart(6, "0");
}
__name(generateVerificationCode, "generateVerificationCode");
async function handleRegister(request, env) {
  const body = await request.json();
  const { email, password, username, role, seeking, interests, age, city, bio } = body;
  if (!email || !password || !username || !role || !seeking) {
    return error("Campos requeridos: email, password, username, role, seeking");
  }
  if (password.length < 6) {
    return error("La contrase\xF1a debe tener al menos 6 caracteres");
  }
  const existing = await env.DB.prepare("SELECT id, status FROM users WHERE email = ?").bind(email.toLowerCase()).first();
  if (existing && existing.status === "verified") {
    return error("Este email ya est\xE1 registrado", 409);
  }
  if (existing) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(existing.id).run();
    await env.DB.prepare("DELETE FROM verification_tokens WHERE user_id = ?").bind(existing.id).run();
  }
  const userId = generateId();
  const passwordHash = await hashPassword(password);
  const country = request.headers.get("cf-ipcountry") || "";
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
    city || "",
    country,
    bio || ""
  ).run();
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1e3).toISOString();
  await env.DB.prepare(`
    INSERT INTO verification_tokens (id, user_id, email, token, purpose, expires_at)
    VALUES (?, ?, ?, ?, 'verify_email', ?)
  `).bind(generateId(), userId, email.toLowerCase(), code, expiresAt).run();
  console.log(`\u{1F4E7} VERIFICATION CODE for ${email}: ${code}`);
  return json({
    needsVerification: true,
    email: email.toLowerCase(),
    message: "C\xF3digo de verificaci\xF3n enviado a tu email.",
    ...env.ENVIRONMENT !== "production" && { devCode: code }
  }, 201);
}
__name(handleRegister, "handleRegister");
async function handleVerifyCode(request, env) {
  const { email, code } = await request.json();
  if (!email || !code) {
    return error("Email y c\xF3digo requeridos");
  }
  const record = await env.DB.prepare(`
    SELECT * FROM verification_tokens
    WHERE email = ? AND token = ? AND purpose = 'verify_email' AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(email.toLowerCase(), code.trim()).first();
  if (!record) {
    return error("C\xF3digo inv\xE1lido o expirado", 401);
  }
  await env.DB.prepare("UPDATE verification_tokens SET used = 1 WHERE id = ?").bind(record.id).run();
  await env.DB.prepare("UPDATE users SET status = 'verified', online = 1, last_active = datetime('now') WHERE id = ?").bind(record.user_id).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(record.user_id).first();
  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);
  return json({ token, user: sanitizeUser(user) });
}
__name(handleVerifyCode, "handleVerifyCode");
async function handleResendCode(request, env) {
  const { email } = await request.json();
  if (!email) return error("Email requerido");
  const user = await env.DB.prepare("SELECT id, status FROM users WHERE email = ? AND status = 'pending'").bind(email.toLowerCase()).first();
  if (!user) {
    return error("No hay registro pendiente para este email", 404);
  }
  await env.DB.prepare("UPDATE verification_tokens SET used = 1 WHERE user_id = ? AND purpose = 'verify_email' AND used = 0").bind(user.id).run();
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1e3).toISOString();
  await env.DB.prepare(`
    INSERT INTO verification_tokens (id, user_id, email, token, purpose, expires_at)
    VALUES (?, ?, ?, ?, 'verify_email', ?)
  `).bind(generateId(), user.id, email.toLowerCase(), code, expiresAt).run();
  console.log(`\u{1F4E7} RESEND CODE for ${email}: ${code}`);
  return json({
    message: "Nuevo c\xF3digo enviado.",
    ...env.ENVIRONMENT !== "production" && { devCode: code }
  });
}
__name(handleResendCode, "handleResendCode");
async function handleLogin(request, env) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return error("Email y contrase\xF1a requeridos");
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).first();
  if (!user || !user.password_hash) {
    return error("Credenciales inv\xE1lidas", 401);
  }
  if (user.status === "pending") {
    return error("Debes verificar tu email antes de iniciar sesi\xF3n. Revisa tu bandeja de entrada.", 403);
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return error("Credenciales inv\xE1lidas", 401);
  }
  await env.DB.prepare("UPDATE users SET online = 1, last_active = datetime('now') WHERE id = ?").bind(user.id).run();
  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);
  return json({ token, user: sanitizeUser(user) });
}
__name(handleLogin, "handleLogin");
async function handleMagicLink(request, env) {
  const { email } = await request.json();
  if (!email) return error("Email requerido");
  const token = generateId();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email.toLowerCase()).first();
  await env.DB.prepare(`
    INSERT INTO verification_tokens (id, user_id, email, token, purpose, expires_at)
    VALUES (?, ?, ?, ?, 'login', ?)
  `).bind(generateId(), user?.id || null, email.toLowerCase(), token, expiresAt).run();
  console.log(`\u{1F517} MAGIC LINK for ${email}: /api/auth/verify?token=${token}`);
  return json({ message: "Si el email existe, recibir\xE1s un enlace de acceso." });
}
__name(handleMagicLink, "handleMagicLink");
async function handleVerifyToken(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return error("Token requerido");
  const record = await env.DB.prepare(`
    SELECT * FROM verification_tokens
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).bind(token).first();
  if (!record) return error("Token inv\xE1lido o expirado", 401);
  await env.DB.prepare("UPDATE verification_tokens SET used = 1 WHERE id = ?").bind(record.id).run();
  let user;
  if (record.user_id) {
    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(record.user_id).first();
    await env.DB.prepare("UPDATE users SET status = 'verified', online = 1, last_active = datetime('now') WHERE id = ?").bind(user.id).run();
  } else {
    const userId = generateId();
    const country = request.headers.get("cf-ipcountry") || "";
    await env.DB.prepare(`
      INSERT INTO users (id, email, username, role, seeking, country, status)
      VALUES (?, ?, ?, 'hombre', 'mujer', ?, 'verified')
    `).bind(userId, record.email, record.email.split("@")[0], country).run();
    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  }
  const jwt = await signJWT({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);
  return Response.redirect(`${env.CORS_ORIGIN}/?token=${jwt}`, 302);
}
__name(handleVerifyToken, "handleVerifyToken");
async function handleMe(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(auth.sub).first();
  if (!user) return error("Usuario no encontrado", 404);
  return json({ user: sanitizeUser(user) });
}
__name(handleMe, "handleMe");
async function handleProfiles(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";
  const search = url.searchParams.get("q") || "";
  const country = request.headers.get("cf-ipcountry") || "";
  let query = `SELECT * FROM users WHERE id != ? AND status = 'verified'`;
  const params = [auth.sub];
  if (country) {
    query += ` AND country = ?`;
    params.push(country);
  }
  if (filter === "hombre") {
    query += ` AND role = 'hombre'`;
  } else if (filter === "mujer") {
    query += ` AND role = 'mujer'`;
  } else if (filter === "pareja") {
    query += ` AND role = 'pareja'`;
  }
  if (search) {
    query += ` AND (username LIKE ? OR city LIKE ? OR bio LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  query += ` ORDER BY last_active DESC LIMIT 50`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  const profiles = results.map((u) => ({
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
    avatar_url: u.avatar_url
  }));
  return json({ profiles });
}
__name(handleProfiles, "handleProfiles");
async function handleProfileDetail(request, env, userId) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  if (!user) return error("Perfil no encontrado", 404);
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
      avatar_url: user.avatar_url
    }
  });
}
__name(handleProfileDetail, "handleProfileDetail");
async function handleSendMessage(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const { receiver_id, content } = await request.json();
  if (!receiver_id || !content || !content.trim()) {
    return error("receiver_id y content requeridos");
  }
  const receiver = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(receiver_id).first();
  if (!receiver) return error("Destinatario no encontrado", 404);
  const today = todayUTC();
  const limit = await env.DB.prepare(
    "SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?"
  ).bind(auth.sub, today).first();
  const currentCount = limit?.msg_count || 0;
  const sender = await env.DB.prepare("SELECT premium FROM users WHERE id = ?").bind(auth.sub).first();
  if (!sender.premium && currentCount >= 5) {
    return error("Has alcanzado el l\xEDmite de 5 mensajes diarios. Desbloquea VIP para mensajes ilimitados.", 403);
  }
  const msgId = generateId();
  await env.DB.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)
  `).bind(msgId, auth.sub, receiver_id, content.trim()).run();
  if (!sender.premium) {
    if (limit) {
      await env.DB.prepare(
        "UPDATE message_limits SET msg_count = msg_count + 1 WHERE user_id = ? AND date_utc = ?"
      ).bind(auth.sub, today).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO message_limits (user_id, date_utc, msg_count) VALUES (?, ?, 1)"
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
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  }, 201);
}
__name(handleSendMessage, "handleSendMessage");
async function handleGetMessages(request, env, otherUserId) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const { results } = await env.DB.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
    LIMIT 100
  `).bind(auth.sub, otherUserId, otherUserId, auth.sub).all();
  await env.DB.prepare(`
    UPDATE messages SET is_read = 1
    WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
  `).bind(otherUserId, auth.sub).run();
  const messages = results.map((m) => ({
    id: m.id,
    senderId: m.sender_id === auth.sub ? "me" : "them",
    text: m.content,
    timestamp: new Date(m.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    created_at: m.created_at
  }));
  return json({ messages });
}
__name(handleGetMessages, "handleGetMessages");
async function handleConversations(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const { results } = await env.DB.prepare(`
    SELECT
      m.*,
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS partner_id
    FROM messages m
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY m.created_at DESC
  `).bind(auth.sub, auth.sub, auth.sub).all();
  const convMap = /* @__PURE__ */ new Map();
  for (const m of results) {
    const partnerId = m.sender_id === auth.sub ? m.receiver_id : m.sender_id;
    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, {
        lastMessage: m,
        unread: 0
      });
    }
    if (m.receiver_id === auth.sub && !m.is_read) {
      const entry = convMap.get(partnerId);
      entry.unread++;
    }
  }
  const conversations = [];
  for (const [partnerId, data] of convMap) {
    const partner = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(partnerId).first();
    if (!partner) continue;
    conversations.push({
      id: `conv-${partnerId}`,
      profileId: partnerId,
      name: partner.username,
      avatar: partner.avatar_url || "",
      lastMessage: data.lastMessage.content.slice(0, 50),
      timestamp: data.lastMessage.created_at,
      unread: data.unread,
      online: partner.online === 1
    });
  }
  return json({ conversations });
}
__name(handleConversations, "handleConversations");
async function handleMessageLimit(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const today = todayUTC();
  const limit = await env.DB.prepare(
    "SELECT msg_count FROM message_limits WHERE user_id = ? AND date_utc = ?"
  ).bind(auth.sub, today).first();
  const sender = await env.DB.prepare("SELECT premium FROM users WHERE id = ?").bind(auth.sub).first();
  const count = limit?.msg_count || 0;
  const max = sender?.premium ? Infinity : 5;
  return json({
    sent: count,
    remaining: sender?.premium ? 999 : Math.max(0, 5 - count),
    canSend: sender?.premium ? true : count < 5,
    max: sender?.premium ? 999 : 5
  });
}
__name(handleMessageLimit, "handleMessageLimit");
async function handleUpload(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.startsWith("image/")) {
    return error("Solo se permiten im\xE1genes (image/jpeg, image/png, image/webp)");
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(contentType)) {
    return error("Formato no soportado. Usa JPEG, PNG o WebP.");
  }
  const imageData = await request.arrayBuffer();
  if (imageData.byteLength > 5 * 1024 * 1024) {
    return error("La imagen no puede superar 5MB");
  }
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `profiles/${auth.sub}/${generateId()}.${ext}`;
  await env.IMAGES.put(key, imageData, {
    httpMetadata: { contentType }
  });
  const publicUrl = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : `/api/images/${key}`;
  const user = await env.DB.prepare("SELECT photos, avatar_url FROM users WHERE id = ?").bind(auth.sub).first();
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
__name(handleUpload, "handleUpload");
async function handleServeImage(request, env, path) {
  const key = path.replace("/api/images/", "");
  if (!key || key.includes("..")) return error("Ruta inv\xE1lida", 400);
  const object = await env.IMAGES.get(key);
  if (!object) return error("Imagen no encontrada", 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
__name(handleServeImage, "handleServeImage");
async function handleUpdateProfile(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return error("No autorizado", 401);
  const body = await request.json();
  const allowedFields = ["username", "role", "seeking", "interests", "age", "city", "bio", "avatar_url"];
  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (body[field] !== void 0) {
      if (field === "interests") {
        updates.push(`${field} = ?`);
        values.push(JSON.stringify(body[field]));
      } else {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
  }
  if (updates.length === 0) return error("No hay campos para actualizar");
  values.push(auth.sub);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(auth.sub).first();
  return json({ user: sanitizeUser(user) });
}
__name(handleUpdateProfile, "handleUpdateProfile");
async function handleLogout(request, env) {
  const auth = await authenticate(request, env);
  if (auth) {
    await env.DB.prepare("UPDATE users SET online = 0, last_active = datetime('now') WHERE id = ?").bind(auth.sub).run();
  }
  return json({ message: "Sesi\xF3n cerrada" });
}
__name(handleLogout, "handleLogout");
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return {
    ...safe,
    interests: safeParseJSON(safe.interests, []),
    photos: safeParseJSON(safe.photos, []),
    verified: safe.verified === 1,
    online: safe.online === 1,
    premium: safe.premium === 1
  };
}
__name(sanitizeUser, "sanitizeUser");
function mapRoleToDisplay(role) {
  const map = { hombre: "Hombre Solo", mujer: "Mujer Sola", pareja: "Pareja" };
  return map[role] || role;
}
__name(mapRoleToDisplay, "mapRoleToDisplay");
function safeParseJSON(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
__name(safeParseJSON, "safeParseJSON");
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (method === "OPTIONS") return handleOptions(env);
  if (["POST", "PUT", "DELETE"].includes(method) && env.TURNSTILE_SECRET) {
    const turnstileToken = request.headers.get("X-Turnstile-Token");
    if (!turnstileToken) {
      return error("Verificaci\xF3n de Turnstile requerida", 403);
    }
    const ip = request.headers.get("CF-Connecting-IP");
    const valid = await validateTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
    if (!valid) {
      return error("Verificaci\xF3n de Turnstile fallida", 403);
    }
  }
  if (path === "/api/auth/register" && method === "POST") return handleRegister(request, env);
  if (path === "/api/auth/login" && method === "POST") return handleLogin(request, env);
  if (path === "/api/auth/verify-code" && method === "POST") return handleVerifyCode(request, env);
  if (path === "/api/auth/resend-code" && method === "POST") return handleResendCode(request, env);
  if (path === "/api/auth/magic-link" && method === "POST") return handleMagicLink(request, env);
  if (path === "/api/auth/verify" && method === "GET") return handleVerifyToken(request, env);
  if (path === "/api/auth/me" && method === "GET") return handleMe(request, env);
  if (path === "/api/auth/logout" && method === "POST") return handleLogout(request, env);
  if (path === "/api/profiles" && method === "GET") return handleProfiles(request, env);
  if (path === "/api/profile" && method === "PUT") return handleUpdateProfile(request, env);
  const profileMatch = path.match(/^\/api\/profiles\/([a-f0-9-]+)$/);
  if (profileMatch && method === "GET") return handleProfileDetail(request, env, profileMatch[1]);
  if (path === "/api/messages" && method === "GET") return handleConversations(request, env);
  if (path === "/api/messages/send" && method === "POST") return handleSendMessage(request, env);
  if (path === "/api/messages/limit" && method === "GET") return handleMessageLimit(request, env);
  const msgMatch = path.match(/^\/api\/messages\/([a-f0-9-]+)$/);
  if (msgMatch && method === "GET") return handleGetMessages(request, env, msgMatch[1]);
  if (path === "/api/upload" && method === "POST") return handleUpload(request, env);
  if (path.startsWith("/api/images/") && method === "GET") return handleServeImage(request, env, path);
  return error("Ruta no encontrada", 404);
}
__name(handleRequest, "handleRequest");
var src_default = {
  async fetch(request, env, ctx) {
    try {
      const response = await handleRequest(request, env);
      const cors = corsHeaders(env);
      for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value);
      }
      return response;
    } catch (err) {
      console.error("Worker error:", err.message, err.stack);
      return json({ error: "Error interno del servidor" }, 500);
    }
  }
};

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error2 = reduceError(e);
    return Response.json(error2, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-fb5yeJ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-fb5yeJ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
