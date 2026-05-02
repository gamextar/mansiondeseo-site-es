import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Crown, Eye, Heart, MapPin, MessageCircle, Sparkles, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { getFavorites, getOwnProfileDashboard, peekOwnProfileDashboard } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { formatLocation } from '../lib/location';
import { formatNumber } from '../lib/siteConfig';
import AvatarImg from '../components/AvatarImg';

const ROLE_PILLS = {
  hombre: { label: 'Hombre', className: 'border-blue-500/40 bg-blue-600/35 text-blue-100' },
  mujer: { label: 'Mujer', className: 'border-pink-500/40 bg-pink-600/35 text-pink-100' },
  pareja: { label: 'Pareja', className: 'border-purple-500/40 bg-purple-600/35 text-purple-100' },
  pareja_hombres: { label: 'Pareja de hombres', className: 'border-sky-500/40 bg-sky-600/35 text-sky-100' },
  pareja_mujeres: { label: 'Pareja de mujeres', className: 'border-fuchsia-500/40 bg-fuchsia-600/35 text-fuchsia-100' },
  trans: { label: 'Trans', className: 'border-teal-500/40 bg-teal-600/35 text-teal-100' },
};

function getProfileName(profile) {
  return profile?.name || profile?.username || 'Perfil';
}

function getRolePill(role) {
  return ROLE_PILLS[role] || (role ? { label: role, className: 'border-white/20 bg-white/10 text-white/80' } : null);
}

function formatVisitAgo(dateStr) {
  if (!dateStr) return '';
  const raw = String(dateStr);
  const date = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return '';
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) return `hace ${seconds || 1} ${seconds === 1 ? 'segundo' : 'segundos'}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

function buildPreview(profile) {
  return {
    id: profile.id,
    name: getProfileName(profile),
    age: profile.age,
    province: profile.province,
    locality: profile.locality,
    role: profile.role,
    avatar_url: profile.avatar_url,
    avatar_thumb_url: profile.avatar_thumb_url || '',
    avatar_crop: profile.avatar_crop || null,
    online: profile.online,
    premium: profile.premium,
    verified: profile.verified,
    photos: [],
  };
}

function buildProfileState(profile, location) {
  const useOverlayNavigation = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const scrollY = typeof window !== 'undefined'
    ? window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    : 0;

  return {
    ...(useOverlayNavigation ? {
      backgroundLocation: location,
      backgroundScrollY: scrollY,
      modal: 'profile',
    } : {}),
    from: `${location.pathname}${location.search}${location.hash}`,
    preview: buildPreview(profile),
  };
}

function ProfileImage({ profile, className = '' }) {
  const profileName = getProfileName(profile);
  const src = profile.avatar_thumb_url || profile.avatar_url;

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-mansion-elevated text-text-dim ${className}`}>
        <Users className="h-7 w-7" />
      </div>
    );
  }

  return (
    <AvatarImg
      src={src}
      crop={profile.avatar_crop}
      alt={profileName}
      className={className}
      imgClassName="h-full w-full object-cover"
    />
  );
}

function MetricIndicator({ icon: Icon, value, label, shortLabel, delay = 0, first = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay }}
      className={`relative min-h-[3.55rem] overflow-hidden px-1.5 py-1.5 sm:min-h-[5.9rem] sm:px-4 sm:py-3.5 lg:min-h-[5.45rem] ${first ? '' : 'border-l border-white/10'}`}
    >
      <div className="flex items-center justify-center gap-1.5 sm:justify-between sm:gap-3">
        <Icon className="h-3 w-3 text-mansion-gold sm:h-4 sm:w-4" />
        <span className="hidden h-1.5 w-1.5 animate-pulse rounded-full bg-mansion-gold/80 shadow-[0_0_16px_rgba(201,168,76,0.55)] sm:block" />
      </div>
      <p className="mt-1 text-center font-display text-[1.2rem] font-semibold leading-none text-text-primary tabular-nums sm:mt-3 sm:text-left sm:text-[2.1rem] lg:text-[2rem]">
        {formatNumber(value)}
      </p>
      <p className="mt-0.5 text-center text-[8px] font-semibold uppercase leading-tight tracking-[0.1em] text-text-dim sm:mt-1.5 sm:text-left sm:text-[10px] sm:tracking-[0.18em]">
        <span className="sm:hidden">{shortLabel || label}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.62, delay: delay + 0.08, ease: 'easeOut' }}
        className="absolute bottom-0 left-0 h-px w-full origin-left bg-gradient-to-r from-mansion-gold via-mansion-gold/30 to-transparent"
      />
    </motion.div>
  );
}

