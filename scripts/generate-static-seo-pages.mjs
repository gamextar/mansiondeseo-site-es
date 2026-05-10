import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SEO_LOCALE, getSeoLocale } from '../src/lib/seoLocales.js';
import { buildSeoCanonical, buildSeoPath } from '../src/lib/seoRouting.js';
import { getSeoIntentPage } from '../src/lib/seoIntentCatalog.js';
import { getGeoPagesForLocale } from '../src/lib/seoGeoCatalog.js';
import { SITE_LOCALE, SITE_ORIGIN, formatNumber } from '../src/lib/siteConfig.js';
import { SEO_BASE_INTENTS, SEO_GEO_INTENT_CONFIGS } from '../src/lib/seoVariants.js';
import { loadIntentKeywordPages } from './seo-intent-keywords.mjs';

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
const INTENT_ROUTE_PREFIX = '/explorar';
const PROFILE_NAMES = {
  parejas: ['Luz y Nico', 'Mara y Leo', 'Sofi y Fran', 'Vale y Tomi', 'Cami y Agus', 'Flor y Seba'],
  swingers: ['Maia y Juli', 'Noe y Fer', 'Lola y Santi', 'Romi y Fede', 'Ari y Manu', 'Vero y Dani'],
  cornudos: ['Clara y Martin', 'Nati y Pablo', 'Mora y Andres', 'Jaz y Lucas', 'Paula y Diego', 'Meli y Gonza'],
  cuckold: ['Bianca y G', 'Eva y Marco', 'Nina y Raul', 'Lara y Nico', 'Uma y Leo', 'Sasha y Ivan'],
  trios: ['Alma', 'Renata', 'Bruno', 'Thiago', 'Delfi', 'Mateo'],
  default: ['Camila', 'Valentina', 'Sofia', 'Lucia', 'Martina', 'Julieta', 'Agustina', 'Florencia'],
};
const PROFILE_MOODS = ['Discreta', 'Selectiva', 'Nueva', 'Verificada', 'Activa', 'Afinidad alta'];

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

