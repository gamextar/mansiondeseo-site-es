import type { APIRoute } from 'astro';

export const prerender = false;
export const GET: APIRoute = ({ site, locals }) => {
  const env = (locals as any)?.runtime?.env || {};
  const staging = String(env.STAGING_NO_INDEX || '') === '1';
  const origin = String(env.PUBLIC_SITE_ORIGIN || site || '').replace(/\/$/, '');
  const policy = staging ? 'Disallow: /' : 'Allow: /';
  return new Response(`User-agent: *\n${policy}\nSitemap: ${origin}/sitemap-index.xml\n`, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