function SectionIntro({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-mansion-gold/80">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-text-primary">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function VisitorCard({ profile, caption, index = 0, compact = false }) {
  const location = useLocation();
  const locationText = formatLocation(profile);
  const profileName = getProfileName(profile);
  const rolePill = getRolePill(profile.role);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.035, 0.22) }}
      className="min-w-0"
    >
      <Link
        to={`/perfiles/${profile.id}`}
        state={buildProfileState(profile, location)}
        className="group block min-w-0"
      >
        <div className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-mansion-card shadow-[0_8px_18px_rgba(0,0,0,0.2)] ring-1 ring-white/5 transition duration-300 group-hover:-translate-y-1 group-hover:ring-mansion-gold/35 lg:rounded-xl lg:shadow-[0_10px_22px_rgba(0,0,0,0.22)] ${compact ? 'lg:aspect-[4/5]' : ''}`}>
          <ProfileImage profile={profile} className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="absolute left-2 right-2 top-2 z-20 flex items-start justify-between gap-2 sm:left-3 sm:right-3 sm:top-3">
            <div className="flex min-w-0 flex-wrap gap-1.5 pr-3">
              {profile.premium && (
                <span className="inline-flex items-center gap-1 rounded-full border border-mansion-gold/30 bg-mansion-gold/20 px-1.5 py-0.5 text-[9px] font-semibold text-mansion-gold backdrop-blur-sm sm:px-2 sm:text-[10px]">
                  <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  VIP
                </span>
              )}
              {profile.verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200 backdrop-blur-sm sm:px-2 sm:text-[10px]">
                  <BadgeCheck className="h-2.5 w-2.5 text-emerald-300 sm:h-3 sm:w-3" />
                  Verificado
                </span>
              )}
            </div>
            {profile.online && (
              <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-black/40 bg-green-400 shadow-lg shadow-green-400/30 sm:h-3 sm:w-3" />
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 p-3 lg:p-2.5">
            <h3 className="truncate font-display text-lg font-semibold leading-tight text-white lg:text-base">
              {profileName}
              {profile.age ? <span className="ml-1 font-body text-sm text-text-muted">{profile.age}</span> : null}
            </h3>
            {rolePill && (
              <span className={`mt-1 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm lg:text-[9px] ${rolePill.className}`}>
                {rolePill.label}
              </span>
            )}
            {locationText && (
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-text-muted lg:text-[11px]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{locationText}</span>
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 flex min-h-[1.75rem] items-center justify-center gap-1 text-center text-[11px] leading-4 text-text-muted sm:text-[13px] sm:leading-5 lg:text-xs">
          <Eye className="h-3.5 w-3.5 shrink-0 text-mansion-gold/70" />
          {caption}
        </p>
      </Link>
    </motion.div>
  );
}

function FavoriteCard({ profile, caption, index = 0 }) {
  const location = useLocation();
  const locationText = formatLocation(profile);
  const profileName = getProfileName(profile);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.03, 0.18) }}
    >
      <Link
        to={`/perfiles/${profile.id}`}
        state={buildProfileState(profile, location)}
        className="group grid min-h-[6.75rem] grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-3 transition duration-300 hover:border-mansion-gold/35 hover:bg-mansion-gold/[0.055]"
      >
        <div className="relative h-[4.75rem] w-[4.75rem] overflow-hidden rounded-lg bg-mansion-card">
          <ProfileImage profile={profile} className="h-full w-full" />
          {profile.online && (
            <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full border border-black bg-emerald-400" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-text-primary">{profileName}</p>
            {profile.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}
            {profile.premium && <Crown className="h-3.5 w-3.5 shrink-0 text-mansion-gold" />}
          </div>
          {locationText && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-text-dim">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{locationText}</span>
            </p>
          )}
          <p className="mt-2 truncate text-[12px] text-mansion-gold/80">{caption}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-text-dim transition group-hover:translate-x-0.5 group-hover:text-mansion-gold" />
      </Link>
    </motion.div>
  );
}

function LoadingPanel({ minHeight = '18rem' }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.025]" style={{ minHeight }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold" />
    </div>
  );
}

function EmptyPanel({ children, minHeight = '12rem' }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.018] px-6 text-center text-sm leading-6 text-text-dim" style={{ minHeight }}>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const [dashboard, setDashboard] = useState(() => peekOwnProfileDashboard() || null);
  const [followingProfiles, setFollowingProfiles] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(!dashboard);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    setLoading(!dashboard);

    Promise.all([
      getOwnProfileDashboard(),
      getFavorites('following', 9),
    ])
      .then(([dashboardData, followingData]) => {
        if (cancelled) return;
        setDashboard(dashboardData || null);
        setFollowingProfiles((followingData?.profiles || []).slice(0, 9));
        setFollowersCount(Number(followingData?.followersCount ?? dashboardData?.user?.followers_total ?? 0));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'No pudimos cargar tu inicio');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dashboardUser = dashboard?.user || user || {};
  const visitors = useMemo(() => (dashboard?.visitors || []).slice(0, 4), [dashboard?.visitors]);
  const visitsTotal = Number(dashboardUser?.visits_total || visitors.length || 0);
  const likesTotal = Number(followersCount || dashboardUser?.followers_total || 0);

  return (
    <div className="min-h-mobile-browser-screen bg-black pb-mobile-legacy-nav pt-0 text-text-primary lg:pb-16 lg:pt-12">
      <div
        className="flex min-h-[48px] items-center px-0 pr-3 pb-0.5 lg:hidden"
        style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}
      >
        <Link
          to="/inicio"
          className="relative -top-[5px] inline-flex items-center gap-2 rounded-full bg-black/28 px-2.5 py-1.5 backdrop-blur-md"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark">
            <span className="font-display text-xs font-bold text-white">M</span>
          </div>
          <span
            className="font-display text-[15px] font-semibold text-gradient-gold"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}
          >
            Mansion Deseo
          </span>
        </Link>
      </div>
      <main className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className="pb-3 lg:pb-6"
        >
          <div className="hidden items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-mansion-gold lg:flex">
            <Sparkles className="h-3.5 w-3.5" />
            Inicio
          </div>
          <div className="grid gap-3 lg:mt-5">
            <div>
              <h1 className="font-display text-[1.9rem] font-semibold leading-[1.03] text-text-primary sm:text-6xl">
                Bienvenido a la Mansión..
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted lg:mt-4">
                Tu actividad reciente, señales importantes y perfiles guardados en un solo lugar.
              </p>
            </div>
          </div>
        </motion.header>

        <section className="grid grid-cols-3 border-y border-white/10">
          <MetricIndicator icon={MessageCircle} value={unreadCount} label="mensajes nuevos" shortLabel="mensajes" first delay={0.04} />
          <MetricIndicator icon={Eye} value={visitsTotal} label="visitas a tu perfil" shortLabel="visitas" delay={0.1} />
          <MetricIndicator icon={Heart} value={likesTotal} label="likes" delay={0.16} />
        </section>

        {error && (
          <div className="mt-7 rounded-lg border border-mansion-crimson/25 bg-mansion-crimson/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="mt-7 lg:mt-10">
          <SectionIntro
            eyebrow="Actividad reciente"
            title="Últimas visitas"
            subtitle="Los últimos perfiles que pasaron por tu espacio, ordenados por visita reciente."
            action={(
              <span className="inline-flex w-fit items-center rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-dim">
                {formatNumber(visitors.length)} de 4
              </span>
            )}
          />

          {loading && visitors.length === 0 ? (
            <LoadingPanel minHeight="22rem" />
          ) : visitors.length === 0 ? (
            <EmptyPanel minHeight="18rem">Todavía no hay visitas recientes.</EmptyPanel>
          ) : (
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6 lg:max-w-[64rem] lg:gap-x-4 xl:max-w-[68rem]">
              {visitors.map((visitor, index) => {
                const ago = formatVisitAgo(visitor.visited_at);
                return (
                  <VisitorCard
                    key={`visit-${visitor.id}`}
                    profile={visitor}
                    index={index}
                    compact
                    caption={ago ? `Te visitó ${ago}` : 'Te visitó recientemente'}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-14">
          <SectionIntro
            eyebrow="Guardados"
            title="Favoritos"
            subtitle="Usuarios que seguís para retomar conversaciones, mirar novedades o volver a encontrarlos rápido."
            action={(
              <Link
                to="/favoritos"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-mansion-gold/25 px-4 py-2 text-xs font-semibold text-mansion-gold transition hover:border-mansion-gold/55 hover:bg-mansion-gold/10"
              >
                Ver todos
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          />

          {loading && followingProfiles.length === 0 ? (
            <LoadingPanel minHeight="15rem" />
          ) : followingProfiles.length === 0 ? (
            <EmptyPanel>Todavía no seguís a ningún perfil.</EmptyPanel>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {followingProfiles.map((profile, index) => (
                <FavoriteCard
                  key={`favorite-${profile.id}`}
                  profile={profile}
                  index={index}
                  caption={profile.mutual_follow ? 'También te dio Me gusta' : 'Le diste Me gusta'}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
