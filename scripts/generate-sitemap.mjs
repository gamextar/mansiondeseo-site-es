import { writeFile } from 'node:fs/promises';
import { GEO_PAGES } from '../src/lib/seoGeoCatalog.js';

const baseUrls = [
  ['https://mansiondeseo.com/', 'daily', '1.0'],
  ['https://mansiondeseo.com/bienvenida', 'weekly', '0.8'],
  ['https://mansiondeseo.com/registro', 'monthly', '0.7'],
];

const baseIntentUrls = [
  ['parejas', 'weekly', '0.9'],
  ['trios', 'weekly', '0.9'],
  ['swingers', 'weekly', '0.8'],
  ['mujeres', 'weekly', '0.8'],
  ['hombres', 'weekly', '0.8'],
  ['trans', 'weekly', '0.8'],
  ['cuckold-argentina', 'weekly', '0.8'],
  ['contactossex', 'weekly', '0.8'],
  ['contactossex-argentina', 'weekly', '0.9'],
  ['cornudos-argentina', 'weekly', '0.9'],
];

const geoIntentConfigs = [
  { prefix: 'parejas', priority: '0.8' },
  { prefix: 'trios', priority: '0.8' },
  { prefix: 'swingers', priority: '0.78' },
  { prefix: 'mujeres', priority: '0.78' },
  { prefix: 'hombres', priority: '0.78' },
  { prefix: 'trans', priority: '0.78' },
  { prefix: 'cuckold-argentina', priority: '0.88' },
  { prefix: 'contactossex', priority: '0.85' },
  { prefix: 'contactossex-argentina', priority: '0.92' },
  { prefix: 'cornudos-argentina', priority: '0.92' },
];

const urls = [
  ...baseUrls,
  ...baseIntentUrls.map(([slug, changefreq, priority]) => [`https://mansiondeseo.com/${slug}`, changefreq, priority]),
];

for (const geoSlug of Object.keys(GEO_PAGES)) {
  for (const { prefix, priority } of geoIntentConfigs) {
    urls.push([`https://mansiondeseo.com/${prefix}/${geoSlug}`, 'weekly', priority]);
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
