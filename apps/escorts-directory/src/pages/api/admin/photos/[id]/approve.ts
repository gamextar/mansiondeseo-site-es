import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../../lib/auth';
import { runtimeEnv } from '../../../../../lib/runtime';

export const prerender = false;

async function createVariant(images: any, body: ReadableStream, width: number, height: number) {
  return (await images.input(body)
    .transform({ width, height, fit: 'cover' })
    .output({ format: 'image/avif', quality: width <= 640 ? 68 : 78 })
    .response());
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  if (!env.DB || !env.ESCORT_MEDIA_PRIVATE || !env.ESCORT_MEDIA_PUBLIC || !env.IMAGES) return new Response('Procesamiento de imágenes no configurado', { status: 503 });
  const photo = await env.DB.prepare("SELECT id, profile_id, source_key FROM escort_photos WHERE id = ? AND status = 'pending_review'").bind(params.id).first<any>();
  if (!photo) return new Response('Foto no encontrada o ya revisada', { status: 404 });
  const original = await env.ESCORT_MEDIA_PRIVATE.get(photo.source_key);
  if (!original?.body) return new Response('Original no disponible', { status: 404 });
  const prefix = `profiles/${photo.profile_id}/${photo.id}/v1`;
  const smallKey = `${prefix}/card-320.avif`;
  const cardKey = `${prefix}/card-640.avif`;
  const detailKey = `${prefix}/detail-1280.avif`;
  const [smallSource, remainingSource] = original.body.tee();
  const [cardSource, detailSource] = remainingSource.tee();
  const [small, card, detail] = await Promise.all([
    createVariant(env.IMAGES, smallSource, 320, 427),
    createVariant(env.IMAGES, cardSource, 640, 853),
    createVariant(env.IMAGES, detailSource, 1280, 1706),
  ]);
  await Promise.all([
    env.ESCORT_MEDIA_PUBLIC.put(smallKey, small.body, { httpMetadata: { contentType: 'image/avif', cacheControl: 'public, max-age=31536000, immutable' } }),
    env.ESCORT_MEDIA_PUBLIC.put(cardKey, card.body, { httpMetadata: { contentType: 'image/avif', cacheControl: 'public, max-age=31536000, immutable' } }),
    env.ESCORT_MEDIA_PUBLIC.put(detailKey, detail.body, { httpMetadata: { contentType: 'image/avif', cacheControl: 'public, max-age=31536000, immutable' } }),
  ]);
  await env.DB.batch([
    env.DB.prepare("UPDATE escort_photos SET status = 'approved', card_key = ?, detail_key = ?, reviewed_at = datetime('now') WHERE id = ?").bind(cardKey, detailKey, photo.id),
    env.DB.prepare("INSERT INTO escort_moderation_events (id, profile_id, actor_id, action) VALUES (?, ?, 'administrator', 'photo_approved')").bind(crypto.randomUUID(), photo.profile_id),
  ]);
  return Response.redirect(new URL('/admin/?photo=approved', request.url), 303);
};
