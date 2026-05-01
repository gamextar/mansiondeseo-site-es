import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BadgeCheck, Crown, Eye, Heart, MapPin, MessageCircle, Sparkles, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { getFavorites, getOwnProfileDashboard, peekOwnProfileDashboard } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { formatLocation } from '../lib/location';
import { formatNumber } from '../lib/siteConfig';
import AvatarImg from '../components/AvatarImg';

function getDisplayName(user) {
  return user?.username || user?.name || 'Invitado';
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
    name: profile.name,
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

function ProfileMiniCard({ profile, caption, tone = 'default' }) {
  const location = useLocation();
  const locationText = formatLocation(profile);
  const profileName = profile?.name || profile?.username || 'Perfil';
  const useOverlayNavigation = typeof window !== 'undefined' && window.innerWidth >= 1024;

  return (
    <Link
      to={`/perfiles/${profile.id}`}
      state={{
        ...(useOverlayNavigation ? {
          backgroundLocation: location,
          backgroundScrollY: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
          modal: 'profile',
        } : {}),
        from: `${location.pathname}${location.search}${location.hash}`,
        preview: buildPreview(profile),
      }}
      className="group block min-w-0"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.2rem] border border-white/8 bg-[#111] shadow-[0_18px_44px_rgba(0,0,0,0.22)] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-mansion-gold/30">
        {profile.avatar_url ? (
          <AvatarImg
            src={profile.avatar_thumb_url || profile.avatar_url}
            crop={profile.avatar_crop}
            alt={profileName}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-dim">
            <Users className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 via-black/38 to-transparent p-3">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-white">{profileName}</p>
            {profile.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}
            {profile.premium && <Crown className="h-3.5 w-3.5 shrink-0 text-mansion-gold" />}
          </div>
          {locationText && (
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-white/66">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{locationText}</span>
            </p>
          )}
        </div>
        {profile.online && (
          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.55)]" />
        )}
      </div>
      <p className={`mt-2 min-h-[2rem] text-center text-xs leading-snug ${tone === 'gold' ? 'text-mansion-gold/90' : 'text-text-dim'}`}>
        {caption}
      </p>
    </Link>
  );
}

function StatPill({ icon: Icon, value, label, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay }}
      className="relative overflow-hidden rounded-[1.35rem] border border-white/8 bg-[#101010] px-4 py-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
    >
      <div className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-mansion-gold/80" />
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-mansion-gold/18 bg-mansion-gold/10 text-mansion-gold">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums text-text-primary">{formatNumber(value)}</p>
          <p className="truncate text-xs text-text-dim">{label}</p>
        </div>
      </div>
    </motion.div>
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
      getFavorites('followers', 1),
    ])
      .then(([dashboardData, followingData, followersData]) => {
        if (cancelled) return;
        setDashboard(dashboardData || null);
        setFollowingProfiles((followingData?.profiles || []).slice(0, 9));
        setFollowersCount(Number(followersData?.followersCount ?? dashboardData?.user?.followers_total ?? 0));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'No pudimos cargar tu dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dashboardUser = dashboard?.user || user || {};
  const visitors = useMemo(() => (dashboard?.visitors || []).slice(0, 9), [dashboard?.visitors]);
  const visitsTotal = Number(dashboardUser?.visits_total || visitors.length || 0);
  const likesTotal = Number(followersCount || dashboardUser?.followers_total || 0);

  return (
    <div className="min-h-mobile-browser-screen bg-mansion-base pb-mobile-legacy-nav pt-[calc(var(--safe-top)+72px)] lg:pb-12 lg:pt-16">
      <div className="mx-auto max-w-[92rem] px-[5vw] lg:px-[4vw]">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className="border-b border-white/8 pb-7"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-mansion-gold/18 bg-mansion-gold/8 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-mansion-gold">
            <Sparkles className="h-3.5 w-3.5" />
            Dashboard
          </div>
          <h1 className="mt-5 font-display text-[2rem] font-semibold leading-tight text-text-primary sm:text-5xl">
            Bienvenido a la Mansión "{getDisplayName(dashboardUser)}"!
          </h1>
        </motion.header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatPill icon={MessageCircle} value={unreadCount} label="mensajes nuevos" delay={0.04} />
          <StatPill icon={Eye} value={visitsTotal} label="visitas a tu perfil" delay={0.1} />
          <StatPill icon={Heart} value={likesTotal} label="likes" delay={0.16} />
        </section>

        {error && (
          <div className="mt-6 rounded-[1.25rem] border border-mansion-crimson/20 bg-mansion-card/60 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Últimas visitas</h2>
              <p className="mt-1 text-sm text-text-dim">Los perfiles que pasaron por tu espacio recientemente.</p>
            </div>
            <span className="hidden rounded-full bg-white/5 px-3 py-1.5 text-xs text-text-dim sm:inline-flex">
              {formatNumber(visitors.length)} perfiles
            </span>
          </div>

          {loading && visitors.length === 0 ? (
            <div className="flex min-h-[18rem] items-center justify-center rounded-[1.5rem] border border-white/8 bg-[#0d0d0d]">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold" />
            </div>
          ) : visitors.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/8 bg-[#0d0d0d] p-8 text-center text-sm text-text-dim">
              Todavía no hay visitas recientes.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-9">
              {visitors.map((visitor) => {
                const ago = formatVisitAgo(visitor.visited_at);
                return (
                  <ProfileMiniCard
                    key={`visit-${visitor.id}`}
                    profile={visitor}
                    caption={ago ? `Te visitó ${ago}` : 'Te visitó recientemente'}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Favoritos</h2>
              <p className="mt-1 text-sm text-text-dim">Usuarios que seguís para volver a encontrarlos rápido.</p>
            </div>
            <Link to="/favoritos" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-dim transition hover:border-mansion-gold/35 hover:text-mansion-gold">
              Ver todos
            </Link>
          </div>

          {loading && followingProfiles.length === 0 ? (
            <div className="flex min-h-[14rem] items-center justify-center rounded-[1.5rem] border border-white/8 bg-[#0d0d0d]">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold" />
            </div>
          ) : followingProfiles.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/8 bg-[#0d0d0d] p-8 text-center text-sm text-text-dim">
              Todavía no seguís a ningún perfil.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-9">
              {followingProfiles.map((profile) => (
                <ProfileMiniCard
                  key={`favorite-${profile.id}`}
                  profile={profile}
                  tone="gold"
                  caption={profile.mutual_follow ? 'También te dio Me gusta' : 'Le diste Me gusta'}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
