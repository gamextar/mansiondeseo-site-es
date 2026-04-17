import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getGeo, getGeoPagesForLocale } from '../src/lib/seoGeoCatalog.js';
import { DEFAULT_SEO_LOCALE, getRouteEnabledSeoLocales, getSeoLocale } from '../src/lib/seoLocales.js';
import { buildSeoAlternates, buildSeoCanonical, buildSeoPath } from '../src/lib/seoRouting.js';
import { getSeoIntentPage } from '../src/lib/seoIntentCatalog.js';
import { SEO_BASE_INTENTS, SEO_GEO_INTENT_CONFIGS } from '../src/lib/seoVariants.js';

const SITE_ORIGIN = 'https://mansiondeseo.com';
const DIST_DIR = path.resolve('dist');
const countFormatter = new Intl.NumberFormat('es-AR');
const seoCityStatsData = JSON.parse(await readFile(path.resolve('data/seo/seo-city-stats.json'), 'utf8'));
const seoHomeStatsData = JSON.parse(await readFile(path.resolve('data/seo/seo-home-stats.json'), 'utf8'));
const cityStatsList = Array.isArray(seoCityStatsData?.cities) ? seoCityStatsData.cities : [];
const cityStatsBySlug = new Map(cityStatsList.map((entry) => [entry.city_slug, entry]));

const HOME_INTENT_LINKS = [
  { to: '/parejas-liberales', label: 'Parejas liberales' },
  { to: '/trios', label: 'Trios' },
  { to: '/swingers', label: 'Swingers' },
  { to: '/intercambio-de-parejas', label: 'Intercambio' },
  { to: '/cornudos-argentina', label: 'Cornudos' },
  { to: '/cornudos-argentina', label: 'Maridos cornudos' },
  { to: '/cuckold-argentina', label: 'Cuckold' },
  { to: '/hotwife-argentina', label: 'Hotwife' },
  { to: '/contactossex', label: 'Contactossex' },
];

const RELATED_LINKS = [
  { to: '/parejas-liberales', label: 'Parejas liberales' },
  { to: '/intercambio-de-parejas', label: 'Intercambio parejas' },
  { to: '/cornudos-argentina', label: 'Cornudos' },
  { to: '/cornudos-argentina', label: 'Maridos cornudos' },
  { to: '/cuckold-argentina', label: 'Cuckold' },
  { to: '/hotwife-argentina', label: 'Hotwife' },
  { to: '/trios', label: 'Tríos' },
  { to: '/swingers', label: 'Swingers' },
  { to: '/mujeres', label: 'Mujeres' },
  { to: '/hombres', label: 'Hombres' },
  { to: '/trans', label: 'Trans' },
  { to: '/contactossex', label: 'Contactossex' },
];

const PRIVATE_STATIC_ROUTES = [
  '/feed',
  '/explorar',
  '/videos',
  '/ranking',
  '/perfil',
  '/favoritos',
  '/seguidores',
  '/configuracion',
  '/login',
  '/registro',
  '/recuperar-contrasena',
  '/bienvenida',
  '/vip',
  '/monedas',
  '/pago-exitoso',
  '/pago-monedas-exitoso',
  '/pago-fallido',
  '/pago-pendiente',
  '/mensajes',
  '/admin',
  '/black-test',
  '/historia/nueva',
];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function formatCount(value) {
  return countFormatter.format(Number(value || 0));
}

function getSeoCityStats(citySlug = '') {
  return cityStatsBySlug.get(citySlug) || null;
}

function hasSeoCityStats(stats) {
  return Number(stats?.active_profiles_30d || 0) > 0;
}

function getTopSeoCityStats(limit = 6, excludeSlugs = []) {
  const excluded = new Set(Array.isArray(excludeSlugs) ? excludeSlugs : [excludeSlugs]);
  return cityStatsList
    .filter((entry) => Number(entry.active_profiles_30d || 0) > 0 && !excluded.has(entry.city_slug))
    .sort((left, right) => Number(right.active_profiles_30d || 0) - Number(left.active_profiles_30d || 0))
    .slice(0, limit);
}

