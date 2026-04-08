import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Eye, Flame, MapPin, Shield, Sparkles, Trophy } from 'lucide-react';
import { getTopVisitedProfiles } from '../lib/api';
import { formatLocation } from '../lib/location';
import AvatarImg from '../components/AvatarImg';

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

function formatVisits(visits) {
  return Number(visits || 0).toLocaleString('es-AR');
}

function rankPalette(rank) {
  if (rank === 1) {
    return {
      line: 'from-[#f7e1b2] via-mansion-gold to-[#7c5a12]',
      badge: 'border-mansion-gold/35 bg-[#1f1809]/85 text-[#f7e1b2]',
      halo: 'bg-mansion-gold/18',
    };
  }
  if (rank === 2) {
    return {
      line: 'from-slate-100 via-slate-400 to-slate-700',
      badge: 'border-slate-300/30 bg-slate-900/70 text-slate-200',
      halo: 'bg-slate-300/10',
    };
  }
  if (rank === 3) {
    return {
      line: 'from-amber-200 via-orange-400 to-amber-900',
      badge: 'border-orange-300/30 bg-[#22140d]/80 text-amber-200',
      halo: 'bg-orange-400/12',
    };
  }
  return {
    line: 'from-mansion-border/50 via-mansion-border/20 to-transparent',
    badge: 'border-mansion-border/20 bg-black/35 text-text-dim',
    halo: 'bg-mansion-gold/8',
  };
}

