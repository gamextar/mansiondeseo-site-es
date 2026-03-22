import { MapPin, ShieldCheck } from 'lucide-react';

export function ProfileCard({ profile, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group glass-panel gold-ring relative w-full overflow-hidden rounded-[1.8rem] text-left transition duration-300 ${
        isSelected
          ? 'scale-[1.01] border-gold/30 bg-white/5 shadow-[0_18px_60px_rgba(212,175,55,0.08)]'
          : 'hover:-translate-y-1 hover:border-white/20 hover:bg-white/5'
      }`}
    >
      <div className="relative h-[22rem] overflow-hidden">
        <img
          src={profile.photo}
          alt={profile.name}
          className={`h-full w-full object-cover transition duration-500 ${
            isSelected ? 'scale-105 blur-0' : 'scale-100 blur-md group-hover:scale-105 group-hover:blur-0'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="rounded-full border border-gold/40 bg-black/50 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-gold">
            {profile.fetish}
          </span>
          <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/75">
            {profile.status}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-3xl leading-none text-white">
                {profile.name}
              </h3>
              <p className="mt-2 text-sm text-white/70">{profile.role}</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              {profile.age}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-gold" />
              <span>
                {profile.city}, {profile.country}
              </span>
            </div>
            <span>{profile.distance}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/50">
          <ShieldCheck size={14} className="text-gold" />
          <span>Perfil Curado</span>
        </div>
        <span className="text-sm font-medium text-gold">
          {isSelected ? 'Viendo perfil' : 'Tocar para revelar'}
        </span>
      </div>
    </button>
  );
}
