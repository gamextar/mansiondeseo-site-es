import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Crown, Eye, MapPin, Shield, Trophy } from 'lucide-react';
import { getTopVisitedProfiles, peekTopVisitedProfiles } from '../lib/api';
import { formatLocation } from '../lib/location';
import AvatarImg from '../components/AvatarImg';
import { isSafariDesktopBrowser } from '../lib/browser';

const RANKING_FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: 'mujeres', label: 'Mujeres' },
  { id: 'hombres', label: 'Hombres' },
  { id: 'parejas', label: 'Parejas' },
];

function rankAccent(rank) {
  if (rank === 1) return 'bg-[#5a4728] text-mansion-gold';
  if (rank === 2) return 'bg-[#3b352d] text-[#d6d1c8]';
  if (rank === 3) return 'bg-[#4b3424] text-[#d8a56c]';
  return 'bg-[#221c17] text-text-dim';
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
    avatar_crop: profile.avatar_crop || null,
    online: profile.online,
    premium: profile.premium,
    verified: profile.verified,
    photos: [],
  };
}

function RankCard({ profile, compact = false, safariDesktop = false, imageLoading = 'lazy' }) {
  const routerLocation = useLocation();
  const location = formatLocation(profile);
  const useOverlayNavigation = typeof window !== 'undefined' && window.innerWidth >= 1024;

  return (
    <Link
      to={`/perfiles/${profile.id}`}
      state={{
        ...(useOverlayNavigation ? {
          backgroundLocation: routerLocation,
          backgroundScrollY: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
          modal: 'profile',
        } : {}),
        from: `${routerLocation.pathname}${routerLocation.search}${routerLocation.hash}`,
        preview: buildPreview(profile),
      }}
      className={`group rounded-[2rem] border border-[#352d25] bg-[linear-gradient(180deg,rgba(24,20,18,0.96),rgba(14,12,12,0.96))] shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition-all ${safariDesktop ? '' : 'duration-300 hover:-translate-y-1 hover:border-[#5a4a33] hover:bg-[linear-gradient(180deg,rgba(28,24,21,0.98),rgba(16,14,14,0.98))]'} ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className={`${compact ? 'h-20 w-20 rounded-[1.4rem]' : 'h-28 w-28 rounded-[2rem]'} overflow-hidden bg-mansion-elevated shadow-[0_12px_24px_rgba(0,0,0,0.18)] ring-1 ring-[#2b241d]`}>
            {profile.avatar_url ? (
              <AvatarImg
                src={profile.avatar_url}
                crop={profile.avatar_crop}
                alt={profile.name}
                className="h-full w-full"
                loading={imageLoading}
                decoding="async"
                fetchPriority={imageLoading === 'eager' ? 'high' : 'auto'}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-dim">
                <Trophy className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className={`absolute -left-2 -top-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold ${rankAccent(profile.rank)}`}>
            #{profile.rank}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`${compact ? 'text-base' : 'text-[1.15rem]'} truncate font-semibold text-text-primary group-hover:text-white transition-colors`}>
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

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b241d] px-3 py-1.5 font-medium text-text-primary">
              <Eye className="h-3.5 w-3.5" />
              <span className="tabular-nums">{Number(profile.visits_total || 0).toLocaleString('es-AR')}</span>
              <span className="text-text-dim">visitas</span>
            </span>
            {location && (
              <span className="inline-flex items-center gap-1.5 text-text-dim/85">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            )}
            {profile.online && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                Online
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TopVisitedPage() {
  const safariDesktop = isSafariDesktopBrowser();
  const [profiles, setProfiles] = useState(() => peekTopVisitedProfiles(100, 'all')?.profiles || []);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(() => profiles.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [visibleRestCount, setVisibleRestCount] = useState(18);

  useEffect(() => {
    let cancelled = false;
    const cached = peekTopVisitedProfiles(100, filter);
    if (cached?.profiles?.length) {
      setProfiles(cached.profiles);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
      setRefreshing(false);
    }
    setError('');

    getTopVisitedProfiles(100, filter)
      .then((data) => {
        if (cancelled) return;
        setProfiles(data?.profiles || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'No pudimos cargar el ranking');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const podium = profiles.slice(0, 3);
  const rest = profiles.slice(3);
  const renderedRest = rest.slice(0, visibleRestCount);

  useEffect(() => {
    if (rest.length <= 18) {
      setVisibleRestCount(rest.length);
      return undefined;
    }

    let rafId = null;
    let nextCount = 18;
    setVisibleRestCount(18);

    const step = () => {
      nextCount = Math.min(rest.length, nextCount + 18);
      setVisibleRestCount(nextCount);
      if (nextCount < rest.length) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [rest.length]);

  return (
    <div className="min-h-mobile-browser-screen bg-mansion-base px-3 pb-mobile-legacy-nav pt-[calc(var(--safe-top)+80px)] lg:px-8 lg:pb-10 lg:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-[#352d25] bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.1),transparent_28%),linear-gradient(180deg,rgba(20,18,18,0.98),rgba(10,10,12,0.98))] p-6 shadow-[0_26px_70px_rgba(0,0,0,0.22)] lg:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(201,168,76,0.06),transparent)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#2f271f] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-mansion-gold">
              <Trophy className="h-3.5 w-3.5" />
              Ranking
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold text-text-primary lg:text-5xl">
              Top 100 perfiles más visitados
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim lg:text-base">
              Un ranking vivo de los perfiles que más atención generan en Mansión Deseo. Ideal para descubrir quién está marcando el ritmo del sitio.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b241d] px-3.5 py-2 text-xs text-text-dim">
                <Eye className="h-3.5 w-3.5 text-mansion-gold" />
                Top {profiles.length || 100} perfiles
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b241d] px-3.5 py-2 text-xs text-text-dim">
                <Crown className="h-3.5 w-3.5 text-mansion-gold" />
                tráfico real del sitio
              </span>
              {refreshing && (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#2b241d] px-3.5 py-2 text-xs text-text-dim">
                  <span className="h-3 w-3 rounded-full border border-mansion-gold/25 border-t-mansion-gold animate-spin" />
                  actualizando ranking
                </span>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {RANKING_FILTERS.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
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
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[2rem] border border-[#352d25] bg-[linear-gradient(180deg,rgba(24,20,18,0.96),rgba(14,12,12,0.96))] p-5"
              >
                <div className="animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="h-24 w-24 rounded-[1.6rem] bg-mansion-elevated/80" />
                    <div className="min-w-0 flex-1">
                      <div className="h-5 w-36 rounded-full bg-mansion-elevated/80" />
                      <div className="mt-3 h-3 w-24 rounded-full bg-mansion-elevated/70" />
                      <div className="mt-4 h-8 w-full rounded-2xl bg-mansion-elevated/60" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[1.75rem] border border-mansion-crimson/20 bg-mansion-card/50 p-6 text-sm text-red-300">
            {error}
          </div>
        ) : (
          <>
            {podium.length > 0 && (
              <section className="mt-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-mansion-gold" />
                    <h2 className="text-lg font-semibold text-text-primary">Podio</h2>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-dim">Los más vistos ahora</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {podium.map((profile) => (
                    <RankCard key={profile.id} profile={profile} safariDesktop={safariDesktop} imageLoading="eager" />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-mansion-gold" />
                  <h2 className="text-lg font-semibold text-text-primary">Listado completo</h2>
                </div>
                <p className="text-xs text-text-dim">
                  <span className="tabular-nums">{profiles.length}</span> perfiles
                </p>
              </div>
              <div className="grid gap-4">
                {renderedRest.map((profile) => (
                  <RankCard key={profile.id} profile={profile} compact safariDesktop={safariDesktop} imageLoading="lazy" />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
