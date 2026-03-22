import { BadgeCheck, HeartHandshake, MessageSquareMore, Sparkles } from 'lucide-react';

export function ProfileDetail({ profile }) {
  return (
    <section className="glass-panel gold-ring rounded-[2rem] p-5 shadow-luxe sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.36em] text-gold/70">Ficha Privada</p>
          <h2 className="mt-3 font-display text-4xl leading-none text-mist">
            {profile.name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/70">
            {profile.city}, {profile.country} · {profile.role} · {profile.fetish}
          </p>
        </div>
        <div className="rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-gold">
          {profile.status}
        </div>
      </div>

      <div className="mt-6 grid gap-4 rounded-[1.6rem] border border-white/10 bg-black/25 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 text-gold" size={18} />
          <p className="text-sm leading-6 text-white/70">{profile.bio}</p>
        </div>
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-1 text-gold" size={18} />
          <div className="flex flex-wrap gap-2">
            {profile.highlights.map((highlight) => (
              <span
                key={highlight}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/70"
              >
                {highlight}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.36em] text-white/40">
          Intereses Compatibles
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {profile.interests.map((interest) => (
            <span
              key={interest}
              className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-sm text-mist"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-gold px-5 py-3 text-sm font-semibold uppercase tracking-[0.26em] text-black transition hover:brightness-110"
        >
          <MessageSquareMore size={18} />
          Enviar Mensaje
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.26em] text-white/80 transition hover:border-white/20 hover:bg-white/5"
        >
          <HeartHandshake size={18} />
          Guardar Match
        </button>
      </div>
    </section>
  );
}