function hashString(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(list, random) {
  return list[Math.floor(random() * list.length)] || list[0];
}

function shuffleDeterministic(items, seed) {
  const random = seededRandom(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function intentKey(value = '') {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('cuck')) return 'cuckold';
  if (normalized.includes('cornud')) return 'cornudos';
  if (normalized.includes('swing')) return 'swingers';
  if (normalized.includes('trio')) return 'trios';
  if (normalized.includes('pareja')) return 'parejas';
  return 'default';
}

function buildIntentMeta(page) {
  const title = page.title || `${page.titleTerm} | Mansión Deseo`;
  const description = page.description || `Explorá ${page.term} en una comunidad privada para adultos registrados, con perfiles discretos, vista protegida y acceso completo solo al crear tu cuenta.`;
  const headline = page.h1 || `${page.titleTerm}: perfiles privados y encuentros discretos`;
  return { title, description, headline };
}

function buildIntentIntro(page) {
  if (page.intro) return String(page.intro);
  const relatedConcepts = [
    'privacidad',
    'perfiles verificados',
    'búsqueda por afinidad',
    'actividad reciente',
    'mensajes privados',
    'acceso controlado',
    'discreción',
    'comunidad adulta',
  ];
  const concepts = shuffleDeterministic(relatedConcepts, hashString(page.slug)).slice(0, 5);
  return [
    `Buscar ${page.term} suele mezclar curiosidad, deseo de privacidad y necesidad de encontrar un espacio que no exponga de más. Mansión Deseo está pensada como una entrada selecta para adultos registrados que quieren explorar ${page.intent} con más control, mejores filtros y una experiencia visual cuidada. Esta página resume la intención principal de la búsqueda y la conecta con perfiles privados, actividad local y una navegación simple hacia el registro.`,
    `La diferencia está en el enfoque: no se trata de mostrar todo en público, sino de dar una señal clara de que existe una comunidad activa en torno a ${page.term}, manteniendo las fotos y los detalles sensibles protegidos hasta que el usuario ingresa. Por eso las vistas previas aparecen con privacidad visual y la interacción completa queda dentro de la plataforma. Conceptos como ${concepts.join(', ')} ayudan a ordenar la experiencia sin convertir la landing en un listado frío.`,
    `Para Google, la página también necesita resolver una intención concreta y no repetir el mismo bloque en cientos de URLs. Por eso cada término puede usar una combinación propia de título, descripción, perfiles simulados, ubicación y enlaces internos. La idea es que el usuario entienda rápido qué puede encontrar, que la marca transmita seguridad y que el rastreador vea una estructura clara, con contenido contextual y navegación hacia otras búsquedas relacionadas.`,
    `Si estás en ${page.location} o buscás conexiones relacionadas, la propuesta apunta a reducir ruido: perfiles con intención compatible, presentación discreta y una ruta directa para crear cuenta. La landing funciona como una puerta de entrada SEO y, al mismo tiempo, como una primera impresión real de marca: oscura, minimalista y orientada a confianza. Para ver perfiles completos, enviar mensajes o acceder a contenido privado, el siguiente paso es registrarse en Mansión Deseo.`,
  ].join('\n\n');
}

function buildIntentProfileCards(page) {
  const random = seededRandom(hashString(page.slug));
  const key = intentKey(`${page.intent} ${page.term}`);
  const names = PROFILE_NAMES[key] || PROFILE_NAMES.default;
  return Array.from({ length: 12 }, (_, index) => {
    const name = `${pickFrom(names, random)}${index >= names.length ? ` ${index + 1}` : ''}`;
    const age = 24 + Math.floor(random() * 22);
    const distance = page.location === 'Argentina'
      ? `${2 + Math.floor(random() * 28)} km`
      : `${1 + Math.floor(random() * 14)} km`;
    const mood = pickFrom(PROFILE_MOODS, random);
    const hueA = 330 + Math.floor(random() * 52);
    const hueB = 28 + Math.floor(random() * 42);
    return {
      name,
      age,
      distance,
      mood,
      gradient: `linear-gradient(135deg,hsl(${hueA} 48% 24%),hsl(${hueB} 48% 34%))`,
    };
  });
}

function buildIntentCrossLinks(page, intentKeywordPages) {
  return shuffleDeterministic(
    intentKeywordPages.filter((item) => item.slug !== page.slug),
    hashString(`links-${page.slug}`)
  ).slice(0, 5);
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

function renderIntentKeywordPage(page, intentKeywordPages) {
  const locale = getSeoLocale(DEFAULT_SEO_LOCALE);
  const { title, description, headline } = buildIntentMeta(page);
  const intro = buildIntentIntro(page);
  const profileCards = buildIntentProfileCards(page);
  const crossLinks = buildIntentCrossLinks(page, intentKeywordPages);
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: page.canonical,
      inLanguage: locale.hreflang,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Mansión Deseo',
        url: `${SITE_ORIGIN}/`,
      },
      about: [
        { '@type': 'Thing', name: page.term },
        { '@type': 'Thing', name: page.intent },
        { '@type': 'Thing', name: page.location },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Mansión Deseo', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Explorar', item: `${SITE_ORIGIN}${INTENT_ROUTE_PREFIX}/` },
        { '@type': 'ListItem', position: 3, name: page.titleTerm, item: page.canonical },
      ],
    },
  ];

  return `<!doctype html>
<html lang="${escapeHtml(locale.language)}" style="background:#000;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeHtml(page.canonical)}" />
  <meta name="theme-color" content="#000000" />
  <meta name="color-scheme" content="dark" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mansión Deseo" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(`${SITE_ORIGIN}/icon-512.png`)}" />
  <meta property="og:url" content="${escapeHtml(page.canonical)}" />
  <meta property="og:locale" content="${escapeHtml(locale.hreflang.replace('-', '_'))}" />
  <script type="application/ld+json">${escapeJsonScript(structuredData)}</script>
  <style>
    :root{--bg:#000;--ink:#f4f4f4;--muted:rgba(244,244,244,.68);--dim:rgba(244,244,244,.46);--line:rgba(244,244,244,.12);--gold:#c5a059;--panel:#090909;--panel2:#111;--danger:#6f1730}
    *{box-sizing:border-box}html{background:var(--bg);scroll-behavior:smooth}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:Inter,Montserrat,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}.page{width:min(1180px,calc(100% - 32px));margin:0 auto}.nav{display:flex;align-items:center;justify-content:space-between;padding:24px 0}.brand{display:flex;align-items:center;gap:12px}.brand-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(197,160,89,.34);color:var(--gold);font-family:Georgia,"Times New Roman",serif}.brand strong{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:20px}.nav-actions{display:flex;align-items:center;gap:10px}.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 18px;border:1px solid var(--line);font-size:13px;font-weight:600}.btn.gold{border-color:rgba(197,160,89,.62);background:var(--gold);color:#090704}.hero{padding:72px 0 58px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:42px;align-items:end}.eyebrow{display:inline-flex;color:var(--gold);font-size:12px;letter-spacing:.14em;text-transform:uppercase}.h1{margin:20px 0 0;max-width:860px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(46px,8vw,92px);font-weight:400;line-height:.94;letter-spacing:-.035em}.lead{margin:24px 0 0;max-width:760px;color:var(--muted);font-size:18px;line-height:1.75}.hero-card{border:1px solid rgba(197,160,89,.22);background:linear-gradient(180deg,rgba(197,160,89,.08),rgba(255,255,255,.025));padding:24px}.hero-card p{margin:0;color:var(--muted);line-height:1.7}.metric-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}.metric{border-top:1px solid var(--line);padding-top:14px}.metric strong{display:block;color:var(--ink);font-size:22px;font-family:Georgia,"Times New Roman",serif;font-weight:400}.metric span{display:block;margin-top:4px;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.1em}.intro{padding:30px 0 66px}.intro-text{max-width:920px;color:rgba(244,244,244,.74);font-size:16px;line-height:1.9;white-space:pre-line}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.section-head h2{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:34px;font-weight:400}.section-head p{margin:0;max-width:460px;color:var(--dim);font-size:14px;line-height:1.7}.profiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.profile-card{appearance:none;border:1px solid var(--line);background:var(--panel);color:inherit;text-align:left;padding:0;overflow:hidden;cursor:pointer}.profile-photo{height:210px;background:var(--profile-bg);filter:blur(8px);transform:scale(1.04);transition:filter .3s ease,transform .3s ease}.profile-card:hover .profile-photo,.profile-card:focus-visible .profile-photo,.profile-card.is-visible .profile-photo{filter:blur(0);transform:scale(1)}.profile-body{padding:14px}.profile-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.profile-name{font-weight:600}.profile-age{color:var(--gold);font-size:13px}.profile-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;color:var(--dim);font-size:12px}.privacy-note{margin-top:18px;color:var(--dim);font-size:12px;line-height:1.7}.links-section{padding:76px 0}.links-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.link-card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));min-height:118px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;transition:border-color .2s ease,transform .2s ease}.link-card:hover{border-color:rgba(197,160,89,.48);transform:translateY(-2px)}.link-card span{color:var(--gold);font-size:11px;letter-spacing:.12em;text-transform:uppercase}.link-card strong{font-family:Georgia,"Times New Roman",serif;font-size:18px;font-weight:400;line-height:1.2}.cta-band{border-top:1px solid var(--line);padding:42px 0 54px;display:flex;align-items:center;justify-content:space-between;gap:20px}.cta-band p{margin:0;color:var(--muted);line-height:1.6}.foot{padding:26px 0 34px;border-top:1px solid var(--line);color:var(--dim);font-size:12px}@media(max-width:980px){.hero{grid-template-columns:1fr;padding-top:48px}.profiles{grid-template-columns:repeat(2,minmax(0,1fr))}.links-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cta-band{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.page{width:min(100% - 24px,520px)}.nav{padding:18px 0}.nav-actions .btn:first-child{display:none}.hero{padding:38px 0 42px}.h1{font-size:42px}.lead{font-size:16px}.hero-card{padding:18px}.profiles{grid-template-columns:1fr 1fr;gap:10px}.profile-photo{height:152px}.profile-body{padding:11px}.links-grid{grid-template-columns:1fr}.section-head{display:block}.section-head p{margin-top:10px}}
  </style>
</head>
<body>
  <main class="page">
    <nav class="nav" aria-label="Principal">
      <a class="brand" href="/">
        <span class="brand-mark">M</span>
        <strong>Mansión Deseo</strong>
      </a>
      <div class="nav-actions">
        <a class="btn" href="/login/">Entrar</a>
        <a class="btn gold" href="/registro/">Solicitar acceso</a>
      </div>
    </nav>

    <section class="hero">
      <div>
        <span class="eyebrow">Búsqueda privada · ${escapeHtml(page.location)}</span>
        <h1 class="h1">${escapeHtml(headline)}</h1>
        <p class="lead">${escapeHtml(description)}</p>
      </div>
      <aside class="hero-card">
        <p>Vista pública pensada para quienes buscan ${escapeHtml(page.term)} con una experiencia discreta, rápida y protegida.</p>
        <div class="metric-row">
          <div class="metric"><strong>12</strong><span>previews</span></div>
          <div class="metric"><strong>+18</strong><span>privado</span></div>
          <div class="metric"><strong>VIP</strong><span>opcional</span></div>
        </div>
      </aside>
    </section>

    <section class="intro">
      <div class="intro-text">${escapeHtml(intro)}</div>
    </section>

    <section aria-labelledby="profiles-title">
      <div class="section-head">
        <h2 id="profiles-title">Perfiles destacados</h2>
        <p>Las fotos se muestran protegidas en la vista pública. Al interactuar, la imagen se revela suavemente como muestra visual de la experiencia privada.</p>
      </div>
      <div class="profiles">
        ${profileCards.map((card) => `<button class="profile-card" type="button" data-profile-card style="--profile-bg:${escapeHtml(card.gradient)}">
          <div class="profile-photo" aria-hidden="true"></div>
          <div class="profile-body">
            <div class="profile-top">
              <span class="profile-name">${escapeHtml(card.name)}</span>
              <span class="profile-age">${card.age}</span>
            </div>
            <div class="profile-meta">
              <span>${escapeHtml(card.distance)}</span>
              <span>${escapeHtml(card.mood)}</span>
            </div>
          </div>
        </button>`).join('\n        ')}
      </div>
      <p class="privacy-note">Previews públicos de estilo editorial. Los perfiles completos, fotos reales, mensajes y filtros avanzados quedan disponibles únicamente dentro de Mansión Deseo para usuarios registrados.</p>
    </section>

    <section class="links-section" aria-labelledby="related-title">
      <div class="section-head">
        <h2 id="related-title">También podés explorar</h2>
        <p>Navegación cruzada para búsquedas relacionadas y señales internas más claras.</p>
      </div>
      <div class="links-grid">
        ${crossLinks.map((item) => `<a class="link-card" href="${escapeHtml(item.routePath)}">
          <span>Explorar</span>
          <strong>${escapeHtml(item.titleTerm)}</strong>
        </a>`).join('\n        ')}
      </div>
    </section>

    <section class="cta-band">
      <p>Para ver perfiles completos y conectar con usuarios reales, creá una cuenta privada.</p>
      <a class="btn gold" href="/registro/">Crear cuenta</a>
    </section>

    <footer class="foot">Mansión Deseo · Comunidad privada para adultos registrados · ${escapeHtml(page.term)}</footer>
  </main>
  <script>
    document.addEventListener('click', function(event) {
      var card = event.target.closest('[data-profile-card]');
      if (!card) return;
      card.classList.toggle('is-visible');
    });
  </script>
</body>
</html>`;
}

