import type { APIRoute } from 'astro';
import { accountSessionCookie, verifyPassword } from '../../../lib/auth';
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
  const account = await db.prepare("SELECT id, password_hash, status, email_verified FROM escort_accounts WHERE email = ?").bind(email).first<any>();
  if (!account || account.status !== 'active' || !(await verifyPassword(password, account.password_hash))) {
    return Response.redirect(new URL('/registro/?error=acceso', request.url), 303);
  }
  if (!account.email_verified) return Response.redirect(new URL('/registro/?error=sinverificar', request.url), 303);
  const headers = new Headers({ Location: '/panel/' });
  headers.append('Set-Cookie', await accountSessionCookie(account.id, sessionSecret));
  return new Response(null, { status: 303, headers });
};
