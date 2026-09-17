import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../../lib/auth';
import { runtimeEnv } from '../../../../lib/runtime';

export const prerender = false;

const MAX_SELECTED = 50;
const ACTIONS = new Set(['publish', 'pause', 'reject', 'delete']);

function redirect(request: Request, notice: string) {
  const url = new URL('/admin/', request.url);
  url.searchParams.set('bulk', notice);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = runtimeEnv(locals);
  if (!await isAdminRequest(request, env)) return new Response('No autorizado', { status: 401 });
  if (!env.DB) return new Response('Base de datos no configurada', { status: 503 });

  const form = await request.formData();
  const action = String(form.get('action') || '').trim();
  const ids = [...new Set(form.getAll('profile_id').map((value) => String(value).trim()).filter(Boolean))].slice(0, MAX_SELECTED);
  if (!ACTIONS.has(action) || !ids.length) return redirect(request, 'sin-seleccion');

  const placeholders = ids.map(() => '?').join(',');
  const profiles = await env.DB.prepare(`SELECT id, account_id FROM escort_profiles WHERE id IN (${placeholders})`).bind(...ids).all<any>();
  const rows = profiles.results || [];
  if (!rows.length) return redirect(request, 'sin-resultados');

  if (action === 'delete') {
    const photos = await env.DB.prepare(`SELECT source_key, card_key, detail_key FROM escort_photos WHERE profile_id IN (${placeholders})`).bind(...ids).all<any>();
    const objects = [...new Set((photos.results || []).flatMap((photo: any) => [photo.source_key, photo.card_key, photo.detail_key].filter(Boolean)))];
    await Promise.all(objects.map((key) => env.ESCORT_MEDIA_PRIVATE?.delete(key)).concat(objects.map((key) => env.ESCORT_MEDIA_PUBLIC?.delete(key))));
    const accountIds = rows.map((row: any) => row.account_id).filter(Boolean);
    const accountPlaceholders = accountIds.map(() => '?').join(',');
    const statements = [
      env.DB.prepare(`DELETE FROM escort_reports WHERE profile_id IN (${placeholders})`).bind(...ids),
      env.DB.prepare(`DELETE FROM escort_reviews WHERE profile_id IN (${placeholders})`).bind(...ids),
      env.DB.prepare(`DELETE FROM escort_photos WHERE profile_id IN (${placeholders})`).bind(...ids),
      env.DB.prepare(`DELETE FROM escort_promotions WHERE profile_id IN (${placeholders})`).bind(...ids),
      env.DB.prepare(`DELETE FROM escort_moderation_events WHERE profile_id IN (${placeholders})`).bind(...ids),
      env.DB.prepare(`DELETE FROM escort_profiles WHERE id IN (${placeholders})`).bind(...ids),
    ];
    if (accountPlaceholders) statements.push(env.DB.prepare(`DELETE FROM escort_accounts WHERE id IN (${accountPlaceholders})`).bind(...accountIds));
    await env.DB.batch(statements);
    return redirect(request, `eliminados-${rows.length}`);
  }

  const note = String(form.get('note') || '').trim().slice(0, 600);
  const status = action === 'publish' ? 'published' : action === 'pause' ? 'paused' : 'rejected';
  const publishedClause = action === 'publish' ? ", published_at = COALESCE(published_at, datetime('now'))" : '';
  const eligible = action === 'publish'
    ? ` AND EXISTS (SELECT 1 FROM escort_photos photo WHERE photo.profile_id = escort_profiles.id AND photo.status = 'approved')`
    : '';
  const result = await env.DB.prepare(`UPDATE escort_profiles SET status = ?, reviewed_by = 'administrator', reviewed_at = datetime('now'), review_note = ?${publishedClause} WHERE id IN (${placeholders})${eligible}`).bind(status, note, ...ids).run();
  const changed = Number(result.meta?.changes || 0);
  const eventAction = action === 'publish' ? 'approved' : action === 'pause' ? 'paused' : 'rejected';
  await env.DB.batch(ids.map((id) => env.DB.prepare("INSERT INTO escort_moderation_events (id, profile_id, actor_id, action, note) VALUES (?, ?, 'administrator', ?, ?)").bind(crypto.randomUUID(), id, eventAction, note)));
  return redirect(request, `${eventAction}-${changed}`);
};
