import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Sparkles, MapPin, HeartHandshake } from 'lucide-react';
import { useSeoMeta, useStructuredData } from '../lib/seo';
import { useAuth } from '../lib/authContext';
import { getTopSeoCityStats, formatSeoCityStatsDate } from '../lib/seoCityStats';
import { getSeoHomeStats, formatSeoHomeStatsDate } from '../lib/seoHomeStats';
import heroTrioPremium from '../assets/hero-trio-premium.svg';
import { isAppSubdomainHost } from '../lib/siteDomains';

const countFormatter = new Intl.NumberFormat('es-AR');

const featureCards = [
  {
    icon: ShieldCheck,
    title: 'Perfiles verificados',
    text: 'Una comunidad cerrada, discreta y con acceso controlado para adultos registrados.',
  },
  {
    icon: HeartHandshake,
    title: 'Afinidad mejor filtrada',
    text: 'Parejas, mujeres, hombres y nichos concretos dentro de una experiencia privada más cuidada.',
  },
  {
    icon: MapPin,
    title: 'SEO por ciudad e intención',
    text: 'La capa pública capta búsquedas reales y la experiencia completa vive adentro, detrás del registro.',
  },
];

const intentLinks = [
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

function formatCount(value) {
  return countFormatter.format(Number(value || 0));
}

export default function PublicHomePage() {
  const { user } = useAuth();
  const homeStats = getSeoHomeStats();
  const updatedLabel = formatSeoHomeStatsDate(homeStats?.updated_at) || formatSeoCityStatsDate(homeStats?.updated_at);
  const topCities = getTopSeoCityStats(4);
  const totalActive = Number(homeStats?.active_profiles_30d || 0);
  const couplesActive = Number(homeStats?.active_couples_30d || 0);
  const womenActive = Number(homeStats?.active_women_30d || 0);
  const menActive = Number(homeStats?.active_men_30d || 0);

  useSeoMeta({
    title: 'Mansion Deseo | Club privado para adultos registrados',
    description: 'Comunidad privada para adultos registrados, pensada para parejas liberales, swingers, trios y conexiones discretas con perfiles verificados.',
    canonical: 'https://mansiondeseo.com/',
  });

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Mansion Deseo',
    url: 'https://mansiondeseo.com/',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://mansiondeseo.com/contactossex/{search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }, 'website-home');

  if (user) {
    return <Navigate to="/feed" replace />;
  }

  if (isAppSubdomainHost()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#09080d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(155,43,64,0.22),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(201,168,106,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_48%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="absolute left-[-120px] top-16 h-80 w-80 rounded-full bg-mansion-crimson/14 blur-3xl" />
        <div className="absolute right-[-100px] top-44 h-72 w-72 rounded-full bg-mansion-gold/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-16 pt-10 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark shadow-[0_10px_30px_rgba(139,26,46,0.35)]">
              <span className="font-display text-sm font-bold text-white">M</span>
            </div>
            <div>
              <span className="font-display text-xl font-semibold text-gradient-gold">Mansion Deseo</span>
              <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim">Club privado para adultos</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-text-muted transition-colors hover:text-white">
              Acceder
            </Link>
            <Link to="/registro" className="rounded-full bg-mansion-gold px-4 py-2 text-sm font-semibold text-black transition-all hover:brightness-110">
              Registro gratis
            </Link>
          </div>
        </header>

        <section className="py-14 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl"
          >
            <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-black/25 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch lg:p-6">
              <div className="flex h-full flex-col">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-text-muted backdrop-blur-sm">
                  <Sparkles className="h-4 w-4 text-mansion-gold" />
                  +18 · Acceso privado para adultos
                </div>

                <h1 className="mt-6 font-display text-4xl font-bold leading-[1.02] text-white sm:text-5xl lg:text-[4.4rem]">
                  Una entrada pública más cuidada para una comunidad privada con química real.
                </h1>

                <p className="mt-6 max-w-xl text-base leading-7 text-text-muted sm:text-lg">
                  Mansion Deseo combina visibilidad SEO por intención y ciudad con una experiencia
                  cerrada para explorar perfiles verificados, historias y mensajes dentro de un
                  entorno más discreto.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to="/registro"
                    className="inline-flex items-center gap-2 rounded-full bg-mansion-gold px-6 py-3 text-sm font-semibold text-black transition-all hover:brightness-110"
                  >
                    Empezar ahora
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-[1.9rem] border border-white/10 bg-black/25">
                  <img
                    src={heroTrioPremium}
                    alt="Tres figuras adultas en una composición elegante y sensual"
                    className="h-full min-h-[420px] w-full object-cover md:min-h-[620px]"
                    loading="eager"
                    decoding="async"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#08080e] via-[#08080ecc] to-transparent p-6 sm:p-8">
                    <p className="max-w-md text-sm leading-6 text-text-muted">
                      No es una red abierta. La capa pública capta la búsqueda correcta y la experiencia
                      completa vive adentro: filtros, perfiles verificados, historias y mensajes con más
                      discreción que en plataformas generalistas.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            <div className="mt-5 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-mansion-gold/80">Comunidad activa</p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <p className="font-display text-5xl font-bold leading-none text-white sm:text-6xl">
                      {formatCount(totalActive)}
                    </p>
                    <p className="max-w-[16rem] pb-1 text-sm leading-5 text-text-muted">
                      perfiles activos en los últimos 30 días
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Parejas', value: couplesActive },
                    { label: 'Mujeres', value: womenActive },
                    { label: 'Hombres', value: menActive },
                  ].map((item) => (
                    <span
                      key={item.label}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-white/90"
                    >
                      {item.label} · {formatCount(item.value)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                  <span>Ultimas busquedas</span>
                  <span className="h-1 w-1 rounded-full bg-mansion-gold/70" />
                  <span>Actualizado {updatedLabel || 'hoy'}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {intentLinks.map((item) => (
                    <Link
                      key={`${item.to}-${item.label}`}
                      to={item.to}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                  <MapPin className="h-3.5 w-3.5 text-mansion-gold" />
                  Ciudades activas
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {topCities.map((city) => (
                    <Link
                      key={city.city_slug}
                      to={`/contactossex/${city.city_slug}`}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-white"
                    >
                      {city.locality || city.city_slug}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {featureCards.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mansion-gold/12">
                <Icon className="h-5 w-5 text-mansion-gold" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
