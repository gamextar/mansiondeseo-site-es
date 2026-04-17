import { motion } from 'framer-motion';
import { ArrowRight, Lock, Sparkles, Shield, Users, Heart, Crown, MapPin, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSeoMeta, useStructuredData } from '../lib/seo';
import { getGeo } from '../lib/seoGeoCatalog';
import { DEFAULT_SEO_LOCALE, getSeoLocale } from '../lib/seoLocales';
import { buildSeoAlternates, buildSeoCanonical, buildSeoPublicPath } from '../lib/seoRouting';
import { formatSeoCityStatsDate, getSeoCityStats, getTopSeoCityStats, hasSeoCityStats } from '../lib/seoCityStats';
import { getSeoIntentPage } from '../lib/seoIntentCatalog';

function slugToCity(slug, locale) {
  return getGeo(slug, locale);
}

const countFormatter = new Intl.NumberFormat('es-AR');

function formatCount(value) {
  return countFormatter.format(Number(value || 0));
}

function buildLocalizedPage(page, citySlug, variant, cityStats, locale) {
  const city = slugToCity(citySlug, locale);
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

const RELATED = [
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

function Pill({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-text-muted backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 text-mansion-gold" />
      {children}
    </span>
  );
}

export default function SEOLandingPage({ variant, citySlug = '', locale = DEFAULT_SEO_LOCALE }) {
  const localeConfig = getSeoLocale(locale);
  const city = citySlug ? slugToCity(citySlug, locale) : null;
  const cityStats = city ? getSeoCityStats(citySlug) : null;
  const cityHasStats = hasSeoCityStats(cityStats);
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
        const entryCity = slugToCity(entry.city_slug, locale);
        if (!entryCity) return null;
        return {
          to: buildSeoPublicPath({ locale, variant, citySlug: entry.city_slug }),
          label: `${entryCity.label} (${formatCount(entry.active_profiles_30d)})`,
        };
      })
      .filter(Boolean)
    : [];
  const page = buildLocalizedPage(getSeoIntentPage(locale, variant), citySlug, variant, cityStats, locale);
  const canonical = buildSeoCanonical({ locale, variant, citySlug });
  const alternates = buildSeoAlternates({ variant, citySlug });
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

  useSeoMeta({
    title: page.title,
    description: page.description,
    canonical,
    alternates,
    htmlLang: localeConfig.language,
    ogLocale: localeConfig.hreflang.replace('-', '_'),
  });
  useStructuredData(faqSchema, `faq-${variant}${citySlug ? `-${citySlug}` : ''}`);
  useStructuredData(pageSchema, `webpage-${variant}${citySlug ? `-${citySlug}` : ''}`);

  return (
    <div className="min-h-screen bg-mansion-base overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 right-[-8rem] h-96 w-96 rounded-full bg-mansion-gold/10 blur-3xl" />
        <div className="absolute top-24 left-[-6rem] h-80 w-80 rounded-full bg-mansion-crimson/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_35%),linear-gradient(180deg,rgba(10,10,16,0.02),rgba(10,10,16,0.18))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 lg:px-8">
        <div className="mb-10 flex items-center justify-between">
          <Link to="/bienvenida?intent=register" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark text-white shadow-elevated">
              <span className="font-display text-lg font-bold">M</span>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-text-primary">Mansión Deseo</p>
              <p className="text-xs text-text-dim">Acceso privado para adultos</p>
            </div>
          </Link>
          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/login" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-text-primary transition-colors hover:bg-white/10">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="rounded-full bg-mansion-gold px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.02]">
              Registrarme
            </Link>
          </div>
        </div>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="flex flex-wrap gap-2">
              <Pill icon={Lock}>Solo mayores registrados</Pill>
              <Pill icon={Shield}>Perfiles verificados</Pill>
              <Pill icon={Sparkles}>Discreción total</Pill>
            </div>

            <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight text-text-primary md:text-6xl">
              {page.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-dim md:text-lg">
              {page.intro}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-muted">encuentros discretos</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-muted">perfiles verificados</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-muted">adultos registrados</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-muted">contactos privados</span>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <Users className="h-5 w-5 text-mansion-gold" />
                <p className="mt-3 text-sm font-medium text-text-primary">Comunidad privada</p>
                <p className="mt-1 text-xs leading-relaxed text-text-dim">Contenido completo solo para usuarios registrados.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <Heart className="h-5 w-5 text-mansion-gold" />
                <p className="mt-3 text-sm font-medium text-text-primary">Afinidad real</p>
                <p className="mt-1 text-xs leading-relaxed text-text-dim">Buscá por intención, filtros y preferencias.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <Crown className="h-5 w-5 text-mansion-gold" />
                <p className="mt-3 text-sm font-medium text-text-primary">Experiencia cuidada</p>
                <p className="mt-1 text-xs leading-relaxed text-text-dim">El sitio está pensado para convertir a registro.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/registro" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mansion-gold px-5 py-4 text-base font-semibold text-black shadow-[0_12px_28px_rgba(201,168,76,0.22)] transition-transform hover:scale-[1.01]">
                Crear cuenta
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base font-medium text-text-primary transition-colors hover:bg-white/10">
                Ya tengo cuenta
              </Link>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="relative"
          >
            <div className="rounded-[2rem] border border-mansion-border/25 bg-[linear-gradient(180deg,rgba(24,20,29,0.92),rgba(10,10,16,0.92))] p-6 shadow-elevated">
              <div className="inline-flex rounded-full border border-mansion-gold/20 bg-mansion-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-mansion-gold">
                {city ? `${city.label} · SEO local` : 'Qué encontrás'}
              </div>

              <ul className="mt-5 space-y-3">
                {page.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mansion-gold/15 text-mansion-gold">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-sm leading-relaxed text-text-primary">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-dim">
                  <MapPin className="h-3.5 w-3.5 text-mansion-gold" />
                  Foco SEO
                </div>
                <p className="mt-2 text-sm text-text-primary">
                  {page.focus} y búsquedas relacionadas{city ? ` ${city.cityHint}` : ''}, con acceso completo solo después del registro.
                </p>
              </div>

              {city && (
                <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-dim">
                    <Users className="h-3.5 w-3.5 text-mansion-gold" />
                    Actividad local
                  </div>
                  {cityHasStats ? (
                    <>
                      <p className="mt-2 text-sm leading-relaxed text-text-primary">
                        Hay {formatCount(cityStats.active_profiles_30d)} perfiles verificados activos en los últimos 30 días {city.cityHint}.
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-text-dim">
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em]">Parejas</p>
                          <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(cityStats.active_couples_30d)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em]">Mujeres</p>
                          <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(cityStats.active_women_30d)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em]">Hombres</p>
                          <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(cityStats.active_men_30d)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em]">Premium</p>
                          <p className="mt-1 text-lg font-semibold text-text-primary">{formatCount(cityStats.premium_profiles)}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-text-dim">
                        Datos agregados y actualizados el {formatSeoCityStatsDate(cityStats.updated_at)}.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-text-primary">
                      Esta landing ya está preparada para captar búsquedas de alta intención {city.cityHint}. A medida que se consolida la actividad verificada local, vamos mostrando cifras públicas más precisas.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </div>

        <section className="mt-16 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-semibold text-text-primary">Preguntas frecuentes</h2>
            <div className="mt-4 space-y-4">
              {page.faq.map(([question, answer]) => (
                <div key={question} className="rounded-2xl border border-white/5 bg-black/15 p-4">
                  <p className="text-sm font-medium text-text-primary">{question}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-dim">{answer}</p>
                </div>
              ))}
            </div>
          </div>

            <div className="rounded-[2rem] border border-mansion-border/25 bg-[linear-gradient(180deg,rgba(201,168,76,0.08),rgba(24,20,29,0.88))] p-6">
              <h2 className="font-display text-2xl font-semibold text-text-primary">
                {relatedCityLinks.length ? 'Otras ciudades activas' : 'Ultimas busquedas'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                {relatedCityLinks.length
                  ? 'Estas ciudades ya muestran actividad verificada y ayudan a reforzar el enlazado interno de la familia SEO.'
                  : 'Agrupamos aca las keywords principales. Desde cada landing se amplian otras ciudades e intenciones relacionadas.'}
              </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(relatedCityLinks.length ? relatedCityLinks : RELATED.map((item) => ({
                ...item,
                to: buildSeoPublicPath({ locale, variant: item.to.replace(/^\//, '') }),
              }))).map((item) => (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-mansion-gold/25 hover:text-mansion-gold"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-text-dim">
              <MessageCircle className="h-4 w-4 text-mansion-gold" />
              La experiencia completa vive adentro, detrás del login.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
