import { writeFile } from 'node:fs/promises';
import { getGeoPagesForLocale } from '../src/lib/seoGeoCatalog.js';
import { buildSeoCanonical } from '../src/lib/seoRouting.js';
import { getSitemapSeoLocales } from '../src/lib/seoLocales.js';
import { SEO_BASE_INTENTS, SEO_GEO_INTENT_CONFIGS } from '../src/lib/seoVariants.js';
import { SITE_ORIGIN } from '../src/lib/siteConfig.js';

const urls = [[`${SITE_ORIGIN}/`, 'daily', '1.0']];

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

for (const locale of getSitemapSeoLocales()) {
  for (const [slug, changefreq, priority] of SEO_BASE_INTENTS) {
    urls.push([ensureTrailingSlash(buildSeoCanonical({ locale: locale.code, variant: slug })), changefreq, priority]);
  }

  const geoPages = getGeoPagesForLocale(locale.code);
  for (const geoSlug of Object.keys(geoPages)) {
    for (const { prefix, priority } of SEO_GEO_INTENT_CONFIGS) {
      urls.push([
        ensureTrailingSlash(buildSeoCanonical({ locale: locale.code, variant: prefix, citySlug: geoSlug })),
        'weekly',
        priority,
      ]);
    }
  }
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(([loc, changefreq, priority]) => `  <url><loc>${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`),
  '</urlset>',
  '',
].join('\n');

await writeFile('public/sitemap.xml', xml, 'utf8');
console.log(`Generated sitemap with ${urls.length} URLs`);