function FeaturedRankCard({ profile, align = 'center' }) {
  const palette = rankPalette(profile.rank);
  const location = formatLocation(profile);
  const featured = profile.rank === 1;
  const titleSize = featured ? 'text-2xl lg:text-[2rem]' : 'text-xl lg:text-2xl';
  const containerClass = featured
    ? 'lg:col-span-2 lg:min-h-[26rem]'
    : 'lg:min-h-[26rem]';
  const alignClass = align === 'right' ? 'lg:text-right' : align === 'left' ? 'lg:text-left' : 'lg:text-center';

  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94], delay: profile.rank * 0.04 }}
      className={containerClass}
    >
      <Link
        to={`/perfiles/${profile.id}`}
        state={{ preview: buildPreview(profile) }}
        className={`group relative flex h-full overflow-hidden rounded-[2rem] border border-mansion-border/25 bg-[linear-gradient(180deg,rgba(22,18,28,0.96),rgba(10,10,16,0.96))] p-5 shadow-elevated transition-all hover:-translate-y-1 hover:border-mansion-gold/30 ${featured ? 'lg:p-7' : 'lg:p-6'}`}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${palette.line}`} />
        <div className={`pointer-events-none absolute -right-10 top-4 h-32 w-32 rounded-full blur-3xl ${palette.halo}`} />
        <div className="pointer-events-none absolute left-8 top-8 h-24 w-24 rounded-full bg-mansion-crimson/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_24%),linear-gradient(145deg,transparent_55%,rgba(255,255,255,0.04)_100%)]" />

        <div className={`relative flex w-full flex-col ${featured ? 'justify-between' : ''}`}>
          <div className={`flex ${featured ? 'flex-col gap-5 lg:flex-row lg:items-end lg:justify-between' : 'flex-col gap-5'} ${alignClass}`}>
            <div className={`flex ${featured ? 'flex-col gap-4 lg:max-w-[60%]' : 'flex-col gap-4'} ${align === 'center' ? 'items-start lg:items-center' : align === 'right' ? 'items-start lg:items-end' : 'items-start'}`}>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] ${palette.badge}`}>
                <Trophy className="h-3.5 w-3.5" />
                Puesto #{profile.rank}
              </span>

              <div>
                <h2 className={`${titleSize} font-display font-bold text-text-primary transition-colors group-hover:text-mansion-gold`}>
                  {profile.name}
                </h2>
                <p className="mt-1 text-sm text-text-dim">
                  {profile.role} · {profile.age} años
                </p>
              </div>

              <div className={`flex flex-wrap gap-2 ${align === 'center' ? 'lg:justify-center' : align === 'right' ? 'lg:justify-end' : ''}`}>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-gold/20 bg-mansion-gold/10 px-3 py-1.5 text-xs font-medium text-mansion-gold">
                  <Eye className="h-3.5 w-3.5" />
                  {formatVisits(profile.visits_total)} visitas
                </span>
                {profile.online && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    Online
                  </span>
                )}
              </div>
            </div>

            <div className={`relative ${featured ? 'mx-auto lg:mx-0' : 'mx-auto'} shrink-0`}>
              <div className={`absolute inset-0 rounded-[2rem] blur-2xl ${palette.halo}`} />
              <div className={`relative overflow-hidden border border-white/10 bg-mansion-elevated ${featured ? 'h-56 w-44 lg:h-72 lg:w-56 rounded-[2rem]' : 'h-52 w-40 rounded-[1.8rem]'}`}>
                {profile.avatar_url ? (
                  <AvatarImg src={profile.avatar_url} crop={profile.avatar_crop} alt={profile.name} className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-dim">
                    <Trophy className="h-8 w-8" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/18 to-transparent" />
                <div className="pointer-events-none absolute left-4 top-4 h-10 w-10 rounded-tl-[18px] border-l border-t border-white/20" />
                <div className="pointer-events-none absolute bottom-4 right-4 h-10 w-10 rounded-br-[18px] border-b border-r border-white/14" />
                <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-1.5">
                  {profile.verified && <Shield className="h-4 w-4 text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.35)]" />}
                  {profile.premium && <Crown className="h-4 w-4 text-mansion-gold drop-shadow-[0_0_10px_rgba(201,168,76,0.35)]" />}
                </div>
              </div>
            </div>
          </div>

          <div className={`mt-5 flex flex-wrap items-center gap-3 text-xs ${align === 'center' ? 'lg:justify-center' : align === 'right' ? 'lg:justify-end' : ''}`}>
            {location && (
              <span className="inline-flex items-center gap-1.5 text-text-dim">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-text-dim">
              <Sparkles className="h-3.5 w-3.5 text-mansion-gold" />
              Perfil destacado por tráfico real
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function RankingRow({ profile, index }) {
  const palette = rankPalette(profile.rank);
  const location = formatLocation(profile);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.015, 0.28) }}
    >
      <Link
        to={`/perfiles/${profile.id}`}
        state={{ preview: buildPreview(profile) }}
        className="group relative flex items-center gap-3 overflow-hidden rounded-[1.6rem] border border-mansion-border/20 bg-mansion-card/55 px-4 py-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-mansion-gold/25 hover:bg-mansion-card/75 lg:px-5"
      >
        <div className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${palette.line}`} />

        <div className={`flex h-11 min-w-11 items-center justify-center rounded-2xl border text-sm font-bold ${palette.badge}`}>
          {profile.rank}
        </div>

        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[1.15rem] border border-white/10 bg-mansion-elevated">
          {profile.avatar_url ? (
            <AvatarImg src={profile.avatar_url} crop={profile.avatar_crop} alt={profile.name} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-dim">
              <Trophy className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-display text-base font-semibold text-text-primary transition-colors group-hover:text-mansion-gold">
                  {profile.name}
                </h3>
                <span className="text-sm text-text-dim">{profile.age}</span>
              </div>
              <p className="mt-0.5 text-xs text-text-dim">
                {profile.role}
                {location ? ` · ${location}` : ''}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              {profile.verified && <Shield className="h-4 w-4 text-green-400" />}
              {profile.premium && <Crown className="h-4 w-4 text-mansion-gold" />}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mansion-gold/18 bg-mansion-gold/8 px-2.5 py-1 text-mansion-gold">
              <Eye className="h-3.5 w-3.5" />
              {formatVisits(profile.visits_total)}
            </span>
            {profile.online && (
              <span className="inline-flex items-center gap-1.5 text-green-300">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                Online
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
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
  const [leader] = podium;
  const podiumRest = podium.slice(1);
  const rest = profiles.slice(3);

  return (
    <div className="min-h-screen bg-mansion-base px-4 pb-28 pt-20 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-[2.3rem] border border-mansion-border/25 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.22),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(122,20,49,0.22),transparent_26%),linear-gradient(180deg,rgba(22,18,28,0.97),rgba(8,8,14,0.96))] px-6 py-7 shadow-elevated lg:px-10 lg:py-10"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.02),transparent_24%,transparent_72%,rgba(255,255,255,0.02))]" />
          <div className="pointer-events-none absolute -right-20 top-0 h-52 w-52 rounded-full bg-mansion-gold/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-44 w-44 rounded-full bg-mansion-crimson/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,24rem)] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-mansion-gold/20 bg-mansion-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-mansion-gold">
                <Trophy className="h-3.5 w-3.5" />
                Ranking Oficial
              </div>

              <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-[0.95] text-text-primary lg:text-6xl">
                Los perfiles
                <span className="block text-gradient-gold">que más miradas atraen</span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-dim lg:text-base">
                Una vitrina editorial con el top 100 de perfiles más visitados en Mansión Deseo. El ranking se alimenta del tráfico real del sitio y te muestra quién está en el centro de la atención.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border border-mansion-gold/20 bg-black/20 px-4 py-4 backdrop-blur-xl">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-mansion-gold">
                  <Flame className="h-3.5 w-3.5" />
                  Radar
                </div>
                <p className="mt-2 text-2xl font-display font-bold text-text-primary">{profiles.length}</p>
                <p className="mt-1 text-xs text-text-dim">perfiles medidos en el top actual</p>
              </div>

              <div className="rounded-[1.5rem] border border-mansion-border/25 bg-black/20 px-4 py-4 backdrop-blur-xl">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-mansion-gold">
                  <Eye className="h-3.5 w-3.5" />
                  Lidera
                </div>
                <p className="mt-2 truncate text-lg font-display font-bold text-text-primary">
                  {leader?.name || 'Sin datos'}
                </p>
                <p className="mt-1 text-xs text-text-dim">
                  {leader ? `${formatVisits(leader.visits_total)} visitas` : 'Esperando actividad'}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-mansion-border/25 bg-black/20 px-4 py-4 backdrop-blur-xl">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-mansion-gold">
                  <Sparkles className="h-3.5 w-3.5" />
                  Señal
                </div>
                <p className="mt-2 text-sm font-semibold text-text-primary">Tráfico real</p>
                <p className="mt-1 text-xs text-text-dim">ideal para detectar perfiles con mayor arrastre orgánico</p>
              </div>
            </div>
          </div>
        </motion.section>

        {loading ? (
          <div className="flex min-h-[42vh] items-center justify-center">
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
                <div className="mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-mansion-gold" />
                  <h2 className="text-lg font-semibold text-text-primary">Podio de la semana</h2>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {leader ? <FeaturedRankCard profile={leader} align="left" /> : null}
                  <div className="grid gap-4">
                    {podiumRest.map((profile, index) => (
                      <FeaturedRankCard key={profile.id} profile={profile} align={index === 0 ? 'right' : 'center'} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section className="mt-8 rounded-[2rem] border border-mansion-border/20 bg-[linear-gradient(180deg,rgba(18,16,24,0.95),rgba(10,10,16,0.92))] p-4 shadow-elevated lg:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-mansion-gold">
                    <Eye className="h-3.5 w-3.5" />
                    Ranking Completo
                  </div>
                  <h2 className="mt-1 text-xl font-display font-semibold text-text-primary">Top 100 de perfiles más visitados</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-mansion-border/20 bg-black/20 px-3 py-1.5 text-xs text-text-dim">
                  <span className="h-2 w-2 rounded-full bg-mansion-gold" />
                  {profiles.length} perfiles visibles
                </div>
              </div>

              <div className="grid gap-3">
                {rest.map((profile, index) => (
                  <RankingRow key={profile.id} profile={profile} index={index} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
