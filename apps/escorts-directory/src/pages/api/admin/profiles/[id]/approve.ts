import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../../lib/auth';
import { runtimeEnv } from '../../../../../lib/runtime';
export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  const profile = await env.DB.prepare("SELECT id FROM escort_profiles WHERE id = ? AND status = 'pending_review'").bind(params.id).first<any>();
  const photo = profile && await env.DB.prepare("SELECT id FROM escort_photos WHERE profile_id = ? AND status = 'approved' LIMIT 1").bind(profile.id).first();
  if (!profile || !photo) return Response.redirect(new URL('/admin/?error=sin-fotos', request.url), 303);
  await env.DB.batch([
    env.DB.prepare("UPDATE escort_profiles SET status = 'published', published_at = COALESCE(published_at, datetime('now')), reviewed_by = 'administrator', reviewed_at = datetime('now'), review_note = '' WHERE id = ?").bind(profile.id),
    env.DB.prepare("INSERT INTO escort_moderation_events (id, profile_id, actor_id, action) VALUES (?, ?, 'administrator', 'approved')").bind(crypto.randomUUID(), profile.id),
  ]);
  return Response.redirect(new URL('/admin/?profile=approved', request.url), 303);
};
