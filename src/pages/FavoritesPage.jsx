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
      className="group relative overflow-hidden rounded-[1.75rem] border border-mansion-border/25 bg-mansion-card/60 p-5 shadow-[0_20px_40px_rgba(4,4,8,0.18)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-mansion-gold/30 hover:bg-mansion-card/80"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-mansion-crimson/60 via-mansion-gold/70 to-mansion-gold/25" />
      <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-mansion-gold/8 blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_30%,transparent_70%,rgba(255,255,255,0.02))]" />

      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="h-20 w-20 overflow-hidden rounded-[1.35rem] border border-white/10 bg-mansion-elevated shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
            {profile.avatar_url ? (
              <AvatarImg src={profile.avatar_url} crop={profile.avatar_crop} alt={profile.name} className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-dim">
                <Users className="h-6 w-6" />
              </div>
            )}
          </div>
          {profile.online && (
            <span className="absolute -bottom-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-green-400/30 bg-black/75 px-1 text-[9px] font-semibold text-green-400">
              ON
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-display text-lg font-semibold text-text-primary transition-colors group-hover:text-mansion-gold">
                  {profile.name}
                </h3>
                <span className="text-sm tabular-nums text-text-dim">{profile.age}</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-dim/90">{profile.role}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {profile.verified && <Shield className="h-4 w-4 text-green-400" />}
              {profile.premium && <Crown className="h-4 w-4 text-mansion-gold" />}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-crimson/20 bg-mansion-crimson/10 px-2.5 py-1 font-medium text-mansion-crimson">
              <Heart className="h-3.5 w-3.5" fill="currentColor" />
              <span className="tabular-nums">{Number(profile.followers_total || 0).toLocaleString('es-AR')}</span>
              <span className="text-mansion-crimson/85">seguidores</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-gold/20 bg-mansion-gold/10 px-2.5 py-1 font-medium text-mansion-gold">
              <Eye className="h-3.5 w-3.5" />
              <span className="tabular-nums">{Number(profile.visits_total || 0).toLocaleString('es-AR')}</span>
              <span className="text-mansion-gold/80">visitas</span>
            </span>
            {location && (
              <span className="inline-flex items-center gap-1.5 text-text-dim">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
            <span className="rounded-full border border-mansion-border/20 bg-black/20 px-2.5 py-1 text-text-dim">
              {relationLabel}
            </span>
            {connectedDate && (
              <span className="text-text-dim/80">desde {connectedDate}</span>
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
    <div className="min-h-screen bg-mansion-base px-2 pb-28 pt-20 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-mansion-border/25 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.14),transparent_34%),linear-gradient(180deg,rgba(24,20,29,0.94),rgba(10,10,16,0.92))] p-6 shadow-elevated lg:p-8">
          <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-mansion-gold/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_28%,transparent_72%,rgba(255,255,255,0.02))]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-mansion-crimson/18 bg-mansion-crimson/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-mansion-crimson">
              <Heart className="h-3.5 w-3.5" fill="currentColor" />
              Seguidores
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold text-text-primary lg:text-5xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim lg:text-base">
              {subtitle}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-crimson/18 bg-black/20 px-3 py-1.5 text-xs text-text-dim">
                <Heart className="h-3.5 w-3.5 text-mansion-crimson" fill="currentColor" />
                <span className="tabular-nums">{followersCount.toLocaleString('es-AR')}</span>
                seguidores
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-gold/18 bg-black/20 px-3 py-1.5 text-xs text-text-dim">
                <Users className="h-3.5 w-3.5 text-mansion-gold" />
                <span className="tabular-nums">{followingCount.toLocaleString('es-AR')}</span>
                siguiendo
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {FAVORITE_TABS.map((option) => {
                const active = tab === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTab(option.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? 'border-mansion-gold/30 bg-mansion-gold/12 text-mansion-gold'
                        : 'border-mansion-border/20 bg-black/20 text-text-dim hover:border-mansion-gold/18 hover:text-text-primary'
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
          <div className="mt-8 rounded-[1.75rem] border border-mansion-border/20 bg-mansion-card/50 p-10 text-center">
            <Heart className="mx-auto mb-4 h-12 w-12 text-text-dim" />
            <p className="text-sm text-text-dim">
              {tab === 'followers'
                ? 'Todavía no tienes seguidores en esta cuenta.'
                : 'Todavía no sigues a ningún perfil.'}
            </p>
          </div>
        ) : (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-mansion-gold" />
                <h2 className="text-lg font-semibold text-text-primary">{tab === 'followers' ? 'Listado de seguidores' : 'Listado de seguidos'}</h2>
              </div>
              <p className="text-xs text-text-dim">
                <span className="tabular-nums">{profiles.length}</span> perfiles
              </p>
            </div>
            <div className="grid gap-3">
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
