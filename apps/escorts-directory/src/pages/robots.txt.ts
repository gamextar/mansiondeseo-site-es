import type { APIRoute } from 'astro';

export const prerender = false;
export const GET: APIRoute = ({ site, locals }) => {
  const staging = String((locals as any)?.runtime?.env?.STAGING_NO_INDEX || '') === '1';
  const policy = staging ? 'Disallow: /' : 'Allow: /';
  return new Response(`User-agent: *\n${policy}\nSitemap: ${site}sitemap-index.xml\n`, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
