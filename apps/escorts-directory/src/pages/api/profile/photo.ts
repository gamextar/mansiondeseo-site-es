import type { APIRoute } from 'astro';
import { accountIdFromRequest } from '../../../lib/auth';
import { normalizeText } from '../../../lib/profile';
import { runtimeEnv } from '../../../lib/runtime';

export const prerender = false;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  const db = env.DB;
  const accountId = await accountIdFromRequest(request, env);
  if (!db || !accountId || !env.ESCORT_MEDIA_PRIVATE) return Response.redirect(new URL('/registro/?error=sesion', request.url), 303);
  const form = await request.formData();
  const photo = form.get('photo');
  const altText = normalizeText(form.get('alt_text'), 160);
  if (!(photo instanceof File) || !ACCEPTED_TYPES.has(photo.type) || photo.size <= 0 || photo.size > MAX_UPLOAD_BYTES) {
    return Response.redirect(new URL('/panel/?error=foto', request.url), 303);
  }
  const profile = await db.prepare("SELECT id FROM escort_profiles WHERE account_id = ? AND status IN ('draft', 'pending_review', 'rejected', 'paused')").bind(accountId).first<any>();
  if (!profile) return Response.redirect(new URL('/panel/?error=perfil', request.url), 303);

  const photoId = crypto.randomUUID();
  const extension = photo.type === 'image/jpeg' ? 'jpg' : photo.type.split('/')[1];
  const sourceKey = `source/${profile.id}/${photoId}/original.${extension}`;
  await env.ESCORT_MEDIA_PRIVATE.put(sourceKey, photo.stream(), {
    httpMetadata: { contentType: photo.type },
    customMetadata: { profileId: profile.id, uploadedBy: accountId },
  });
  const position = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS position FROM escort_photos WHERE profile_id = ?').bind(profile.id).first<any>();
  await db.prepare('INSERT INTO escort_photos (id, profile_id, source_key, alt_text, sort_order) VALUES (?, ?, ?, ?, ?)')
    .bind(photoId, profile.id, sourceKey, altText, Number(position?.position || -1) + 1).run();
  return Response.redirect(new URL('/panel/?uploaded=1', request.url), 303);
};
