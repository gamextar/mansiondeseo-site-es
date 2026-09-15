import type { APIRoute } from 'astro';
import { accountIdFromRequest } from '../../../lib/auth';
import { citySlug, isSafeContactUrl, normalizeText, profileSlug } from '../../../lib/profile';
import { runtimeEnv } from '../../../lib/runtime';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  const db = env.DB;
  const accountId = await accountIdFromRequest(request, env);
  if (!db || !accountId) return Response.redirect(new URL('/registro/?error=sesion', request.url), 303);
  const form = await request.formData();
  const displayName = normalizeText(form.get('display_name'), 80);
  const cityName = normalizeText(form.get('city_name'), 80);
  const shortBio = normalizeText(form.get('short_bio'), 600);
  const contactUrl = normalizeText(form.get('contact_url'), 500);
  const contactLabel = normalizeText(form.get('contact_label'), 32);
  const slugBase = profileSlug(displayName);
  if (!displayName || !cityName || !shortBio || !slugBase || !isSafeContactUrl(contactUrl)) {
    return Response.redirect(new URL('/panel/?error=perfil', request.url), 303);
  }
  const existing = await db.prepare('SELECT id, slug FROM escort_profiles WHERE account_id = ?').bind(accountId).first<any>();
  if (existing) {
    await db.prepare("UPDATE escort_profiles SET display_name = ?, city_slug = ?, city_name = ?, short_bio = ?, contact_url = ?, contact_label = ?, status = 'pending_review', review_note = '', updated_at = datetime('now') WHERE id = ?")
      .bind(displayName, citySlug(cityName), cityName, shortBio, contactUrl, contactLabel || 'Contactar', existing.id).run();
  } else {
    const suffix = crypto.randomUUID().slice(0, 8);
    await db.prepare("INSERT INTO escort_profiles (id, account_id, slug, display_name, city_slug, city_name, short_bio, contact_url, contact_label, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')")
      .bind(crypto.randomUUID(), accountId, `${slugBase}-${suffix}`, displayName, citySlug(cityName), cityName, shortBio, contactUrl, contactLabel || 'Contactar').run();
  }
  return Response.redirect(new URL('/panel/?saved=1', request.url), 303);
};
