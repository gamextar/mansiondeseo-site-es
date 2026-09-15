import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../../lib/auth';
import { isEscortTier } from '../../../../../lib/tiers';
import { runtimeEnv } from '../../../../../lib/runtime';
export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  const form = await request.formData();
  const tier = String(form.get('tier') || '');
  const endsAt = String(form.get('ends_at') || '').trim() || null;
  if (!isEscortTier(tier)) return new Response('Nivel inválido', { status: 400 });
  const profile = await env.DB.prepare("SELECT id FROM escort_profiles WHERE id = ? AND status = 'published'").bind(params.id).first<any>();
  if (!profile) return new Response('Solo se promocionan perfiles publicados', { status: 400 });
  await env.DB.prepare("UPDATE escort_promotions SET status = 'expired', updated_at = datetime('now') WHERE profile_id = ? AND status = 'active'").bind(profile.id).run();
  await env.DB.prepare("INSERT INTO escort_promotions (id, profile_id, tier, ends_at, rotation_seed) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), profile.id, tier, endsAt, Math.floor(Math.random() * 2147483647)).run();
  return Response.redirect(new URL('/admin/?promotion=updated', request.url), 303);
};
