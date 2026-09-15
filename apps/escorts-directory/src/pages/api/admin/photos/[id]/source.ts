import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../../lib/auth';
import { runtimeEnv } from '../../../../../lib/runtime';
export const prerender = false;
export const GET: APIRoute = async ({ request, params, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  const photo = await env.DB.prepare('SELECT source_key FROM escort_photos WHERE id = ?').bind(params.id).first<any>();
  const object = photo && await env.ESCORT_MEDIA_PRIVATE.get(photo.source_key);
  if (!object?.body) return new Response('Foto no encontrada', { status: 404 });
  return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
};
