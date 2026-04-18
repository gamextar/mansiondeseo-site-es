import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Heart, MapPin, Shield, Users } from 'lucide-react';
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
  const relationLabel = tab === 'followers'
    ? (profile.mutual_follow ? 'Lo sigues también' : 'Te sigue')
    : (profile.mutual_follow ? 'También te sigue' : 'Lo sigues');

  return (
    <Link
      to={`/perfiles/${profile.id}`}
      state={{ preview: buildPreview(profile) }}
      className="group rounded-[2rem] border border-[#3a3127] bg-[linear-gradient(180deg,rgba(24,20,18,0.96),rgba(14,12,12,0.96))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-[#5a4a33] hover:bg-[linear-gradient(180deg,rgba(28,24,21,0.98),rgba(16,14,14,0.98))] focus:outline-none focus-visible:border-[#6b5738] lg:p-5"
    >
      <div className="flex items-center gap-4 lg:gap-5">
        <div className="relative shrink-0">
          <div className="h-40 w-40 overflow-hidden rounded-[2rem] bg-mansion-elevated shadow-[0_16px_32px_rgba(0,0,0,0.2)] ring-1 ring-[#2b241d] lg:h-44 lg:w-44 lg:rounded-[2.35rem]">
            {profile.avatar_url ? (
              <AvatarImg src={profile.avatar_url} crop={profile.avatar_crop} alt={profile.name} className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-dim">
                <Users className="h-8 w-8" />
              </div>
            )}
          </div>
          {profile.online && (
            <span className="absolute bottom-2 right-2 inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.45)]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[1.05rem] font-semibold text-text-primary transition-colors group-hover:text-white lg:text-[1.15rem]">
                  {profile.name}
                </h3>
                <span className="text-sm tabular-nums text-text-dim">{profile.age}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-dim/75">
                <span>{profile.role}</span>
                {profile.verified && <Shield className="h-3.5 w-3.5 text-emerald-400" />}
                {profile.premium && <Crown className="h-3.5 w-3.5 text-mansion-gold" />}
              </div>
            </div>
          </div>

          {location && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-text-dim/85">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{location}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b241d] px-3 py-1.5 font-medium text-text-primary">
              <Heart className="h-3.5 w-3.5" fill="currentColor" />
              <span className="tabular-nums">{Number(profile.followers_total || 0).toLocaleString('es-AR')}</span>
              <span className="text-text-dim">seguidores</span>
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
            <span className="rounded-full bg-[#33291f] px-3 py-1.5 text-mansion-gold">
              {relationLabel}
            </span>
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

    getFavorites(tab, 50)
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
        <div className="relative overflow-hidden rounded-[2.2rem] border border-[#352d25] bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.1),transparent_28%),linear-gradient(180deg,rgba(20,18,18,0.98),rgba(10,10,12,0.98))] p-6 shadow-[0_26px_70px_rgba(0,0,0,0.22)] lg:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(201,168,76,0.06),transparent)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#2f271f] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-mansion-gold">
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b241d] px-3.5 py-2 text-xs text-text-dim">
                <Heart className="h-3.5 w-3.5 text-mansion-gold" fill="currentColor" />
                <span className="tabular-nums">{followersCount.toLocaleString('es-AR')}</span>
                seguidores
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b241d] px-3.5 py-2 text-xs text-text-dim">
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
                        ? 'bg-[#33291f] text-mansion-gold shadow-[inset_0_0_0_1px_rgba(201,168,76,0.18)]'
                        : 'bg-[#221c17] text-text-dim hover:bg-[#2b241d] hover:text-text-primary'
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
