import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SEO_LOCALE, getSeoLocale } from '../src/lib/seoLocales.js';
import { buildSeoCanonical, buildSeoPath } from '../src/lib/seoRouting.js';
import { getSeoIntentPage } from '../src/lib/seoIntentCatalog.js';
import { getGeoPagesForLocale } from '../src/lib/seoGeoCatalog.js';
import { SITE_LOCALE, SITE_ORIGIN, formatNumber } from '../src/lib/siteConfig.js';
import { SEO_BASE_INTENTS, SEO_GEO_INTENT_CONFIGS } from '../src/lib/seoVariants.js';

const DIST_DIR = path.resolve('dist');
const redirectsPath = path.join(DIST_DIR, '_redirects');
const seoStatsPath = path.resolve('data/seo/seo-city-stats.json');

const STATIC_SEO_VARIANTS = SEO_BASE_INTENTS.map(([variant]) => variant);
const GEO_PAGES = getGeoPagesForLocale(DEFAULT_SEO_LOCALE);
const GEO_VARIANTS = SEO_GEO_INTENT_CONFIGS.flatMap(({ prefix }) =>
  Object.keys(GEO_PAGES).map((citySlug) => ({ variant: prefix, citySlug }))
);
const STATIC_SEO_ROUTES = [
  ...STATIC_SEO_VARIANTS.map((variant) => ({ variant, citySlug: '' })),
  ...GEO_VARIANTS,
];
const SEO_FALLBACK_PREFIXES = new Set([
  ...STATIC_SEO_VARIANTS,
  ...SEO_GEO_INTENT_CONFIGS.map(({ prefix }) => prefix),
]);

const RELATED_LABELS = {
  parejas: 'Parejas',
  'parejas-liberales': 'Parejas liberales',
  trios: 'Trios',
  swingers: 'Swingers',
  mujeres: 'Mujeres',
  hombres: 'Hombres',
  trans: 'Trans',
  'cornudos-argentina': 'Cornudos',
  'cuckold-argentina': 'Cuckold',
  'hotwife-argentina': 'Hotwife',
  contactossex: 'Contactossex',
  'contactossex-argentina': 'Contactossex AR',
};

