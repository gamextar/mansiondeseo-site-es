import { ESCORT_TIERS, type EscortTier } from './tiers';
import { mediaUrl } from './runtime';

export type CatalogueListing = {
  slug: string;
  displayName: string;
  citySlug: string;
  cityName: string;
  priceAmount: number;
  currency: string;
  tier: EscortTier;
  shortBio: string;
  photo: string;
  detailPhoto: string;
  contactUrl: string;
  contactLabel: string;
};

function tierCase(column: string) {
  return `CASE ${column} ${Object.keys(ESCORT_TIERS).map((tier, index) => `WHEN '${tier}' THEN ${index + 1}`).join(' ')} ELSE 0 END`;
}

function toListing(env: Record<string, any>, row: any): CatalogueListing {
  const tier = String(row.tier || 'basic') as EscortTier;
  return {
    slug: row.slug,
    displayName: row.display_name,
    citySlug: row.city_slug,
    cityName: row.city_name,
    priceAmount: Number(row.price_amount || 0),
    currency: row.currency || 'ARS',
    tier: tier in ESCORT_TIERS ? tier : 'basic',
    shortBio: row.short_bio || '',
    photo: mediaUrl(env, row.card_key),
    detailPhoto: mediaUrl(env, row.detail_key || row.card_key),
    contactUrl: row.contact_url || '',
    contactLabel: row.contact_label || 'Contactar',
  };
}

const commonSelect = `
  SELECT p.slug, p.display_name, p.city_slug, p.city_name, p.price_amount, p.currency, p.short_bio, p.contact_url, p.contact_label,
    COALESCE((SELECT ep.tier FROM escort_promotions ep WHERE ep.profile_id = p.id AND ep.status = 'active' AND ep.starts_at <= datetime('now') AND (ep.ends_at IS NULL OR ep.ends_at > datetime('now')) ORDER BY ${tierCase('ep.tier')} DESC LIMIT 1), 'basic') AS tier,
    COALESCE((SELECT photo.card_key FROM escort_photos photo WHERE photo.profile_id = p.id AND photo.status = 'approved' ORDER BY photo.sort_order ASC LIMIT 1), '') AS card_key,
    COALESCE((SELECT photo.detail_key FROM escort_photos photo WHERE photo.profile_id = p.id AND photo.status = 'approved' ORDER BY photo.sort_order ASC LIMIT 1), '') AS detail_key
  FROM escort_profiles p
  WHERE p.status = 'published' AND (p.is_demo = 0 OR ? = 1)
`;

export async function getPublicListings(env: Record<string, any>, city = '', limit?: number) {
  if (!env.DB) return [] as CatalogueListing[];
  const resolvedLimit = Number.isFinite(limit) ? Number(limit) : (String(env.STAGING_NO_INDEX || '') === '1' ? 60 : 48);
  const filter = city ? ' AND p.city_slug = ?' : '';
  // A daily deterministic shuffle rotates listings within the same paid level.
  const rotation = `abs((COALESCE((SELECT ep.rotation_seed FROM escort_promotions ep WHERE ep.profile_id = p.id AND ep.status = 'active' ORDER BY ep.created_at DESC LIMIT 1), 0) + CAST(strftime('%j', 'now') AS INTEGER) * 7919) % 2147483647)`;
  const query = `${commonSelect}${filter} ORDER BY ${tierCase('tier')} DESC, ${rotation} ASC, p.published_at DESC LIMIT ?`;
  const includeDemo = String(env.STAGING_NO_INDEX || '') === '1' ? 1 : 0;
  const result = city
    ? await env.DB.prepare(query).bind(includeDemo, city, resolvedLimit).all()
    : await env.DB.prepare(query).bind(includeDemo, resolvedLimit).all();
  return (result.results || []).map((row: any) => toListing(env, row));
}

export async function getPublicListing(env: Record<string, any>, slug: string) {
  if (!env.DB) return null;
  const includeDemo = String(env.STAGING_NO_INDEX || '') === '1' ? 1 : 0;
  const result = await env.DB.prepare(`${commonSelect} AND p.slug = ? LIMIT 1`).bind(includeDemo, slug).first();
  return result ? toListing(env, result) : null;
}

export async function getPublicCities(env: Record<string, any>) {
  if (!env.DB) return [] as { slug: string; name: string; count: number }[];
  const includeDemo = String(env.STAGING_NO_INDEX || '') === '1' ? 1 : 0;
  const result = await env.DB.prepare("SELECT city_slug AS slug, city_name AS name, COUNT(*) AS count FROM escort_profiles WHERE status = 'published' AND (is_demo = 0 OR ? = 1) GROUP BY city_slug, city_name ORDER BY count DESC, name ASC").bind(includeDemo).all();
  return (result.results || []).map((row: any) => ({ slug: row.slug, name: row.name, count: Number(row.count || 0) }));
}
