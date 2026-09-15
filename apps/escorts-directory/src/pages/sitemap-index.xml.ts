import type { APIRoute } from 'astro';
import { demoCities, demoListings } from '../data/demo-listings';

export const prerender = true;
export const GET: APIRoute = ({ site }) => {
  const urls = [
    '/',
    ...demoCities.map((city) => `/escorts/${city.slug}/`),
    ...demoListings.map((listing) => `/escort/${listing.slug}/`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${site}${path.slice(1)}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