const CANONICAL_REDIRECTS = [
  ['/parejas', '/parejas-liberales/'],
  ['/parejas/', '/parejas-liberales/'],
];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonScript(value) {
  return JSON.stringify(value).replaceAll('</', '<\\/');
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function routePath(variant, citySlug = '') {
  return ensureTrailingSlash(buildSeoPath({ locale: DEFAULT_SEO_LOCALE, variant, citySlug }));
}

function canonicalUrl(variant, citySlug = '') {
  return ensureTrailingSlash(buildSeoCanonical({ locale: DEFAULT_SEO_LOCALE, variant, citySlug }));
}

function routeKey(variant, citySlug = '') {
  return routePath(variant, citySlug).replace(/^\/+|\/+$/g, '');
}

function normalizeRoleVariant(variant) {
  return variant === 'parejas' ? 'parejas-liberales' : variant;
}

function formatCount(value) {
  return formatNumber(value || 0);
}

function formatSeoCityStatsDate(value) {
  const datePart = String(value || '').slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function hasSeoCityStats(stats) {
  return Number(stats?.active_profiles_30d || 0) > 0;
}

function exactCityLabel(prefix, citySlug, city) {
  if (citySlug === 'caba') return `${prefix} CABA`;
  if (citySlug === 'buenos-aires-provincia') return `${prefix} Provincia de Buenos Aires`;
  if (citySlug === 'cordoba-provincia') return `${prefix} Provincia de Córdoba`;
  return `${prefix} ${city.label}`;
}

function buildLocalizedPage(page, citySlug, variant, cityStats) {
  const city = GEO_PAGES[citySlug];
  if (!city) return page;

  const citySuffix = `${city.cityHint} | Mansión Deseo`;
  const cityIntroSuffix = ` Enfocada en ${city.label.toLowerCase()}, con presencia local y acceso privado para adultos registrados.`;
  const cityBullets = [
    `${page.focus} ${city.cityHint}`,
    `${city.catchphrase}`,
    'Contenido completo solo para usuarios registrados',
  ];
  const exactContactossex = exactCityLabel('Contactossex', citySlug, city);
  const exactCornudos = exactCityLabel('Cornudos', citySlug, city);
  const exactCuckold = exactCityLabel('Cuckold', citySlug, city);
  const updatedLabel = formatSeoCityStatsDate(cityStats?.updated_at);
  const hasStats = hasSeoCityStats(cityStats);
  const activeProfiles = formatCount(cityStats?.active_profiles_30d);
  const activeCouples = formatCount(cityStats?.active_couples_30d);
  const activeWomen = formatCount(cityStats?.active_women_30d);
  const activeMen = formatCount(cityStats?.active_men_30d);
  const premiumProfiles = formatCount(cityStats?.premium_profiles);

  if (variant === 'contactossex-argentina') {
    if (hasStats) {
      return {
        ...page,
        title: `Contactossex Argentina ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Búsquedas de contactossex argentina ${city.cityHint} con ${activeProfiles} perfiles verificados activos en los últimos 30 días, ${activeCouples} parejas y acceso privado para adultos registrados.`,
        headline: `Contactossex Argentina ${city.label} con actividad real`,
        intro: `Si buscás contactossex argentina ${city.cityHint}, acá tenés una alternativa privada con ${activeProfiles} perfiles verificados activos en los últimos 30 días. La base local incluye ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los últimos 30 días`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Cuánta actividad hay ${city.cityHint}?`, `Según la actualización del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los últimos 30 días, incluyendo ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres.`],
          ['¿Se puede ver todo sin registrarse?', 'No. La landing es pública para captar la búsqueda, pero el contenido completo y la interacción quedan dentro del sitio para usuarios registrados.'],
        ],
      };
    }

    return {
      ...page,
      title: `Contactossex Argentina ${citySuffix}`,
      description: `Búsquedas de contactossex argentina ${city.cityHint} en una comunidad privada para adultos registrados, con perfiles verificados y discreción.`,
      headline: `Contactossex Argentina ${city.label}`,
      intro: `Una entrada pública pensada para captar la búsqueda exacta de contactossex argentina ${city.cityHint} y llevarla a una experiencia privada.${cityIntroSuffix}`,
      bullets: cityBullets,
    };
  }

  if (page.focus === 'contactossex') {
    if (hasStats) {
      return {
        ...page,
        title: `Contactossex ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Alternativa privada para quienes buscan ${exactContactossex}, con ${activeProfiles} perfiles verificados activos en los últimos 30 días, ${activeCouples} parejas y acceso controlado.`,
        headline: `${exactContactossex} con actividad real y acceso privado`,
        intro: `Una landing pensada para captar búsquedas de ${exactContactossex} y convertirlas en registro dentro de Mansión Deseo. En este momento, la base local muestra ${activeProfiles} perfiles verificados activos en los últimos 30 días, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los últimos 30 días`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real para ${exactContactossex}?`, `Sí. Según la actualización del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los últimos 30 días ${city.cityHint}.`],
          ['¿Es el mismo sitio?', 'No. Es una alternativa propia, privada y orientada a perfiles verificados, con acceso completo solo después del registro.'],
        ],
      };
    }

    return {
      ...page,
      title: `Contactossex ${citySuffix}`,
      description: `Alternativa privada para adultos registrados que buscan ${exactContactossex}, con perfiles verificados, discreción total y foco en Argentina.`,
      headline: `Si buscás ${exactContactossex}, esta es tu alternativa`,
      intro: `Una landing pensada para captar búsquedas de ${exactContactossex} y convertirlas en registro dentro de Mansión Deseo.${cityIntroSuffix}`,
      bullets: cityBullets,
    };
  }

  if (page.focus === 'cuckold argentina') {
    return {
      ...page,
      title: `Cuckold ${citySuffix}`,
      description: `Búsquedas de ${exactCuckold}, cornudo y cornudos ${city.cityHint} en una comunidad privada para adultos registrados, con discreción y perfiles verificados.`,
      headline: `${exactCuckold}, discreción y afinidad real`,
      intro: `Una entrada pública para búsquedas de ${exactCuckold}, cornudo y cornudos ${city.cityHint}, pensada para llevar tráfico local a una experiencia privada.${cityIntroSuffix}`,
      bullets: [
        `Búsquedas de ${exactCuckold}, cornudo y cornudos ${city.cityHint}`,
        `${city.catchphrase}`,
        'Contenido completo solo para usuarios registrados',
      ],
    };
  }

  if (page.focus === 'cornudos') {
    return {
      ...page,
      title: `Cornudos ${citySuffix}`,
      description: `Búsquedas de ${exactCornudos} y cornudo ${city.cityHint} en una comunidad privada para adultos registrados, con discreción y perfiles verificados.`,
      headline: `${exactCornudos}, discreción y afinidad real`,
      intro: `Una entrada pública para búsquedas de ${exactCornudos} y cornudo ${city.cityHint}, pensada para llevar tráfico local a una experiencia privada.${cityIntroSuffix}`,
      bullets: [
        `Búsquedas de ${exactCornudos} y cornudo ${city.cityHint}`,
        `${city.catchphrase}`,
        'Contenido completo solo para usuarios registrados',
      ],
    };
  }

  return {
    ...page,
    title: `${page.headline.split(',')[0]} ${citySuffix}`,
    description: `${page.description.replace(/\.$/, '')} ${city.cityHint}.`,
    headline: `${page.headline} ${city.cityHint}`,
    intro: `${page.intro}${cityIntroSuffix}`,
    bullets: cityBullets,
  };
}

