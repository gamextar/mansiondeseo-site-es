const SESSION_COOKIE = 'escort_session';
const ADMIN_COOKIE = 'escort_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  let binary = '';
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function readCookie(request: Request, name: string) {
  const entry = request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : '';
}

type Session = { sub: string; role: 'account' | 'admin'; exp: number };

async function createToken(session: Session, secret: string) {
  const body = encode(JSON.stringify(session));
  return `${body}.${await hmac(body, secret)}`;
}

async function readToken(value: string, secret: string): Promise<Session | null> {
  const [body, signature] = value.split('.');
  if (!body || !signature || signature !== await hmac(body, secret)) return null;
  try {
    const payload = JSON.parse(decode(body));
    if (!payload?.sub || !payload?.role || Number(payload.exp) * 1000 <= Date.now()) return null;
    return payload as Session;
  } catch {
    return null;
  }
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function accountSessionCookie(accountId: string, secret: string) {
  const token = await createToken({ sub: accountId, role: 'account', exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS }, secret);
  return cookie(SESSION_COOKIE, token, SESSION_MAX_AGE_SECONDS);
}

export async function adminSessionCookie(secret: string) {
  const token = await createToken({ sub: 'administrator', role: 'admin', exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS }, secret);
  return cookie(ADMIN_COOKIE, token, SESSION_MAX_AGE_SECONDS);
}

export function clearSessionCookie(name = SESSION_COOKIE) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function accountIdFromRequest(request: Request, env: Record<string, any>) {
  const secret = String(env.ESCORT_SESSION_SECRET || '');
  if (!secret) return null;
  const session = await readToken(readCookie(request, SESSION_COOKIE), secret);
  return session?.role === 'account' ? session.sub : null;
}

export async function isAdminRequest(request: Request, env: Record<string, any>) {
  const secret = String(env.ESCORT_SESSION_SECRET || '');
  const adminToken = String(env.ESCORT_ADMIN_TOKEN || '');
  const authorization = request.headers.get('Authorization') || '';
  if (adminToken && authorization === `Bearer ${adminToken}`) return true;
  if (!secret) return false;
  const session = await readToken(readCookie(request, ADMIN_COOKIE), secret);
  return session?.role === 'admin';
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material, 256));
  const toHex = (bytes: Uint8Array) => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = String(stored || '').split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) || []);
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material, 256));
  const candidate = Array.from(hash).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  if (candidate.length !== hashHex.length) return false;
  let different = 0;
  for (let index = 0; index < candidate.length; index += 1) different |= candidate.charCodeAt(index) ^ hashHex.charCodeAt(index);
  return different === 0;
}
