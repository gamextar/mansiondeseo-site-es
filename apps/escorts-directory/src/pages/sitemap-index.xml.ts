import type { APIRoute } from 'astro';
import { getPublicCities, getPublicListings } from '../lib/public-catalogue';

export const prerender = false;
export const GET: APIRoute = async ({ site, locals }) => {
  const env = (locals as any)?.runtime?.env || {};
  const origin = String(env.PUBLIC_SITE_ORIGIN || site || '').replace(/\/$/, '');
  const [cities, listings] = await Promise.all([getPublicCities(env), getPublicListings(env, '', 50000)]);
  const urls = [
    '/',
    ...cities.map((city) => `/escorts/${city.slug}/`),
    ...listings.map((listing) => `/escort/${listing.slug}/`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=900', 'Cache-Tag': 'escort-sitemap' } });
};
