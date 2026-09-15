import type { APIRoute } from 'astro';
import { adminSessionCookie } from '../../../lib/auth';
import { runtimeEnv } from '../../../lib/runtime';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  const form = await request.formData();
  const provided = String(form.get('token') || '');
  if (!env.ESCORT_ADMIN_TOKEN || provided !== env.ESCORT_ADMIN_TOKEN || !env.ESCORT_SESSION_SECRET) {
    return Response.redirect(new URL('/admin/?error=acceso', request.url), 303);
  }
  return new Response(null, { status: 303, headers: { Location: '/admin/', 'Set-Cookie': await adminSessionCookie(env.ESCORT_SESSION_SECRET) } });
};