function getSeoHomeStats() {
  return seoHomeStatsData?.stats || null;
}

function formatSeoStatsDate(value) {
  const datePart = String(value || '').slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function localizedPage(page, citySlug, variant, cityStats, locale) {
  const city = citySlug ? getGeo(citySlug, locale) : null;
  if (!city) return page;

  const citySuffix = `${city.cityHint} | Mansión Deseo`;
  const cityIntroSuffix = ` Enfocada en ${city.label.toLowerCase()}, con presencia local y acceso privado para adultos registrados.`;
  const cityBullets = [
    `${page.focus} ${city.cityHint}`,
    `${city.catchphrase}`,
    'Contenido completo solo para usuarios registrados',
  ];
  const exactContactossex = citySlug === 'caba'
    ? 'Contactossex CABA'
    : citySlug === 'buenos-aires-provincia'
      ? 'Contactossex Provincia de Buenos Aires'
      : citySlug === 'cordoba-provincia'
        ? 'Contactossex Provincia de Córdoba'
        : `Contactossex ${city.label}`;
  const exactCornudos = citySlug === 'caba'
    ? 'Cornudos CABA'
    : citySlug === 'buenos-aires-provincia'
      ? 'Cornudos Provincia de Buenos Aires'
      : citySlug === 'cordoba-provincia'
        ? 'Cornudos Provincia de Córdoba'
        : `Cornudos ${city.label}`;
  const exactCuckold = citySlug === 'caba'
    ? 'Cuckold CABA'
    : citySlug === 'buenos-aires-provincia'
      ? 'Cuckold Provincia de Buenos Aires'
      : citySlug === 'cordoba-provincia'
        ? 'Cuckold Provincia de Córdoba'
        : `Cuckold ${city.label}`;
  const updatedLabel = formatSeoStatsDate(cityStats?.updated_at);
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

  if (page.focus === 'parejas') {
    if (hasStats) {
      return {
        ...page,
        title: `Parejas ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para búsquedas de parejas ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los últimos 30 días, ${activeCouples} parejas y acceso discreto.`,
        headline: `Parejas ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para búsquedas de parejas ${city.cityHint} y para convertir esa intención en registro dentro de Mansión Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los últimos 30 días, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los últimos 30 días`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real de parejas ${city.cityHint}?`, `Sí. Según la actualización del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los últimos 30 días, incluyendo ${activeCouples} parejas con actividad reciente.`],
          ['¿Se puede ver el contenido completo sin registro?', 'No. La landing es pública para captar la búsqueda, pero el detalle de perfiles y la interacción quedan reservados a usuarios registrados.'],
        ],
      };
    }
    return {
      ...page,
      title: `Parejas ${citySuffix}`,
      description: `Búsquedas de parejas ${city.cityHint} en una comunidad privada para adultos registrados, con perfiles verificados, discreción y acceso controlado.`,
      headline: `Parejas ${city.label}, afinidad real y acceso privado`,
      intro: `Una landing pensada para captar búsquedas de parejas ${city.cityHint} y llevarlas a una experiencia privada con filtros, perfiles verificados y acceso solo para registrados.${cityIntroSuffix}`,
      bullets: cityBullets,
    };
  }

  if (page.focus === 'parejas liberales') {
    if (hasStats) {
      return {
        ...page,
        title: `Parejas Liberales ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para búsquedas de parejas liberales ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los últimos 30 días y ${activeCouples} parejas con actividad reciente.`,
        headline: `Parejas liberales ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para búsquedas de parejas liberales ${city.cityHint} y para convertir esa intención en registro dentro de Mansión Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los últimos 30 días, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los últimos 30 días`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real de parejas liberales ${city.cityHint}?`, `Sí. Según la actualización del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los últimos 30 días, incluyendo ${activeCouples} parejas con actividad reciente.`],
          ['¿Se puede explorar la comunidad completa desde esta página?', 'No. La landing es pública, pero el detalle de perfiles, stories y mensajes queda reservado a usuarios registrados.'],
        ],
      };
    }
    return {
      ...page,
      title: `Parejas Liberales ${citySuffix}`,
      description: `Búsquedas de parejas liberales ${city.cityHint} en una comunidad privada para adultos registrados, con perfiles verificados, discreción y acceso controlado.`,
      headline: `Parejas liberales ${city.label}, afinidad real y acceso privado`,
      intro: `Una landing pensada para captar búsquedas de parejas liberales ${city.cityHint} y llevarlas a una experiencia privada con filtros, perfiles verificados y acceso solo para registrados.${cityIntroSuffix}`,
      bullets: cityBullets,
    };
  }

  if (page.focus === 'swingers') {
    if (hasStats) {
      return {
        ...page,
        title: `Swingers ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para búsquedas swingers ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los últimos 30 días, ${activeCouples} parejas y acceso discreto.`,
        headline: `Swingers ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para búsquedas swingers ${city.cityHint} y para convertir esa intención en registro dentro de Mansión Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los últimos 30 días, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los últimos 30 días`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad swingers real ${city.cityHint}?`, `Sí. Según la actualización del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los últimos 30 días, con ${activeCouples} parejas y actividad reciente dentro de la comunidad.`],
          ['¿El contenido completo es público?', 'No. La landing es pública para captar la búsqueda correcta, pero el detalle de perfiles, stories y mensajes queda reservado a usuarios registrados.'],
        ],
      };
    }
    return {
      ...page,
      title: `Swingers ${citySuffix}`,
      description: `Comunidad privada para búsquedas swingers ${city.cityHint}, con perfiles verificados, discreción y acceso controlado para adultos registrados.`,
      headline: `Swingers ${city.label}, discreción y afinidad real`,
      intro: `Una landing pensada para captar búsquedas swingers ${city.cityHint} y llevarlas a una experiencia privada con filtros, perfiles verificados y acceso solo para registrados.${cityIntroSuffix}`,
      bullets: cityBullets,
    };
  }

  if (page.focus === 'intercambio de parejas') {
    if (hasStats) {
      return {
        ...page,
        title: `Intercambio de Parejas ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para búsquedas de intercambio de parejas ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los últimos 30 días y ${activeCouples} parejas con actividad reciente.`,
        headline: `Intercambio de parejas ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para búsquedas de intercambio de parejas ${city.cityHint} y para convertir esa intención en registro dentro de Mansión Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los últimos 30 días, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los últimos 30 días`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real de intercambio de parejas ${city.cityHint}?`, `Sí. Según la actualización del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los últimos 30 días, incluyendo ${activeCouples} parejas con actividad reciente.`],
          ['¿El intercambio de parejas se ve completo sin registro?', 'No. La página captura la búsqueda, pero la experiencia completa y privada queda reservada a usuarios registrados.'],
        ],
      };
    }
    return {
      ...page,
      title: `Intercambio de Parejas ${citySuffix}`,
      description: `Búsquedas de intercambio de parejas ${city.cityHint} en una comunidad privada para adultos registrados, con perfiles verificados, discreción y acceso controlado.`,
      headline: `Intercambio de parejas ${city.label}, discreción y afinidad real`,
      intro: `Una landing pensada para captar búsquedas de intercambio de parejas ${city.cityHint} y llevarlas a una experiencia privada con filtros, perfiles verificados y acceso solo para registrados.${cityIntroSuffix}`,
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

  if (page.focus === 'hotwife argentina') {
    if (hasStats) {
      return {
        ...page,
        title: `Hotwife ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Búsquedas hotwife ${city.cityHint} en una comunidad privada para adultos registrados, con ${activeProfiles} perfiles verificados activos en los últimos 30 días y acceso discreto.`,
        headline: `Hotwife ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para búsquedas hotwife ${city.cityHint} y para convertir esa intención en registro dentro de Mansión Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los últimos 30 días, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los últimos 30 días`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad hotwife real ${city.cityHint}?`, `Sí. Según la actualización del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los últimos 30 días dentro de la comunidad.`],
          ['¿La experiencia completa es pública?', 'No. La landing es pública para captar la intención de búsqueda, pero los perfiles y la interacción viven detrás del registro.'],
        ],
      };
    }
    return {
      ...page,
      title: `Hotwife ${citySuffix}`,
      description: `Búsquedas hotwife ${city.cityHint} en una comunidad privada para adultos registrados, con perfiles verificados, discreción y acceso controlado.`,
      headline: `Hotwife ${city.label}, discreción y afinidad real`,
      intro: `Una landing pensada para captar búsquedas hotwife ${city.cityHint} y llevarlas a una experiencia privada con perfiles verificados y acceso solo para registrados.${cityIntroSuffix}`,
      bullets: cityBullets,
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

function renderShellCss() {
  return `
    #seo-prerender{background:#09080d;color:#fff;font-family:Inter,system-ui,sans-serif}
    #seo-prerender a{text-decoration:none}
    #seo-prerender .seo-wrap{max-width:1180px;margin:0 auto;padding:40px 24px 56px}
    #seo-prerender .seo-card{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);border-radius:28px}
    #seo-prerender .seo-hero{display:grid;gap:24px;grid-template-columns:1.1fr .9fr;padding:28px}
    #seo-prerender .seo-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);border-radius:999px;padding:10px 16px;font-size:12px;color:rgba(255,255,255,.72)}
    #seo-prerender .seo-title{font-family:"Playfair Display",serif;font-size:clamp(2.5rem,5vw,4.8rem);line-height:1.02;margin:22px 0 0}
    #seo-prerender .seo-copy{max-width:760px;margin:20px 0 0;color:rgba(255,255,255,.72);font-size:18px;line-height:1.7}
    #seo-prerender .seo-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
    #seo-prerender .seo-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:14px 22px;font-weight:600}
    #seo-prerender .seo-btn-primary{background:#c9a84c;color:#0b0b0f}
    #seo-prerender .seo-btn-secondary{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff}
    #seo-prerender .seo-panel{padding:22px}
    #seo-prerender .seo-kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    #seo-prerender .seo-pill{display:inline-flex;align-items:center;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.2);border-radius:999px;padding:8px 12px;color:rgba(255,255,255,.82);font-size:12px}
    #seo-prerender .seo-grid{display:grid;gap:16px;margin-top:18px}
    #seo-prerender .seo-grid-2{grid-template-columns:1fr 1fr}
    #seo-prerender .seo-grid-3{grid-template-columns:repeat(3,1fr)}
    #seo-prerender .seo-list{margin:0;padding-left:18px;color:rgba(255,255,255,.8);line-height:1.7}
    #seo-prerender .seo-section{margin-top:18px;padding:22px}
    #seo-prerender .seo-heading{font-family:"Playfair Display",serif;font-size:30px;margin:0 0 10px}
    #seo-prerender .seo-subtle{font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:rgba(201,168,76,.82)}
    #seo-prerender .seo-mini{font-size:14px;line-height:1.7;color:rgba(255,255,255,.72)}
    #seo-prerender .seo-hero-visual{min-height:340px;border-radius:24px;border:1px solid rgba(255,255,255,.08);background:
      radial-gradient(circle at top,rgba(155,43,64,.22),transparent 32%),
      radial-gradient(circle at 82% 18%,rgba(201,168,106,.16),transparent 26%),
      linear-gradient(180deg,rgba(255,255,255,.015),transparent 48%),
      linear-gradient(135deg,#1b141d,#09080d);padding:24px;display:flex;align-items:flex-end}
    #seo-prerender .seo-visual-copy{max-width:420px;font-size:14px;line-height:1.7;color:rgba(255,255,255,.72)}
    #seo-prerender .seo-stat{font-family:"Playfair Display",serif;font-size:56px;line-height:1;color:#fff}
    #seo-prerender .seo-faq-item{padding:16px;border:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.16);border-radius:22px}
    #seo-prerender .seo-faq-item + .seo-faq-item{margin-top:12px}
    @media (max-width: 900px){
      #seo-prerender .seo-hero{grid-template-columns:1fr;padding:20px}
      #seo-prerender .seo-grid-2,#seo-prerender .seo-grid-3{grid-template-columns:1fr}
      #seo-prerender .seo-wrap{padding:24px 16px 42px}
      #seo-prerender .seo-stat{font-size:44px}
    }
  `;
}

function renderHomeShell() {
  const homeStats = getSeoHomeStats();
  const updatedLabel = formatSeoStatsDate(homeStats?.updated_at);
  const topCities = getTopSeoCityStats(4);
  const totalActive = Number(homeStats?.active_profiles_30d || 0);
  const couplesActive = Number(homeStats?.active_couples_30d || 0);
  const womenActive = Number(homeStats?.active_women_30d || 0);
  const menActive = Number(homeStats?.active_men_30d || 0);

  return `
    <div id="seo-prerender">
      <main class="seo-wrap">
        <section class="seo-card seo-hero">
          <div>
            <div class="seo-badge">+18 · Acceso privado para adultos</div>
            <h1 class="seo-title">Una entrada pública más cuidada para una comunidad privada con química real.</h1>
            <p class="seo-copy">Mansión Deseo combina visibilidad SEO por intención y ciudad con una experiencia cerrada para explorar perfiles verificados, historias y mensajes dentro de un entorno más discreto.</p>
            <div class="seo-actions">
              <a class="seo-btn seo-btn-primary" href="/registro">Empezar ahora</a>
              <a class="seo-btn seo-btn-secondary" href="/login">Ya tengo cuenta</a>
            </div>
          </div>
          <div class="seo-hero-visual">
            <p class="seo-visual-copy">No es una red abierta. La capa pública capta la búsqueda correcta y la experiencia completa vive adentro: filtros, perfiles verificados, historias y mensajes con más discreción que en plataformas generalistas.</p>
          </div>
        </section>

        <section class="seo-card seo-panel" style="margin-top:18px">
          <div class="seo-subtle">Comunidad activa</div>
          <div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;margin-top:12px">
            <div class="seo-stat">${escapeHtml(formatCount(totalActive))}</div>
            <div class="seo-mini">perfiles activos en los últimos 30 días</div>
          </div>
          <div class="seo-kpis">
            <span class="seo-pill">Parejas · ${escapeHtml(formatCount(couplesActive))}</span>
            <span class="seo-pill">Mujeres · ${escapeHtml(formatCount(womenActive))}</span>
            <span class="seo-pill">Hombres · ${escapeHtml(formatCount(menActive))}</span>
            <span class="seo-pill">Actualizado ${escapeHtml(updatedLabel || 'hoy')}</span>
          </div>
        </section>

        <section class="seo-grid seo-grid-2">
          <div class="seo-card seo-section">
            <div class="seo-subtle">Ultimas búsquedas</div>
            <div class="seo-kpis">
              ${HOME_INTENT_LINKS.map((item) => `<a class="seo-pill" href="${escapeHtml(item.to)}">${escapeHtml(item.label)}</a>`).join('')}
            </div>
          </div>
          <div class="seo-card seo-section">
            <div class="seo-subtle">Ciudades activas</div>
            <div class="seo-kpis">
              ${topCities.map((city) => `<a class="seo-pill" href="/contactossex/${escapeHtml(city.city_slug)}">${escapeHtml(city.locality || city.city_slug)}</a>`).join('')}
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function buildLandingData({ variant, citySlug = '', locale = DEFAULT_SEO_LOCALE }) {
  const localeConfig = getSeoLocale(locale);
  const city = citySlug ? getGeo(citySlug, locale) : null;
  const cityStats = city ? getSeoCityStats(citySlug) : null;
  const cityHasStats = hasSeoCityStats(cityStats);
  const page = localizedPage(getSeoIntentPage(locale, variant), citySlug, variant, cityStats, locale);
  const canonical = buildSeoCanonical({ locale, variant, citySlug });
  const alternates = buildSeoAlternates({ variant, citySlug });
  const relatedCityLinks = city && (
    variant === 'contactossex' ||
    variant === 'contactossex-argentina' ||
    variant === 'swingers' ||
    variant === 'parejas' ||
    variant === 'parejas-liberales' ||
    variant === 'intercambio-de-parejas' ||
    variant === 'hotwife-argentina'
  )
    ? getTopSeoCityStats(6, citySlug)
      .map((entry) => {
        const entryCity = getGeo(entry.city_slug, locale);
        if (!entryCity) return null;
        return {
          to: buildSeoPath({ locale, variant, citySlug: entry.city_slug }),
          label: `${entryCity.label} (${formatCount(entry.active_profiles_30d)})`,
        };
      })
      .filter(Boolean)
    : [];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url: canonical,
    inLanguage: localeConfig.hreflang,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Mansión Deseo',
      url: `${SITE_ORIGIN}/`,
    },
    ...(city ? { areaServed: city.label } : {}),
    ...(cityHasStats && cityStats?.updated_at ? { dateModified: `${String(cityStats.updated_at).slice(0, 10)}T00:00:00Z` } : {}),
    about: [
      { '@type': 'Thing', name: page.focus },
      { '@type': 'Thing', name: 'encuentros discretos' },
      { '@type': 'Thing', name: 'adultos registrados' },
    ],
  };

  return { page, city, cityStats, cityHasStats, canonical, alternates, localeConfig, faqSchema, pageSchema, relatedCityLinks };
}

function renderLandingShell(view) {
  const { page, city, cityStats, cityHasStats, relatedCityLinks } = view;
  const links = relatedCityLinks.length
    ? relatedCityLinks
    : RELATED_LINKS.map((item) => ({ ...item, to: item.to }));

  return `
    <div id="seo-prerender">
      <main class="seo-wrap">
        <section class="seo-card seo-hero">
          <div>
            <div class="seo-badge">Solo mayores registrados · Perfiles verificados · Discreción total</div>
            <h1 class="seo-title">${escapeHtml(page.headline)}</h1>
            <p class="seo-copy">${escapeHtml(page.intro)}</p>
            <div class="seo-kpis">
              <span class="seo-pill">encuentros discretos</span>
              <span class="seo-pill">perfiles verificados</span>
              <span class="seo-pill">adultos registrados</span>
              <span class="seo-pill">contactos privados</span>
            </div>
            <div class="seo-actions">
              <a class="seo-btn seo-btn-primary" href="/registro">Crear cuenta</a>
              <a class="seo-btn seo-btn-secondary" href="/login">Ya tengo cuenta</a>
            </div>
          </div>
          <aside class="seo-card seo-panel" style="background:linear-gradient(180deg,rgba(24,20,29,.92),rgba(10,10,16,.92))">
            <div class="seo-subtle">${escapeHtml(city ? `${city.label} · SEO local` : 'Qué encontrás')}</div>
            <ul class="seo-list">
              ${page.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
            <div class="seo-card seo-section" style="margin-top:18px;background:rgba(0,0,0,.2)">
              <div class="seo-subtle">Foco SEO</div>
              <p class="seo-mini">${escapeHtml(`${page.focus} y búsquedas relacionadas${city ? ` ${city.cityHint}` : ''}, con acceso completo solo después del registro.`)}</p>
            </div>
            ${city ? `
              <div class="seo-card seo-section" style="margin-top:18px;background:rgba(0,0,0,.2)">
                <div class="seo-subtle">Actividad local</div>
                ${cityHasStats ? `
                  <p class="seo-mini">Hay ${escapeHtml(formatCount(cityStats.active_profiles_30d))} perfiles verificados activos en los últimos 30 días ${escapeHtml(city.cityHint)}.</p>
                  <div class="seo-grid seo-grid-2" style="margin-top:14px">
                    <div class="seo-card seo-panel"><div class="seo-subtle">Parejas</div><div class="seo-stat" style="font-size:34px">${escapeHtml(formatCount(cityStats.active_couples_30d))}</div></div>
                    <div class="seo-card seo-panel"><div class="seo-subtle">Mujeres</div><div class="seo-stat" style="font-size:34px">${escapeHtml(formatCount(cityStats.active_women_30d))}</div></div>
                    <div class="seo-card seo-panel"><div class="seo-subtle">Hombres</div><div class="seo-stat" style="font-size:34px">${escapeHtml(formatCount(cityStats.active_men_30d))}</div></div>
                    <div class="seo-card seo-panel"><div class="seo-subtle">Premium</div><div class="seo-stat" style="font-size:34px">${escapeHtml(formatCount(cityStats.premium_profiles))}</div></div>
                  </div>
                  <p class="seo-mini" style="margin-top:10px">Datos agregados y actualizados el ${escapeHtml(formatSeoStatsDate(cityStats.updated_at))}.</p>
                ` : `
                  <p class="seo-mini">Esta landing ya está preparada para captar búsquedas de alta intención ${escapeHtml(city.cityHint)}. A medida que se consolida la actividad verificada local, vamos mostrando cifras públicas más precisas.</p>
                `}
              </div>
            ` : ''}
          </aside>
        </section>

        <section class="seo-grid seo-grid-2">
          <div class="seo-card seo-section">
            <h2 class="seo-heading">Preguntas frecuentes</h2>
            ${page.faq.map(([question, answer]) => `
              <div class="seo-faq-item">
                <div style="font-weight:600;color:#fff">${escapeHtml(question)}</div>
                <div class="seo-mini" style="margin-top:8px">${escapeHtml(answer)}</div>
              </div>
            `).join('')}
          </div>
          <div class="seo-card seo-section">
            <div class="seo-subtle">${relatedCityLinks.length ? 'Otras ciudades activas' : 'Ultimas búsquedas'}</div>
            <h2 class="seo-heading">${relatedCityLinks.length ? 'Ciudades con actividad verificada' : 'Keywords principales'}</h2>
            <div class="seo-kpis">
              ${links.map((item) => `<a class="seo-pill" href="${escapeHtml(item.to)}">${escapeHtml(item.label)}</a>`).join('')}
            </div>
            <div class="seo-card seo-section" style="margin-top:18px;background:rgba(0,0,0,.2)">
              <div class="seo-mini">La experiencia completa vive adentro, detrás del login.</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function renderPrivateShell(title, heading, body) {
  return `
    <div id="seo-prerender">
      <main class="seo-wrap">
        <section class="seo-card seo-section">
          <div class="seo-badge">Área privada</div>
          <h1 class="seo-title" style="font-size:52px">${escapeHtml(heading)}</h1>
          <p class="seo-copy">${escapeHtml(body)}</p>
          <div class="seo-actions">
            <a class="seo-btn seo-btn-primary" href="/login">Iniciar sesión</a>
            <a class="seo-btn seo-btn-secondary" href="/registro">Registrarme</a>
          </div>
        </section>
      </main>
    </div>
  `;
}

function injectMeta(template, { title, description, canonical, robots, alternates = [], htmlLang = 'es', ogLocale = 'es_AR', structuredData = [], shellHtml = '' }) {
  const alternateTags = alternates.map(({ hrefLang, href }) => `<link rel="alternate" hreflang="${escapeHtml(hrefLang)}" href="${escapeHtml(href)}" />`).join('\n    ');
  const structuredScripts = structuredData.map((entry) => `<script type="application/ld+json">\n${escapeJsonForScript(entry)}\n    </script>`).join('\n    ');
  const shellStyle = `<style>${renderShellCss()}</style>`;

  let html = template.replace(/<html lang="[^"]*"/, `<html lang="${htmlLang}"`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${escapeHtml(robots)}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />${alternateTags ? `\n    ${alternateTags}` : ''}`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  html = html.replace(/<meta property="og:locale" content="[^"]*"\s*\/>/, `<meta property="og:locale" content="${escapeHtml(ogLocale)}" />`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = html.replace(/<!-- Structured Data -->[\s\S]*?<style>/, `<!-- Structured Data -->\n    ${structuredScripts}\n    ${shellStyle}\n    <style>`);
  html = html.replace('<div id="root" style="background-color:#08080E"></div>', `${shellHtml}\n    <div id="root" style="background-color:#08080E"></div>`);
  return html;
}

async function writeRouteHtml(routePath, html) {
  const normalized = routePath === '/' ? '' : routePath.replace(/^\/+|\/+$/g, '');
  const dirPath = normalized ? path.join(DIST_DIR, normalized) : DIST_DIR;
  await mkdir(dirPath, { recursive: true });
  await writeFile(path.join(dirPath, 'index.html'), html, 'utf8');
}

function buildHomeStructuredData() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Mansion Deseo',
      url: `${SITE_ORIGIN}/`,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_ORIGIN}/contactossex/{search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Mansión Deseo',
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/icon-512.png`,
      sameAs: [],
    },
  ];
}

async function main() {
  const template = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8');
  const existingRedirects = await readFile(path.join(DIST_DIR, '_redirects'), 'utf8');
  const locales = getRouteEnabledSeoLocales();
  const generatedRoutes = new Set(['/']);

  const homeHtml = injectMeta(template, {
    title: 'Mansion Deseo | Club privado para adultos registrados',
    description: 'Comunidad privada para adultos registrados, pensada para parejas liberales, swingers, trios y conexiones discretas con perfiles verificados.',
    canonical: `${SITE_ORIGIN}/`,
    robots: 'index, follow',
    htmlLang: 'es',
    ogLocale: 'es_AR',
    structuredData: buildHomeStructuredData(),
    shellHtml: renderHomeShell(),
  });
  await writeRouteHtml('/', homeHtml);

  for (const locale of locales) {
    const geoPages = getGeoPagesForLocale(locale.code);

    for (const [variant] of SEO_BASE_INTENTS) {
      const data = buildLandingData({ locale: locale.code, variant });
      const html = injectMeta(template, {
        title: data.page.title,
        description: data.page.description,
        canonical: data.canonical,
        robots: 'index, follow',
        alternates: data.alternates,
        htmlLang: data.localeConfig.language,
        ogLocale: data.localeConfig.hreflang.replace('-', '_'),
        structuredData: [data.pageSchema, data.faqSchema],
        shellHtml: renderLandingShell(data),
      });
      const routePath = buildSeoPath({ locale: locale.code, variant });
      generatedRoutes.add(routePath);
      await writeRouteHtml(routePath, html);
    }

    for (const geoSlug of Object.keys(geoPages)) {
      for (const { prefix } of SEO_GEO_INTENT_CONFIGS) {
        const data = buildLandingData({ locale: locale.code, variant: prefix, citySlug: geoSlug });
        const html = injectMeta(template, {
          title: data.page.title,
          description: data.page.description,
          canonical: data.canonical,
          robots: 'index, follow',
          alternates: data.alternates,
          htmlLang: data.localeConfig.language,
          ogLocale: data.localeConfig.hreflang.replace('-', '_'),
          structuredData: [data.pageSchema, data.faqSchema],
          shellHtml: renderLandingShell(data),
        });
        const routePath = buildSeoPath({ locale: locale.code, variant: prefix, citySlug: geoSlug });
        generatedRoutes.add(routePath);
        await writeRouteHtml(routePath, html);
      }
    }
  }

  for (const routePath of PRIVATE_STATIC_ROUTES) {
    const title = routePath === '/feed'
      ? 'Feed privado | Mansión Deseo'
      : 'Área privada | Mansión Deseo';
    const heading = routePath === '/feed'
      ? 'Feed privado para usuarios registrados'
      : 'Área privada para usuarios registrados';
    const body = 'Esta ruta forma parte de la aplicación privada y no debería indexarse en buscadores. El contenido completo requiere sesión activa.';

    const html = injectMeta(template, {
      title,
      description: 'Área privada de Mansión Deseo para usuarios registrados.',
      canonical: `${SITE_ORIGIN}${routePath}`,
      robots: 'noindex, follow',
      htmlLang: 'es',
      ogLocale: 'es_AR',
      structuredData: [],
      shellHtml: renderPrivateShell(title, heading, body),
    });
    generatedRoutes.add(routePath);
    await writeRouteHtml(routePath, html);
  }

  const explicitRewrites = [...generatedRoutes]
    .filter((routePath) => routePath !== '/')
    .sort()
    .map((routePath) => `${routePath} ${routePath}/index.html 200`)
    .join('\n');

  const redirectsContent = explicitRewrites
    ? `${explicitRewrites}\n${existingRedirects}`
    : existingRedirects;

  await writeFile(path.join(DIST_DIR, '_redirects'), redirectsContent, 'utf8');

  console.log('Prerendered public SEO pages into dist');
}

await main();
