import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../../lib/auth';
import { runtimeEnv } from '../../../../../lib/runtime';
export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  const photo = await env.DB.prepare("SELECT profile_id FROM escort_photos WHERE id = ? AND status = 'pending_review'").bind(params.id).first<any>();
  if (!photo) return new Response('Foto no encontrada', { status: 404 });
  await env.DB.batch([
    env.DB.prepare("UPDATE escort_photos SET status = 'rejected', reviewed_at = datetime('now') WHERE id = ?").bind(params.id),
    env.DB.prepare("INSERT INTO escort_moderation_events (id, profile_id, actor_id, action) VALUES (?, ?, 'administrator', 'photo_rejected')").bind(crypto.randomUUID(), photo.profile_id),
  ]);
  return Response.redirect(new URL('/admin/?photo=rejected', request.url), 303);
};
