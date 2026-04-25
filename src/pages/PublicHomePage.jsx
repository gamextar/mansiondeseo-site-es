import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Sparkles, Users, MapPin, HeartHandshake } from 'lucide-react';
import { useSeoMeta, useStructuredData } from '../lib/seo';
import { useAuth } from '../lib/authContext';
import { login as apiLogin } from '../lib/api';
import { SITE_CONFIG, SITE_ORIGIN } from '../lib/siteConfig';

const featureCards = [
  {
    icon: ShieldCheck,
    title: 'Perfiles verificados',
    text: 'Una comunidad cerrada para adultos registrados, con foco en discrecion y acceso controlado.',
  },
  {
    icon: MapPin,
    title: 'Intencion local real',
    text: 'Entradas SEO por ciudad e intencion para captar trafico local y dirigirlo a una experiencia privada.',
  },
  {
    icon: HeartHandshake,
    title: 'Conexiones afines',
    text: 'Parejas, trios, swingers, hombres, mujeres y perfiles trans con filtros y afinidad real.',
  },
];

const BASE_INTENT_LINKS = [
  { to: '/parejas', label: 'Parejas' },
  { to: '/trios', label: 'Trios' },
  { to: '/swingers', label: 'Swingers' },
  { to: '/contactossex', label: 'Contactossex' },
];

const AR_INTENT_LINKS = [
  { to: '/contactossex-argentina', label: 'Contactossex AR' },
  { to: '/cornudos-argentina', label: 'Cornudos AR' },
];

const intentLinks = SITE_CONFIG.country === 'AR'
  ? [...BASE_INTENT_LINKS, ...AR_INTENT_LINKS]
  : BASE_INTENT_LINKS;

export default function PublicHomePage() {
  const { user, setRegistered, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useSeoMeta({
    title: 'Mansion Deseo | Club privado para adultos registrados',
    description: 'Comunidad privada para adultos registrados, pensada para parejas, swingers, trios y conexiones discretas con perfiles verificados.',
    canonical: `${SITE_ORIGIN}/`,
  });

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Mansion Deseo',
    url: `${SITE_ORIGIN}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_ORIGIN}/contactossex/{search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }, 'website-home');

  if (user) {
    return <Navigate to="/feed" replace />;
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loggingIn) return;
    setLoggingIn(true);
    setLoginError('');

    try {
      const data = await apiLogin({ email, password });
      setUser(data.user);
      setRegistered(true);
      window.location.href = '/feed';
    } catch (err) {
      setLoginError(err?.message || 'Credenciales inválidas');
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-mansion-base text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-140px] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-mansion-crimson/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-120px] h-[280px] w-[280px] rounded-full bg-mansion-gold/10 blur-3xl" />
        <div className="absolute right-[-120px] top-1/3 h-[300px] w-[300px] rounded-full bg-mansion-crimson/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-16 pt-10 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
              <span className="font-display text-white text-sm font-bold">M</span>
            </div>
            <span className="font-display text-[17px] font-semibold text-gradient-gold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
              Mansión Deseo
            </span>
          </Link>

          <form onSubmit={handleLogin} className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(11rem,13rem)_minmax(9rem,11rem)_auto] sm:items-start">
            <label className="sr-only" htmlFor="public-login-email">Email</label>
            <input
              id="public-login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="h-10 rounded-full border-white/10 bg-white/5 px-4 py-2 text-sm"
              required
            />
            <label className="sr-only" htmlFor="public-login-password">Contraseña</label>
            <input
              id="public-login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              className="h-10 rounded-full border-white/10 bg-white/5 px-4 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={loggingIn}
              className="h-10 rounded-full bg-mansion-gold px-5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              {loggingIn ? 'Entrando...' : 'Entrar'}
            </button>
            {loginError && (
              <p className="sm:col-span-3 text-xs text-mansion-crimson">
                {loginError}
              </p>
            )}
          </form>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-text-muted backdrop-blur-sm"
            >
              <Sparkles className="h-4 w-4 text-mansion-gold" />
              Acceso privado para adultos registrados
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl"
            >
              Una comunidad privada para perfiles reales, afinidad y discrecion total.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-5 max-w-2xl text-base leading-7 text-text-muted sm:text-lg"
            >
              Mansion Deseo funciona como puerta de entrada publica y experiencia privada:
              landings indexables para captar busquedas locales y una app cerrada para explorar
              perfiles verificados, historias, mensajes y conexiones con afinidad real.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to={user ? '/feed' : '/registro'}
                className="inline-flex items-center gap-2 rounded-full bg-mansion-gold px-6 py-3 text-sm font-semibold text-black transition-all hover:brightness-110"
              >
                {user ? 'Entrar al feed' : 'Empezar ahora'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!user && (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Ya tengo cuenta
                </Link>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="mt-8 flex flex-wrap gap-2"
            >
              {intentLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="relative"
          >
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-text-dim">Visibilidad publica</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">SEO fuerte por intencion y ciudad</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mansion-gold/15">
                    <Users className="h-6 w-6 text-mansion-gold" />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {featureCards.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-mansion-gold/10">
                          <Icon className="h-5 w-5 text-mansion-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-text-muted">{text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-text-dim sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Mansión Deseo · Sitio para mayores de 18 años.</span>
          <nav className="flex flex-wrap gap-4" aria-label="Legal y ayuda">
            <Link to="/terminos" className="transition-colors hover:text-text-muted">Términos</Link>
            <Link to="/privacidad" className="transition-colors hover:text-text-muted">Privacidad</Link>
            <Link to="/ayuda" className="transition-colors hover:text-text-muted">Ayuda</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
