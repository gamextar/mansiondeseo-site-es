import type { APIRoute } from 'astro';
import { accountSessionCookie, hashPassword } from '../../../lib/auth';
import { normalizeEmail } from '../../../lib/profile';
import { runtimeEnv } from '../../../lib/runtime';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  const db = env.DB;
  const sessionSecret = String(env.ESCORT_SESSION_SECRET || '');
  if (!db || !sessionSecret) return new Response('Configuración incompleta', { status: 503 });
  const form = await request.formData();
  const email = normalizeEmail(form.get('email'));
  const password = String(form.get('password') || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    return Response.redirect(new URL('/registro/?error=datos', request.url), 303);
  }
  const existing = await db.prepare('SELECT id FROM escort_accounts WHERE email = ?').bind(email).first();
  if (existing) return Response.redirect(new URL('/registro/?error=existente', request.url), 303);

  const accountId = crypto.randomUUID();
  await db.prepare('INSERT INTO escort_accounts (id, email, password_hash) VALUES (?, ?, ?)')
    .bind(accountId, email, await hashPassword(password)).run();
  const headers = new Headers({ Location: '/panel/' });
  headers.append('Set-Cookie', await accountSessionCookie(accountId, sessionSecret));
  return new Response(null, { status: 303, headers });
};
