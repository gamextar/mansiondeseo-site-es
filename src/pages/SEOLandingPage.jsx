import { motion } from 'framer-motion';
import { ArrowRight, Lock, Sparkles, Shield, Users, Heart, Crown, MapPin, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSeoMeta, useStructuredData } from '../lib/seo';
import { getGeo } from '../lib/seoGeoCatalog';

const SEO_PAGES = {
  parejas: {
    title: 'Parejas en Mansión Deseo | Encuentros privados para adultos registrados',
    description: 'Descubrí parejas, contactos discretos y perfiles afines en una comunidad privada para adultos registrados, con verificación y acceso controlado.',
    headline: 'Parejas, complicidad y encuentros discretos',
    intro: 'Una puerta de entrada pública para quienes buscan contactos entre parejas, parejas abiertas y propuestas afines dentro de una comunidad privada para adultos.',
    focus: 'parejas',
    bullets: ['Contactos entre parejas y perfiles afines', 'Búsquedas por intención, afinidad y discreción', 'Acceso solo para adultos registrados'],
    faq: [
      ['¿Es público el contenido?', 'La entrada es pública, pero el contenido completo queda dentro del sitio para usuarios registrados.'],
      ['¿Para quién está pensado?', 'Para adultos que buscan relaciones discretas, parejas abiertas y encuentros afines.'],
    ],
  },
  trios: {
    title: 'Tríos en Mansión Deseo | Búsquedas discretas para adultos registrados',
    description: 'Explorá una comunidad privada para adultos registrados que buscan tríos, encuentros compartidos y conexiones discretas.',
    headline: 'Tríos, química y propuestas sin ruido',
    intro: 'Una landing pensada para búsquedas de tríos y experiencias compartidas, con contenido privado detrás del registro.',
    focus: 'tríos',
    bullets: ['Búsquedas de tríos y experiencias compartidas', 'Ambiente privado, discreto y verificado', 'Perfiles con actividad, fotos y stories'],
    faq: [
      ['¿Se puede ver todo sin registrarse?', 'No. La experiencia completa queda reservada a usuarios registrados.'],
      ['¿Qué muestra esta página?', 'Una introducción pública para captar la intención de búsqueda correcta.'],
    ],
  },
  swingers: {
    title: 'Swingers en Mansión Deseo | Comunidad privada para adultos registrados',
    description: 'Encontrá una comunidad orientada a swingers, parejas abiertas y contactos privados para adultos registrados.',
    headline: 'Swingers, apertura y encuentros privados',
    intro: 'Pensada para parejas y adultos que buscan una experiencia social más abierta, con discreción, control y perfiles verificados.',
    focus: 'swingers',
    bullets: ['Perfiles orientados a parejas abiertas', 'Búsqueda por afinidades y preferencias', 'Registro privado y acceso controlado'],
    faq: [
      ['¿Esto es para todos?', 'Está orientado a adultos que realmente buscan ese tipo de dinámica.'],
      ['¿El sitio es abierto?', 'La presentación es pública; el contenido completo, no.'],
    ],
  },
  mujeres: {
    title: 'Mujeres en Mansión Deseo | Perfiles privados para adultos registrados',
    description: 'Explorá perfiles de mujeres dentro de una comunidad privada para adultos registrados, con foco en discreción, afinidad y registro.',
    headline: 'Mujeres, afinidad y conversaciones privadas',
    intro: 'Una entrada pública para búsquedas centradas en mujeres, con acceso a perfiles y funciones completas tras el registro.',
    focus: 'mujeres',
    bullets: ['Perfiles de mujeres con afinidad real', 'Acceso privado al detalle completo', 'Registro rápido para adultos'],
    faq: [
      ['¿Puedo ver perfiles completos?', 'Solo una vista pública; el acceso total requiere registro.'],
      ['¿Sirve para captar búsquedas?', 'Sí, porque cubre la intención de búsqueda sin exponer contenido privado.'],
    ],
  },
  hombres: {
    title: 'Hombres en Mansión Deseo | Perfiles privados para adultos registrados',
    description: 'Descubrí perfiles de hombres y una comunidad privada para adultos registrados con afinidad, filtros y discreción.',
    headline: 'Hombres, filtros y encuentros afines',
    intro: 'Una página de entrada pública para búsquedas centradas en hombres, ideal para llevar tráfico orgánico al registro.',
    focus: 'hombres',
    bullets: ['Búsquedas por sexo e intención', 'Perfil privado y verificado', 'Acceso completo luego del registro'],
    faq: [
      ['¿Se indexa el contenido privado?', 'No, solo esta entrada pública y el contenido preparado para captación.'],
      ['¿Puedo usarla como landing?', 'Sí, está pensada para eso.'],
    ],
  },
  trans: {
    title: 'Trans en Mansión Deseo | Comunidad privada para adultos registrados',
    description: 'Una comunidad privada para adultos registrados con búsquedas trans, perfiles verificados y acceso discreto.',
    headline: 'Trans, visibilidad y acceso discreto',
    intro: 'Una página clara y respetuosa para búsquedas trans, diseñada para captar intención sin mostrar contenido privado.',
    focus: 'trans',
    bullets: ['Búsquedas trans con filtros reales', 'Contenido privado para registrados', 'Landing con enfoque respetuoso'],
    faq: [
      ['¿El contenido es público?', 'No. La página pública solo presenta la propuesta general.'],
      ['¿Qué ventaja tiene SEO?', 'Te permite posicionar una intención concreta sin exponer el área privada.'],
    ],
  },
  'cuckold-argentina': {
    title: 'Cuckold Argentina | Encuentros privados para adultos registrados',
    description: 'Una landing pública para búsquedas de cuckold en Argentina, con una comunidad privada, perfiles verificados y acceso discreto.',
    headline: 'Cuckold Argentina, discreción y afinidad real',
    intro: 'Una entrada pública pensada para captar búsquedas de cuckold en Argentina y llevarlas a una experiencia privada para adultos registrados.',
    focus: 'cuckold argentina',
    bullets: ['Búsquedas de cuckold en Argentina', 'Perfiles afines y verificados', 'Acceso completo tras el registro'],
    faq: [
      ['¿Esto es público?', 'Solo la puerta de entrada. El contenido completo queda para usuarios registrados.'],
      ['¿Sirve para posicionar la búsqueda?', 'Sí, porque ataca la intención principal con contenido propio y relevante.'],
    ],
  },
  contactossex: {
    title: 'Contactossex | Alternativa privada para adultos registrados',
    description: 'Si buscás Contactossex, descubrí una alternativa privada para adultos registrados con perfiles verificados, discreción y acceso controlado.',
    headline: 'Si buscás Contactossex, esta es tu alternativa privada',
    intro: 'Una landing orientada a capturar búsquedas de Contactossex y convertirlas en registro dentro de Mansión Deseo.',
    focus: 'contactossex',
    bullets: ['Alternativa privada a Contactossex', 'Perfiles verificados y discretos', 'Acceso completo solo para registrados'],
    faq: [
      ['¿Es el mismo sitio?', 'No. Es una alternativa propia con foco en privacidad y comunidad verificada.'],
      ['¿Puedo entrar sin registrarme?', 'Solo a esta landing; el contenido completo sigue siendo privado.'],
    ],
  },
  'contactossex-argentina': {
    title: 'Contactossex Argentina | Alternativa privada para adultos registrados',
    description: 'Si buscás contactossex argentina, descubrí una alternativa privada para adultos registrados con perfiles verificados, discreción y acceso controlado.',
    headline: 'Contactossex Argentina, acceso privado y perfiles verificados',
    intro: 'Una landing pensada para captar la búsqueda exacta de contactossex argentina y llevar tráfico a una experiencia privada para adultos registrados.',
    focus: 'contactossex',
    bullets: ['Búsqueda exacta de contactossex argentina', 'Perfiles verificados y discretos', 'Acceso completo solo para registrados'],
    faq: [
      ['¿Qué captura esta página?', 'Captura búsquedas exactas de contactossex argentina y variantes cercanas.'],
      ['¿Hay contenido público completo?', 'No, solo la puerta de entrada pública.'],
    ],
  },
  'cornudos-argentina': {
    title: 'Cornudos Argentina | Comunidad privada para adultos registrados',
    description: 'Una landing pública para búsquedas de cornudos en Argentina, con comunidad privada, perfiles verificados y acceso discreto.',
    headline: 'Cornudos Argentina, discreción y afinidad real',
    intro: 'Una entrada pública pensada para captar búsquedas de cornudos y cornudo en Argentina, con acceso privado para adultos registrados.',
    focus: 'cornudos',
    bullets: ['Búsquedas de cornudos y cornudo en Argentina', 'Perfiles afines y verificados', 'Acceso completo tras el registro'],
    faq: [
      ['¿Esto es público?', 'Solo la puerta de entrada. El contenido completo queda para usuarios registrados.'],
      ['¿Sirve para posicionar la búsqueda?', 'Sí, porque ataca la intención principal con contenido propio y relevante.'],
    ],
  },
};

