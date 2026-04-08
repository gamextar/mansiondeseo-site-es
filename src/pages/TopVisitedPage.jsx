import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Eye, MapPin, Shield, Trophy } from 'lucide-react';
import { getTopVisitedProfiles } from '../lib/api';
import { formatLocation } from '../lib/location';
import AvatarImg from '../components/AvatarImg';

function rankAccent(rank) {
  if (rank === 1) return 'from-[#f3ddaa] via-mansion-gold to-[#8c6b1f]';
  if (rank === 2) return 'from-slate-200 via-slate-400 to-slate-600';
  if (rank === 3) return 'from-amber-400 via-orange-500 to-amber-800';
  return 'from-mansion-border/50 via-mansion-border/20 to-transparent';
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

function RankCard({ profile, compact = false }) {
  const location = formatLocation(profile);
  const isPodium = profile.rank <= 3;

  return (
    <Link
      to={`/perfiles/${profile.id}`}
      state={{ preview: buildPreview(profile) }}
      className={`group relative overflow-hidden rounded-[1.75rem] border border-mansion-border/25 bg-mansion-card/60 shadow-[0_20px_40px_rgba(4,4,8,0.18)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-mansion-gold/30 hover:bg-mansion-card/80 ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${rankAccent(profile.rank)}`} />
      <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-mansion-gold/8 blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_30%,transparent_70%,rgba(255,255,255,0.02))]" />
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className={`${compact ? 'h-16 w-16' : 'h-20 w-20'} overflow-hidden rounded-[1.35rem] border border-white/10 bg-mansion-elevated shadow-[0_12px_24px_rgba(0,0,0,0.18)]`}>
            {profile.avatar_url ? (
              <AvatarImg src={profile.avatar_url} crop={profile.avatar_crop} alt={profile.name} className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-dim">
                <Trophy className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className={`absolute -left-2 -top-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-bold ${isPodium ? 'border-mansion-gold/30 bg-black/65 text-mansion-gold' : 'border-mansion-border/30 bg-black/55 text-text-muted'}`}>
            #{profile.rank}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`${compact ? 'text-base' : 'text-lg'} truncate font-display font-semibold text-text-primary group-hover:text-mansion-gold transition-colors`}>
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

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
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
            {profile.online && (
              <span className="inline-flex items-center gap-1.5 text-green-400">
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
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getTopVisitedProfiles(100)
      .then((data) => {
        if (cancelled) return;
        setProfiles(data?.profiles || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'No pudimos cargar el ranking');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const podium = profiles.slice(0, 3);
  const rest = profiles.slice(3);

  return (
    <div className="min-h-screen bg-mansion-base px-4 pb-28 pt-20 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-mansion-border/25 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.18),transparent_34%),linear-gradient(180deg,rgba(24,20,29,0.94),rgba(10,10,16,0.92))] p-6 shadow-elevated lg:p-8">
          <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-mansion-gold/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-mansion-crimson/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_28%,transparent_72%,rgba(255,255,255,0.02))]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-mansion-gold/20 bg-mansion-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-mansion-gold">
              <Trophy className="h-3.5 w-3.5" />
              Ranking
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold text-text-primary lg:text-5xl">
              Top 100 perfiles más visitados
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim lg:text-base">
              Un ranking vivo de los perfiles que más atención generan en Mansión Deseo. Ideal para descubrir quién está marcando el ritmo del sitio.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-gold/18 bg-black/20 px-3 py-1.5 text-xs text-text-dim">
                <Eye className="h-3.5 w-3.5 text-mansion-gold" />
                Top {profiles.length || 100} perfiles
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-border/20 bg-black/20 px-3 py-1.5 text-xs text-text-dim">
                <Crown className="h-3.5 w-3.5 text-mansion-gold" />
                tráfico real del sitio
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-mansion-gold/25 border-t-mansion-gold animate-spin" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[1.75rem] border border-mansion-crimson/20 bg-mansion-card/50 p-6 text-sm text-red-300">
            {error}
          </div>
        ) : (
          <>
            {podium.length > 0 && (
              <section className="mt-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-mansion-gold" />
                  <h2 className="text-lg font-semibold text-text-primary">Podio</h2>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-text-dim">Los más vistos ahora</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {podium.map((profile) => (
                    <RankCard key={profile.id} profile={profile} />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-mansion-gold" />
                  <h2 className="text-lg font-semibold text-text-primary">Listado completo</h2>
                </div>
                <p className="text-xs text-text-dim">
                  <span className="tabular-nums">{profiles.length}</span> perfiles
                </p>
              </div>
              <div className="grid gap-3">
                {rest.map((profile) => (
                  <RankCard key={profile.id} profile={profile} compact />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
