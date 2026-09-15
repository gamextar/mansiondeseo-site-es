import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../../lib/auth';
import { runtimeEnv } from '../../../../../lib/runtime';
export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  const form = await request.formData();
  const note = String(form.get('note') || '').trim().slice(0, 600);
  const profile = await env.DB.prepare("SELECT id FROM escort_profiles WHERE id = ? AND status = 'pending_review'").bind(params.id).first<any>();
  if (!profile) return new Response('Perfil no encontrado', { status: 404 });
  await env.DB.batch([
    env.DB.prepare("UPDATE escort_profiles SET status = 'rejected', reviewed_by = 'administrator', reviewed_at = datetime('now'), review_note = ? WHERE id = ?").bind(note, profile.id),
    env.DB.prepare("INSERT INTO escort_moderation_events (id, profile_id, actor_id, action, note) VALUES (?, ?, 'administrator', 'rejected', ?)").bind(crypto.randomUUID(), profile.id, note),
  ]);
  return Response.redirect(new URL('/admin/?profile=rejected', request.url), 303);
};