function slugToCity(slug) {
  return getGeo(slug);
}

function buildLocalizedPage(page, citySlug, variant) {
  const city = slugToCity(citySlug);
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

  if (variant === 'contactossex-argentina') {
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

const RELATED = [
  { to: '/contactossex', label: 'Contactossex' },
  { to: '/contactossex-argentina', label: 'Contactossex AR' },
  { to: '/cornudos-argentina', label: 'Cornudos AR' },
  { to: '/cuckold-argentina', label: 'Cuckold AR' },
  { to: '/parejas', label: 'Parejas' },
  { to: '/trios', label: 'Tríos' },
  { to: '/swingers', label: 'Swingers' },
  { to: '/mujeres', label: 'Mujeres' },
  { to: '/hombres', label: 'Hombres' },
  { to: '/trans', label: 'Trans' },
];

function Pill({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-text-muted backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 text-mansion-gold" />
      {children}
    </span>
  );
}

export default function SEOLandingPage({ variant, citySlug = '' }) {
  const page = buildLocalizedPage(SEO_PAGES[variant] || SEO_PAGES.parejas, citySlug, variant);
  const canonical = citySlug
    ? `https://mansiondeseo.com/${variant}/${citySlug}`
    : `https://mansiondeseo.com/${variant}`;
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
    isPartOf: {
      '@type': 'WebSite',
      name: 'Mansión Deseo',
      url: 'https://mansiondeseo.com/',
    },
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
                {citySlug && slugToCity(citySlug) ? `${slugToCity(citySlug).label} · SEO local` : 'Qué encontrás'}
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
                  {page.focus} y búsquedas relacionadas{citySlug && slugToCity(citySlug) ? ` ${slugToCity(citySlug).cityHint}` : ''}, con acceso completo solo después del registro.
                </p>
              </div>
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
              <h2 className="font-display text-2xl font-semibold text-text-primary">Más búsquedas</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                Usá estas páginas como entrada para términos de alta intención y dejá que el sitio convierta a registro.
              </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {RELATED.map((item) => (
                <Link
                  key={item.to}
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
