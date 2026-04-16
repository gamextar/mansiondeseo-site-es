import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Eye, Heart, MapPin, Shield, Users } from 'lucide-react';
import { getFavorites } from '../lib/api';
import { formatLocation } from '../lib/location';
import AvatarImg from '../components/AvatarImg';

const FAVORITE_TABS = [
  { id: 'followers', label: 'Seguidores' },
  { id: 'following', label: 'Siguiendo' },
];

function buildPreview(profile) {
  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    province: profile.province,
    locality: profile.locality,
    role: profile.role,
    avatar_url: profile.avatar_url,
    avatar_crop: profile.avatar_crop || null,
    online: profile.online,
    premium: profile.premium,
    verified: profile.verified,
    photos: [],
  };
}

function FollowCard({ profile, tab }) {
  const location = formatLocation(profile);
  const connectedDate = profile.connected_at
    ? new Date(`${profile.connected_at}Z`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    : '';
  const relationLabel = tab === 'followers'
    ? (profile.mutual_follow ? 'Lo sigues también' : 'Te sigue')
    : (profile.mutual_follow ? 'También te sigue' : 'Lo sigues');

  return (
    <Link
      to={`/perfiles/${profile.id}`}
      state={{ preview: buildPreview(profile) }}
      className="group relative overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,rgba(24,20,29,0.96),rgba(12,12,18,0.92))] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(0,0,0,0.28)] lg:p-5"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_70%)]" />
      <div className="pointer-events-none absolute -right-10 top-4 h-28 w-28 rounded-full bg-mansion-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-2 h-24 w-24 rounded-full bg-mansion-crimson/10 blur-3xl" />

      <div className="relative flex items-center gap-4 lg:gap-5">
        <div className="relative shrink-0">
          <div className="h-24 w-24 overflow-hidden rounded-[1.6rem] bg-mansion-elevated shadow-[0_16px_36px_rgba(0,0,0,0.22)] ring-1 ring-white/8 lg:h-28 lg:w-28 lg:rounded-[1.8rem]">
            {profile.avatar_url ? (
              <AvatarImg src={profile.avatar_url} crop={profile.avatar_crop} alt={profile.name} className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-dim">
                <Users className="h-7 w-7" />
              </div>
            )}
          </div>
          {profile.online && (
            <span className="absolute -bottom-1 -right-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-400 px-1.5 text-[9px] font-bold text-black shadow-[0_0_20px_rgba(74,222,128,0.35)]">
              ON
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h3 className="truncate font-display text-[1.15rem] font-semibold text-text-primary transition-colors group-hover:text-mansion-gold lg:text-[1.28rem]">
                  {profile.name}
                </h3>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-text-dim">
                  {profile.age}
                </span>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-text-dim/85">{profile.role}</p>
            </div>
            <div className="flex items-center gap-2">
              {profile.verified && <Shield className="h-4 w-4 text-emerald-400" />}
              {profile.premium && <Crown className="h-4 w-4 text-mansion-gold" />}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mansion-crimson/12 px-3 py-1.5 font-medium text-mansion-crimson">
              <Heart className="h-3.5 w-3.5" fill="currentColor" />
              <span className="tabular-nums">{Number(profile.followers_total || 0).toLocaleString('es-AR')}</span>
              <span className="text-mansion-crimson/80">seguidores</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mansion-gold/12 px-3 py-1.5 font-medium text-mansion-gold">
              <Eye className="h-3.5 w-3.5" />
              <span className="tabular-nums">{Number(profile.visits_total || 0).toLocaleString('es-AR')}</span>
              <span className="text-mansion-gold/75">visitas</span>
            </span>
            {location && (
              <span className="inline-flex items-center gap-1.5 text-text-dim/90">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em]">
            <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-text-dim">
              {relationLabel}
            </span>
            {connectedDate && (
              <span className="text-text-dim/70">desde {connectedDate}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function FavoritesPage() {
  const [tab, setTab] = useState('followers');
  const [profiles, setProfiles] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getFavorites(tab, 200)
      .then((data) => {
        if (cancelled) return;
        setProfiles(data?.profiles || []);
        setFollowersCount(Number(data?.followersCount || 0));
        setFollowingCount(Number(data?.followingCount || 0));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'No pudimos cargar esta sección');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const title = tab === 'followers' ? 'Tus seguidores' : 'A quién sigues';
  const subtitle = tab === 'followers'
    ? 'Perfiles que te marcaron con corazón y ya forman parte de tu órbita.'
    : 'Tus favoritos guardados para volver a verlos rápido.';

  return (
    <div className="min-h-screen bg-mansion-base px-3 pb-28 pt-20 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2.2rem] bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(139,21,56,0.22),transparent_28%),linear-gradient(180deg,rgba(26,20,30,0.96),rgba(10,10,16,0.96))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] lg:p-8">
          <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-mansion-gold/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_28%,transparent_72%,rgba(255,255,255,0.02))]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-mansion-crimson/12 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-mansion-crimson">
              <Heart className="h-3.5 w-3.5" fill="currentColor" />
              Seguidores
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold text-text-primary lg:text-5xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim lg:text-base">
              {subtitle}
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3.5 py-2 text-xs text-text-dim">
                <Heart className="h-3.5 w-3.5 text-mansion-crimson" fill="currentColor" />
                <span className="tabular-nums">{followersCount.toLocaleString('es-AR')}</span>
                seguidores
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3.5 py-2 text-xs text-text-dim">
                <Users className="h-3.5 w-3.5 text-mansion-gold" />
                <span className="tabular-nums">{followingCount.toLocaleString('es-AR')}</span>
                siguiendo
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {FAVORITE_TABS.map((option) => {
                const active = tab === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTab(option.id)}
                    className={`rounded-full px-4 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'bg-mansion-gold/14 text-mansion-gold shadow-[inset_0_0_0_1px_rgba(201,168,76,0.22)]'
                        : 'bg-black/20 text-text-dim hover:bg-white/[0.04] hover:text-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[1.75rem] border border-mansion-crimson/20 bg-mansion-card/50 p-6 text-sm text-red-300">
            {error}
          </div>
        ) : profiles.length === 0 ? (
          <div className="mt-8 rounded-[2rem] bg-mansion-card/50 p-10 text-center shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
            <Heart className="mx-auto mb-4 h-12 w-12 text-text-dim" />
            <p className="text-sm text-text-dim">
              {tab === 'followers'
                ? 'Todavía no tienes seguidores en esta cuenta.'
                : 'Todavía no sigues a ningún perfil.'}
            </p>
          </div>
        ) : (
          <section className="mt-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-mansion-gold" />
                <h2 className="text-lg font-semibold text-text-primary">{tab === 'followers' ? 'Listado de seguidores' : 'Listado de seguidos'}</h2>
              </div>
              <p className="text-xs text-text-dim">
                <span className="tabular-nums">{profiles.length}</span> perfiles
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              {profiles.map((profile) => (
                <FollowCard key={`${tab}-${profile.id}`} profile={profile} tab={tab} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
