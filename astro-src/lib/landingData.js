import { getSeoIntentPage } from '../../src/lib/seoIntentCatalog.js';
import { getGeo } from '../../src/lib/seoGeoCatalog.js';
import { DEFAULT_SEO_LOCALE, getSeoLocale } from '../../src/lib/seoLocales.js';
import { buildSeoAlternates, buildSeoCanonical, buildSeoPath } from '../../src/lib/seoRouting.js';
import { formatSeoCityStatsDate, getSeoCityStats, getTopSeoCityStats, hasSeoCityStats } from '../../src/lib/seoCityStats.js';

const countFormatter = new Intl.NumberFormat('es-AR');

export const RELATED_KEYWORDS = [
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

function formatCount(value) {
  return countFormatter.format(Number(value || 0));
}

function buildLocalizedPage(page, citySlug, variant, cityStats, locale) {
  const city = getGeo(citySlug, locale);
  if (!city) return page;

  const citySuffix = `${city.cityHint} | Mansion Deseo`;
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
        description: `Busquedas de contactossex argentina ${city.cityHint} con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, ${activeCouples} parejas y acceso privado para adultos registrados.`,
        headline: `Contactossex Argentina ${city.label} con actividad real`,
        intro: `Si buscas contactossex argentina ${city.cityHint}, aca tenes una alternativa privada con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias. La base local incluye ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los ultimos 30 dias`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Cuanta actividad hay ${city.cityHint}?`, `Segun la actualizacion del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, incluyendo ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres.`],
          ['¿Se puede ver todo sin registrarse?', 'No. La landing es publica para captar la busqueda, pero el contenido completo y la interaccion quedan dentro del sitio para usuarios registrados.'],
        ],
      };
    }

    return {
      ...page,
      title: `Contactossex Argentina ${citySuffix}`,
      description: `Busquedas de contactossex argentina ${city.cityHint} en una comunidad privada para adultos registrados, con perfiles verificados y discrecion.`,
      headline: `Contactossex Argentina ${city.label}`,
      intro: `Una entrada publica pensada para captar la busqueda exacta de contactossex argentina ${city.cityHint} y llevarla a una experiencia privada.${cityIntroSuffix}`,
      bullets: cityBullets,
    };
  }

  if (page.focus === 'contactossex') {
    if (hasStats) {
      return {
        ...page,
        title: `Contactossex ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Alternativa privada para quienes buscan ${exactContactossex}, con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, ${activeCouples} parejas y acceso controlado.`,
        headline: `${exactContactossex} con actividad real y acceso privado`,
        intro: `Una landing pensada para captar busquedas de ${exactContactossex} y convertirlas en registro dentro de Mansion Deseo. En este momento, la base local muestra ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los ultimos 30 dias`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real para ${exactContactossex}?`, `Si. Segun la actualizacion del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los ultimos 30 dias ${city.cityHint}.`],
          ['¿Es el mismo sitio?', 'No. Es una alternativa propia, privada y orientada a perfiles verificados, con acceso completo solo despues del registro.'],
        ],
      };
    }

    return {
      ...page,
      title: `Contactossex ${citySuffix}`,
      description: `Alternativa privada para adultos registrados que buscan ${exactContactossex}, con perfiles verificados, discrecion total y foco en Argentina.`,
      headline: `Si buscas ${exactContactossex}, esta es tu alternativa`,
      intro: `Una landing pensada para captar busquedas de ${exactContactossex} y convertirlas en registro dentro de Mansion Deseo.${cityIntroSuffix}`,
      bullets: cityBullets,
    };
  }

  if (page.focus === 'parejas') {
    if (hasStats) {
      return {
        ...page,
        title: `Parejas ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para busquedas de parejas ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, ${activeCouples} parejas y acceso discreto.`,
        headline: `Parejas ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para busquedas de parejas ${city.cityHint} y para convertir esa intencion en registro dentro de Mansion Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los ultimos 30 dias`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real de parejas ${city.cityHint}?`, `Si. Segun la actualizacion del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, incluyendo ${activeCouples} parejas con actividad reciente.`],
          ['¿Se puede ver el contenido completo sin registro?', 'No. La landing es publica para captar la busqueda, pero el detalle de perfiles y la interaccion quedan reservados a usuarios registrados.'],
        ],
      };
    }
  }

  if (page.focus === 'parejas liberales') {
    if (hasStats) {
      return {
        ...page,
        title: `Parejas Liberales ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para busquedas de parejas liberales ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias y ${activeCouples} parejas con actividad reciente.`,
        headline: `Parejas liberales ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para busquedas de parejas liberales ${city.cityHint} y para convertir esa intencion en registro dentro de Mansion Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los ultimos 30 dias`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real de parejas liberales ${city.cityHint}?`, `Si. Segun la actualizacion del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, incluyendo ${activeCouples} parejas con actividad reciente.`],
          ['¿Se puede explorar la comunidad completa desde esta pagina?', 'No. La landing es publica, pero el detalle de perfiles, stories y mensajes queda reservado a usuarios registrados.'],
        ],
      };
    }
  }

  if (page.focus === 'swingers') {
    if (hasStats) {
      return {
        ...page,
        title: `Swingers ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para busquedas swingers ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, ${activeCouples} parejas y acceso discreto.`,
        headline: `Swingers ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para busquedas swingers ${city.cityHint} y para convertir esa intencion en registro dentro de Mansion Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los ultimos 30 dias`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad swingers real ${city.cityHint}?`, `Si. Segun la actualizacion del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, con ${activeCouples} parejas y actividad reciente dentro de la comunidad.`],
          ['¿El contenido completo es publico?', 'No. La landing es publica para captar la busqueda correcta, pero el detalle de perfiles, stories y mensajes queda reservado a usuarios registrados.'],
        ],
      };
    }
  }

  if (page.focus === 'intercambio de parejas') {
    if (hasStats) {
      return {
        ...page,
        title: `Intercambio de Parejas ${citySuffix} | ${activeProfiles} perfiles activos`,
        description: `Comunidad privada para busquedas de intercambio de parejas ${city.cityHint}, con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias y ${activeCouples} parejas con actividad reciente.`,
        headline: `Intercambio de parejas ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para busquedas de intercambio de parejas ${city.cityHint} y para convertir esa intencion en registro dentro de Mansion Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los ultimos 30 dias`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad real de intercambio de parejas ${city.cityHint}?`, `Si. Segun la actualizacion del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, incluyendo ${activeCouples} parejas con actividad reciente.`],
          ['¿El intercambio de parejas se ve completo sin registro?', 'No. La pagina captura la busqueda, pero la experiencia completa y privada queda reservada a usuarios registrados.'],
        ],
      };
    }
  }

  if (page.focus === 'cuckold argentina') {
    return {
      ...page,
      title: `Cuckold ${citySuffix}`,
      description: `Busquedas de ${exactCuckold}, cornudo y cornudos ${city.cityHint} en una comunidad privada para adultos registrados, con discrecion y perfiles verificados.`,
      headline: `${exactCuckold}, discrecion y afinidad real`,
      intro: `Una entrada publica para busquedas de ${exactCuckold}, cornudo y cornudos ${city.cityHint}, pensada para llevar trafico local a una experiencia privada.${cityIntroSuffix}`,
      bullets: [
        `Busquedas de ${exactCuckold}, cornudo y cornudos ${city.cityHint}`,
        `${city.catchphrase}`,
        'Contenido completo solo para usuarios registrados',
      ],
    };
  }

  if (page.focus === 'cornudos') {
    return {
      ...page,
      title: `Cornudos ${citySuffix}`,
      description: `Busquedas de ${exactCornudos} y cornudo ${city.cityHint} en una comunidad privada para adultos registrados, con discrecion y perfiles verificados.`,
      headline: `${exactCornudos}, discrecion y afinidad real`,
      intro: `Una entrada publica para busquedas de ${exactCornudos} y cornudo ${city.cityHint}, pensada para llevar trafico local a una experiencia privada.${cityIntroSuffix}`,
      bullets: [
        `Busquedas de ${exactCornudos} y cornudo ${city.cityHint}`,
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
        description: `Busquedas hotwife ${city.cityHint} en una comunidad privada para adultos registrados, con ${activeProfiles} perfiles verificados activos en los ultimos 30 dias y acceso discreto.`,
        headline: `Hotwife ${city.label} con actividad real y acceso privado`,
        intro: `Una landing pensada para busquedas hotwife ${city.cityHint} y para convertir esa intencion en registro dentro de Mansion Deseo. La actividad local muestra ${activeProfiles} perfiles verificados activos en los ultimos 30 dias, con ${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres. Datos actualizados el ${updatedLabel}.${cityIntroSuffix}`,
        bullets: [
          `${activeProfiles} perfiles verificados activos en los ultimos 30 dias`,
          `${activeCouples} parejas, ${activeWomen} mujeres y ${activeMen} hombres con actividad reciente`,
          `${premiumProfiles} perfiles premium y acceso completo solo para registrados`,
        ],
        faq: [
          [`¿Hay actividad hotwife real ${city.cityHint}?`, `Si. Segun la actualizacion del ${updatedLabel}, hay ${activeProfiles} perfiles verificados activos en los ultimos 30 dias dentro de la comunidad.`],
          ['¿La experiencia completa es publica?', 'No. La landing es publica para captar la intencion de busqueda, pero los perfiles y la interaccion viven detras del registro.'],
        ],
      };
    }
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

export function getAstroLandingData({ variant, citySlug = '', locale = DEFAULT_SEO_LOCALE }) {
  const localeConfig = getSeoLocale(locale);
  const city = citySlug ? getGeo(citySlug, locale) : null;
  const cityStats = city ? getSeoCityStats(citySlug) : null;
  const cityHasStats = hasSeoCityStats(cityStats);
  const page = city
    ? buildLocalizedPage(getSeoIntentPage(locale, variant), citySlug, variant, cityStats, locale)
    : getSeoIntentPage(locale, variant);
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
      name: 'Mansion Deseo',
      url: 'https://mansiondeseo.com/',
    },
    ...(city ? { areaServed: city.label } : {}),
    ...(cityHasStats && cityStats?.updated_at ? { dateModified: `${String(cityStats.updated_at).slice(0, 10)}T00:00:00Z` } : {}),
    about: [
      { '@type': 'Thing', name: page.focus },
      { '@type': 'Thing', name: 'encuentros discretos' },
      { '@type': 'Thing', name: 'adultos registrados' },
    ],
  };

  return {
    localeConfig,
    city,
    cityStats,
    cityHasStats,
    page,
    canonical,
    alternates,
    relatedCityLinks,
    faqSchema,
    pageSchema,
  };
}