async function writeSeoPage({ variant, citySlug = '' }) {
  const route = routeKey(variant, citySlug);
  const outputDir = path.join(DIST_DIR, ...route.split('/'));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), renderSeoPage(variant, citySlug), 'utf8');
}

async function writeIntentKeywordPage(page, intentKeywordPages) {
  const route = page.routePath.replace(/^\/+|\/+$/g, '');
  const outputDir = path.join(DIST_DIR, ...route.split('/'));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), renderIntentKeywordPage(page, intentKeywordPages), 'utf8');
}

function shouldDropRedirectLine(line, hasIntentPages = false) {
  const source = line.split(/\s+/)[0] || '';
  const normalized = source.replace(/^\/+/, '');
  const prefix = normalized.split('/')[0].replace(/\*$/, '');
  if (hasIntentPages && normalized === 'explorar/*') return true;
  return SEO_FALLBACK_PREFIXES.has(prefix);
}

async function updateRedirects(intentKeywordPages = []) {
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
  const intentRouteRedirects = intentKeywordPages.map((page) => {
    const target = page.routePath;
    const source = target.replace(/\/$/, '');
    return `${source} ${target} 301`;
  });

  const redirectRules = [...CANONICAL_REDIRECTS.map(([from, to]) => `${from} ${to} 301`), ...canonicalRouteRedirects, ...intentRouteRedirects];
  const existingLines = redirects
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !redirectRules.includes(line) && !shouldDropRedirectLine(line, intentKeywordPages.length > 0));

  await writeFile(redirectsPath, `${[...redirectRules, ...existingLines].join('\n')}\n`, 'utf8');
}

const seoCityStats = JSON.parse(await readFile(seoStatsPath, 'utf8').catch(() => '{"cities":[]}'));
const seoCityStatsBySlug = new Map(
  (Array.isArray(seoCityStats?.cities) ? seoCityStats.cities : []).map((entry) => [entry.city_slug, entry])
);
const intentKeywordPages = await loadIntentKeywordPages();

await Promise.all([
  ...STATIC_SEO_ROUTES.map(writeSeoPage),
  ...intentKeywordPages.map((page) => writeIntentKeywordPage(page, intentKeywordPages)),
]);
await updateRedirects(intentKeywordPages);
console.log(`Generated ${STATIC_SEO_ROUTES.length} static SEO pages and ${intentKeywordPages.length} intent pages`);
