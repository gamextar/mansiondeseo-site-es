import type { APIRoute } from 'astro';
import { hashPassword } from '../../../lib/auth';
import { sendAccountVerificationEmail } from '../../../lib/email';
import { normalizeEmail } from '../../../lib/profile';
import { runtimeEnv } from '../../../lib/runtime';

export const prerender = false;

function wantsJson(request: Request) {
  return String(request.headers.get('accept') || '').includes('application/json');
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function redirectTo(request: Request, query: string) {
  return Response.redirect(new URL(`/registro/?${query}`, request.url), 303);
}

export const GET: APIRoute = async ({ request }) => redirectTo(request, 'error=metodo');

export const POST: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  const db = env.DB;
  const sessionSecret = String(env.ESCORT_SESSION_SECRET || '');
  const json = wantsJson(request);
  if (!db || !sessionSecret) return json ? jsonResponse({ error: 'Configuración incompleta' }, 503) : new Response('Configuración incompleta', { status: 503 });
  const form = await request.formData();
  const email = normalizeEmail(form.get('email'));
  const password = String(form.get('password') || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
    return json ? jsonResponse({ error: 'El email no es válido o la contraseña debe tener al menos 10 caracteres.' }, 400) : redirectTo(request, 'error=datos');
  }

  const existing = await db.prepare('SELECT id, email_verified FROM escort_accounts WHERE email = ?').bind(email).first<any>();
  if (existing?.email_verified) {
    return json ? jsonResponse({ error: 'Este email ya está registrado.' }, 409) : redirectTo(request, 'error=existente');
  }

  const accountId = existing?.id || crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  if (existing) {
    await db.prepare("UPDATE escort_accounts SET password_hash = ?, status = 'active', email_verified = 0, updated_at = datetime('now') WHERE id = ?")
      .bind(passwordHash, accountId).run();
    await db.prepare('DELETE FROM escort_email_verifications WHERE account_id = ?').bind(accountId).run();
  } else {
    await db.prepare('INSERT INTO escort_accounts (id, email, password_hash, email_verified) VALUES (?, ?, ?, 0)')
      .bind(accountId, email, passwordHash).run();
  }

  const token = crypto.randomUUID();
  await db.prepare('INSERT INTO escort_email_verifications (id, account_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), accountId, token, new Date(Date.now() + 30 * 60 * 1000).toISOString()).run();

  const sent = await sendAccountVerificationEmail(env, email, token);
  if (!sent) {
    return json
      ? jsonResponse({ error: 'No pudimos enviar el email de confirmación. Intentá nuevamente en unos minutos.' }, 502)
      : redirectTo(request, 'error=email');
  }

  return json
    ? jsonResponse({ message: 'Te enviamos un enlace de confirmación a tu email.', email }, 201)
    : redirectTo(request, 'registered=1');
};
