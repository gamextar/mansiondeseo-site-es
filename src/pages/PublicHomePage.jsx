import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, HeartHandshake, ShieldCheck, Users } from 'lucide-react';
import { useSeoMeta, useStructuredData } from '../lib/seo';
import { useAuth } from '../lib/authContext';
import { hasEverLoggedIn, login as apiLogin } from '../lib/api';
import { SITE_ORIGIN } from '../lib/siteConfig';

const ESCORTS_ORIGIN = 'https://escorts.mansiondeseo.com';

const benefits = [
  {
    icon: ShieldCheck,
    title: 'Privacidad por defecto',
    text: 'Un entorno reservado, discreto y pensado para adultos que cuidan su exposición.',
  },
  {
    icon: Users,
    title: 'Perfiles Verificados',
    text: 'Menos ruido, más intención: perfiles cuidados antes de entrar a la comunidad.',
  },
  {
    icon: HeartHandshake,
    title: 'Acceso curado',
    text: 'Una experiencia selectiva para conectar con personas que buscan lo mismo.',
  },
];

export default function PublicHomePage() {
  const { user, setRegistered, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useSeoMeta({
    title: 'Escorts en Argentina | Mansión Deseo',
    description: 'Directorio de escorts en Argentina con perfiles públicos, fotografías revisadas y contacto directo por ciudad.',
    canonical: `${SITE_ORIGIN}/`,
  });

  useStructuredData({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Mansión Deseo',
    url: `${SITE_ORIGIN}/`,
    description: 'Directorio de escorts en Argentina con perfiles públicos y revisión manual.',
  }, 'website-home');

  if (user) {
    return <Navigate to="/inicio" replace />;
  }

  if (hasEverLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loggingIn) return;
    const formData = new FormData(event.currentTarget);
    const loginEmail = String(formData.get('username') || email).trim();
    const loginPassword = String(formData.get('password') || password);
    setLoggingIn(true);
    setLoginError('');

    try {
      const data = await apiLogin({ email: loginEmail, password: loginPassword });
      setUser(data.user);
      setRegistered(true);
      window.location.href = '/inicio';
    } catch (err) {
      setLoginError(err?.message || 'Credenciales inválidas');
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] font-body text-[#f4f4f4]">
      <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between border-b border-white/[0.08] px-6 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-3" aria-label="Mansión Deseo">
          <span className="flex h-9 w-9 items-center justify-center border border-[#c5a059]/50 font-display text-sm font-semibold text-[#c5a059]">
            MD
          </span>
          <span className="font-display text-xl font-medium text-[#f4f4f4]">
            Mansión Deseo
          </span>
        </Link>

        <form
          onSubmit={handleLogin}
          autoComplete="on"
          className="relative hidden items-center gap-4 md:grid md:grid-cols-[12rem_10rem_auto]"
        >
          <label className="sr-only" htmlFor="public-login-email">Email</label>
          <input
            id="public-login-email"
            name="username"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="username"
            inputMode="email"
            className="h-9 rounded-none border-0 border-b border-white/20 bg-transparent px-0 py-1 text-sm text-[#f4f4f4] placeholder:text-white/35 focus:border-[#c5a059] focus:outline-none focus:ring-0"
            required
          />
          <label className="sr-only" htmlFor="public-login-password">Contraseña</label>
          <input
            id="public-login-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            className="h-9 rounded-none border-0 border-b border-white/20 bg-transparent px-0 py-1 text-sm text-[#f4f4f4] placeholder:text-white/35 focus:border-[#c5a059] focus:outline-none focus:ring-0"
            required
          />
          <button
            type="submit"
            disabled={loggingIn}
            className="h-9 border border-[#c5a059]/70 px-5 text-sm font-medium text-[#c5a059] transition-colors hover:border-[#c5a059] hover:bg-[#c5a059] hover:text-black disabled:cursor-wait disabled:opacity-60"
          >
            {loggingIn ? 'Entrando...' : 'Entrar'}
          </button>
          {loginError && (
            <p className="absolute right-0 top-12 max-w-sm text-right text-xs text-[#c5a059]">
              {loginError}
            </p>
          )}
        </form>

        <Link
          to="/login"
          className="border border-[#c5a059]/70 px-4 py-2 text-sm font-medium text-[#c5a059] md:hidden"
        >
          Login
        </Link>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10">
        <section className="flex max-w-5xl flex-col justify-center py-24 sm:py-28 lg:min-h-[calc(100svh-11rem)] lg:py-32">
          <h1 className="max-w-4xl font-display text-5xl font-medium leading-[1.05] text-[#f4f4f4] sm:text-6xl lg:text-7xl">
            Escorts en Argentina, con perfiles que podés conocer.
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-8 text-white/64 sm:text-xl">
            Explorá perfiles públicos por ciudad, revisá sus fotografías y contactá directamente. La comunidad privada continúa disponible para quienes buscan conectar con otras personas adultas.
          </p>
          <div className="mt-10">
            <a
              href={ESCORTS_ORIGIN}
              className="inline-flex min-h-12 items-center gap-3 bg-[#c5a059] px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#d4b36c] focus:outline-none focus:ring-2 focus:ring-[#c5a059]/50 focus:ring-offset-2 focus:ring-offset-black"
            >
              Ver escorts en Argentina
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              to="/registro"
              className="ml-3 inline-flex min-h-12 items-center border border-white/25 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:border-[#c5a059] hover:text-[#c5a059]"
            >
              Entrar a la comunidad
            </Link>
          </div>
        </section>

        <section className="border-y border-white/[0.08] py-8 text-center" aria-label="Directorio de escorts">
          <p className="text-sm font-light text-white/70">
            Perfiles públicos disponibles en distintas zonas de Argentina ·{' '}
            <a href={ESCORTS_ORIGIN} className="font-medium text-[#c5a059] hover:underline">Explorar el directorio</a>
          </p>
        </section>

        <section className="grid gap-12 py-24 md:grid-cols-3 lg:py-32" aria-label="Beneficios">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article key={title} className="border-t border-white/[0.08] pt-8">
              <Icon className="h-6 w-6 text-[#c5a059]" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="mt-8 font-display text-2xl font-medium text-[#f4f4f4]">
                {title}
              </h2>
              <p className="mt-4 max-w-sm text-sm font-light leading-7 text-white/58">
                {text}
              </p>
            </article>
          ))}
        </section>
        <section className="border-t border-white/[0.08] py-20 lg:py-28" aria-labelledby="community-title">
          <p className="text-xs uppercase tracking-[0.2em] text-[#c5a059]">Comunidad Mansion Deseo</p>
          <h2 id="community-title" className="mt-5 max-w-2xl font-display text-3xl font-medium text-[#f4f4f4] sm:text-4xl">
            El espacio de contactos continúa como comunidad secundaria.
          </h2>
          <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-white/58">
            Parejas, tríos y adultos que buscan conectar pueden continuar utilizando las secciones públicas y el acceso privado de Mansion Deseo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/parejas" className="border border-white/20 px-5 py-3 text-sm text-white/75 transition-colors hover:border-[#c5a059] hover:text-[#c5a059]">Parejas</Link>
            <Link to="/trios" className="border border-white/20 px-5 py-3 text-sm text-white/75 transition-colors hover:border-[#c5a059] hover:text-[#c5a059]">Tríos</Link>
            <Link to="/swingers" className="border border-white/20 px-5 py-3 text-sm text-white/75 transition-colors hover:border-[#c5a059] hover:text-[#c5a059]">Swingers</Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-5 border-t border-white/[0.08] px-6 py-10 text-xs text-white/38 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <span>© 2026 Mansión Deseo · Mayores de 18 años.</span>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Privacidad y redes">
          <a href={ESCORTS_ORIGIN} className="transition-colors hover:text-[#c5a059]">Escorts</a>
          <Link to="/privacidad" className="transition-colors hover:text-[#c5a059]">Privacidad</Link>
          <Link to="/terminos" className="transition-colors hover:text-[#c5a059]">Términos</Link>
          <a href="https://instagram.com/mansiondeseo" className="transition-colors hover:text-[#c5a059]" rel="noreferrer" target="_blank">Instagram</a>
          <a href="https://x.com/mansiondeseo" className="transition-colors hover:text-[#c5a059]" rel="noreferrer" target="_blank">X</a>
        </nav>
      </footer>
    </div>
  );
}
