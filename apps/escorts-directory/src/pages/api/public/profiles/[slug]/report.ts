import type { APIRoute } from 'astro';
import { runtimeEnv } from '../../../../../lib/runtime';

export const prerender = false;

const ALLOWED_REASONS = new Set(['suplantacion', 'menor_de_edad', 'imagen_sin_consentimiento', 'estafa', 'otro']);

export const POST: APIRoute = async ({ request, params, locals }) => {
  const env = runtimeEnv(locals);
  if (!env.DB) return new Response('Servicio no disponible', { status: 503 });
  const form = await request.formData();
  const reason = String(form.get('reason') || 'otro').trim();
  const details = String(form.get('details') || '').trim().slice(0, 1000);
  if (!ALLOWED_REASONS.has(reason)) return new Response('Motivo inválido', { status: 400 });
  const profile = await env.DB.prepare("SELECT id FROM escort_profiles WHERE slug = ? AND status = 'published'").bind(params.slug).first<any>();
  if (!profile) return new Response('Perfil no encontrado', { status: 404 });
  await env.DB.prepare('INSERT INTO escort_reports (id, profile_id, reason, details) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), profile.id, reason, details).run();
  return Response.redirect(new URL(`/escort/${params.slug}/?report=received`, request.url), 303);
};
