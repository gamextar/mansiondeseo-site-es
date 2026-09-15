import type { APIRoute } from 'astro';
import { accountSessionCookie } from '../../../lib/auth';
import { runtimeEnv } from '../../../lib/runtime';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  const db = env.DB;
  const sessionSecret = String(env.ESCORT_SESSION_SECRET || '');
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!db || !sessionSecret || !token) return Response.redirect(new URL('/registro/?error=verificacion', request.url), 303);

  const record = await db.prepare(`
    SELECT v.id, v.account_id
    FROM escort_email_verifications v
    WHERE v.token = ? AND v.used = 0 AND v.expires_at > datetime('now')
    LIMIT 1
  `).bind(token).first<any>();
  if (!record) return Response.redirect(new URL('/registro/?error=verificacion', request.url), 303);

  await db.batch([
    db.prepare("UPDATE escort_accounts SET email_verified = 1, updated_at = datetime('now') WHERE id = ?").bind(record.account_id),
    db.prepare('UPDATE escort_email_verifications SET used = 1 WHERE id = ?').bind(record.id),
  ]);

  const headers = new Headers({ Location: '/panel/?verified=1', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', await accountSessionCookie(record.account_id, sessionSecret));
  return new Response(null, { status: 303, headers });
};
