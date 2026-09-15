import type { APIRoute } from 'astro';
import { ESCORT_TIERS } from '../../../lib/tiers';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as any).runtime;
  const db = runtime?.env?.DB;
  if (!db) return Response.json({ error: 'Base de datos no configurada' }, { status: 503 });

  const city = new URL(request.url).searchParams.get('city')?.trim().toLowerCase() || '';
  const cityClause = city ? 'AND p.city_slug = ?' : '';
  const tierOrder = Object.keys(ESCORT_TIERS).map((tier, index) => `WHEN '${tier}' THEN ${index + 1}`).join(' ');
  const query = `
    SELECT p.slug, p.display_name, p.city_slug, p.city_name, p.price_amount, p.currency, p.short_bio,
      COALESCE((SELECT ep.tier FROM escort_promotions ep WHERE ep.profile_id = p.id AND ep.status = 'active' AND ep.starts_at <= datetime('now') AND (ep.ends_at IS NULL OR ep.ends_at > datetime('now')) ORDER BY CASE ep.tier ${tierOrder} ELSE 0 END DESC LIMIT 1), 'basic') AS tier,
      COALESCE((SELECT photo.card_key FROM escort_photos photo WHERE photo.profile_id = p.id AND photo.status = 'approved' ORDER BY photo.sort_order ASC LIMIT 1), '') AS card_key
    FROM escort_profiles p
    WHERE p.status = 'published' AND (p.is_demo = 0 OR ? = 1) ${cityClause}
    ORDER BY CASE tier ${tierOrder} ELSE 0 END DESC, p.published_at DESC
    LIMIT 48
  `;
  const includeDemo = String((locals as any)?.runtime?.env?.STAGING_NO_INDEX || '') === '1' ? 1 : 0;
  const result = city ? await db.prepare(query).bind(includeDemo, city).all() : await db.prepare(query).bind(includeDemo).all();
  return Response.json({ listings: result.results || [] }, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
      'Cache-Tag': city ? `escort-city-${city}` : 'escort-home',
    },
  });
};