function relatedLinks(activeVariant, activeCitySlug = '') {
  if (activeCitySlug) {
    return SEO_GEO_INTENT_CONFIGS
      .map(({ prefix }) => ({
        href: routePath(prefix, activeCitySlug),
        label: RELATED_LABELS[prefix] || prefix,
      }))
      .filter((item) => item.href !== routePath(activeVariant, activeCitySlug));
  }

  return STATIC_SEO_VARIANTS
    .filter((variant) => variant !== activeVariant)
    .map((variant) => ({
      href: routePath(variant),
      label: RELATED_LABELS[variant] || variant,
    }));
}

function buildStructuredData({ page, variant, citySlug, canonical, locale, city }) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: canonical,
      inLanguage: locale.hreflang,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Mansión Deseo',
        url: `${SITE_ORIGIN}/`,
      },
      ...(city ? { areaServed: city.label } : {}),
      about: [
        { '@type': 'Thing', name: page.focus },
        { '@type': 'Thing', name: 'adultos registrados' },
        { '@type': 'Thing', name: 'encuentros discretos' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Mansión Deseo',
          item: `${SITE_ORIGIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: RELATED_LABELS[variant] || page.focus,
          item: canonical,
        },
      ],
    },
  ];
}

function renderSeoPage(variant, citySlug = '') {
  const locale = getSeoLocale(DEFAULT_SEO_LOCALE);
  const baseVariant = normalizeRoleVariant(variant);
  const city = citySlug ? GEO_PAGES[citySlug] : null;
  const cityStats = citySlug ? seoCityStatsBySlug.get(citySlug) : null;
  const page = buildLocalizedPage(getSeoIntentPage(DEFAULT_SEO_LOCALE, baseVariant), citySlug, variant, cityStats);
  const canonical = canonicalUrl(variant, citySlug);
  const currentPath = routePath(variant, citySlug);
  const related = relatedLinks(variant, citySlug);
  const structuredData = buildStructuredData({ page, variant, citySlug, canonical, locale, city });
  const visibleFaq = page.faq || [];

  return `<!doctype html>
<html lang="${escapeHtml(locale.language)}" style="background:#08080e;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta name="theme-color" content="#08080E" />
  <meta name="color-scheme" content="dark" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mansión Deseo" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:image" content="${escapeHtml(`${SITE_ORIGIN}/icon-512.png`)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:locale" content="${escapeHtml(locale.hreflang.replace('-', '_'))}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="${escapeHtml(`${SITE_ORIGIN}/icon-512.png`)}" />
  <script type="application/ld+json">${escapeJsonScript(structuredData)}</script>
  <style>
    :root{--bg:#08080e;--paper:#11111a;--paper2:#17151f;--ink:#f6efe6;--soft:rgba(246,239,230,.7);--dim:rgba(246,239,230,.5);--gold:#c9a84c;--gold2:#f0d98b;--red:#9b2b40;--line:rgba(255,255,255,.1)}
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:radial-gradient(circle at 74% -8%,rgba(201,168,76,.18),transparent 31rem),radial-gradient(circle at 10% 18%,rgba(155,43,64,.22),transparent 25rem),linear-gradient(180deg,#0b0a11,#08080e 72%);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}.wrap{width:min(1160px,calc(100% - 32px));margin:0 auto;padding:22px 0 54px}.top{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:10px 0 26px}.brand{display:flex;align-items:center;gap:12px}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:16px;background:linear-gradient(135deg,var(--red),#54172a);font-family:Georgia,serif;font-weight:800;box-shadow:0 18px 42px rgba(155,43,64,.24)}.brand strong{font-family:Georgia,"Times New Roman",serif;font-size:22px;color:var(--gold2);font-weight:600}.nav{display:flex;gap:10px;align-items:center}.nav a,.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 17px;font-size:14px;font-weight:700}.nav .ghost,.btn.ghost{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--ink)}.btn.gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171107}.hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(315px,.92fr);gap:22px;align-items:stretch}.panel{border:1px solid var(--line);border-radius:34px;background:linear-gradient(180deg,rgba(255,255,255,.064),rgba(255,255,255,.026));box-shadow:0 30px 90px rgba(0,0,0,.34);overflow:hidden}.copy{padding:42px}.kicker{display:inline-flex;border:1px solid rgba(201,168,76,.28);background:rgba(201,168,76,.09);color:rgba(240,217,139,.94);border-radius:999px;padding:9px 13px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.title{max-width:800px;margin:22px 0 0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(42px,6.7vw,78px);font-weight:500;letter-spacing:-.045em;line-height:.96}.lead{max-width:700px;margin:22px 0 0;color:var(--soft);font-size:18px;line-height:1.75}.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.aside{padding:28px;background:radial-gradient(circle at 80% 10%,rgba(201,168,76,.13),transparent 17rem),linear-gradient(145deg,rgba(23,21,31,.94),rgba(8,8,14,.96))}.aside h2,.section h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.03em}.aside h2{margin:0;font-size:30px}.bullets{display:grid;gap:12px;margin:22px 0 0;padding:0;list-style:none}.bullets li{border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(0,0,0,.2);padding:15px;color:var(--soft);line-height:1.55}.focus{margin-top:18px;border:1px solid rgba(201,168,76,.18);border-radius:24px;background:rgba(201,168,76,.075);padding:18px;color:var(--soft);line-height:1.65}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.section{padding:26px}.section h2{margin:0;font-size:30px}.faq{display:grid;gap:13px;margin-top:18px}.qa{border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.16);border-radius:22px;padding:17px}.qa h3{margin:0;font-size:15px}.qa p,.section p{color:var(--soft);line-height:1.65}.links{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.tag{border:1px solid var(--line);background:rgba(0,0,0,.19);border-radius:999px;padding:9px 13px;font-size:12px;color:rgba(255,255,255,.78)}.foot{margin-top:18px;color:var(--dim);font-size:12px;text-align:center}@media(max-width:900px){.wrap{width:min(100% - 24px,680px);padding-top:14px}.hero,.grid{grid-template-columns:1fr}.copy{padding:26px}.top{align-items:flex-start}.brand strong{font-size:20px}.nav a:first-child{display:none}.title{font-size:clamp(40px,12vw,64px)}}
  </style>
</head>
<body>
  <main class="wrap">
    <nav class="top" aria-label="Principal">
      <a class="brand" href="/" aria-label="Mansión Deseo">
        <span class="mark">M</span>
        <strong>Mansión Deseo</strong>
      </a>
      <div class="nav">
        <a class="ghost" href="/login/">Iniciar sesión</a>
        <a class="btn gold" href="/registro/">Registrarme</a>
      </div>
    </nav>

    <section class="hero">
      <article class="panel copy">
        <span class="kicker">+18 · Landing pública SEO</span>
        <h1 class="title">${escapeHtml(page.headline)}</h1>
        <p class="lead">${escapeHtml(page.intro)}</p>
        <div class="cta">
          <a class="btn gold" href="/registro/">Crear cuenta privada</a>
          <a class="btn ghost" href="/login/">Ya tengo cuenta</a>
        </div>
      </article>
      <aside class="panel aside">
        <h2>Qué encontrás</h2>
        <ul class="bullets">
          ${page.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ')}
        </ul>
        <div class="focus">
          Foco de búsqueda: <strong>${escapeHtml(page.focus)}</strong>. La interacción, los perfiles completos y los mensajes quedan reservados para usuarios registrados.
        </div>
      </aside>
    </section>

    <section class="grid">
      <article class="panel section">
        <h2>Preguntas frecuentes</h2>
        <div class="faq">
          ${visibleFaq.map(([question, answer]) => `<div class="qa"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></div>`).join('\n          ')}
        </div>
      </article>
      <article class="panel section">
        <h2>Más búsquedas</h2>
        <p>Estas páginas refuerzan el enlazado interno de las intenciones principales sin exponer contenido privado.</p>
        <div class="links">
          ${related.map((item) => `<a class="tag" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('\n          ')}
        </div>
        <p class="foot">URL estática generada: ${escapeHtml(currentPath)}</p>
      </article>
    </section>
  </main>
</body>
</html>`;
}

async function writeSeoPage({ variant, citySlug = '' }) {
  const route = routeKey(variant, citySlug);
  const outputDir = path.join(DIST_DIR, ...route.split('/'));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), renderSeoPage(variant, citySlug), 'utf8');
}

function shouldDropRedirectLine(line) {
  const source = line.split(/\s+/)[0] || '';
  const normalized = source.replace(/^\/+/, '');
  const prefix = normalized.split('/')[0].replace(/\*$/, '');
  return SEO_FALLBACK_PREFIXES.has(prefix);
}

async function updateRedirects() {
  let redirects = '';
  try {
    redirects = await readFile(redirectsPath, 'utf8');
  } catch {
    redirects = '';
  }

  const canonicalRouteRedirects = STATIC_SEO_ROUTES
    .map(({ variant, citySlug }) => {
      const target = routePath(variant, citySlug);
      const source = target.replace(/\/$/, '');
      return `${source} ${target} 301`;
    })
    .filter((line) => !line.startsWith(' /'));

  const redirectRules = [...CANONICAL_REDIRECTS.map(([from, to]) => `${from} ${to} 301`), ...canonicalRouteRedirects];
  const existingLines = redirects
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !redirectRules.includes(line) && !shouldDropRedirectLine(line));

  await writeFile(redirectsPath, `${[...redirectRules, ...existingLines].join('\n')}\n`, 'utf8');
}

const seoCityStats = JSON.parse(await readFile(seoStatsPath, 'utf8').catch(() => '{"cities":[]}'));
const seoCityStatsBySlug = new Map(
  (Array.isArray(seoCityStats?.cities) ? seoCityStats.cities : []).map((entry) => [entry.city_slug, entry])
);

await Promise.all(STATIC_SEO_ROUTES.map(writeSeoPage));
await updateRedirects();
console.log(`Generated ${STATIC_SEO_ROUTES.length} static SEO pages`);
