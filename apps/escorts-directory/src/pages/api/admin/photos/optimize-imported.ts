import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../lib/auth';
import { purgePublicCache, runtimeEnv } from '../../../../lib/runtime';

export const prerender = false;

async function createVariant(images: any, body: ReadableStream, width: number, height: number) {
  return (await images.input(body)
    .transform({ width, height, fit: 'cover' })
    .output({ format: 'image/avif', quality: width <= 640 ? 68 : 78 })
    .response());
}

function redirect(request: Request, processed: number, failed: number) {
  const url = new URL('/admin/', request.url);
  url.searchParams.set('optimized', `${processed}-${failed}`);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  if (!env.DB || !env.ESCORT_MEDIA_PRIVATE || !env.ESCORT_MEDIA_PUBLIC || !env.IMAGES) return new Response('Procesamiento de imágenes no configurado', { status: 503 });

  const form = await request.formData();
  const requestedLimit = Number.parseInt(String(form.get('limit') || '8'), 10);
  const limit = Math.max(1, Math.min(8, Number.isFinite(requestedLimit) ? requestedLimit : 8));
  const photos = await env.DB.prepare(`
    SELECT photo.id, photo.profile_id, photo.source_key, profile.slug, profile.city_slug
    FROM escort_photos photo
    JOIN escort_profiles profile ON profile.id = photo.profile_id
    WHERE photo.status = 'approved'
      AND photo.source_key IS NOT NULL
      AND (photo.card_key IS NULL OR photo.card_key NOT LIKE '%/card-640.avif')
    ORDER BY photo.reviewed_at ASC, photo.id ASC
    LIMIT ?
  `).bind(limit).all<any>();

  let processed = 0;
  let failed = 0;
  const publicPaths = ['/', '/sitemap-index.xml'];
  for (const photo of photos.results || []) {
    try {
      const original = await env.ESCORT_MEDIA_PRIVATE.get(photo.source_key);
      if (!original?.body) throw new Error('Original no disponible');
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
      await env.DB.prepare("UPDATE escort_photos SET card_key = ?, detail_key = ?, width = 640, height = 853, reviewed_at = datetime('now') WHERE id = ?")
        .bind(cardKey, detailKey, photo.id).run();
      publicPaths.push(`/escort/${photo.slug}/`, `/escorts/${photo.city_slug}/`);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.warn(`No se pudo optimizar ${photo.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (processed > 0) await purgePublicCache(env, publicPaths);
  return redirect(request, processed, failed);
};
